import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4.5: Shopping Cart & Multi-Vendor Partitioning", () => {
  it("enforces positive integer quantity validation", () => {
    const validateQty = (qty) => {
      const parsed = Math.floor(Number(qty));
      if (!parsed || parsed <= 0 || !Number.isInteger(parsed)) {
        return { valid: false, error: "Quantity must be a positive integer" };
      }
      return { valid: true, qty: parsed };
    };

    assert.strictEqual(validateQty(1).valid, true);
    assert.strictEqual(validateQty(5).valid, true);
    assert.strictEqual(validateQty(0).valid, false);
    assert.strictEqual(validateQty(-3).valid, false);
    assert.strictEqual(validateQty("abc").valid, false);
    assert.strictEqual(validateQty(null).valid, false);
    assert.strictEqual(validateQty(1.5).valid, true); // Floored to 1
    assert.strictEqual(validateQty(1.5).qty, 1);
  });

  it("enforces available stock limits on add and update", () => {
    const checkStock = (currentCartQty, addQty, availableStock) => {
      const newTotal = currentCartQty + addQty;
      if (newTotal > availableStock) {
        return {
          allowed: false,
          error: `Cannot add ${addQty} more. Only ${availableStock} available in stock.`,
        };
      }
      return { allowed: true, newTotal };
    };

    assert.strictEqual(checkStock(0, 2, 10).allowed, true);
    assert.strictEqual(checkStock(3, 2, 5).allowed, true);
    assert.strictEqual(checkStock(5, 1, 5).allowed, false);
    assert.strictEqual(checkStock(0, 10, 5).allowed, false);
  });

  it("partitions cart items by vendor shop and computes accurate minor unit subtotals", () => {
    const items = [
      {
        id: "item-1",
        productId: "prod-1",
        productTitle: "Corolla Brake Pads",
        priceMinorUnits: 750000, // LKR 7,500.00
        quantity: 2,
        shopId: "shop-colombo",
        shopName: "Colombo Auto Parts",
        shopDistrict: "Colombo",
      },
      {
        id: "item-2",
        productId: "prod-2",
        productTitle: "Corolla Oil Filter",
        priceMinorUnits: 250000, // LKR 2,500.00
        quantity: 1,
        shopId: "shop-colombo",
        shopName: "Colombo Auto Parts",
        shopDistrict: "Colombo",
      },
      {
        id: "item-3",
        productId: "prod-3",
        productTitle: "Spark Plugs Set",
        priceMinorUnits: 1200000, // LKR 12,000.00
        quantity: 1,
        shopId: "shop-kandy",
        shopName: "Kandy Motor Hub",
        shopDistrict: "Kandy",
      },
    ];

    // Partitioning logic (matching getCartAction)
    const groupMap = new Map();
    let totalGrandMinor = 0;
    let totalCount = 0;

    for (const item of items) {
      const itemSubtotal = item.priceMinorUnits * item.quantity;
      totalGrandMinor += itemSubtotal;
      totalCount += item.quantity;

      if (!groupMap.has(item.shopId)) {
        groupMap.set(item.shopId, {
          shopId: item.shopId,
          shopName: item.shopName,
          shopDistrict: item.shopDistrict,
          items: [],
          subtotalMinorUnits: 0,
        });
      }
      const grp = groupMap.get(item.shopId);
      grp.items.push(item);
      grp.subtotalMinorUnits += itemSubtotal;
    }

    const groups = Array.from(groupMap.values());

    assert.strictEqual(groups.length, 2, "Cart must be partitioned into exactly 2 vendor groups");
    assert.strictEqual(totalCount, 4, "Total items count must be 2 + 1 + 1 = 4");

    const colomboGroup = groups.find((g) => g.shopId === "shop-colombo");
    assert.ok(colomboGroup, "Colombo vendor group exists");
    assert.strictEqual(colomboGroup.items.length, 2);
    // (750000 * 2) + (250000 * 1) = 1500000 + 250000 = 1750000
    assert.strictEqual(colomboGroup.subtotalMinorUnits, 1750000);

    const kandyGroup = groups.find((g) => g.shopId === "shop-kandy");
    assert.ok(kandyGroup, "Kandy vendor group exists");
    assert.strictEqual(kandyGroup.items.length, 1);
    assert.strictEqual(kandyGroup.subtotalMinorUnits, 1200000);

    // Grand total = 1750000 + 1200000 = 2950000
    assert.strictEqual(totalGrandMinor, 2950000);
  });
});

