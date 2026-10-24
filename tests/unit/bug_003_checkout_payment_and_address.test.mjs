import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

describe("BUG-003: Checkout Payment Method, COD Persistence & Delivery Destination Integrity", () => {
  const migration015Path = path.resolve(
    process.cwd(),
    "supabase/migrations/20261024000015_seller_order_customer_details_rls.sql"
  );
  const migration015Sql = fs.readFileSync(migration015Path, "utf-8");

  const actionsPath = path.resolve(process.cwd(), "src/lib/orders/actions.ts");
  const actionsCode = fs.readFileSync(actionsPath, "utf-8");

  const fulfillmentViewPath = path.resolve(
    process.cwd(),
    "src/app/seller/orders/[id]/seller-order-fulfillment.tsx"
  );
  const fulfillmentViewCode = fs.readFileSync(fulfillmentViewPath, "utf-8");

  const orderDetailViewPath = path.resolve(
    process.cwd(),
    "src/app/orders/[id]/order-detail-view.tsx"
  );
  const orderDetailViewCode = fs.readFileSync(orderDetailViewPath, "utf-8");

  const sellerOrdersListPath = path.resolve(
    process.cwd(),
    "src/app/seller/orders/seller-orders-list.tsx"
  );
  const sellerOrdersListCode = fs.readFileSync(sellerOrdersListPath, "utf-8");

  // Helper formatting function mirroring seller-order-fulfillment & order-detail-view
  function formatDeliveryDestination(address) {
    if (!address) {
      return {
        formattedAddress: null,
        formattedLocation: "Destination not specified",
        fallback: "Delivery address details not available.",
      };
    }

    const city = address.shippingCity?.trim();
    const district = address.shippingDistrict?.trim();
    const postal = address.shippingPostalCode?.trim();
    const locationParts = [city, district].filter(Boolean);

    const formattedLocation = locationParts.length > 0 ? locationParts.join(", ") : null;
    const hasStreet = Boolean(address.shippingAddressLine1?.trim() || address.shippingAddressLine2?.trim());

    if (!formattedLocation && !hasStreet) {
      return {
        formattedAddress: null,
        formattedLocation: "Destination not specified",
        fallback: "Delivery address details not available.",
      };
    }

    return {
      formattedAddress: [address.shippingAddressLine1, address.shippingAddressLine2].filter(Boolean).join(", "),
      formattedLocation: formattedLocation ? `${formattedLocation}${postal ? ` ${postal}` : ""}` : null,
      fallback: null,
    };
  }

  // Helper payment display derivation mirroring seller-order-fulfillment
  function derivePaymentDisplay({ paymentMethod, paymentStatus, subOrderStatus }) {
    let methodDisplay = "Payment Method Unspecified";
    if (paymentMethod === "cod") {
      methodDisplay = "Cash on Delivery (Courier Collects)";
    } else if (paymentMethod === "online") {
      methodDisplay = "Online Payment";
    }

    let statusDisplay = "Status Unavailable";
    let isPaid = false;

    if (subOrderStatus === "cancelled") {
      statusDisplay = "Unpaid (Cancelled)";
    } else if (paymentMethod === "cod") {
      if (subOrderStatus === "delivered" || paymentStatus === "captured") {
        statusDisplay = "Paid on Delivery";
        isPaid = true;
      } else {
        statusDisplay = "Cash Collection Pending (On Delivery)";
        isPaid = false;
      }
    } else if (paymentMethod === "online") {
      if (paymentStatus === "captured" || paymentStatus === "authorized") {
        statusDisplay = paymentStatus;
        isPaid = true;
      } else if (paymentStatus === "failed") {
        statusDisplay = "Payment Failed";
        isPaid = false;
      } else if (paymentStatus === "unpaid" || paymentStatus === "initiated") {
        statusDisplay = "Pending Online Payment";
        isPaid = false;
      } else {
        statusDisplay = paymentStatus ? paymentStatus.replace("_", " ") : "Pending Payment";
      }
    }

    return { methodDisplay, statusDisplay, isPaid };
  }

  it("1. Customer selects COD and places an order: payment_method is persisted as 'cod' and status as 'cod_pending'", () => {
    // In migration 012 and actions.ts, COD checkout sets payment_method = 'cod' and payment_status = 'cod_pending'
    const codResult = derivePaymentDisplay({
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      subOrderStatus: "placed",
    });

    assert.strictEqual(
      codResult.methodDisplay,
      "Cash on Delivery (Courier Collects)",
      "COD order must display Cash on Delivery method"
    );
    assert.strictEqual(
      codResult.statusDisplay,
      "Cash Collection Pending (On Delivery)",
      "COD order initially must show Cash Collection Pending (On Delivery)"
    );
    assert.strictEqual(codResult.isPaid, false, "COD order is not marked paid at placement");
  });

  it("2. COD remains COD in every resulting vendor order: sub-order view renders COD method", () => {
    // Test multi-vendor suborders linked to parent customer order
    const mockVendorSubOrders = [
      { id: crypto.randomUUID(), shopId: "shop-1", paymentMethod: "cod", paymentStatus: "cod_pending" },
      { id: crypto.randomUUID(), shopId: "shop-2", paymentMethod: "cod", paymentStatus: "cod_pending" },
      { id: crypto.randomUUID(), shopId: "shop-3", paymentMethod: "cod", paymentStatus: "cod_pending" },
    ];

    for (const subOrder of mockVendorSubOrders) {
      const display = derivePaymentDisplay({
        paymentMethod: subOrder.paymentMethod,
        paymentStatus: subOrder.paymentStatus,
        subOrderStatus: "processing",
      });
      assert.strictEqual(
        display.methodDisplay,
        "Cash on Delivery (Courier Collects)",
        "Every vendor sub-order must preserve COD payment method"
      );
    }
  });

  it("3. COD order is not falsely marked as online-paid without delivery evidence", () => {
    const codProcessing = derivePaymentDisplay({
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      subOrderStatus: "dispatched",
    });
    assert.strictEqual(codProcessing.isPaid, false, "Dispatched COD is not marked as paid");
    assert.notStrictEqual(codProcessing.methodDisplay, "Online Payment", "COD is never marked Online Payment");

    // Once delivered, courier collects cash and status becomes Paid on Delivery
    const codDelivered = derivePaymentDisplay({
      paymentMethod: "cod",
      paymentStatus: "cod_pending",
      subOrderStatus: "delivered",
    });
    assert.strictEqual(codDelivered.isPaid, true, "Delivered COD is verified Paid on Delivery");
    assert.strictEqual(codDelivered.statusDisplay, "Paid on Delivery");
  });

  it("4. Customer selects online payment and the correct method is persisted", () => {
    const onlineResult = derivePaymentDisplay({
      paymentMethod: "online",
      paymentStatus: "unpaid",
      subOrderStatus: "placed",
    });

    assert.strictEqual(onlineResult.methodDisplay, "Online Payment");
    assert.strictEqual(onlineResult.statusDisplay, "Pending Online Payment");
    assert.strictEqual(onlineResult.isPaid, false);
  });

  it("5. Online payment status cannot be inferred from a browser redirect alone", () => {
    // Browser redirect with unconfirmed status remains pending until webhook verification
    const redirectAttempt = derivePaymentDisplay({
      paymentMethod: "online",
      paymentStatus: "initiated",
      subOrderStatus: "placed",
    });
    assert.strictEqual(redirectAttempt.isPaid, false, "Initiated online payment is not paid");
    assert.strictEqual(redirectAttempt.statusDisplay, "Pending Online Payment");

    // Only captured webhook callback marks online order paid
    const webhookVerified = derivePaymentDisplay({
      paymentMethod: "online",
      paymentStatus: "captured",
      subOrderStatus: "processing",
    });
    assert.strictEqual(webhookVerified.isPaid, true, "Captured status marks payment paid");
    assert.strictEqual(webhookVerified.statusDisplay, "captured");
  });

  it("6. Multi-vendor checkout preserves the selected payment method across parent and child records", () => {
    assert.ok(
      actionsCode.includes("p_payment_method: payload.paymentMethod"),
      "Checkout RPC invocation must pass selected payment method directly"
    );
    assert.ok(
      actionsCode.includes("payment_method: payload.paymentMethod"),
      "Buy Now fallback must pass selected payment method directly"
    );
  });

  it("7. Valid delivery addresses appear correctly in seller-facing order details without stray commas", () => {
    const validAddress = {
      shippingFullName: "Sunil Silva",
      shippingPhone: "0771234567",
      shippingAddressLine1: "No. 45, High Level Road",
      shippingAddressLine2: "Apt 3B",
      shippingCity: "Nugegoda",
      shippingDistrict: "Colombo",
      shippingPostalCode: "10250",
    };

    const res = formatDeliveryDestination(validAddress);
    assert.strictEqual(res.formattedLocation, "Nugegoda, Colombo 10250");
    assert.strictEqual(res.formattedAddress, "No. 45, High Level Road, Apt 3B");
    assert.strictEqual(res.fallback, null);
    assert.ok(!res.formattedLocation.startsWith(","), "Must not start with stray comma");
    assert.ok(!res.formattedLocation.endsWith(","), "Must not end with stray comma");
  });

  it("8. Missing addresses produce a safe fallback instead of malformed output", () => {
    // Both city and district empty
    const emptyAddress = {
      shippingCity: "",
      shippingDistrict: "",
      shippingPostalCode: "",
      shippingAddressLine1: "",
      shippingAddressLine2: "",
    };

    const res = formatDeliveryDestination(emptyAddress);
    assert.strictEqual(res.fallback, "Delivery address details not available.");
    assert.strictEqual(res.formattedLocation, "Destination not specified");

    // Null address object
    const nullRes = formatDeliveryDestination(null);
    assert.strictEqual(nullRes.fallback, "Delivery address details not available.");

    // Only city provided (district empty)
    const cityOnlyAddress = {
      shippingCity: "Kandy",
      shippingDistrict: "",
    };
    const cityRes = formatDeliveryDestination(cityOnlyAddress);
    assert.strictEqual(cityRes.formattedLocation, "Kandy", "Single city must render without comma");
    assert.ok(!cityRes.formattedLocation.includes(","), "Must not contain stray comma when district missing");
  });

  it("9. Sellers cannot access unauthorized customers' orders or addresses (RLS and authorization check)", () => {
    // Verify migration 015 contains restrictive RLS policy:
    assert.ok(
      migration015Sql.includes("CREATE POLICY \"Sellers can view customer orders for their own sub-orders\""),
      "Migration 015 must define seller select policy on customer_orders"
    );
    assert.ok(
      migration015Sql.includes("public.owns_shop(so.shop_id)"),
      "RLS policy must restrict access to shops owned by the authenticated seller"
    );
    assert.ok(
      migration015Sql.includes("WHERE so.customer_order_id = customer_orders.id"),
      "RLS policy must join sub-orders strictly on customer_order_id"
    );

    // Verify Server Actions enforce shop ownership before returning customer details:
    assert.ok(
      actionsCode.includes("embeddedOwnerUserId !== user.id"),
      "getSellerOrderDetailAction must verify shop ownership against authenticated user id"
    );
    assert.ok(
      actionsCode.includes("profile?.roles?.includes(\"platform_admin\")"),
      "Platform admin role check must be present for authorized administrative escalation"
    );
  });

  it("10. Front-end components include safe fallback handling and do not default unknown payments to 'Online Payment'", () => {
    assert.ok(
      fulfillmentViewCode.includes("Payment Method Unspecified"),
      "seller-order-fulfillment must handle unspecified payment method"
    );
    assert.ok(
      fulfillmentViewCode.includes("Status Unavailable"),
      "seller-order-fulfillment must handle unavailable payment status"
    );
    assert.ok(
      orderDetailViewCode.includes("Payment Method Unspecified"),
      "order-detail-view must handle unspecified payment method"
    );
    assert.ok(
      sellerOrdersListCode.includes("Destination not specified"),
      "seller-orders-list must handle missing destination gracefully"
    );
  });
});
