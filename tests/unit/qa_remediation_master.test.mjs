import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

describe("SH-QA-001: Cart Persistence & Real-time Badge Reactivity", () => {
  it("verifies getCartAction queries product_images and NOT non-existent images column", () => {
    const actionsPath = path.resolve("src/lib/cart/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf8");

    // Must query relational product_images
    assert.ok(
      content.includes("product_images ("),
      "getCartAction must query product_images table instead of a non-existent products.images column"
    );
    assert.ok(
      !content.includes("status,\n        images,"),
      "Must not query non-existent column 'images' from products table"
    );
  });

  it("verifies shop availability filter accepts self-service active shops", () => {
    const actionsPath = path.resolve("src/lib/cart/actions.ts");
    const content = fs.readFileSync(actionsPath, "utf8");

    assert.ok(
      content.includes('s?.status !== "suspended"') || content.includes("s?.status !== 'suspended'"),
      "getCartAction must allow products from non-suspended shops"
    );
    assert.ok(
      !content.includes('s?.status === "approved"'),
      "Must not restrict cart availability to legacy approved status"
    );
  });

  it("verifies CartNavBadge listens to sparehub:cart-updated events", () => {
    const badgePath = path.resolve("src/components/layout/cart-nav-badge.tsx");
    const content = fs.readFileSync(badgePath, "utf8");

    assert.ok(
      content.includes('window.addEventListener("sparehub:cart-updated"'),
      "CartNavBadge must register event listener for sparehub:cart-updated"
    );
    assert.ok(
      content.includes('window.removeEventListener("sparehub:cart-updated"'),
      "CartNavBadge must cleanly unregister listener on unmount"
    );
  });

  it("verifies MobileNav loads cart count dynamically and updates reactively", () => {
    const mobileNavPath = path.resolve("src/components/layout/mobile-nav.tsx");
    const content = fs.readFileSync(mobileNavPath, "utf8");

    assert.ok(
      content.includes("getCartCountAction"),
      "MobileNav must import and invoke getCartCountAction"
    );
    assert.ok(
      content.includes('window.addEventListener("sparehub:cart-updated"'),
      "MobileNav must listen to sparehub:cart-updated events"
    );
    assert.ok(
      !content.includes('badge: "0"'),
      "MobileNav must never hardcode a static '0' badge"
    );
  });
});