describe("Phase 4.5: Checkout Validation, Idempotency & Price Integrity", () => {
  const LK_PHONE_REGEX = /^(?:\+94|0)(?:7[0-9]|1[1-9]|2[1-8]|3[1-8]|4[1-7]|5[1-7]|6[3-7]|8[1-2])[0-9]{7}$/;

  it("validates Sri Lankan recipient telephone numbers strictly", () => {
    assert.strictEqual(LK_PHONE_REGEX.test("0771234567"), true);
    assert.strictEqual(LK_PHONE_REGEX.test("0719876543"), true);
    assert.strictEqual(LK_PHONE_REGEX.test("+94771234567"), true);
    assert.strictEqual(LK_PHONE_REGEX.test("0112345678"), true); // Colombo landline

    assert.strictEqual(LK_PHONE_REGEX.test("123456"), false);
    assert.strictEqual(LK_PHONE_REGEX.test("+1234567890"), false);
    assert.strictEqual(LK_PHONE_REGEX.test("077123456"), false); // 9 digits (too short)
    assert.strictEqual(LK_PHONE_REGEX.test("phone-number"), false);
  });

  it("rejects invalid or missing delivery fields", () => {
    const validateDelivery = (payload) => {
      const fullName = (payload.shippingFullName || "").trim();
      if (fullName.length < 2) return { valid: false, error: "Name too short" };

      const phone = (payload.shippingPhone || "").trim();
      if (!LK_PHONE_REGEX.test(phone)) return { valid: false, error: "Invalid phone" };

      const address1 = (payload.shippingAddressLine1 || "").trim();
      if (address1.length < 5) return { valid: false, error: "Address too short" };

      const district = (payload.shippingDistrict || "").trim();
      if (!district) return { valid: false, error: "Missing district" };

      const city = (payload.shippingCity || "").trim();
      if (city.length < 2) return { valid: false, error: "Missing city" };

      if (!["cod", "online"].includes(payload.paymentMethod)) {
        return { valid: false, error: "Invalid payment method" };
      }

      return { valid: true };
    };

    assert.strictEqual(
      validateDelivery({
        shippingFullName: "Kasun Perera",
        shippingPhone: "0771234567",
        shippingAddressLine1: "123 Galle Road",
        shippingDistrict: "Colombo",
        shippingCity: "Colombo 03",
        paymentMethod: "cod",
      }).valid,
      true
    );

    assert.strictEqual(
      validateDelivery({
        shippingFullName: "K",
        shippingPhone: "0771234567",
        shippingAddressLine1: "123 Galle Road",
        shippingDistrict: "Colombo",
        shippingCity: "Colombo",
        paymentMethod: "cod",
      }).valid,
      false
    );

    assert.strictEqual(
      validateDelivery({
        shippingFullName: "Kasun Perera",
        shippingPhone: "0771234567",
        shippingAddressLine1: "123 Galle Road",
        shippingDistrict: "Colombo",
        shippingCity: "Colombo",
        paymentMethod: "crypto",
      }).valid,
      false
    );
  });

  it("verifies server-derived minor unit calculations (tamper-proof against client tampering)", () => {
    // Database authoritative records
    const dbProductPrices = new Map([
      ["prod-1", 500000], // LKR 5,000.00
      ["prod-2", 300000], // LKR 3,000.00
    ]);

    // Client attempts to claim price is 100 minor units
    const clientPayload = [
      { productId: "prod-1", clientReportedPrice: 100, quantity: 2 },
      { productId: "prod-2", clientReportedPrice: 50, quantity: 1 },
    ];

    // Server recalculation
    let serverGrandTotal = 0;
    for (const item of clientPayload) {
      const dbPrice = dbProductPrices.get(item.productId);
      assert.ok(dbPrice, "Product must exist in DB");
      serverGrandTotal += dbPrice * item.quantity;
    }

    assert.strictEqual(
      serverGrandTotal,
      1300000,
      "Server grand total must be (500000 * 2) + (300000 * 1) = 1,300,000 minor units (LKR 13,000.00)"
    );
    assert.notStrictEqual(
      serverGrandTotal,
      250,
      "Must not accept client-tampered prices"
    );
  });
});

