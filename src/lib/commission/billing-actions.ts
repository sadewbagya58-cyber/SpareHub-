"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSellerShopProfile } from "@/lib/seller/actions";
import {
  validateCommissionRateBps,
  calculateStatementDeadlines,
  recordCommissionPaymentSchema,
  submitCommissionDisputeSchema,
  type RecordCommissionPaymentInput,
  type SubmitCommissionDisputeInput,
} from "@/lib/validators/business-rules";
import { revalidatePath } from "next/cache";

export interface MonthlyStatementView {
  id: string;
  statementNumber: string;
  shopId: string;
  shopName?: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  gracePeriodEnd: string;
  totalDeliveredSalesMinor: number;
  effectiveCommissionRateBps: number;
  commissionEarnedMinor: number;
  refundAdjustmentsMinor: number;
  disputedAmountMinor: number;
  previousUnpaidBalanceMinor: number;
  paymentsReceivedMinor: number;
  creditsMinor: number;
  totalAmountDueMinor: number;
  undisputedAmountDueMinor: number;
  status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "disputed" | "adjusted";
  issuedAt: string;
  settledAt?: string | null;
}

/**
 * Server Action: Platform Admin proposes a custom commission rate for an individual shop.
 * Enforces 1% to 5% range. Status starts as 'pending_acceptance'.
 */
export async function proposeShopCommissionRateAction(
  shopId: string,
  rateBasisPoints: number,
  ruleName?: string
): Promise<{ success: boolean; message: string; ruleId?: string }> {
  const rateValidation = validateCommissionRateBps(rateBasisPoints);
  if (!rateValidation.valid) {
    return { success: false, message: rateValidation.error || "Invalid commission rate." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).maybeSingle();
  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized. Platform admin privileges required." };
  }

  const adminClient = createAdminClient();
  const { data: shop } = await adminClient.from("shops").select("id, name").eq("id", shopId).maybeSingle();
  if (!shop) return { success: false, message: "Shop not found." };

  const name = ruleName?.trim() || `${shop.name} Custom Rate (${(rateBasisPoints / 100).toFixed(2)}%)`;

  const { data: inserted, error } = await adminClient
    .from("commission_rules")
    .insert({
      name,
      rule_type: "shop_override",
      shop_id: shopId,
      rate_basis_points: rateBasisPoints,
      status: "pending_acceptance",
      proposed_at: new Date().toISOString(),
      is_active: false,
      effective_from: new Date().toISOString(),
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, message: "Failed to propose commission rate: " + error?.message };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_rule.propose_shop_rate",
    target_type: "commission_rules",
    target_id: inserted.id,
    new_values: { shop_id: shopId, rate_basis_points: rateBasisPoints, status: "pending_acceptance" },
  });

  revalidatePath("/admin/commissions");
  revalidatePath("/seller/earnings");
  return {
    success: true,
    message: `Proposed ${(rateBasisPoints / 100).toFixed(2)}% rate submitted. It will become active once accepted by the vendor.`,
    ruleId: inserted.id,
  };
}

/**
 * Server Action: Seller reviews and accepts proposed commission rate.
 * Only upon recorded acceptance does the rate transition to 'active'.
 */
export async function acceptProposedCommissionRateAction(
  ruleId: string,
  shopId: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  // Tenant authorization
  const { data: isOwner } = await supabase.rpc("owns_shop", { target_shop_id: shopId });
  if (!isOwner) return { success: false, message: "Unauthorized. You do not own this shop." };

  const adminClient = createAdminClient();

  const { data: rule, error: fetchErr } = await adminClient
    .from("commission_rules")
    .select("*")
    .eq("id", ruleId)
    .eq("shop_id", shopId)
    .maybeSingle();

  if (fetchErr || !rule) {
    return { success: false, message: "Proposed commission rule not found." };
  }

  if (rule.status !== "pending_acceptance") {
    return { success: false, message: `Rule is not in pending acceptance state (Current: ${rule.status}).` };
  }

  // Supersede previous active shop_overrides
  await adminClient
    .from("commission_rules")
    .update({ status: "superseded", is_active: false })
    .eq("shop_id", shopId)
    .eq("rule_type", "shop_override")
    .eq("status", "active");

  const acceptedAt = new Date().toISOString();
  const { error: updateErr } = await adminClient
    .from("commission_rules")
    .update({
      status: "active",
      is_active: true,
      accepted_at: acceptedAt,
      accepted_by: user.id,
      terms_version: "1.0",
    })
    .eq("id", ruleId);

  if (updateErr) {
    return { success: false, message: "Failed to record acceptance: " + updateErr.message };
  }

  // Record acceptance in seller_policy_acceptances
  await adminClient.from("seller_policy_acceptances").upsert(
    {
      user_id: user.id,
      shop_id: shopId,
      policy_type: "seller_agreement",
      policy_version: "1.0",
      commission_rate_bps: rule.rate_basis_points,
      accepted_at: acceptedAt,
    },
    { onConflict: "shop_id,policy_type,policy_version" }
  );

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_rule.accept_proposed_rate",
    target_type: "commission_rules",
    target_id: ruleId,
    new_values: { shop_id: shopId, rate_basis_points: rule.rate_basis_points, accepted_at: acceptedAt },
  });

  revalidatePath("/seller/earnings");
  revalidatePath("/seller/dashboard");
  revalidatePath("/admin/commissions");

  return {
    success: true,
    message: `Commission rate of ${(rule.rate_basis_points / 100).toFixed(2)}% accepted and activated.`,
  };
}