describe("SH-QA-002: Responsive Product Grid Columns", () => {
  it("verifies 2-column mobile, 3-column tablet, 4-column desktop in demo-catalog", () => {
    const catalogPath = path.resolve("src/components/marketplace/demo-catalog.tsx");
    const content = fs.readFileSync(catalogPath, "utf8");

    assert.ok(
      content.includes("grid-cols-2 md:grid-cols-3 xl:grid-cols-4"),
      "DemoCatalog must implement grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    );
  });

  it("verifies 2-column mobile, 3-column tablet, 4-column desktop in search page", () => {
    const searchPath = path.resolve("src/app/search/page.tsx");
    const content = fs.readFileSync(searchPath, "utf8");

    assert.ok(
      content.includes("grid-cols-2 md:grid-cols-3 xl:grid-cols-4"),
      "Search results grid must implement grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    );
  });

  it("verifies 2-column mobile, 3-column tablet, 4-column desktop in shop storefront page", () => {
    const shopPath = path.resolve("src/app/shop/[slug]/page.tsx");
    const content = fs.readFileSync(shopPath, "utf8");

    assert.ok(
      content.includes("grid-cols-2 md:grid-cols-3 xl:grid-cols-4"),
      "Shop storefront grid must implement grid-cols-2 md:grid-cols-3 xl:grid-cols-4"
    );
  });
});

describe("SH-QA-003: Dual Actions (Add to Cart + Buy Now) on Every Product", () => {
  it("verifies ProductCard renders both Add to Cart and Buy Now buttons", () => {
    const cardPath = path.resolve("src/components/marketplace/product-card.tsx");
    const content = fs.readFileSync(cardPath, "utf8");

    assert.ok(
      content.includes("Add to Cart"),
      "ProductCard must provide an Add to Cart button"
    );
    assert.ok(
      content.includes("Buy Now"),
      "ProductCard must provide a Buy Now button"
    );
    assert.ok(
      content.includes("addToCartAction"),
      "ProductCard must execute real addToCartAction on add"
    );
    assert.ok(
      content.includes("/checkout?buyNow="),
      "ProductCard Buy Now button must route to isolated /checkout?buyNow= flow"
    );
  });

  it("verifies ProductBuyBox has distinct Add to Cart and Buy Now handlers", () => {
    const buyBoxPath = path.resolve("src/components/marketplace/product-buy-box.tsx");
    const content = fs.readFileSync(buyBoxPath, "utf8");

    assert.ok(
      content.includes("const handleAddToCart = async () =>"),
      "ProductBuyBox must have dedicated handleAddToCart"
    );
    assert.ok(
      content.includes("const handleBuyNow = () =>"),
      "ProductBuyBox must have dedicated handleBuyNow"
    );
    assert.ok(
      content.includes("/checkout?buyNow="),
      "ProductBuyBox handleBuyNow must route to isolated /checkout?buyNow= flow"
    );
  });

  it("verifies Buy Now checkout preserves user's existing persistent cart", () => {
    const checkoutActionsPath = path.resolve("src/lib/orders/actions.ts");
    const content = fs.readFileSync(checkoutActionsPath, "utf8");

    // Buy Now must branch and not clear cart_items
    assert.ok(
      content.includes("if (payload.isBuyNow && payload.buyNowProductId)"),
      "processCheckoutAction must detect isBuyNow and execute isolated flow"
    );
    assert.ok(
      content.includes("p_buy_now_product_id: payload.buyNowProductId"),
      "processCheckoutAction must pass Buy Now product ID"
    );
  });

  it("verifies CheckoutPage handles buyNow searchParam and constructs isolated cart", () => {
    const checkoutPagePath = path.resolve("src/app/checkout/page.tsx");
    const content = fs.readFileSync(checkoutPagePath, "utf8");

    assert.ok(
      content.includes("if (buyNow)"),
      "CheckoutPage must inspect buyNow parameter"
    );
    assert.ok(
      content.includes("isBuyNow = true"),
      "CheckoutPage must flag Buy Now state"
    );
    assert.ok(
      content.includes("buyNowProductId = p.id"),
      "CheckoutPage must pass buyNowProductId to CheckoutForm"
    );
  });
});

describe("TASK 5: Platform Admin Promotion & Bootstrap Security", () => {
  it("verifies migration 20261014000008 fixes trigger for service_role and postgres", () => {
    const migrationPath = path.resolve("supabase/migrations/20261014000008_promote_platform_admin.sql");
    assert.ok(fs.existsSync(migrationPath), "Admin promotion migration must exist");

    const content = fs.readFileSync(migrationPath, "utf8");
    assert.ok(
      content.includes("auth.role() = 'service_role'"),
      "prevent_self_role_escalation must allow service_role"
    );
    assert.ok(
      content.includes("current_user IN ('postgres', 'supabase_admin')"),
      "prevent_self_role_escalation must allow postgres superuser"
    );
    assert.ok(
      content.includes("sadewbagya58@gmail.com"),
      "Migration must target Sadewbagya58@gmail.com"
    );
  });

  it("verifies deploy script promote_platform_admin.sql contains verification query", () => {
    const deployPath = path.resolve("supabase/deploy/promote_platform_admin.sql");
    assert.ok(fs.existsSync(deployPath), "Standalone deploy script must exist");

    const content = fs.readFileSync(deployPath, "utf8");
    assert.ok(
      content.includes("UPDATE public.user_profiles"),
      "Deploy script must update user_profiles role"
    );
    assert.ok(
      content.includes("sadewbagya58@gmail.com"),
      "Deploy script must specify sadewbagya58@gmail.com"
    );
    assert.ok(
      content.includes("SELECT"),
      "Deploy script must include verification SELECT query"
    );
  });
});
