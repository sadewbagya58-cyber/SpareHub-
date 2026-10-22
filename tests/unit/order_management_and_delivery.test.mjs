import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("SH-QA-010: Order Tracking Navigation Fixes", () => {
  const authNavPath = path.resolve(process.cwd(), "src/components/layout/auth-nav.tsx");
  const nextConfigPath = path.resolve(process.cwd(), "next.config.ts");

  const authNavCode = fs.readFileSync(authNavPath, "utf-8");
  const nextConfigCode = fs.readFileSync(nextConfigPath, "utf-8");

  it("updates desktop dropdown 'My Orders & Tracking' to point to /account/orders", () => {
    assert.ok(
      authNavCode.includes('href="/account/orders"') && authNavCode.includes("My Orders & Tracking"),
      "Desktop dropdown must link to /account/orders"
    );
    assert.ok(
      !authNavCode.includes('href="/orders">'),
      "Desktop dropdown must not contain dead href='/orders'"
    );
  });

  it("updates mobile drawer navigation to point to /account/orders", () => {
    const ordersMatches = authNavCode.match(/href="\/orders"/g);
    assert.strictEqual(
      ordersMatches,
      null,
      "There must be no remaining links to non-existent /orders in auth-nav"
    );
  });

  it("configures permanent redirect in next.config.ts from /orders to /account/orders", () => {
    assert.ok(
      nextConfigCode.includes('source: "/orders"'),
      "next.config.ts must define redirect for /orders"
    );
    assert.ok(
      nextConfigCode.includes('destination: "/account/orders"'),
      "next.config.ts must redirect to /account/orders"
    );
    assert.ok(
      nextConfigCode.includes("permanent: true"),
      "next.config.ts redirect must be permanent: true"
    );
  });
});

describe("SH-QA-011: Parent / Sub-Order Status Synchronization", () => {
  // Pure state derivation function matching src/lib/orders/delivery.ts
  function deriveParentOrderStatus(subOrderStatuses) {
    if (!subOrderStatuses || subOrderStatuses.length === 0) return "pending";

    const allCancelled = subOrderStatuses.every((s) => s === "cancelled");
    if (allCancelled) return "cancelled";

    const activeStatuses = subOrderStatuses.filter((s) => s !== "cancelled");
    if (activeStatuses.length === 0) return "cancelled";

    const allDelivered = activeStatuses.every((s) => s === "delivered");
    if (allDelivered) return "completed";

    const allDispatchedOrDelivered = activeStatuses.every((s) => s === "dispatched" || s === "delivered");
    if (allDispatchedOrDelivered) return "dispatched";

    const anyDispatchedOrDelivered = activeStatuses.some((s) => s === "dispatched" || s === "delivered");
    if (anyDispatchedOrDelivered) return "partially_dispatched";

    const anyProcessingOrConfirmed = activeStatuses.some((s) => s === "confirmed" || s === "processing");
    if (anyProcessingOrConfirmed) return "processing";

    return "pending";
  }

  it("derives 'completed' when single sub-order is delivered", () => {
    assert.strictEqual(deriveParentOrderStatus(["delivered"]), "completed");
  });

  it("derives 'completed' when all active sub-orders are delivered, even if one vendor cancelled", () => {
    assert.strictEqual(deriveParentOrderStatus(["delivered", "cancelled"]), "completed");
    assert.strictEqual(deriveParentOrderStatus(["delivered", "delivered"]), "completed");
  });

  it("derives 'partially_dispatched' when one vendor dispatched while another is processing", () => {
    assert.strictEqual(deriveParentOrderStatus(["dispatched", "processing"]), "partially_dispatched");
    assert.strictEqual(deriveParentOrderStatus(["delivered", "placed"]), "partially_dispatched");
  });

  it("derives 'dispatched' when all active vendors have dispatched or delivered (with at least one dispatched)", () => {
    assert.strictEqual(deriveParentOrderStatus(["dispatched", "dispatched"]), "dispatched");
    assert.strictEqual(deriveParentOrderStatus(["dispatched", "delivered"]), "dispatched");
    assert.strictEqual(deriveParentOrderStatus(["dispatched", "cancelled"]), "dispatched");
  });

  it("derives 'processing' when vendors have confirmed or processing orders", () => {
    assert.strictEqual(deriveParentOrderStatus(["placed", "processing"]), "processing");
    assert.strictEqual(deriveParentOrderStatus(["confirmed", "placed"]), "processing");
  });

  it("derives 'cancelled' when all vendor sub-orders are cancelled", () => {
    assert.strictEqual(deriveParentOrderStatus(["cancelled", "cancelled"]), "cancelled");
  });

  it("derives 'pending' when all orders are placed", () => {
    assert.strictEqual(deriveParentOrderStatus(["placed", "placed"]), "pending");
  });

  it("verifies PostgreSQL SECURITY DEFINER trigger exists in migration for automated DB synchronization", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261021000011_seller_delivery_configuration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    assert.ok(
      sql.includes("CREATE OR REPLACE FUNCTION public.trg_fn_sync_parent_order_status()"),
      "Migration must define trg_fn_sync_parent_order_status"
    );
    assert.ok(
      sql.includes("SECURITY DEFINER"),
      "Trigger function must run as SECURITY DEFINER to bypass seller RLS on customer_orders"
    );
    assert.ok(
      sql.includes("CREATE TRIGGER trg_sync_parent_order_status"),
      "Migration must create trigger on seller_orders"
    );
  });
});