/**
 * Server Action: Platform Admin generates monthly commission statements for a calendar month.
 * Computes delivered item commissions, due date = 10th of following month, grace period = 17th.
 */
export async function generateMonthlyStatementsAction(
  year: number,
  month: number
): Promise<{ success: boolean; message: string; count?: number }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).maybeSingle();
  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized: Platform admin privileges required." };
  }

  const adminClient = createAdminClient();
  const { periodStart, periodEnd, dueDate, gracePeriodEnd } = calculateStatementDeadlines(year, month);

  // 1. Fetch all shops
  const { data: shops } = await adminClient.from("shops").select("id, name, slug");
  if (!shops || shops.length === 0) {
    return { success: false, message: "No shops found to bill." };
  }

  let generatedCount = 0;

  for (const shop of shops) {
    // 2. Fetch earned commissions for delivered orders in period
    const { data: earnedLedger } = await adminClient
      .from("commission_ledger")
      .select("item_subtotal_minor, commission_amount_minor, commission_rate_bps")
      .eq("shop_id", shop.id)
      .eq("status", "earned")
      .gte("created_at", `${periodStart}T00:00:00.000Z`)
      .lte("created_at", `${periodEnd}T23:59:59.999Z`);

    const deliveredSales = (earnedLedger || []).reduce((acc, row) => acc + Number(row.item_subtotal_minor || 0), 0);
    const commEarned = (earnedLedger || []).reduce((acc, row) => acc + Number(row.commission_amount_minor || 0), 0);

    // Skip shops with 0 delivered sales unless they have previous unpaid balance
    const { data: prevStatement } = await adminClient
      .from("monthly_commission_statements")
      .select("undisputed_amount_due_minor")
      .eq("shop_id", shop.id)
      .order("period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    const prevUnpaid = Math.max(0, Number(prevStatement?.undisputed_amount_due_minor || 0));

    if (deliveredSales === 0 && prevUnpaid === 0) {
      continue;
    }

    const effectiveBps =
      deliveredSales > 0 ? Math.round((commEarned / deliveredSales) * 10000) : 300;

    const totalDue = commEarned + prevUnpaid;
    const padMonth = String(month).padStart(2, "0");
    const stmtNumber = `STM-${year}${padMonth}-${shop.slug.slice(0, 8).toUpperCase()}`;

    await adminClient.from("monthly_commission_statements").upsert(
      {
        statement_number: stmtNumber,
        shop_id: shop.id,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        grace_period_end: gracePeriodEnd,
        total_delivered_sales_minor: deliveredSales,
        effective_commission_rate_bps: effectiveBps,
        commission_earned_minor: commEarned,
        refund_adjustments_minor: 0,
        disputed_amount_minor: 0,
        previous_unpaid_balance_minor: prevUnpaid,
        payments_received_minor: 0,
        credits_minor: 0,
        total_amount_due_minor: totalDue,
        undisputed_amount_due_minor: totalDue,
        status: totalDue === 0 ? "paid" : "issued",
        issued_at: new Date().toISOString(),
      },
      { onConflict: "shop_id,period_start,period_end" }
    );

    generatedCount++;
  }

  revalidatePath("/admin/financials");
  revalidatePath("/admin/commissions");
  revalidatePath("/seller/earnings");

  return {
    success: true,
    message: `Generated ${generatedCount} monthly statement(s) for ${year}-${String(month).padStart(2, "0")}. Due date: ${dueDate}.`,
    count: generatedCount,
  };
}

/**
 * Server Action: Seller fetches their monthly commission statements.
 */
