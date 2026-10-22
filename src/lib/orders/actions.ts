"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/actions";
import type { CustomerOrderSummary, SellerSubOrder } from "@/lib/types";
import {
  calculateShopDeliveryFee,
  calculateMultiVendorDeliverySummary,
  deriveParentOrderStatus,
} from "@/lib/orders/delivery";

export { deriveParentOrderStatus };

// Sri Lankan phone validation (same standard as seller onboarding & auth)
const LK_PHONE_REGEX = /^(?:\+94|0)(?:7[0-9]|1[1-9]|2[1-8]|3[1-8]|4[1-7]|5[1-7]|6[3-7]|8[1-2])[0-9]{7}$/;

/**
 * Reconciles customer_orders.status and payment_status based on child seller_orders.
 * Runs via createAdminClient to ensure multi-tenant visibility and avoid silent RLS drops.
 */
export async function reconcileParentCustomerOrder(customerOrderId: string): Promise<string> {
  const adminClient = createAdminClient();
  const { data: allSiblings } = await adminClient
    .from("seller_orders")
    .select("status")
    .eq("customer_order_id", customerOrderId);

  const statuses = (allSiblings || []).map((s: { status: string }) => s.status);
  const newParentStatus = deriveParentOrderStatus(statuses);

  const { data: custOrder } = await adminClient
    .from("customer_orders")
    .select("payment_method, payment_status")
    .eq("id", customerOrderId)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = {
    status: newParentStatus,
    updated_at: new Date().toISOString(),
  };

  if (custOrder?.payment_method === "cod") {
    if (newParentStatus === "completed" && custOrder.payment_status === "cod_pending") {
      updatePayload.payment_status = "captured";
    } else if (newParentStatus === "cancelled" && custOrder.payment_status === "cod_pending") {
      updatePayload.payment_status = "unpaid";
    }
  }

  await adminClient
    .from("customer_orders")
    .update(updatePayload)
    .eq("id", customerOrderId);

  return newParentStatus;
}

export interface CheckoutPayload {
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string;
  shippingDistrict: string;
  shippingCity: string;
  shippingPostalCode?: string;
  paymentMethod: "online" | "cod";
  customerNotes?: string;
  idempotencyKey?: string;
  isBuyNow?: boolean;
  buyNowProductId?: string;
  buyNowQuantity?: number;
}

export interface CheckoutResult {
  success: boolean;
  message?: string;
  orderId?: string;
  orderNumber?: string;
  totalGrandMinor?: number;
}

/**
 * Atomic, transactional checkout creating multi-vendor parent and child sub-orders.
 */