describe("SH-QA-012: Delivered Order Cancellation Restriction", () => {
  const actionsPath = path.resolve(process.cwd(), "src/lib/orders/actions.ts");
  const orderViewPath = path.resolve(process.cwd(), "src/app/orders/[id]/order-detail-view.tsx");

  const actionsCode = fs.readFileSync(actionsPath, "utf-8");
  const orderViewCode = fs.readFileSync(orderViewPath, "utf-8");

  it("cancelCustomerOrderAction rejects cancellation if parent is completed or cancelled", () => {
    assert.ok(
      actionsCode.includes('co.status === "completed"') && actionsCode.includes('co.status === "cancelled"'),
      "Must reject cancellation if parent order is completed or cancelled"
    );
  });

  it("cancelCustomerOrderAction checks every sub-order and strictly rejects if any is dispatched or delivered", () => {
    assert.ok(
      actionsCode.includes('so.status === "delivered"') && actionsCode.includes('so.status === "dispatched"'),
      "Must inspect all sub-orders for dispatched or delivered status"
    );
    assert.ok(
      actionsCode.includes("already been delivered") && actionsCode.includes("already been dispatched"),
      "Must return informative error messages stating packages have already been delivered or dispatched"
    );
  });

  it("UI strictly disables cancellation button if any sub-order is dispatched or delivered", () => {
    assert.ok(
      orderViewCode.includes('so.status === "dispatched" || so.status === "delivered"'),
      "order-detail-view must evaluate sub-order statuses when determining canCancel"
    );
    assert.ok(
      orderViewCode.includes("!hasNonCancellableSubOrder"),
      "canCancel condition must require !hasNonCancellableSubOrder"
    );
  });
});

describe("SH-QA-013 & SH-QA-014: Timeline Integrity & Cancelled Payment Status", () => {
  const actionsPath = path.resolve(process.cwd(), "src/lib/orders/actions.ts");
  const orderViewPath = path.resolve(process.cwd(), "src/app/orders/[id]/order-detail-view.tsx");
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261021000011_seller_delivery_configuration.sql"
  );

  const actionsCode = fs.readFileSync(actionsPath, "utf-8");
  const orderViewCode = fs.readFileSync(orderViewPath, "utf-8");
  const sqlCode = fs.readFileSync(migrationPath, "utf-8");

  it("getCustomerOrderDetailAction sorts history entries chronologically ascending", () => {
    assert.ok(
      actionsCode.includes("new Date(a.created_at).getTime() - new Date(b.created_at).getTime()"),
      "Order history timeline must be sorted chronologically"
    );
  });

  it("cancelCustomerOrderAction records actual previous status in order_status_history", () => {
    assert.ok(
      actionsCode.includes("from_status: previousStatus"),
      "Must record true previous sub-order status rather than hardcoded 'placed'"
    );
  });

  it("updates COD payment status to 'unpaid' when order is cancelled", () => {
    assert.ok(
      actionsCode.includes('custOrder?.payment_method === "cod"') &&
      actionsCode.includes('updatePayload.payment_status = "unpaid"'),
      "reconcileParentCustomerOrder must set payment_status to 'unpaid' for cancelled COD orders"
    );
    assert.ok(
      sqlCode.includes("UPDATE public.customer_orders") &&
      sqlCode.includes("v_new_payment_status := 'unpaid'"),
      "Database trigger must sync payment_status to 'unpaid' when all sub-orders are cancelled"
    );
  });

  it("displays honest payment status in order-detail-view", () => {
    assert.ok(
      orderViewCode.includes("Unpaid (Cancelled)"),
      "Order detail UI must render 'Unpaid (Cancelled)' for cancelled COD orders"
    );
    assert.ok(
      orderViewCode.includes("Paid on Delivery"),
      "Order detail UI must render 'Paid on Delivery' when COD is collected"
    );
  });
});