export async function getSellerMonthlyStatementsAction(
  shopIdParam?: string
): Promise<{ success: boolean; statements: MonthlyStatementView[]; error?: string }> {
  const profileRes = await getSellerShopProfile();
  const shop = profileRes?.shop;
  const shopId = shopIdParam || shop?.id;

  if (!shopId) return { success: false, statements: [], error: "No active shop found." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("monthly_commission_statements")
    .select("*")
    .eq("shop_id", shopId)
    .order("period_end", { ascending: false });

  if (error || !data) {
    return { success: false, statements: [], error: "Failed to load statements." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: MonthlyStatementView[] = data.map((r: any) => ({
    id: r.id,
    statementNumber: r.statement_number,
    shopId: r.shop_id,
    periodStart: r.period_start,
    periodEnd: r.period_end,
    dueDate: r.due_date,
    gracePeriodEnd: r.grace_period_end,
    totalDeliveredSalesMinor: Number(r.total_delivered_sales_minor) || 0,
    effectiveCommissionRateBps: Number(r.effective_commission_rate_bps) || 0,
    commissionEarnedMinor: Number(r.commission_earned_minor) || 0,
    refundAdjustmentsMinor: Number(r.refund_adjustments_minor) || 0,
    disputedAmountMinor: Number(r.disputed_amount_minor) || 0,
    previousUnpaidBalanceMinor: Number(r.previous_unpaid_balance_minor) || 0,
    paymentsReceivedMinor: Number(r.payments_received_minor) || 0,
    creditsMinor: Number(r.credits_minor) || 0,
    totalAmountDueMinor: Number(r.total_amount_due_minor) || 0,
    undisputedAmountDueMinor: Number(r.undisputed_amount_due_minor) || 0,
    status: r.status,
    issuedAt: r.issued_at,
    settledAt: r.settled_at,
  }));

  return { success: true, statements };
}

/**
 * Server Action: Platform Admin fetches all monthly commission statements across vendors.
 */
export async function getAdminMonthlyStatementsAction(filters?: {
  status?: string;
  shopId?: string;
}): Promise<{ success: boolean; statements: MonthlyStatementView[]; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, statements: [], error: "Authentication required." };

  let query = supabase
    .from("monthly_commission_statements")
    .select("*, shops:shops(id, name)")
    .order("period_end", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.shopId) {
    query = query.eq("shop_id", filters.shopId);
  }

  const { data, error } = await query;
  if (error || !data) {
    return { success: false, statements: [], error: "Failed to load statements." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const statements: MonthlyStatementView[] = data.map((r: any) => ({
    id: r.id,
    statementNumber: r.statement_number,
    shopId: r.shop_id,
    shopName: r.shops?.name || "Vendor Shop",
    periodStart: r.period_start,
    periodEnd: r.period_end,
    dueDate: r.due_date,
    gracePeriodEnd: r.grace_period_end,
    totalDeliveredSalesMinor: Number(r.total_delivered_sales_minor) || 0,
    effectiveCommissionRateBps: Number(r.effective_commission_rate_bps) || 0,
    commissionEarnedMinor: Number(r.commission_earned_minor) || 0,
    refundAdjustmentsMinor: Number(r.refund_adjustments_minor) || 0,
    disputedAmountMinor: Number(r.disputed_amount_minor) || 0,
    previousUnpaidBalanceMinor: Number(r.previous_unpaid_balance_minor) || 0,
    paymentsReceivedMinor: Number(r.payments_received_minor) || 0,
    creditsMinor: Number(r.credits_minor) || 0,
    totalAmountDueMinor: Number(r.total_amount_due_minor) || 0,
    undisputedAmountDueMinor: Number(r.undisputed_amount_due_minor) || 0,
    status: r.status,
    issuedAt: r.issued_at,
    settledAt: r.settled_at,
  }));

  return { success: true, statements };
}

/**
 * Server Action: Platform Admin records a verified manual bank payment from vendor to SpareHub.
 * Updates payments received, recalculates statement status, and records audit trail.
 */
export async function recordAdminCommissionPaymentAction(
  payload: RecordCommissionPaymentInput
): Promise<{ success: boolean; message: string }> {
  const parsed = recordCommissionPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Invalid payment details." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).maybeSingle();
  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized. Admin privileges required." };
  }

  const adminClient = createAdminClient();

  // 1. Fetch statement
  const { data: stmt, error: fErr } = await adminClient
    .from("monthly_commission_statements")
    .select("*")
    .eq("id", parsed.data.statementId)
    .single();

  if (fErr || !stmt) return { success: false, message: "Statement not found." };

  // 2. Insert verified commission payment record
  const { error: insErr } = await adminClient.from("commission_payments").insert({
    statement_id: parsed.data.statementId,
    shop_id: parsed.data.shopId,
    amount_minor: parsed.data.amountMinor,
    payment_method: parsed.data.paymentMethod,
    payment_reference: parsed.data.paymentReference,
    payment_date: parsed.data.paymentDate,
    verified_by: user.id,
    verification_notes: parsed.data.verificationNotes || null,
  });

  if (insErr) {
    return { success: false, message: "Failed to record payment: " + insErr.message };
  }

  // 3. Recalculate statement balances
  const newReceived = Number(stmt.payments_received_minor || 0) + parsed.data.amountMinor;
  const totalDue = Number(stmt.total_amount_due_minor || 0);
  const disputed = Number(stmt.disputed_amount_minor || 0);
  const newUndisputed = Math.max(0, totalDue - newReceived - disputed);

  let newStatus = stmt.status;
  if (newReceived >= totalDue) {
    newStatus = "paid";
  } else if (newReceived > 0) {
    newStatus = "partially_paid";
  }

  await adminClient
    .from("monthly_commission_statements")
    .update({
      payments_received_minor: newReceived,
      undisputed_amount_due_minor: newUndisputed,
      status: newStatus,
      settled_at: newStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", stmt.id);

  // 4. Audit Log
  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_billing.record_payment",
    target_type: "monthly_commission_statements",
    target_id: stmt.id,
    new_values: {
      amount_minor: parsed.data.amountMinor,
      payment_reference: parsed.data.paymentReference,
      new_status: newStatus,
    },
  });

  revalidatePath("/admin/financials");
  revalidatePath("/seller/earnings");

  return { success: true, message: `Verified payment of LKR ${(parsed.data.amountMinor / 100).toFixed(2)} recorded.` };
}

/**
 * Server Action: Seller raises a dispute on a monthly statement.
 * Holds disputed amount from overdue enforcement.
 */
export async function submitCommissionDisputeAction(
  payload: SubmitCommissionDisputeInput
): Promise<{ success: boolean; message: string }> {
  const parsed = submitCommissionDisputeSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Invalid dispute details." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: isOwner } = await supabase.rpc("owns_shop", { target_shop_id: parsed.data.shopId });
  if (!isOwner) return { success: false, message: "Unauthorized: You do not own this shop." };

  const adminClient = createAdminClient();

  const { error: insErr } = await adminClient.from("commission_disputes").insert({
    statement_id: parsed.data.statementId || null,
    shop_id: parsed.data.shopId,
    seller_order_id: parsed.data.sellerOrderId || null,
    disputed_amount_minor: parsed.data.disputedAmountMinor,
    reason: parsed.data.reason,
    evidence_urls: parsed.data.evidenceUrls || [],
    status: "pending",
  });

  if (insErr) {
    return { success: false, message: "Failed to submit dispute: " + insErr.message };
  }

  // If tied to statement, adjust disputed amount and status
  if (parsed.data.statementId) {
    const { data: stmt } = await adminClient
      .from("monthly_commission_statements")
      .select("*")
      .eq("id", parsed.data.statementId)
      .single();

    if (stmt) {
      const newDisputed = Number(stmt.disputed_amount_minor || 0) + parsed.data.disputedAmountMinor;
      const totalDue = Number(stmt.total_amount_due_minor || 0);
      const received = Number(stmt.payments_received_minor || 0);
      const newUndisputed = Math.max(0, totalDue - received - newDisputed);

      await adminClient
        .from("monthly_commission_statements")
        .update({
          disputed_amount_minor: newDisputed,
          undisputed_amount_due_minor: newUndisputed,
          status: "disputed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", stmt.id);
    }
  }

  revalidatePath("/seller/earnings");
  return {
    success: true,
    message: "Dispute submitted successfully. Disputed amount is held pending administrative review.",
  };
}

/**
 * Server Action: Platform Admin applies or clears overdue restrictions on non-compliant shops.
 */
export async function toggleShopRestrictionsAction(
  shopId: string,
  restrictions: { publishingRestricted: boolean; ordersRestricted: boolean; reason?: string }
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).maybeSingle();
  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized. Admin privileges required." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("shops")
    .update({
      publishing_restricted: restrictions.publishingRestricted,
      orders_restricted: restrictions.ordersRestricted,
      restriction_reason: restrictions.reason || null,
      restricted_at: restrictions.publishingRestricted || restrictions.ordersRestricted ? new Date().toISOString() : null,
      restricted_by: restrictions.publishingRestricted || restrictions.ordersRestricted ? user.id : null,
    })
    .eq("id", shopId);

  if (error) {
    return { success: false, message: "Failed to update shop restrictions: " + error.message };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "shop.update_restrictions",
    target_type: "shops",
    target_id: shopId,
    new_values: restrictions,
  });

  revalidatePath("/admin/dashboard");
  revalidatePath("/admin/commissions");
  revalidatePath("/seller/dashboard");

  return { success: true, message: "Shop restrictions updated successfully." };
}
