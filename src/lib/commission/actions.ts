"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { revalidatePath } from "next/cache";
import type {
  CommissionRuleItem,
  CommissionLedgerItem,
  SellerEarningsSummary,
  AdminFinancialsSummary,
} from "@/lib/types";

/**
 * Server Action: Platform Admin fetches all configured commission rules.
 */
export async function getCommissionRulesAction(): Promise<{
  rules: CommissionRuleItem[];
  success: boolean;
  message?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { rules: [], success: false, message: "Authentication required." };
  }

  // Admin verification
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { rules: [], success: false, message: "Unauthorized: Admin privileges required." };
  }

  const { data, error } = await supabase
    .from("commission_rules")
    .select(`
      id,
      name,
      rule_type,
      category_id,
      shop_id,
      rate_basis_points,
      effective_from,
      effective_until,
      is_active,
      created_at,
      categories:categories (id, name),
      shops:shops (id, name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching commission rules:", error);
    return { rules: [], success: false, message: "Failed to load commission rules." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rules: CommissionRuleItem[] = data.map((row: any) => ({
    id: row.id,
    name: row.name,
    ruleType: row.rule_type,
    categoryId: row.category_id,
    categoryName: row.categories?.name || null,
    shopId: row.shop_id,
    shopName: row.shops?.name || null,
    rateBasisPoints: Number(row.rate_basis_points) || 0,
    effectiveFrom: row.effective_from,
    effectiveUntil: row.effective_until,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
  }));

  return { rules, success: true };
}

/**
 * Server Action: Platform Admin fetches category and shop dropdown choices for rule creation.
 */
export async function getCommissionRuleFormOptionsAction(): Promise<{
  categories: { id: string; name: string }[];
  shops: { id: string; name: string }[];
}> {
  const supabase = await createServerSupabaseClient();
  const [catRes, shopRes] = await Promise.all([
    supabase.from("categories").select("id, name").order("name"),
    supabase.from("shops").select("id, name").order("name"),
  ]);

  return {
    categories: (catRes.data || []).map((c) => ({ id: c.id, name: c.name })),
    shops: (shopRes.data || []).map((s) => ({ id: s.id, name: s.name })),
  };
}

/**
 * Server Action: Platform Admin creates a new commission rule.
 */
export async function createCommissionRuleAction(payload: {
  name: string;
  ruleType: "platform_default" | "category_override" | "shop_override";
  rateBasisPoints: number;
  categoryId?: string | null;
  shopId?: string | null;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
}): Promise<{ success: boolean; message: string; ruleId?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized. Platform admin privileges required." };
  }

  const name = (payload.name || "").trim();
  if (name.length < 3 || name.length > 100) {
    return { success: false, message: "Rule name must be between 3 and 100 characters." };
  }

  const rateBps = Math.round(Number(payload.rateBasisPoints));
  if (isNaN(rateBps) || rateBps < 0 || rateBps > 10000) {
    return {
      success: false,
      message: "Commission rate must be between 0 and 10000 basis points (0.00% to 100.00%).",
    };
  }

  if (payload.ruleType === "category_override" && !payload.categoryId) {
    return { success: false, message: "Category must be selected for Category Override rules." };
  }

  if (payload.ruleType === "shop_override" && !payload.shopId) {
    return { success: false, message: "Vendor Shop must be selected for Shop Override rules." };
  }

  const effectiveFrom = payload.effectiveFrom
    ? new Date(payload.effectiveFrom).toISOString()
    : new Date().toISOString();
  const effectiveUntil = payload.effectiveUntil
    ? new Date(payload.effectiveUntil).toISOString()
    : null;

  if (effectiveUntil && new Date(effectiveUntil) <= new Date(effectiveFrom)) {
    return { success: false, message: "Expiration date must be later than effective start date." };
  }

  const adminClient = createAdminClient();

  const { data: inserted, error: insErr } = await adminClient
    .from("commission_rules")
    .insert({
      name,
      rule_type: payload.ruleType,
      category_id: payload.ruleType === "category_override" ? payload.categoryId : null,
      shop_id: payload.ruleType === "shop_override" ? payload.shopId : null,
      rate_basis_points: rateBps,
      effective_from: effectiveFrom,
      effective_until: effectiveUntil,
      is_active: true,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (insErr || !inserted) {
    console.error("Error creating commission rule:", insErr);
    return { success: false, message: "Failed to create commission rule." };
  }

  // Record audit log
  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_rule.create",
    target_type: "commission_rule",
    target_id: inserted.id,
    new_values: {
      name,
      rule_type: payload.ruleType,
      rate_basis_points: rateBps,
      category_id: payload.categoryId,
      shop_id: payload.shopId,
    },
  });

  revalidatePath("/admin/commissions");
  return { success: true, message: "Commission rule created successfully.", ruleId: inserted.id };
}

/**
 * Server Action: Platform Admin toggles or updates a commission rule.
 */
export async function toggleCommissionRuleAction(
  ruleId: string,
  isActive: boolean
): Promise<{ success: boolean; message: string }> {
  if (!ruleId) return { success: false, message: "Invalid rule identifier." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("commission_rules")
    .update({ is_active: isActive })
    .eq("id", ruleId);

  if (error) {
    return { success: false, message: "Failed to update commission rule status." };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: isActive ? "commission_rule.activate" : "commission_rule.deactivate",
    target_type: "commission_rule",
    target_id: ruleId,
    new_values: { is_active: isActive },
  });

  revalidatePath("/admin/commissions");
  return { success: true, message: `Rule ${isActive ? "activated" : "deactivated"} successfully.` };
}

/**
 * Server Action: Platform Admin deletes a commission rule.
 */
export async function deleteCommissionRuleAction(
  ruleId: string
): Promise<{ success: boolean; message: string }> {
  if (!ruleId) return { success: false, message: "Invalid rule identifier." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("commission_rules").delete().eq("id", ruleId);

  if (error) {
    return { success: false, message: "Failed to delete rule." };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_rule.delete",
    target_type: "commission_rule",
    target_id: ruleId,
  });

  revalidatePath("/admin/commissions");
  return { success: true, message: "Commission rule deleted." };
}

/**
 * Server Action: Seller fetches their own shop's financial earnings & ledger breakdown.
 */
export async function getSellerEarningsAction(): Promise<{
  summary: SellerEarningsSummary;
  ledger: CommissionLedgerItem[];
  shopId?: string;
  shopName?: string;
  success: boolean;
  message?: string;
}> {
  const defaultSummary: SellerEarningsSummary = {
    totalGrossSalesMinor: 0,
    totalCommissionMinor: 0,
    netEarningsMinor: 0,
    availableBalanceMinor: 0,
    pendingClearanceMinor: 0,
    settledPayoutsMinor: 0,
    cancelledMinor: 0,
    totalOrdersCount: 0,
  };

  const [supabase, sellerData] = await Promise.all([
    createServerSupabaseClient(),
    getSellerShopProfile(),
  ]);

  if (!sellerData || !sellerData.user) {
    return { summary: defaultSummary, ledger: [], success: false, message: "Authentication required." };
  }

  const shop = sellerData.shop;
  if (!shop) {
    return { summary: defaultSummary, ledger: [], success: false, message: "No active shop found." };
  }

  // Fetch all commission ledger rows for this shop
  const { data: ledgerRows, error } = await supabase
    .from("commission_ledger")
    .select(`
      id,
      seller_order_id,
      order_item_id,
      shop_id,
      applied_rule_id,
      item_subtotal_minor,
      commission_rate_bps,
      commission_amount_minor,
      seller_net_earning_minor,
      status,
      payout_reference,
      settled_at,
      created_at,
      seller_orders:seller_orders (
        sub_order_number
      ),
      order_items:order_items (
        product_title_snapshot,
        product_part_number_snapshot
      ),
      commission_rules:commission_rules (
        name
      )
    `)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  if (error || !ledgerRows) {
    console.error("Error fetching seller earnings ledger:", error);
    return {
      summary: defaultSummary,
      ledger: [],
      shopId: shop.id,
      shopName: shop.name,
      success: false,
      message: "Failed to load earnings records.",
    };
  }

  let totalGross = 0;
  let totalComm = 0;
  let totalNet = 0;
  let available = 0;
  let pending = 0;
  let settled = 0;
  let cancelled = 0;
  const uniqueOrders = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledger: CommissionLedgerItem[] = ledgerRows.map((r: any) => {
    const gross = Number(r.item_subtotal_minor) || 0;
    const comm = Number(r.commission_amount_minor) || 0;
    const net = Number(r.seller_net_earning_minor) || 0;
    uniqueOrders.add(r.seller_order_id);

    if (r.status === "earned") {
      available += net;
      totalGross += gross;
      totalComm += comm;
      totalNet += net;
    } else if (r.status === "accrued") {
      pending += net;
      totalGross += gross;
      totalComm += comm;
      totalNet += net;
    } else if (r.status === "settled") {
      settled += net;
      totalGross += gross;
      totalComm += comm;
      totalNet += net;
    } else if (r.status === "cancelled" || r.status === "refunded") {
      cancelled += gross;
    }

    return {
      id: r.id,
      sellerOrderId: r.seller_order_id,
      subOrderNumber: r.seller_orders?.sub_order_number,
      orderItemId: r.order_item_id,
      productTitle: r.order_items?.product_title_snapshot,
      productPartNumber: r.order_items?.product_part_number_snapshot,
      shopId: r.shop_id,
      shopName: shop.name,
      appliedRuleId: r.applied_rule_id,
      appliedRuleName: r.commission_rules?.name || "Marketplace Default",
      itemSubtotalMinor: gross,
      commissionRateBps: Number(r.commission_rate_bps) || 0,
      commissionAmountMinor: comm,
      sellerNetEarningMinor: net,
      status: r.status,
      payoutReference: r.payout_reference,
      settledAt: r.settled_at,
      createdAt: r.created_at,
    };
  });

  const summary: SellerEarningsSummary = {
    totalGrossSalesMinor: totalGross,
    totalCommissionMinor: totalComm,
    netEarningsMinor: totalNet,
    availableBalanceMinor: available,
    pendingClearanceMinor: pending,
    settledPayoutsMinor: settled,
    cancelledMinor: cancelled,
    totalOrdersCount: uniqueOrders.size,
  };

  return {
    summary,
    ledger,
    shopId: shop.id,
    shopName: shop.name,
    success: true,
  };
}

/**
 * Server Action: Platform Admin fetches marketplace-wide financial ledger and summaries.
 */
export async function getAdminFinancialsAction(filters?: {
  status?: string;
  shopId?: string;
  query?: string;
}): Promise<{
  summary: AdminFinancialsSummary;
  ledger: CommissionLedgerItem[];
  success: boolean;
  message?: string;
}> {
  const defaultSummary: AdminFinancialsSummary = {
    totalGrossGmvMinor: 0,
    totalPlatformRevenueMinor: 0,
    totalEarnedRevenueMinor: 0,
    pendingSellerPayoutsMinor: 0,
    totalSettledPayoutsMinor: 0,
    totalLedgerCount: 0,
  };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { summary: defaultSummary, ledger: [], success: false, message: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { summary: defaultSummary, ledger: [], success: false, message: "Unauthorized." };
  }

  let dbQuery = supabase
    .from("commission_ledger")
    .select(`
      id,
      seller_order_id,
      order_item_id,
      shop_id,
      applied_rule_id,
      item_subtotal_minor,
      commission_rate_bps,
      commission_amount_minor,
      seller_net_earning_minor,
      status,
      payout_reference,
      settled_at,
      created_at,
      shops:shops (id, name),
      seller_orders:seller_orders (sub_order_number),
      order_items:order_items (product_title_snapshot, product_part_number_snapshot),
      commission_rules:commission_rules (name)
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    dbQuery = dbQuery.eq("status", filters.status);
  }

  if (filters?.shopId && filters.shopId !== "all") {
    dbQuery = dbQuery.eq("shop_id", filters.shopId);
  }

  const { data, count, error } = await dbQuery;

  if (error || !data) {
    console.error("Error fetching admin financials:", error);
    return { summary: defaultSummary, ledger: [], success: false, message: "Failed to load financial records." };
  }

  let totalGmv = 0;
  let totalPlatformRevenue = 0;
  let totalEarnedRevenue = 0;
  let pendingSellerPayouts = 0;
  let totalSettledPayouts = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ledger: CommissionLedgerItem[] = data.map((r: any) => {
    const gross = Number(r.item_subtotal_minor) || 0;
    const comm = Number(r.commission_amount_minor) || 0;
    const net = Number(r.seller_net_earning_minor) || 0;

    if (r.status !== "cancelled" && r.status !== "refunded") {
      totalGmv += gross;
      totalPlatformRevenue += comm;
    }

    if (r.status === "earned") {
      totalEarnedRevenue += comm;
      pendingSellerPayouts += net;
    } else if (r.status === "settled") {
      totalEarnedRevenue += comm;
      totalSettledPayouts += net;
    }

    return {
      id: r.id,
      sellerOrderId: r.seller_order_id,
      subOrderNumber: r.seller_orders?.sub_order_number,
      orderItemId: r.order_item_id,
      productTitle: r.order_items?.product_title_snapshot,
      productPartNumber: r.order_items?.product_part_number_snapshot,
      shopId: r.shop_id,
      shopName: r.shops?.name || "Merchant",
      appliedRuleId: r.applied_rule_id,
      appliedRuleName: r.commission_rules?.name || "Marketplace Default",
      itemSubtotalMinor: gross,
      commissionRateBps: Number(r.commission_rate_bps) || 0,
      commissionAmountMinor: comm,
      sellerNetEarningMinor: net,
      status: r.status,
      payoutReference: r.payout_reference,
      settledAt: r.settled_at,
      createdAt: r.created_at,
    };
  });

  const summary: AdminFinancialsSummary = {
    totalGrossGmvMinor: totalGmv,
    totalPlatformRevenueMinor: totalPlatformRevenue,
    totalEarnedRevenueMinor: totalEarnedRevenue,
    pendingSellerPayoutsMinor: pendingSellerPayouts,
    totalSettledPayoutsMinor: totalSettledPayouts,
    totalLedgerCount: count ?? ledger.length,
  };

  return { summary, ledger, success: true };
}