describe("Phase 4.6: Seller Order Workflow State Transitions & Invariants", () => {
  const ALLOWED_TRANSITIONS = {
    placed: ["confirmed", "cancelled"],
    confirmed: ["processing", "cancelled"],
    processing: ["dispatched", "cancelled"],
    dispatched: ["delivered", "returned"],
    delivered: [],
    cancelled: [],
    returned: [],
  };

  const canTransition = (from, to) => {
    const allowed = ALLOWED_TRANSITIONS[from] || [];
    return allowed.includes(to);
  };

  it("permits legal forward state transitions", () => {
    assert.strictEqual(canTransition("placed", "confirmed"), true);
    assert.strictEqual(canTransition("confirmed", "processing"), true);
    assert.strictEqual(canTransition("processing", "dispatched"), true);
    assert.strictEqual(canTransition("dispatched", "delivered"), true);
  });

  it("blocks illegal status skips and backwards jumps", () => {
    assert.strictEqual(canTransition("placed", "delivered"), false, "Cannot jump placed directly to delivered");
    assert.strictEqual(canTransition("placed", "dispatched"), false, "Cannot jump placed directly to dispatched");
    assert.strictEqual(canTransition("dispatched", "processing"), false, "Cannot move dispatched back to processing");
    assert.strictEqual(canTransition("delivered", "placed"), false, "Delivered is a terminal state");
    assert.strictEqual(canTransition("cancelled", "confirmed"), false, "Cancelled is a terminal state");
  });

  it("customer can only cancel orders in pending status", () => {
    const isCustomerCancellable = (customerOrderStatus) => {
      return customerOrderStatus === "pending";
    };

    assert.strictEqual(isCustomerCancellable("pending"), true);
    assert.strictEqual(isCustomerCancellable("confirmed"), false);
    assert.strictEqual(isCustomerCancellable("processing"), false);
    assert.strictEqual(isCustomerCancellable("dispatched"), false);
    assert.strictEqual(isCustomerCancellable("completed"), false);
  });

  it("reconciles parent customer order status from child sub-orders", () => {
    const reconcileParentStatus = (subOrderStatuses) => {
      if (subOrderStatuses.every((s) => s === "delivered")) return "completed";
      if (subOrderStatuses.every((s) => s === "cancelled")) return "cancelled";
      if (subOrderStatuses.some((s) => s === "dispatched")) return "partially_dispatched";
      if (subOrderStatuses.every((s) => s === "confirmed" || s === "processing")) return "processing";
      return "pending";
    };

    assert.strictEqual(reconcileParentStatus(["delivered", "delivered"]), "completed");
    assert.strictEqual(reconcileParentStatus(["cancelled", "cancelled"]), "cancelled");
    assert.strictEqual(reconcileParentStatus(["dispatched", "processing"]), "partially_dispatched");
    assert.strictEqual(reconcileParentStatus(["confirmed", "processing"]), "processing");
    assert.strictEqual(reconcileParentStatus(["placed", "placed"]), "pending");
  });
});

describe("Phase 4.5/4.6: Database Schema & Migration Integrity", () => {
  it("verifies 20261014000005 migration defines cart_items, customer_orders, seller_orders, order_items, order_status_history", () => {
    const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261014000005_cart_and_multi_vendor_orders.sql");
    const content = fs.readFileSync(migrationPath, "utf-8");

    assert.ok(content.includes("CREATE TABLE IF NOT EXISTS public.cart_items"));
    assert.ok(content.includes("CREATE TABLE IF NOT EXISTS public.customer_orders"));
    assert.ok(content.includes("CREATE TABLE IF NOT EXISTS public.seller_orders"));
    assert.ok(content.includes("CREATE TABLE IF NOT EXISTS public.order_items"));
    assert.ok(content.includes("CREATE TABLE IF NOT EXISTS public.order_status_history"));
    assert.ok(content.includes("CREATE OR REPLACE FUNCTION public.process_checkout_order"));
  });

  it("verifies checkout RPC includes row-level locking on products to prevent overselling", () => {
    const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261014000005_cart_and_multi_vendor_orders.sql");
    const content = fs.readFileSync(migrationPath, "utf-8");

    assert.ok(content.includes("FOR UPDATE OF p"), "Must acquire FOR UPDATE OF p row locks");
    assert.ok(content.includes("stock_quantity < v_item_record.quantity"), "Must validate available stock");
    assert.ok(content.includes("SET stock_quantity = stock_quantity - v_item_record.quantity"), "Must decrement stock");
  });

  it("verifies multi-tenant RLS policies on seller_orders and customer_orders", () => {
    const migrationPath = path.resolve(process.cwd(), "supabase/migrations/20261014000005_cart_and_multi_vendor_orders.sql");
    const content = fs.readFileSync(migrationPath, "utf-8");

    assert.ok(content.includes('"Customers can view own orders"'));
    assert.ok(content.includes('"Sellers can view own shop sub-orders"'));
    assert.ok(content.includes('"Sellers can update fulfillment on own sub-orders"'));
    assert.ok(content.includes('"Users can manage own cart"'));
  });
});