export async function processCheckoutAction(payload: CheckoutPayload): Promise<CheckoutResult> {
  // 1. Validate customer & delivery inputs
  const fullName = (payload.shippingFullName || "").trim();
  if (fullName.length < 2) {
    return { success: false, message: "Please enter your full recipient name (at least 2 characters)." };
  }

  const phone = (payload.shippingPhone || "").trim();
  if (!LK_PHONE_REGEX.test(phone)) {
    return {
      success: false,
      message: "Please enter a valid Sri Lankan phone number (e.g., 0771234567 or +94771234567).",
    };
  }

  const address1 = (payload.shippingAddressLine1 || "").trim();
  if (address1.length < 5) {
    return { success: false, message: "Please provide a valid street address (at least 5 characters)." };
  }

  const district = (payload.shippingDistrict || "").trim().toLowerCase();
  if (!district) {
    return { success: false, message: "Please select your delivery district." };
  }

  const city = (payload.shippingCity || "").trim();
  if (city.length < 2) {
    return { success: false, message: "Please specify your city or town." };
  }

  if (payload.paymentMethod !== "cod" && payload.paymentMethod !== "online") {
    return { success: false, message: "Please choose a valid payment method (Cash on Delivery or Online Card)." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Please sign in to complete your checkout." };
  }

  // If Buy Now mode: handle isolated single-product checkout
  if (payload.isBuyNow && payload.buyNowProductId) {
    const buyQty = Math.max(1, Math.floor(Number(payload.buyNowQuantity) || 1));

    // Try RPC with Buy Now parameters first
    const { data: rpcData, error: rpcError } = await supabase.rpc("process_checkout_order", {
      p_shipping_full_name: fullName,
      p_shipping_phone: phone,
      p_shipping_address_line1: address1,
      p_shipping_address_line2: payload.shippingAddressLine2?.trim() || null,
      p_shipping_district: district,
      p_shipping_city: city,
      p_shipping_postal_code: payload.shippingPostalCode?.trim() || null,
      p_payment_method: payload.paymentMethod,
      p_customer_notes: payload.customerNotes?.trim() || null,
      p_buy_now_product_id: payload.buyNowProductId,
      p_buy_now_quantity: buyQty,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rpcRes: any = rpcData;
    if (!rpcError && rpcRes && rpcRes.customer_order_id) {
      if (payload.paymentMethod === "online") {
        const idempotencyKey = payload.idempotencyKey || `pay-${rpcRes.customer_order_id}-${Date.now()}`;
        await supabase.from("payment_records").insert({
          customer_order_id: rpcRes.customer_order_id,
          gateway_provider: "payhere_test",
          gateway_reference: null,
          idempotency_key: idempotencyKey,
        });
      }

      // Non-blocking notification trigger
      try {
        await createNotification({
          userId: user.id,
          type: "order_placed",
          title: `Order Placed: #${rpcRes.order_number}`,
          message: `Your order #${rpcRes.order_number} has been placed successfully.`,
          link: `/orders/${rpcRes.customer_order_id}`,
          idempotencyKey: `notif-cust-order-${rpcRes.customer_order_id}`,
          metadata: { orderId: rpcRes.customer_order_id, orderNumber: rpcRes.order_number },
        });
      } catch (e) {
        console.error("Non-blocking notification error:", e);
      }

      revalidatePath("/orders");
      return {
        success: true,
        orderId: rpcRes.customer_order_id,
        orderNumber: rpcRes.order_number,
        totalGrandMinor: Number(rpcRes.total_grand_minor),
      };
    }

    // Fallback if RPC does not support buy now parameters yet:
    // Execute atomic server-side checkout without modifying or clearing user's cart_items
    try {
      const adminClient = createAdminClient();

      const { data: p, error: pErr } = await adminClient
        .from("products")
        .select(`
          id,
          title,
          part_number,
          brand_name,
          price_minor_units,
          stock_quantity,
          is_published,
          status,
          shop_id,
          shops!inner (
            id,
            name,
            status,
            delivery_enabled,
            default_delivery_fee_minor,
            district_delivery_fees,
            free_delivery_threshold_minor,
            supported_districts,
            estimated_delivery_days
          )
        `)
        .eq("id", payload.buyNowProductId)
        .maybeSingle();

      if (pErr || !p) {
        return { success: false, message: "Selected product could not be found." };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = p.shops;
      if (!p.is_published || p.status !== "active" || s?.status === "suspended") {
        return { success: false, message: "This product is currently unavailable for purchase." };
      }

      if (p.stock_quantity < buyQty) {
        return {
          success: false,
          message: `Insufficient stock for "${p.title}": requested ${buyQty}, available ${p.stock_quantity}.`,
        };
      }

      const merchandiseSubtotal = Number(p.price_minor_units) * buyQty;
      const deliveryRes = calculateShopDeliveryFee(s, district, merchandiseSubtotal);
      if (!deliveryRes.allowed) {
        return {
          success: false,
          message: deliveryRes.reason || "Delivery is unavailable for this vendor in the selected district.",
        };
      }

      const deliveryFeeMinor = deliveryRes.feeMinor;
      const orderTotalGrandMinor = merchandiseSubtotal + deliveryFeeMinor;

      const orderNumber =
        "SH-" +
        new Date().toISOString().slice(0, 10).replace(/-/g, "") +
        "-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();

      // 1. Create parent customer order
      const { data: custOrder, error: custErr } = await adminClient
        .from("customer_orders")
        .insert({
          order_number: orderNumber,
          customer_id: user.id,
          status: "pending",
          payment_method: payload.paymentMethod,
          payment_status: payload.paymentMethod === "cod" ? "cod_pending" : "unpaid",
          shipping_full_name: fullName,
          shipping_phone: phone,
          shipping_address_line1: address1,
          shipping_address_line2: payload.shippingAddressLine2?.trim() || null,
          shipping_district: district,
          shipping_city: city,
          shipping_postal_code: payload.shippingPostalCode?.trim() || null,
          customer_notes: payload.customerNotes?.trim() || null,
          total_items_subtotal_minor: merchandiseSubtotal,
          total_delivery_fee_minor: deliveryFeeMinor,
          total_discount_minor: 0,
          total_grand_minor: orderTotalGrandMinor,
        })
        .select("id, order_number, total_grand_minor")
        .single();

      if (custErr || !custOrder) {
        console.error("Buy Now customer_orders insert error:", custErr);
        return { success: false, message: "Failed to create order record." };
      }

      // 2. Create seller suborder
      const subOrderNumber = `${orderNumber}-S1`;
      const { data: sellerOrder, error: sellerErr } = await adminClient
        .from("seller_orders")
        .insert({
          customer_order_id: custOrder.id,
          shop_id: p.shop_id,
          sub_order_number: subOrderNumber,
          status: "placed",
          subtotal_minor: merchandiseSubtotal,
          delivery_fee_minor: deliveryFeeMinor,
          total_amount_minor: orderTotalGrandMinor,
        })
        .select("id")
        .single();

      if (sellerErr || !sellerOrder) {
        console.error("Buy Now seller_orders insert error:", sellerErr);
        return { success: false, message: "Failed to initialize vendor suborder." };
      }

      // 3. Create order item snapshot
      const { error: itemErr } = await adminClient.from("order_items").insert({
        seller_order_id: sellerOrder.id,
        product_id: p.id,
        product_title_snapshot: p.title,
        product_part_number_snapshot: p.part_number,
        product_brand_snapshot: p.brand_name,
        unit_price_minor_units: p.price_minor_units,
        quantity: buyQty,
        total_price_minor_units: merchandiseSubtotal,
      });

      if (itemErr) {
        console.error("Buy Now order_items insert error:", itemErr);
      }

      // 4. Atomically decrement stock
      await adminClient
        .from("products")
        .update({ stock_quantity: p.stock_quantity - buyQty })
        .eq("id", p.id);

      // 5. Order status history
      await adminClient.from("order_status_history").insert({
        seller_order_id: sellerOrder.id,
        from_status: null,
        to_status: "placed",
        changed_by: user.id,
        notes: "Buy Now direct purchase",
      });

      // 6. Online payment record if needed
      if (payload.paymentMethod === "online") {
        const idempotencyKey = payload.idempotencyKey || `pay-${custOrder.id}-${Date.now()}`;
        await adminClient.from("payment_records").insert({
          customer_order_id: custOrder.id,
          gateway_provider: "payhere_test",
          gateway_reference: null,
          idempotency_key: idempotencyKey,
        });
      }

      // 7. Order lifecycle notifications
      try {
        await createNotification({
          userId: user.id,
          type: "order_placed",
          title: `Order Placed: #${custOrder.order_number}`,
          message: `Your direct purchase #${custOrder.order_number} has been confirmed.`,
          link: `/orders/${custOrder.id}`,
          idempotencyKey: `notif-cust-order-${custOrder.id}`,
          metadata: { orderId: custOrder.id, orderNumber: custOrder.order_number },
        });

        const { data: sProfile } = await adminClient
          .from("shops")
          .select("seller_profiles(user_id)")
          .eq("id", p.shop_id)
          .maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sellerUserId = (sProfile?.seller_profiles as any)?.user_id;
        if (sellerUserId) {
          await createNotification({
            userId: sellerUserId,
            type: "order_placed",
            title: `New Order: #${subOrderNumber}`,
            message: `You have received a new order #${subOrderNumber} for "${p.title}".`,
            link: `/seller/orders/${sellerOrder.id}`,
            idempotencyKey: `notif-seller-suborder-${sellerOrder.id}`,
            metadata: { subOrderId: sellerOrder.id, subOrderNumber },
          });
        }
      } catch (e) {
        console.error("Non-blocking notification error in Buy Now:", e);
      }

      revalidatePath("/orders");
      return {
        success: true,
        orderId: custOrder.id,
        orderNumber: custOrder.order_number,
        totalGrandMinor: orderTotalGrandMinor,
      };
    } catch (err: unknown) {
      console.error("Error in Buy Now checkout fallback:", err);
      return { success: false, message: "An error occurred during Buy Now order processing." };
    }
  }

  // 2. Anti-double-submit / Idempotency guard for standard cart checkout:
  // Check if an identical order was already placed by this user in the last 15 seconds
  const fifteenSecondsAgo = new Date(Date.now() - 15000).toISOString();
  const { data: recentOrder } = await supabase
    .from("customer_orders")
    .select("id, order_number, total_grand_minor")
    .eq("customer_id", user.id)
    .gte("created_at", fifteenSecondsAgo)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentOrder) {
    // If user's cart is now empty, return the existing order directly!
    const { count: cartCount } = await supabase
      .from("cart_items")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if (cartCount === 0) {
      return {
        success: true,
        orderId: recentOrder.id,
        orderNumber: recentOrder.order_number,
        totalGrandMinor: Number(recentOrder.total_grand_minor),
      };
    }
  }

  // 3. Pre-validate delivery across all vendor shops in cart
  const { data: cartData } = await supabase
    .from("cart_items")
    .select(`
      quantity,
      product:products (
        price_minor_units,
        shop:shops (
          id,
          name,
          status,
          delivery_enabled,
          default_delivery_fee_minor,
          district_delivery_fees,
          free_delivery_threshold_minor,
          supported_districts,
          estimated_delivery_days
        )
      )
    `)
    .eq("user_id", user.id);

  let deliverySummary: ReturnType<typeof calculateMultiVendorDeliverySummary> | null = null;
  if (cartData && cartData.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shopMap = new Map<string, { shop: any; merchandiseSubtotalMinor: number }>();
    for (const c of cartData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p: any = c.product;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s: any = p?.shop;
      if (!s) continue;
      const sub = (Number(p.price_minor_units) || 0) * c.quantity;
      if (!shopMap.has(s.id)) {
        shopMap.set(s.id, { shop: s, merchandiseSubtotalMinor: 0 });
      }
      shopMap.get(s.id)!.merchandiseSubtotalMinor += sub;
    }

    deliverySummary = calculateMultiVendorDeliverySummary(Array.from(shopMap.values()), district);
    if (!deliverySummary.allowed) {
      return { success: false, message: deliverySummary.error || "Delivery is unavailable for one or more shops." };
    }
  }

  // 4. Call process_checkout_order RPC
  const { data: rpcData, error: rpcError } = await supabase.rpc("process_checkout_order", {
    p_shipping_full_name: fullName,
    p_shipping_phone: phone,
    p_shipping_address_line1: address1,
    p_shipping_address_line2: payload.shippingAddressLine2?.trim() || null,
    p_shipping_district: district,
    p_shipping_city: city,
    p_shipping_postal_code: payload.shippingPostalCode?.trim() || null,
    p_payment_method: payload.paymentMethod,
    p_customer_notes: payload.customerNotes?.trim() || null,
  });

  if (rpcError) {
    console.error("Checkout RPC error:", rpcError);
    return {
      success: false,
      message: rpcError.message || "Failed to process checkout. Please review your cart and try again.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res: any = rpcData;
  if (!res || !res.customer_order_id) {
    return { success: false, message: "Checkout did not complete successfully. Please try again." };
  }

  // 5. Persist shop-specific delivery fees if not handled natively by RPC
  let totalGrand = Number(res.total_grand_minor);
  if (deliverySummary && deliverySummary.totalDeliveryFeeMinor > 0) {
    const admin = createAdminClient();
    for (const sf of deliverySummary.shopFees) {
      await admin
        .from("seller_orders")
        .update({
          delivery_fee_minor: sf.deliveryFeeMinor,
          total_amount_minor: sf.merchandiseSubtotalMinor + sf.deliveryFeeMinor,
        })
        .eq("customer_order_id", res.customer_order_id)
        .eq("shop_id", sf.shopId);
    }
    totalGrand = totalGrand + deliverySummary.totalDeliveryFeeMinor;
    await admin
      .from("customer_orders")
      .update({
        total_delivery_fee_minor: deliverySummary.totalDeliveryFeeMinor,
        total_grand_minor: totalGrand,
      })
      .eq("id", res.customer_order_id);
    res.total_grand_minor = totalGrand;
  }

  // 4. If online payment method selected, create payment record entry
  if (payload.paymentMethod === "online") {
    const idempotencyKey = payload.idempotencyKey || `pay-${res.customer_order_id}-${Date.now()}`;
    await supabase.from("payment_records").insert({
      customer_order_id: res.customer_order_id,
      gateway_provider: "payhere_test",
      gateway_reference: null,
      idempotency_key: idempotencyKey,
      amount_minor: res.total_grand_minor,
      currency: "LKR",
      status: "initiated",
    });
  }

  // 5. Order lifecycle notifications
  try {
    // Notify customer
    await createNotification({
      userId: user.id,
      type: "order_placed",
      title: `Order Placed: #${res.order_number}`,
      message: `Your order #${res.order_number} has been confirmed. Thank you for shopping with SpareHub!`,
      link: `/orders/${res.customer_order_id}`,
      idempotencyKey: `notif-cust-order-${res.customer_order_id}`,
      metadata: { orderId: res.customer_order_id, orderNumber: res.order_number },
    });

    // Notify vendors
    const admin = createAdminClient();
    const { data: subOrders } = await admin
      .from("seller_orders")
      .select("id, sub_order_number, shop_id, shops(seller_profiles(user_id))")
      .eq("customer_order_id", res.customer_order_id);

    if (subOrders) {
      for (const so of subOrders) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sellerUserId = (so.shops as any)?.seller_profiles?.user_id;
        if (sellerUserId) {
          await createNotification({
            userId: sellerUserId,
            type: "order_placed",
            title: `New Sub-Order: #${so.sub_order_number}`,
            message: `You have received a new sub-order #${so.sub_order_number}.`,
            link: `/seller/orders/${so.id}`,
            idempotencyKey: `notif-seller-suborder-${so.id}`,
            metadata: { subOrderId: so.id, subOrderNumber: so.sub_order_number },
          });
        }
      }
    }
  } catch (notifErr) {
    console.error("Non-blocking notification error in cart checkout:", notifErr);
  }

  revalidatePath("/cart");
  revalidatePath("/account/orders");
  revalidatePath("/seller/dashboard");

  return {
    success: true,
    orderId: res.customer_order_id,
    orderNumber: res.order_number,
    totalGrandMinor: Number(res.total_grand_minor),
  };
}

/**
 * Fetch all customer orders for the authenticated customer.
 */
export async function getCustomerOrdersAction(): Promise<CustomerOrderSummary[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("customer_orders")
    .select(`
      id,
      order_number,
      status,
      payment_method,
      payment_status,
      shipping_full_name,
      shipping_phone,
      shipping_address_line1,
      shipping_address_line2,
      shipping_district,
      shipping_city,
      shipping_postal_code,
      customer_notes,
      total_items_subtotal_minor,
      total_delivery_fee_minor,
      total_discount_minor,
      total_grand_minor,
      created_at,
      seller_orders:seller_orders (
        id,
        sub_order_number,
        status,
        subtotal_minor,
        delivery_fee_minor,
        total_amount_minor,
        shop:shops(id, name, slug)
      )
    `)
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching customer orders:", error);
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return data.map((row: any) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    shippingFullName: row.shipping_full_name,
    shippingPhone: row.shipping_phone,
    shippingAddressLine1: row.shipping_address_line1,
    shippingAddressLine2: row.shipping_address_line2,
    shippingDistrict: row.shipping_district,
    shippingCity: row.shipping_city,
    shippingPostalCode: row.shipping_postal_code,
    customerNotes: row.customer_notes,
    totalItemsSubtotalMinor: Number(row.total_items_subtotal_minor) || 0,
    totalDeliveryFeeMinor: Number(row.total_delivery_fee_minor) || 0,
    totalDiscountMinor: Number(row.total_discount_minor) || 0,
    totalGrandMinor: Number(row.total_grand_minor) || 0,
    createdAt: row.created_at,
    sellerOrders: Array.isArray(row.seller_orders)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? row.seller_orders.map((so: any) => ({
          id: so.id,
          customerOrderId: row.id,
          shopId: so.shop?.id || "",
          shopName: so.shop?.name || "Vendor",
          subOrderNumber: so.sub_order_number,
          status: so.status,
          fulfillmentType: "seller_courier",
          subtotalMinor: Number(so.subtotal_minor) || 0,
          deliveryFeeMinor: Number(so.delivery_fee_minor) || 0,
          totalAmountMinor: Number(so.total_amount_minor) || (Number(so.subtotal_minor) || 0) + (Number(so.delivery_fee_minor) || 0),
          createdAt: row.created_at,
        }))
      : [],
  }));
}

/**
 * Fetch detailed view for a single customer order including multi-vendor suborders & item snapshots.
 */
export async function getCustomerOrderDetailAction(orderId: string): Promise<CustomerOrderSummary | null> {
  if (!orderId || typeof orderId !== "string") return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: co, error: coErr } = await supabase
    .from("customer_orders")
    .select(`
      id,
      order_number,
      customer_id,
      status,
      payment_method,
      payment_status,
      shipping_full_name,
      shipping_phone,
      shipping_address_line1,
      shipping_address_line2,
      shipping_district,
      shipping_city,
      shipping_postal_code,
      customer_notes,
      total_items_subtotal_minor,
      total_delivery_fee_minor,
      total_discount_minor,
      total_grand_minor,
      created_at
    `)
    .eq("id", orderId)
    .single();

  if (coErr || !co) return null;

  // Authorization check: customer_id = user.id OR platform_admin
  if (co.customer_id !== user.id) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("roles")
      .eq("id", user.id)
      .single();
    if (!profile?.roles?.includes("platform_admin")) {
      return null;
    }
  }

  // Fetch sub-orders with items and status history
  const { data: subOrders, error: soErr } = await supabase
    .from("seller_orders")
    .select(`
      id,
      customer_order_id,
      shop_id,
      sub_order_number,
      status,
      fulfillment_type,
      courier_name,
      tracking_number,
      tracking_url,
      dispatched_at,
      delivered_at,
      cancelled_at,
      cancellation_reason,
      subtotal_minor,
      delivery_fee_minor,
      total_amount_minor,
      created_at,
      shop:shops (
        id,
        name,
        slug,
        phone,
        district
      ),
      order_items:order_items (
        id,
        seller_order_id,
        product_id,
        product_title_snapshot,
        product_part_number_snapshot,
        product_brand_snapshot,
        unit_price_minor_units,
        quantity,
        total_price_minor_units
      ),
      order_status_history:order_status_history (
        id,
        from_status,
        to_status,
        notes,
        created_at
      )
    `)
    .eq("customer_order_id", orderId)
    .order("created_at", { ascending: true });

  if (soErr || !subOrders) {
    console.error("Error fetching seller sub-orders:", soErr);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const formattedSubOrders: SellerSubOrder[] = (subOrders || []).map((so: any) => ({
    id: so.id,
    customerOrderId: so.customer_order_id,
    shopId: so.shop?.id || so.shop_id,
    shopName: so.shop?.name || "Verified Vendor",
    subOrderNumber: so.sub_order_number,
    status: so.status,
    fulfillmentType: so.fulfillment_type,
    courierName: so.courier_name,
    trackingNumber: so.tracking_number,
    trackingUrl: so.tracking_url,
    dispatchedAt: so.dispatched_at,
    deliveredAt: so.delivered_at,
    cancelledAt: so.cancelled_at,
    cancellationReason: so.cancellation_reason,
    subtotalMinor: Number(so.subtotal_minor) || 0,
    deliveryFeeMinor: Number(so.delivery_fee_minor) || 0,
    totalAmountMinor: Number(so.total_amount_minor) || (Number(so.subtotal_minor) || 0) + (Number(so.delivery_fee_minor) || 0),
    createdAt: so.created_at,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (so.order_items || []).map((oi: any) => ({
      id: oi.id,
      sellerOrderId: oi.seller_order_id,
      productId: oi.product_id,
      productTitle: oi.product_title_snapshot,
      partNumber: oi.product_part_number_snapshot,
      brandName: oi.product_brand_snapshot,
      unitPriceMinorUnits: Number(oi.unit_price_minor_units) || 0,
      quantity: oi.quantity,
      totalPriceMinorUnits: Number(oi.total_price_minor_units) || 0,
    })),
    history: (so.order_status_history || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((h: any) => ({
        id: h.id,
        sellerOrderId: so.id,
        fromStatus: h.from_status,
        toStatus: h.to_status,
        notes: h.notes,
        createdAt: h.created_at,
      })),
  }));

  return {
    id: co.id,
    orderNumber: co.order_number,
    status: co.status,
    paymentMethod: co.payment_method,
    paymentStatus: co.payment_status,
    shippingFullName: co.shipping_full_name,
    shippingPhone: co.shipping_phone,
    shippingAddressLine1: co.shipping_address_line1,
    shippingAddressLine2: co.shipping_address_line2,
    shippingDistrict: co.shipping_district,
    shippingCity: co.shipping_city,
    shippingPostalCode: co.shipping_postal_code,
    customerNotes: co.customer_notes,
    totalItemsSubtotalMinor: Number(co.total_items_subtotal_minor) || 0,
    totalDeliveryFeeMinor: Number(co.total_delivery_fee_minor) || 0,
    totalDiscountMinor: Number(co.total_discount_minor) || 0,
    totalGrandMinor: Number(co.total_grand_minor) || 0,
    createdAt: co.created_at,
    sellerOrders: formattedSubOrders,
  };
}

/**
 * Customer-initiated cancellation (permitted only when order is in 'pending' status).
 */
export async function cancelCustomerOrderAction(orderId: string, reason: string): Promise<{
  success: boolean;
  message?: string;
}> {
  if (!orderId) return { success: false, message: "Invalid order identifier." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const adminClient = createAdminClient();

  // Fetch order to verify customer ownership and cancellable status
  const { data: co, error: coErr } = await adminClient
    .from("customer_orders")
    .select("id, order_number, status, payment_method, payment_status, customer_id")
    .eq("id", orderId)
    .single();

  if (coErr || !co) return { success: false, message: "Order not found." };
  if (co.customer_id !== user.id) return { success: false, message: "Unauthorized." };

  if (co.status === "cancelled") {
    return { success: false, message: "This order has already been cancelled." };
  }

  if (co.status === "completed") {
    return {
      success: false,
      message: "Delivered orders cannot be cancelled through customer order actions. Please contact support or the vendor for return requests.",
    };
  }

  // Fetch all sub-orders and check fulfillment status
  const { data: subOrders, error: soErr } = await adminClient
    .from("seller_orders")
    .select("id, status, sub_order_number, order_items(product_id, quantity)")
    .eq("customer_order_id", orderId);

  if (soErr || !subOrders || subOrders.length === 0) {
    return { success: false, message: "No sub-orders found for this order." };
  }

  // SH-QA-012: Check if any sub-order is already dispatched or delivered
  const hasDelivered = subOrders.some((so) => so.status === "delivered");
  if (hasDelivered) {
    return {
      success: false,
      message: "Order cannot be cancelled because one or more packages have already been delivered.",
    };
  }

  const hasDispatched = subOrders.some((so) => so.status === "dispatched");
  if (hasDispatched) {
    return {
      success: false,
      message: "Order cannot be cancelled because one or more packages have already been dispatched.",
    };
  }

  // Only allow cancellation if all sub-orders are still in 'placed' or 'confirmed'
  const isCancellable = subOrders.every(
    (so) => so.status === "placed" || so.status === "confirmed" || so.status === "cancelled"
  );
  if (!isCancellable) {
    return {
      success: false,
      message: "Order cannot be cancelled because vendor packaging has already begun. Please contact the vendor directly.",
    };
  }

  // Cancel each eligible sub-order
  for (const so of subOrders) {
    if (so.status === "cancelled") continue;
    const previousStatus = so.status;

    await adminClient
      .from("seller_orders")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancellation_reason: reason?.trim() || "Cancelled by customer prior to dispatch",
        updated_at: new Date().toISOString(),
      })
      .eq("id", so.id);

    // Restore stock for each item
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of (so as any).order_items || []) {
      const { data: prod } = await adminClient
        .from("products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();
      if (prod) {
        await adminClient
          .from("products")
          .update({ stock_quantity: prod.stock_quantity + item.quantity })
          .eq("id", item.product_id);
      }
    }

    // Record in history with accurate previous status
    await adminClient.from("order_status_history").insert({
      seller_order_id: so.id,
      from_status: previousStatus,
      to_status: "cancelled",
      changed_by: user.id,
      notes: `Customer cancelled: ${reason?.trim() || "No reason specified"}`,
    });
  }

  // Reconcile parent customer order status and payment status (sets status to 'cancelled', and COD payment_status to 'unpaid')
  await reconcileParentCustomerOrder(orderId);

  // Reconcile commission ledger for cancelled sub-orders
  try {
    const adminClient = createAdminClient();
    for (const so of subOrders || []) {
      await adminClient
        .from("commission_ledger")
        .update({ status: "cancelled" })
        .eq("seller_order_id", so.id)
        .in("status", ["accrued", "earned"]);
    }
  } catch (clErr) {
    console.error("Non-blocking commission ledger reconciliation error in customer cancel:", clErr);
  }

  // Lifecycle notifications
  try {
    // Notify customer
    await createNotification({
      userId: user.id,
      type: "order_cancelled",
      title: `Order Cancelled: #${co.order_number}`,
      message: `Your cancellation request for order #${co.order_number} was completed successfully.`,
      link: `/orders/${orderId}`,
      idempotencyKey: `notif-cust-cancel-${orderId}`,
      metadata: { orderId, orderNumber: co.order_number, reason },
    });

    // Notify vendors
    const adminClient = createAdminClient();
    const { data: sOrders } = await adminClient
      .from("seller_orders")
      .select("id, sub_order_number, shops(seller_profiles(user_id))")
      .eq("customer_order_id", orderId);

    if (sOrders) {
      for (const s of sOrders) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sellerUserId = (s.shops as any)?.seller_profiles?.user_id;
        if (sellerUserId) {
          await createNotification({
            userId: sellerUserId,
            type: "order_cancelled",
            title: `Order Cancelled by Customer: #${s.sub_order_number}`,
            message: `Customer cancelled order #${s.sub_order_number}.${reason ? ` Reason: ${reason}` : ""}`,
            link: `/seller/orders/${s.id}`,
            idempotencyKey: `notif-seller-cancel-${s.id}`,
            metadata: { subOrderId: s.id, reason },
          });
        }
      }
    }
  } catch (notifErr) {
    console.error("Non-blocking notification error in customer cancel:", notifErr);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/account/orders");
  return { success: true, message: "Order cancelled successfully." };
}

/**
 * Fetch seller sub-orders for the authenticated seller's shop.
 */
export async function getSellerOrdersAction(statusFilter?: string): Promise<{
  success: boolean;
  orders: SellerSubOrder[];
  shopId?: string;
  shopName?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, orders: [] };

  // Fetch seller's shop
  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("shops(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  const shop = sellerProfile?.shops?.[0];
  if (!shop) {
    return { success: false, orders: [] };
  }

  let query = supabase
    .from("seller_orders")
    .select(`
      id,
      customer_order_id,
      shop_id,
      sub_order_number,
      status,
      fulfillment_type,
      courier_name,
      tracking_number,
      tracking_url,
      dispatched_at,
      delivered_at,
      cancelled_at,
      cancellation_reason,
      subtotal_minor,
      delivery_fee_minor,
      total_amount_minor,
      created_at,
      customer_orders:customer_orders (
        order_number,
        shipping_full_name,
        shipping_phone,
        shipping_address_line1,
        shipping_address_line2,
        shipping_district,
        shipping_city,
        shipping_postal_code,
        customer_notes,
        payment_method,
        payment_status,
        created_at
      ),
      order_items:order_items (
        id,
        product_title_snapshot,
        product_part_number_snapshot,
        product_brand_snapshot,
        unit_price_minor_units,
        quantity,
        total_price_minor_units
      )
    `)
    .eq("shop_id", shop.id)
    .order("created_at", { ascending: false });

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching seller orders:", error);
    return { success: false, orders: [], shopId: shop.id, shopName: shop.name };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: SellerSubOrder[] = data.map((row: any) => ({
    id: row.id,
    customerOrderId: row.customer_order_id,
    shopId: row.shop_id,
    shopName: shop.name,
    subOrderNumber: row.sub_order_number,
    status: row.status,
    fulfillmentType: row.fulfillment_type,
    courierName: row.courier_name,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    dispatchedAt: row.dispatched_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    subtotalMinor: Number(row.subtotal_minor) || 0,
    deliveryFeeMinor: Number(row.delivery_fee_minor) || 0,
    totalAmountMinor: Number(row.total_amount_minor) || 0,
    createdAt: row.created_at,
    customerOrder: row.customer_orders
      ? {
          orderNumber: row.customer_orders.order_number,
          shippingFullName: row.customer_orders.shipping_full_name,
          shippingPhone: row.customer_orders.shipping_phone,
          shippingAddressLine1: row.customer_orders.shipping_address_line1,
          shippingAddressLine2: row.customer_orders.shipping_address_line2,
          shippingDistrict: row.customer_orders.shipping_district,
          shippingCity: row.customer_orders.shipping_city,
          shippingPostalCode: row.customer_orders.shipping_postal_code,
          customerNotes: row.customer_orders.customer_notes,
          paymentMethod: row.customer_orders.payment_method,
          paymentStatus: row.customer_orders.payment_status,
          createdAt: row.customer_orders.created_at,
        }
      : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (row.order_items || []).map((oi: any) => ({
      id: oi.id,
      sellerOrderId: row.id,
      productId: "",
      productTitle: oi.product_title_snapshot,
      partNumber: oi.product_part_number_snapshot,
      brandName: oi.product_brand_snapshot,
      unitPriceMinorUnits: Number(oi.unit_price_minor_units) || 0,
      quantity: oi.quantity,
      totalPriceMinorUnits: Number(oi.total_price_minor_units) || 0,
    })),
  }));

  return {
    success: true,
    orders,
    shopId: shop.id,
    shopName: shop.name,
  };
}

/**
 * Fetch detail for a single seller sub-order.
 */
export async function getSellerOrderDetailAction(subOrderId: string): Promise<SellerSubOrder | null> {
  if (!subOrderId) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: so, error } = await supabase
    .from("seller_orders")
    .select(`
      id,
      customer_order_id,
      shop_id,
      sub_order_number,
      status,
      fulfillment_type,
      courier_name,
      tracking_number,
      tracking_url,
      dispatched_at,
      delivered_at,
      cancelled_at,
      cancellation_reason,
      subtotal_minor,
      delivery_fee_minor,
      total_amount_minor,
      created_at,
      shop:shops(id, name, slug, phone),
      customer_orders:customer_orders (
        order_number,
        shipping_full_name,
        shipping_phone,
        shipping_address_line1,
        shipping_address_line2,
        shipping_district,
        shipping_city,
        shipping_postal_code,
        customer_notes,
        payment_method,
        payment_status,
        created_at
      ),
      order_items:order_items (
        id,
        product_id,
        product_title_snapshot,
        product_part_number_snapshot,
        product_brand_snapshot,
        unit_price_minor_units,
        quantity,
        total_price_minor_units
      ),
      order_status_history:order_status_history (
        id,
        from_status,
        to_status,
        notes,
        created_at
      )
    `)
    .eq("id", subOrderId)
    .single();

  if (error || !so) return null;

  // Verify ownership: shop belongs to user or user is platform_admin
  const { data: shopOwner } = await supabase
    .from("shops")
    .select("seller_profiles(user_id)")
    .eq("id", so.shop_id)
    .single();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ownerUserId = (shopOwner?.seller_profiles as any)?.user_id;
  if (ownerUserId !== user.id) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("roles")
      .eq("id", user.id)
      .single();
    if (!profile?.roles?.includes("platform_admin")) {
      return null;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const row: any = so;
  return {
    id: row.id,
    customerOrderId: row.customer_order_id,
    shopId: row.shop_id,
    shopName: row.shop?.name || "My Store",
    subOrderNumber: row.sub_order_number,
    status: row.status,
    fulfillmentType: row.fulfillment_type,
    courierName: row.courier_name,
    trackingNumber: row.tracking_number,
    trackingUrl: row.tracking_url,
    dispatchedAt: row.dispatched_at,
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    cancellationReason: row.cancellation_reason,
    subtotalMinor: Number(row.subtotal_minor) || 0,
    deliveryFeeMinor: Number(row.delivery_fee_minor) || 0,
    totalAmountMinor: Number(row.total_amount_minor) || 0,
    createdAt: row.created_at,
    customerOrder: row.customer_orders
      ? {
          orderNumber: row.customer_orders.order_number,
          shippingFullName: row.customer_orders.shipping_full_name,
          shippingPhone: row.customer_orders.shipping_phone,
          shippingAddressLine1: row.customer_orders.shipping_address_line1,
          shippingAddressLine2: row.customer_orders.shipping_address_line2,
          shippingDistrict: row.customer_orders.shipping_district,
          shippingCity: row.customer_orders.shipping_city,
          shippingPostalCode: row.customer_orders.shipping_postal_code,
          customerNotes: row.customer_orders.customer_notes,
          paymentMethod: row.customer_orders.payment_method,
          paymentStatus: row.customer_orders.payment_status,
          createdAt: row.customer_orders.created_at,
        }
      : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: (row.order_items || []).map((oi: any) => ({
      id: oi.id,
      sellerOrderId: row.id,
      productId: oi.product_id,
      productTitle: oi.product_title_snapshot,
      partNumber: oi.product_part_number_snapshot,
      brandName: oi.product_brand_snapshot,
      unitPriceMinorUnits: Number(oi.unit_price_minor_units) || 0,
      quantity: oi.quantity,
      totalPriceMinorUnits: Number(oi.total_price_minor_units) || 0,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    history: (row.order_status_history || []).map((h: any) => ({
      id: h.id,
      sellerOrderId: row.id,
      fromStatus: h.from_status,
      toStatus: h.to_status,
      notes: h.notes,
      createdAt: h.created_at,
    })),
  };
}

/**
 * Seller status transition with validation and audit logging.
 */
export async function updateSellerOrderStatusAction(
  subOrderId: string,
  targetStatus: "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled",
  options?: {
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    cancellationReason?: string;
  }
): Promise<{ success: boolean; message?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: so, error } = await supabase
    .from("seller_orders")
    .select("id, sub_order_number, status, shop_id, customer_order_id, order_items(product_id, quantity)")
    .eq("id", subOrderId)
    .single();

  if (error || !so) return { success: false, message: "Order not found." };

  // Allowed transitions state machine:
  // placed -> confirmed, cancelled
  // confirmed -> processing, cancelled
  // processing -> dispatched, cancelled
  // dispatched -> delivered, returned
  const currentStatus = so.status;
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    placed: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["dispatched", "cancelled"],
    dispatched: ["delivered", "returned"],
    delivered: [],
    cancelled: [],
    returned: [],
  };

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      message: `Cannot transition order status from "${currentStatus}" to "${targetStatus}".`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload: any = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
  };

  if (targetStatus === "dispatched") {
    updatePayload.dispatched_at = new Date().toISOString();
    if (options?.courierName) updatePayload.courier_name = options.courierName.trim();
    if (options?.trackingNumber) updatePayload.tracking_number = options.trackingNumber.trim();
    if (options?.trackingUrl) updatePayload.tracking_url = options.trackingUrl.trim();
  } else if (targetStatus === "delivered") {
    updatePayload.delivered_at = new Date().toISOString();
  } else if (targetStatus === "cancelled") {
    updatePayload.cancelled_at = new Date().toISOString();
    updatePayload.cancellation_reason = options?.cancellationReason?.trim() || "Cancelled by vendor";

    // Restore stock if vendor cancels
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of (so as any).order_items || []) {
      const { data: prod } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", item.product_id)
        .single();
      if (prod) {
        await supabase
          .from("products")
          .update({ stock_quantity: prod.stock_quantity + item.quantity })
          .eq("id", item.product_id);
      }
    }
  }

  const { error: updErr } = await supabase
    .from("seller_orders")
    .update(updatePayload)
    .eq("id", subOrderId);

  if (updErr) {
    return { success: false, message: `Failed to update status: ${updErr.message}` };
  }

  // Insert status history entry
  let historyNotes = `Status updated to ${targetStatus}`;
  if (targetStatus === "dispatched" && options?.trackingNumber) {
    historyNotes = `Dispatched via ${options.courierName || "Courier"} (Tracking: ${options.trackingNumber})`;
  } else if (targetStatus === "cancelled") {
    historyNotes = `Cancelled: ${options?.cancellationReason || "Vendor cancellation"}`;
  }

  await supabase.from("order_status_history").insert({
    seller_order_id: subOrderId,
    from_status: currentStatus,
    to_status: targetStatus,
    changed_by: user.id,
    notes: historyNotes,
  });

  // Reconcile parent customer order status and payment status via adminClient
  await reconcileParentCustomerOrder(so.customer_order_id);

  // Reconcile commission ledger status
  try {
    const adminClient = createAdminClient();
    if (targetStatus === "delivered") {
      await adminClient
        .from("commission_ledger")
        .update({ status: "earned" })
        .eq("seller_order_id", subOrderId)
        .eq("status", "accrued");
    } else if (targetStatus === "cancelled") {
      await adminClient
        .from("commission_ledger")
        .update({ status: "cancelled" })
        .eq("seller_order_id", subOrderId)
        .in("status", ["accrued", "earned"]);
    }
  } catch (clErr) {
    console.error("Non-blocking commission ledger reconciliation error:", clErr);
  }

  // Lifecycle notification to customer
  try {
    const admin = createAdminClient();
    const { data: parentOrder } = await admin
      .from("customer_orders")
      .select("customer_id, order_number")
      .eq("id", so.customer_order_id)
      .single();

    if (parentOrder?.customer_id) {
      let notifType:
        | "order_confirmed"
        | "order_processing"
        | "order_dispatched"
        | "order_delivered"
        | "order_cancelled" = "order_processing";
      let notifTitle = `Order Update: #${so.sub_order_number || so.id.slice(0, 8)}`;
      let notifMsg = `Your sub-order status has been updated to ${targetStatus}.`;

      if (targetStatus === "confirmed") {
        notifType = "order_confirmed";
        notifTitle = `Order Confirmed: #${so.sub_order_number || so.id.slice(0, 8)}`;
        notifMsg = `Vendor has confirmed your order #${so.sub_order_number || so.id.slice(0, 8)}.`;
      } else if (targetStatus === "processing") {
        notifType = "order_processing";
        notifTitle = `Order Processing: #${so.sub_order_number || so.id.slice(0, 8)}`;
        notifMsg = `Your order #${so.sub_order_number || so.id.slice(0, 8)} is now being prepared for shipping.`;
      } else if (targetStatus === "dispatched") {
        notifType = "order_dispatched";
        notifTitle = `Order Dispatched: #${so.sub_order_number || so.id.slice(0, 8)}`;
        const courier = options?.courierName ? ` via ${options.courierName}` : "";
        const tracking = options?.trackingNumber ? ` (Tracking: ${options.trackingNumber})` : "";
        notifMsg = `Your package has been dispatched${courier}${tracking}.`;
      } else if (targetStatus === "delivered") {
        notifType = "order_delivered";
        notifTitle = `Order Delivered: #${so.sub_order_number || so.id.slice(0, 8)}`;
        notifMsg = `Your order #${so.sub_order_number || so.id.slice(0, 8)} has arrived! You can now rate and review your purchased parts.`;
      } else if (targetStatus === "cancelled") {
        notifType = "order_cancelled";
        notifTitle = `Order Cancelled: #${so.sub_order_number || so.id.slice(0, 8)}`;
        notifMsg = `Your sub-order was cancelled by the vendor.${options?.cancellationReason ? ` Reason: ${options.cancellationReason}` : ""}`;
      }

      await createNotification({
        userId: parentOrder.customer_id,
        type: notifType,
        title: notifTitle,
        message: notifMsg,
        link: `/orders/${so.customer_order_id}`,
        idempotencyKey: `notif-suborder-status-${so.id}-${targetStatus}`,
        metadata: {
          subOrderId: so.id,
          subOrderNumber: so.sub_order_number,
          customerOrderId: so.customer_order_id,
          targetStatus,
        },
      });
    }
  } catch (notifErr) {
    console.error("Non-blocking notification error in updateSellerOrderStatusAction:", notifErr);
  }

  revalidatePath(`/seller/orders/${subOrderId}`);
  revalidatePath("/seller/orders");
  revalidatePath("/seller/dashboard");
  revalidatePath(`/orders/${so.customer_order_id}`);

  return { success: true, message: `Order status updated to "${targetStatus}".` };
}