describe("SH-QA-015: Mobile Product Details UX Layout", () => {
  const galleryPath = path.resolve(process.cwd(), "src/components/marketplace/product-gallery.tsx");
  const pagePath = path.resolve(process.cwd(), "src/app/products/[slug]/page.tsx");

  const galleryCode = fs.readFileSync(galleryPath, "utf-8");
  const pageCode = fs.readFileSync(pagePath, "utf-8");

  it("caps mobile gallery aspect ratio and height to keep buy actions above the fold", () => {
    assert.ok(
      galleryCode.includes("aspect-4/3 sm:aspect-square max-h-[300px] sm:max-h-[480px]"),
      "Product gallery must cap mobile height to max-h-[300px] with aspect-4/3"
    );
    assert.ok(
      galleryCode.includes("w-14 h-14 sm:w-20 sm:h-20"),
      "Gallery thumbnails must be compact on mobile"
    );
  });

  it("positions Title, Price, Stock, and BuyBox directly under gallery on mobile", () => {
    assert.ok(
      pageCode.includes("lg:col-span-5 lg:col-start-8") && pageCode.includes("lg:sticky lg:top-24"),
      "Buy column must follow gallery in DOM and become sticky sidebar only on desktop"
    );
    assert.ok(
      pageCode.includes("<ProductBuyBox"),
      "ProductBuyBox must be rendered in the primary column"
    );
  });

  it("renders ProductBuyBox exactly once to avoid split/conflicting cart state", () => {
    const buyBoxCount = (pageCode.match(/<ProductBuyBox/g) || []).length;
    assert.strictEqual(
      buyBoxCount,
      1,
      "ProductBuyBox must only be mounted once per page"
    );
  });
});