/**
 * Server Action: Platform Admin settles a single commission ledger record.
 */
export async function settleCommissionLedgerAction(
  ledgerId: string,
  payoutReference: string
): Promise<{ success: boolean; message: string }> {
  if (!ledgerId) return { success: false, message: "Invalid ledger entry ID." };
  const ref = (payoutReference || "").trim();
  if (ref.length < 3) {
    return { success: false, message: "Please provide a valid payout transaction reference (at least 3 characters)." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized." };
  }

  const adminClient = createAdminClient();

  // Verify record is in 'earned' status
  const { data: entry, error: fErr } = await adminClient
    .from("commission_ledger")
    .select("id, status, shop_id, seller_net_earning_minor")
    .eq("id", ledgerId)
    .single();

  if (fErr || !entry) return { success: false, message: "Ledger entry not found." };
  if (entry.status !== "earned") {
    return {
      success: false,
      message: `Only earned earnings can be settled. Current status is "${entry.status}".`,
    };
  }

  const settledAt = new Date().toISOString();
  const { error: updErr } = await adminClient
    .from("commission_ledger")
    .update({
      status: "settled",
      payout_reference: ref,
      settled_at: settledAt,
    })
    .eq("id", ledgerId);

  if (updErr) {
    return { success: false, message: "Failed to settle ledger record." };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_ledger.settle",
    target_type: "commission_ledger",
    target_id: ledgerId,
    new_values: { payout_reference: ref, settled_at: settledAt },
  });

  revalidatePath("/admin/financials");
  revalidatePath("/seller/earnings");
  return { success: true, message: "Payout recorded as settled." };
}

