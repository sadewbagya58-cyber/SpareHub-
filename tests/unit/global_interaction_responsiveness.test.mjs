import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Global Button Interaction & UI Responsiveness Audit Verification", () => {
  const readSrc = (relPath) => fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");

  describe("1. Core Button Component Tactile Feedback & Mobile Touch", () => {
    const buttonCode = readSrc("src/components/ui/button.tsx");
    const touchProviderCode = readSrc("src/components/layout/touch-provider.tsx");
    const layoutCode = readSrc("src/app/layout.tsx");

    it("includes instantaneous tactile scaling and active states on Button", () => {
      assert.ok(
        buttonCode.includes("active:scale-[0.97]") || buttonCode.includes("active:scale-95"),
        "Button must include active scaling for tactile feedback"
      );
      assert.ok(
        buttonCode.includes("active:brightness-95") || buttonCode.includes("active:brightness-90"),
        "Button must include active brightness feedback"
      );
      assert.ok(
        buttonCode.includes("transition-all duration-150") || buttonCode.includes("transition-transform"),
        "Button must declare smooth transitions"
      );
    });

    it("binds aria-busy and displays loadingText cleanly when isLoading is true", () => {
      assert.ok(
        buttonCode.includes('aria-busy={isLoading}'),
        "Button must reflect aria-busy accessibility attribute during loading"
      );
      assert.ok(
        buttonCode.includes("loadingText"),
        "Button must support loadingText for contextual feedback"
      );
      assert.ok(
        buttonCode.includes("animate-spin"),
        "Button must render an animated spinner when loading"
      );
    });

    it("mounts TouchProvider in root layout to activate CSS :active styling on iOS/Android WebKit", () => {
      assert.ok(
        touchProviderCode.includes("addEventListener") && touchProviderCode.includes('"touchstart"'),
        "TouchProvider must register passive touchstart listener on window"
      );
      assert.ok(
        layoutCode.includes("<TouchProvider />") || layoutCode.includes("<TouchProvider>"),
        "Root layout must mount TouchProvider"
      );
    });
  });

  describe("2. Product Discovery & Dual Action Responsiveness", () => {
    const productCardCode = readSrc("src/components/marketplace/product-card.tsx");
    const productBuyBoxCode = readSrc("src/components/marketplace/product-buy-box.tsx");

    it("ProductCard binds immediate loading state and loadingText to Add to Cart", () => {
      assert.ok(
        productCardCode.includes("isLoading={isAdding}"),
        "ProductCard Add to Cart must bind isLoading={isAdding}"
      );
      assert.ok(
        productCardCode.includes('loadingText="Adding..."'),
        "ProductCard Add to Cart must provide instant loading text"
      );
    });

    it("ProductCard wraps Buy Now navigation in useTransition with loading feedback", () => {
      assert.ok(
        productCardCode.includes("startBuyTransition") || productCardCode.includes("isPendingBuy"),
        "ProductCard must handle Buy Now transitions cleanly"
      );
      assert.ok(
        productCardCode.includes("isBuying || isPendingBuy"),
        "ProductCard Buy Now button must reflect both state and transition pending status"
      );
    });

    it("ProductBuyBox provides distinct Add to Cart and Buy Now loading feedback", () => {
      assert.ok(
        productBuyBoxCode.includes("isLoading={loading}"),
        "ProductBuyBox Add to Cart must bind isLoading={loading}"
      );
      assert.ok(
        productBuyBoxCode.includes("isLoading={buyNowLoading || isPendingBuy}"),
        "ProductBuyBox Buy Now must bind isLoading for immediate tactile transition feedback"
      );
    });
  });

  describe("3. Cart View Optimistic Reactivity & Non-blocking Confirmations", () => {
    const cartViewCode = readSrc("src/app/cart/cart-view.tsx");

    it("performs optimistic quantity updates before awaiting server action", () => {
      assert.ok(
        cartViewCode.includes("recalculateCart"),
        "CartView must include optimistic cart recalculation"
      );
      assert.ok(
        cartViewCode.includes("setCart") && cartViewCode.includes("previousCart"),
        "CartView must manage optimistic local cart state with rollback"
      );
    });

    it("performs optimistic item removal before awaiting server action", () => {
      assert.ok(
        cartViewCode.includes("items.filter"),
        "CartView must optimistically filter removed items from cart immediately"
      );
    });

    it("replaces blocking window.confirm on Clear Cart with inline confirmation", () => {
      assert.ok(
        !cartViewCode.includes("window.confirm") && !cartViewCode.includes("confirm("),
        "CartView must not call synchronous window.confirm"
      );
      assert.ok(
        cartViewCode.includes("confirmClear"),
        "CartView must use inline confirmClear state"
      );
    });

    it("binds isNavigatingCheckout transition state to Proceed to Checkout", () => {
      assert.ok(
        cartViewCode.includes("isNavigatingCheckout"),
        "CartView checkout button must bind isNavigatingCheckout"
      );
    });
  });

  describe("4. Vehicle Selector & Search Responsiveness", () => {
    const vehicleSelectorCode = readSrc("src/components/marketplace/vehicle-selector.tsx");

    it("wraps search navigation in transition with immediate loading indication", () => {
      assert.ok(
        vehicleSelectorCode.includes("startSearchTransition") || vehicleSelectorCode.includes("isNavigating"),
        "VehicleSelector must wrap search in transition"
      );
      assert.ok(
        vehicleSelectorCode.includes("isLoading={isSearching || isNavigating}"),
        "VehicleSelector search button must bind isLoading"
      );
    });
  });

  describe("5. Checkout Submission Responsiveness", () => {
    const checkoutFormCode = readSrc("src/app/checkout/checkout-form.tsx");

    it("binds isLoading and loadingText to checkout submit button", () => {
      assert.ok(
        checkoutFormCode.includes("isLoading={loading}"),
        "CheckoutForm must bind isLoading={loading}"
      );
      assert.ok(
        checkoutFormCode.includes('loadingText="Placing Secure Order..."'),
        "CheckoutForm must specify loadingText"
      );
    });
  });

  describe("6. Complete Removal of Blocking Synchronous Modals (alert / confirm)", () => {
    const filesToCheck = [
      "src/components/marketplace/wishlist-button.tsx",
      "src/app/wishlist/page.tsx",
      "src/components/marketplace/product-reviews.tsx",
      "src/app/cart/cart-view.tsx",
      "src/app/seller/products/products-list.tsx",
      "src/app/admin/commissions/page.tsx",
      "src/app/admin/financials/page.tsx",
    ];

    for (const filePath of filesToCheck) {
      it(`ensures ${filePath} contains no synchronous window.alert or window.confirm`, () => {
        const code = readSrc(filePath);
        // regex checking for window.alert, alert(, window.confirm, confirm(
        const hasAlert = /(?:window\.)?alert\s*\(/.test(code);
        const hasConfirm = /(?:window\.)?confirm\s*\(/.test(code);
        assert.equal(hasAlert, false, `${filePath} contains synchronous alert()`);
        assert.equal(hasConfirm, false, `${filePath} contains synchronous confirm()`);
      });
    }
  });

  describe("7. Elimination of Invalid HTML <Link><Button> Nesting", () => {
    const filesToCheck = [
      "src/components/layout/navbar.tsx",
      "src/components/layout/auth-nav.tsx",
      "src/app/account/orders/page.tsx",
      "src/app/admin/dashboard/page.tsx",
      "src/app/admin/orders/page.tsx",
      "src/app/seller/dashboard/page.tsx",
      "src/app/seller/orders/page.tsx",
      "src/app/seller/shop/page.tsx",
      "src/app/sell/page.tsx",
      "src/app/sell/seller-onboarding-form.tsx",
      "src/app/not-found.tsx",
      "src/components/marketplace/seller-cta-section.tsx",
    ];

    for (const filePath of filesToCheck) {
      it(`ensures ${filePath} does not nest <Button inside <Link>`, () => {
        const code = readSrc(filePath);
        const hasNestedLinkButton = /<Link[^>]*>\s*<Button/.test(code);
        assert.equal(
          hasNestedLinkButton,
          false,
          `${filePath} has invalid interactive nesting: <Link><Button>`
        );
      });
    }
  });
});
