"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderReturnRequestSchema, type OrderReturnRequestInput } from "@/lib/validators/business-rules";
import { revalidatePath } from "next/cache";

export interface OrderReturnView {
  id: string;
  customerOrderId: string;
  sellerOrderId: string;
  orderItemId?: string | null;
  shopId: string;
  customerId: string;
  reason: string;
  reasonCategory: string;
  returnShippingPayer: "seller" | "customer" | "undecided";
  requestedRefundMinor: number;
  approvedRefundMinor: number;
  evidenceUrls: string[];
  status: string;
  sellerResponse?: string | null;
  adminNotes?: string | null;
  createdAt: string;
}

/**
 * Server Action: Customer submits a return/refund request for an order item.
 */
export async function createOrderReturnRequestAction(
  payload: OrderReturnRequestInput
): Promise<{ success: boolean; message: string; returnId?: string }> {
  const parsed = orderReturnRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Invalid return request." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  // Determine return shipping cost allocation based on verified business rules:
  // Seller pays if wrong item, defective, damaged in transit, or misleading compatibility.
  // Customer pays if customer selected the wrong part.
  let shippingPayer: "seller" | "customer" | "undecided" = "undecided";
  if (
    parsed.data.reasonCategory === "wrong_item" ||
    parsed.data.reasonCategory === "defective_item" ||
    parsed.data.reasonCategory === "damaged_item" ||
    parsed.data.reasonCategory === "incompatible_item"
  ) {
    shippingPayer = "seller";
  } else if (parsed.data.reasonCategory === "customer_error") {
    shippingPayer = "customer";
  }

  const { data: inserted, error } = await supabase
    .from("order_returns")
    .insert({
      customer_order_id: parsed.data.customerOrderId,
      seller_order_id: parsed.data.sellerOrderId,
      order_item_id: parsed.data.orderItemId || null,
      shop_id: parsed.data.shopId,
      customer_id: user.id,
      reason: parsed.data.reason,
      reason_category: parsed.data.reasonCategory,
      return_shipping_payer: shippingPayer,
      requested_refund_minor: parsed.data.requestedRefundMinor,
      evidence_urls: parsed.data.evidenceUrls || [],
      status: "requested",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { success: false, message: "Failed to submit return request: " + error?.message };
  }

  revalidatePath(`/orders/${parsed.data.customerOrderId}`);
  revalidatePath("/account/orders");
  revalidatePath("/seller/orders");

  return {
    success: true,
    message: "Return request submitted. The vendor has been notified to review your request.",
    returnId: inserted.id,
  };
}

/**
 * Server Action: Seller responds to a customer return request.
 */
export async function sellerRespondToReturnAction(
  returnId: string,
  decision: "seller_accepted" | "seller_rejected",
  responseText: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: returnReq } = await supabase
    .from("order_returns")
    .select("id, shop_id")
    .eq("id", returnId)
    .single();

  if (!returnReq) return { success: false, message: "Return request not found." };

  const { data: isOwner } = await supabase.rpc("owns_shop", { target_shop_id: returnReq.shop_id });
  if (!isOwner) return { success: false, message: "Unauthorized. You do not own this shop." };

  const { error } = await supabase
    .from("order_returns")
    .update({
      status: decision,
      seller_response: responseText.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (error) {
    return { success: false, message: "Failed to update return request." };
  }

  revalidatePath("/seller/orders");
  return { success: true, message: `Return request ${decision === "seller_accepted" ? "accepted" : "declined"}.` };
}

/**
 * Server Action: Platform Admin resolves return dispute and logs financial adjustments.
 */
export async function adminResolveReturnDisputeAction(
  returnId: string,
  decision: "refund_issued" | "rejected",
  approvedRefundMinor: number,
  notes: string
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase.from("user_profiles").select("roles").eq("id", user.id).maybeSingle();
  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized: Admin privileges required." };
  }

  const adminClient = createAdminClient();
  const { data: returnReq } = await adminClient.from("order_returns").select("*").eq("id", returnId).single();
  if (!returnReq) return { success: false, message: "Return request not found." };

  const { error: updErr } = await adminClient
    .from("order_returns")
    .update({
      status: decision,
      approved_refund_minor: decision === "refund_issued" ? approvedRefundMinor : 0,
      admin_notes: notes.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", returnId);

  if (updErr) {
    return { success: false, message: "Failed to update return." };
  }

  // If refund issued, create commission adjustment record
  if (decision === "refund_issued" && approvedRefundMinor > 0) {
    const { data: ledgerItem } = await adminClient
      .from("commission_ledger")
      .select("id, commission_rate_bps")
      .eq("seller_order_id", returnReq.seller_order_id)
      .maybeSingle();

    const rateBps = ledgerItem?.commission_rate_bps || 300;
    const adjustedCommissionMinor = Math.round((approvedRefundMinor * rateBps) / 10000);

    await adminClient.from("commission_adjustments").insert({
      commission_ledger_id: ledgerItem?.id || null,
      shop_id: returnReq.shop_id,
      seller_order_id: returnReq.seller_order_id,
      adjustment_type: "refund_partial",
      amount_minor: -adjustedCommissionMinor,
      reason: `Refund approved on return #${returnReq.id.slice(0, 8)}: ${notes}`,
      admin_id: user.id,
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath("/admin/financials");
  return { success: true, message: `Return dispute resolved (${decision}).` };
}