/**
 * Server Action: Platform Admin bulk-settles all earned records for a specific vendor shop.
 */
export async function bulkSettleShopEarningsAction(
  shopId: string,
  payoutReference: string
): Promise<{ success: boolean; message: string; settledCount?: number }> {
  if (!shopId) return { success: false, message: "Invalid shop identifier." };
  const ref = (payoutReference || "").trim();
  if (ref.length < 3) {
    return { success: false, message: "Please provide a valid payout reference (at least 3 characters)." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized." };
  }

  const adminClient = createAdminClient();
  const settledAt = new Date().toISOString();

  const { data: updated, error } = await adminClient
    .from("commission_ledger")
    .update({
      status: "settled",
      payout_reference: ref,
      settled_at: settledAt,
    })
    .eq("shop_id", shopId)
    .eq("status", "earned")
    .select("id");

  if (error) {
    return { success: false, message: "Failed to execute bulk settlement." };
  }

  const count = updated?.length || 0;
  if (count === 0) {
    return { success: false, message: "No eligible 'earned' earnings found for this shop." };
  }

  await adminClient.from("admin_audit_logs").insert({
    actor_id: user.id,
    action: "commission_ledger.bulk_settle",
    target_type: "shop",
    target_id: shopId,
    new_values: { payout_reference: ref, settled_count: count, settled_at: settledAt },
  });

  revalidatePath("/admin/financials");
  revalidatePath("/seller/earnings");
  return {
    success: true,
    message: `Successfully settled ${count} earned ledger records with reference "${ref}".`,
    settledCount: count,
  };
}