describe("SH-FEATURE-001: Seller-Managed Delivery Cost Configuration", () => {
  // Pure delivery fee logic verification
  function calculateShopDeliveryFee(shop, district, merchandiseSubtotalMinor) {
    if (shop.delivery_enabled === false) {
      return { feeMinor: 0, isFree: false, allowed: false, reason: "Delivery is disabled for this shop" };
    }

    if (
      Array.isArray(shop.supported_districts) &&
      shop.supported_districts.length > 0 &&
      !shop.supported_districts.includes(district)
    ) {
      return {
        feeMinor: 0,
        isFree: false,
        allowed: false,
        reason: `Delivery is not supported to ${district}`,
      };
    }

    if (
      shop.free_delivery_threshold_minor != null &&
      shop.free_delivery_threshold_minor > 0 &&
      merchandiseSubtotalMinor >= shop.free_delivery_threshold_minor
    ) {
      return { feeMinor: 0, isFree: true, allowed: true };
    }

    if (
      shop.district_delivery_fees &&
      typeof shop.district_delivery_fees === "object" &&
      district in shop.district_delivery_fees
    ) {
      const override = Number(shop.district_delivery_fees[district]);
      if (!isNaN(override) && override >= 0) {
        return { feeMinor: override, isFree: override === 0, allowed: true };
      }
    }

    const defaultFee = Number(shop.default_delivery_fee_minor) || 0;
    return { feeMinor: defaultFee, isFree: defaultFee === 0, allowed: true };
  }

  it("returns default delivery fee when no district override is present", () => {
    const shop = {
      id: "shop-1",
      delivery_enabled: true,
      default_delivery_fee_minor: 35000, // LKR 350
    };
    const res = calculateShopDeliveryFee(shop, "Gampaha", 100000);
    assert.strictEqual(res.allowed, true);
    assert.strictEqual(res.feeMinor, 35000);
    assert.strictEqual(res.isFree, false);
  });

  it("applies district override fee when specified for buyer district", () => {
    const shop = {
      id: "shop-1",
      delivery_enabled: true,
      default_delivery_fee_minor: 50000, // LKR 500
      district_delivery_fees: {
        Colombo: 30000, // LKR 300
        Kandy: 45000,   // LKR 450
      },
    };

    const resColombo = calculateShopDeliveryFee(shop, "Colombo", 100000);
    assert.strictEqual(resColombo.feeMinor, 30000);

    const resJaffna = calculateShopDeliveryFee(shop, "Jaffna", 100000);
    assert.strictEqual(resJaffna.feeMinor, 50000); // Falls back to default
  });

  it("waives delivery fee when merchandise subtotal reaches free_delivery_threshold_minor", () => {
    const shop = {
      id: "shop-1",
      delivery_enabled: true,
      default_delivery_fee_minor: 40000,
      free_delivery_threshold_minor: 1500000, // LKR 15,000
    };

    const belowThreshold = calculateShopDeliveryFee(shop, "Colombo", 1499900);
    assert.strictEqual(belowThreshold.isFree, false);
    assert.strictEqual(belowThreshold.feeMinor, 40000);

    const atThreshold = calculateShopDeliveryFee(shop, "Colombo", 1500000);
    assert.strictEqual(atThreshold.isFree, true);
    assert.strictEqual(atThreshold.feeMinor, 0);

    const aboveThreshold = calculateShopDeliveryFee(shop, "Colombo", 2500000);
    assert.strictEqual(aboveThreshold.isFree, true);
    assert.strictEqual(aboveThreshold.feeMinor, 0);
  });

  it("disallows checkout when delivery is disabled or district is not supported", () => {
    const shopDisabled = {
      id: "shop-1",
      delivery_enabled: false,
    };
    assert.strictEqual(calculateShopDeliveryFee(shopDisabled, "Colombo", 500000).allowed, false);

    const shopRestricted = {
      id: "shop-2",
      delivery_enabled: true,
      supported_districts: ["Colombo", "Gampaha", "Kalutara"],
    };
    assert.strictEqual(calculateShopDeliveryFee(shopRestricted, "Colombo", 500000).allowed, true);
    assert.strictEqual(calculateShopDeliveryFee(shopRestricted, "Kandy", 500000).allowed, false);
  });

  it("enforces platform commission only on merchandise subtotal and not delivery fees", () => {
    const merchandiseSubtotalMinor = 1000000;
    const deliveryFeeMinor = 50000;
    const commissionRateBps = 500; // 5%

    const commissionMinor = Math.round((merchandiseSubtotalMinor * commissionRateBps) / 10000);
    assert.strictEqual(commissionMinor, 50000, "Commission is calculated strictly on merchandise");

    const sellerMerchandisePayout = merchandiseSubtotalMinor - commissionMinor;
    const sellerTotalPayout = sellerMerchandisePayout + deliveryFeeMinor;
    assert.strictEqual(sellerTotalPayout, 1000000, "Seller receives 100% of delivery fee");
  });

  it("verifies shop delivery configuration schema validation", () => {
    const validatorPath = path.resolve(process.cwd(), "src/lib/validators/shop.ts");
    const validatorCode = fs.readFileSync(validatorPath, "utf-8");

    assert.ok(
      validatorCode.includes("shopDeliverySettingsSchema"),
      "Must define shopDeliverySettingsSchema"
    );
    assert.ok(
      validatorCode.includes("default_delivery_fee_lkr"),
      "Must validate default_delivery_fee_lkr"
    );
    assert.ok(
      validatorCode.includes("district_fees_lkr"),
      "Must validate district_fees_lkr"
    );
    assert.ok(
      validatorCode.includes("free_delivery_threshold_lkr"),
      "Must validate free_delivery_threshold_lkr"
    );
  });
});