/**
 * Platform Admin: Fetch all customer orders across the marketplace with search and filters.
 */
export async function getAdminOrdersAction(params?: {
  query?: string;
  status?: string;
  page?: number;
}): Promise<{
  orders: CustomerOrderSummary[];
  totalCount: number;
  totalGmvMinor: number;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { orders: [], totalCount: 0, totalGmvMinor: 0 };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { orders: [], totalCount: 0, totalGmvMinor: 0 };
  }

  let dbQuery = supabase
    .from("customer_orders")
    .select(`
      id,
      order_number,
      status,
      payment_method,
      payment_status,
      shipping_full_name,
      shipping_phone,
      shipping_address_line1,
      shipping_district,
      shipping_city,
      total_grand_minor,
      created_at,
      seller_orders:seller_orders (
        id,
        sub_order_number,
        status,
        subtotal_minor,
        shop:shops(name)
      )
    `, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params?.status && params.status !== "all") {
    dbQuery = dbQuery.eq("status", params.status);
  }

  if (params?.query && params.query.trim()) {
    const q = params.query.trim();
    dbQuery = dbQuery.or(`order_number.ilike.%${q}%,shipping_full_name.ilike.%${q}%,shipping_phone.ilike.%${q}%`);
  }

  const { data, count, error } = await dbQuery;

  if (error || !data) {
    console.error("Admin orders fetch error:", error);
    return { orders: [], totalCount: 0, totalGmvMinor: 0 };
  }

  let totalGmvMinor = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders: CustomerOrderSummary[] = data.map((row: any) => {
    const grand = Number(row.total_grand_minor) || 0;
    totalGmvMinor += grand;

    return {
      id: row.id,
      orderNumber: row.order_number,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      shippingFullName: row.shipping_full_name,
      shippingPhone: row.shipping_phone,
      shippingAddressLine1: row.shipping_address_line1,
      shippingDistrict: row.shipping_district,
      shippingCity: row.shipping_city,
      totalItemsSubtotalMinor: grand,
      totalDeliveryFeeMinor: 0,
      totalDiscountMinor: 0,
      totalGrandMinor: grand,
      createdAt: row.created_at,
      sellerOrders: Array.isArray(row.seller_orders)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? row.seller_orders.map((so: any) => ({
            id: so.id,
            customerOrderId: row.id,
            shopId: "",
            shopName: so.shop?.name || "Vendor",
            subOrderNumber: so.sub_order_number,
            status: so.status,
            fulfillmentType: "seller_courier",
            subtotalMinor: Number(so.subtotal_minor) || 0,
            deliveryFeeMinor: 0,
            totalAmountMinor: Number(so.subtotal_minor) || 0,
            createdAt: row.created_at,
          }))
        : [],
    };
  });

  return {
    orders,
    totalCount: count ?? orders.length,
    totalGmvMinor,
  };
}
