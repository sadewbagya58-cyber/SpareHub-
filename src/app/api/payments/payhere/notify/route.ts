import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPayHereChecksum } from "@/lib/payments/payhere";

/**
 * PayHere Server-to-Server Webhook Handler
 * Safe, idempotent, signature-verified payment confirmation.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const merchantId = formData.get("merchant_id")?.toString() || "";
    const orderId = formData.get("order_id")?.toString() || "";
    const paymentId = formData.get("payment_id")?.toString() || "";
    const payhereAmount = formData.get("payhere_amount")?.toString() || "";
    const payhereCurrency = formData.get("payhere_currency")?.toString() || "LKR";
    const statusCode = formData.get("status_code")?.toString() || "";
    const receivedMd5sig = formData.get("md5sig")?.toString() || "";

    if (!merchantId || !orderId || !paymentId || !receivedMd5sig) {
      return NextResponse.json({ error: "Missing required webhook parameters." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // 1. Look up the shop payment gateway credentials
    const { data: gateway } = await adminClient
      .from("shop_payment_gateways")
      .select("merchant_secret, shop_id")
      .eq("merchant_id", merchantId)
      .eq("is_enabled", true)
      .maybeSingle();

    if (!gateway?.merchant_secret) {
      console.warn("PayHere webhook: Unknown or disabled merchant ID:", merchantId);
      return NextResponse.json({ error: "Merchant not configured or active." }, { status: 401 });
    }

    // 2. Validate cryptographic checksum
    const isValidSignature = verifyPayHereChecksum({
      merchantId,
      merchantSecret: gateway.merchant_secret,
      orderId,
      payhereAmount,
      payhereCurrency,
      statusCode,
      receivedMd5sig,
    });

    if (!isValidSignature) {
      console.error("PayHere webhook: Invalid signature checksum for order:", orderId);
      return NextResponse.json({ error: "Invalid signature checksum." }, { status: 403 });
    }

    // 3. Idempotency Check: Prevent duplicate webhook processing
    const idempotencyKey = `payhere_${paymentId}`;
    const { data: existingPayment } = await adminClient
      .from("payment_records")
      .select("id, status")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (existingPayment) {
      // Already processed idempotently
      return NextResponse.json({ message: "Payment notification already processed." }, { status: 200 });
    }

    // 4. Find the matching customer_order
    const { data: customerOrder } = await adminClient
      .from("customer_orders")
      .select("id, total_grand_minor, payment_status")
      .or(`id.eq.${orderId},order_number.eq.${orderId}`)
      .maybeSingle();

    if (!customerOrder) {
      console.warn("PayHere webhook: Order not found:", orderId);
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    // Convert amount to minor units (LKR 100.00 -> 10000)
    const amountMinor = Math.round(parseFloat(payhereAmount) * 100);
    const paymentStatus = statusCode === "2" ? "successful" : statusCode === "0" ? "pending" : "failed";

    // 5. Insert payment record
    await adminClient.from("payment_records").insert({
      customer_order_id: customerOrder.id,
      gateway_provider: "payhere",
      gateway_reference: paymentId,
      idempotency_key: idempotencyKey,
      amount_minor: amountMinor,
      currency: payhereCurrency,
      status: paymentStatus,
      raw_payload: Object.fromEntries(formData.entries()),
    });

    // 6. Update order status if payment successful
    if (statusCode === "2") {
      await adminClient
        .from("customer_orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", customerOrder.id);

      await adminClient
        .from("seller_orders")
        .update({
          payment_status: "paid",
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("customer_order_id", customerOrder.id);
    }

    return NextResponse.json({ success: true, message: "Payment notification processed." });
  } catch (err: unknown) {
    console.error("PayHere webhook processing error:", err);
    return NextResponse.json(
      { error: "Internal processing error: " + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    );
  }
}
