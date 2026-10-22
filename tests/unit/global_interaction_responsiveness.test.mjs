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
      "src/app/account/notifications/page.tsx",
      "src/app/wishlist/page.tsx",
      "src/app/admin/dashboard/page.tsx",
      "src/app/admin/orders/page.tsx",
      "src/app/seller/dashboard/page.tsx",
      "src/app/seller/orders/page.tsx",
      "src/app/seller/orders/seller-orders-list.tsx",
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

  describe("8. SH-QA-022: Elimination of 4–7s Global Supabase & Next.js Interaction Latency", () => {
    it("configures IPv4-first DNS resolution and request-scoped auth deduplication in server & admin Supabase clients", () => {
      const serverSupabaseCode = readSrc("src/lib/supabase/server.ts");
      const adminSupabaseCode = readSrc("src/lib/supabase/admin.ts");

      assert.ok(
        serverSupabaseCode.includes('setDefaultResultOrder("ipv4first")'),
        "server.ts must prioritize IPv4 DNS resolution to prevent 4-12s AAAA record timeouts on *.supabase.co"
      );
      assert.ok(
        adminSupabaseCode.includes('setDefaultResultOrder("ipv4first")'),
        "admin.ts must prioritize IPv4 DNS resolution"
      );
      assert.ok(
        serverSupabaseCode.includes("cache(") && serverSupabaseCode.includes("inflightGetUserPromise"),
        "server.ts must memoize client creation per request and deduplicate auth.getUser() calls"
      );
      assert.ok(
        serverSupabaseCode.includes('c.name.startsWith("sb-")'),
        "server.ts must fast-path anonymous requests without sb-* cookies in 0ms"
      );
    });

    it("implements middleware fast-paths for Server Actions, anonymous requests, and public routes", () => {
      const middlewareCode = readSrc("src/lib/supabase/middleware.ts");

      assert.ok(
        middlewareCode.includes('request.headers.get("next-action")') &&
          middlewareCode.includes('pathname.startsWith("/api/")'),
        "Middleware must bypass duplicate edge auth roundtrips on Server Action POSTs and /api/ routes"
      );
      assert.ok(
        middlewareCode.includes('cookie.name.startsWith("sb-")') &&
          middlewareCode.includes("if (!hasAuthCookie)"),
        "Middleware must short-circuit in 0ms when no Supabase auth cookie is present"
      );
      assert.ok(
        middlewareCode.includes("if (!isAuthPage && !isProtectedRoute)"),
        "Middleware must not block public marketplace routes on edge Auth roundtrips"
      );
      assert.ok(
        middlewareCode.includes("Promise.all(["),
        "Middleware seller verification must query user_profiles and seller_profiles concurrently"
      );
    });

    it("unifies client navbar chrome via non-blocking GET /api/user-context and eliminates mount-time Server Action queue blocking", () => {
      const apiRouteCode = readSrc("src/app/api/user-context/route.ts");
      const storeCode = readSrc("src/lib/client/user-nav-store.ts");
      const cartBadgeCode = readSrc("src/components/layout/cart-nav-badge.tsx");
      const notifBadgeCode = readSrc("src/components/layout/notification-nav-badge.tsx");
      const authNavCode = readSrc("src/components/layout/auth-nav.tsx");
      const productPageCode = readSrc("src/app/products/[slug]/page.tsx");
      const productReviewsCode = readSrc("src/components/marketplace/product-reviews.tsx");

      assert.ok(
        apiRouteCode.includes("export async function GET()") &&
          apiRouteCode.includes("Promise.all(["),
        "/api/user-context must expose a parallelized GET handler that never blocks Next.js actionQueue"
      );
      assert.ok(
        storeCode.includes('fetch("/api/user-context"') &&
          storeCode.includes("hasBrowserAuthCookie"),
        "user-nav-store must deduplicate /api/user-context GET requests and short-circuit anonymous visitors in 0ms"
      );
      assert.ok(
        cartBadgeCode.includes("useUserNavContext") &&
          !cartBadgeCode.includes("await getCartCountAction()"),
        "CartNavBadge must read from unified user-nav-store instead of firing mount-time Server Action POST"
      );
      assert.ok(
        notifBadgeCode.includes("useUserNavContext") &&
          !notifBadgeCode.includes("getUnreadNotificationCountAction"),
        "NotificationNavBadge must read from unified user-nav-store instead of polling via Server Action POST"
      );
      assert.ok(
        authNavCode.includes("useUserNavContext") &&
          !authNavCode.includes("supabase.auth.getUser()"),
        "AuthNav must read from unified user-nav-store instead of running duplicate client DB queries on mount/drawer open"
      );
      assert.ok(
        productPageCode.includes("initialData={initialReviews}") &&
          productReviewsCode.includes("if (initialData)"),
        "ProductDetailPage must preload initial reviews on the server so ProductReviews does not queue a mount-time Server Action"
      );
    });

    it("caches reference vehicle taxonomy & categories and parallelizes cart, search, and dashboard queries", () => {
      const taxonomyCode = readSrc("src/lib/products/taxonomy.ts");
      const productActionsCode = readSrc("src/lib/products/actions.ts");
      const cartActionsCode = readSrc("src/lib/cart/actions.ts");
      const wishlistActionsCode = readSrc("src/lib/wishlist/actions.ts");
      const sellerDashboardCode = readSrc("src/app/seller/dashboard/page.tsx");
      const adminDashboardCode = readSrc("src/app/admin/dashboard/page.tsx");

      assert.ok(
        taxonomyCode.includes("TAXONOMY_CACHE_TTL_MS") &&
          taxonomyCode.includes("cachedTaxonomy") &&
          taxonomyCode.includes("cachedCategories"),
        "taxonomy.ts must cache categories and 4-level vehicle hierarchy in memory with TTL and in-flight deduplication"
      );
      assert.ok(
        productActionsCode.includes("getCachedPublicProductBySlug = cache("),
        "getPublicProductBySlug must be wrapped in React.cache() to deduplicate generateMetadata and page queries"
      );
      assert.ok(
        cartActionsCode.includes("Promise.all([") &&
          !cartActionsCode.includes('revalidatePath("/cart")'),
        "addToCartAction must fetch product and cart_items in parallel and avoid blocking revalidatePath('/cart')"
      );
      assert.ok(
        !wishlistActionsCode.includes('revalidatePath("/products")'),
        "wishlist actions must not trigger broad revalidatePath('/products') RSC re-renders during optimistic toggles"
      );
      assert.ok(
        sellerDashboardCode.includes("Promise.all(["),
        "SellerDashboardPage must fetch product count and seller orders concurrently"
      );
      assert.ok(
        adminDashboardCode.includes("Promise.all(["),
        "AdminDashboardPage must fetch all 5 dashboard count and moderation queries concurrently"
      );
    });

    it("disables Node 20+ Happy Eyeballs 250ms connection race (setDefaultAutoSelectFamily) in Supabase clients", () => {
      const serverSupabaseCode = readSrc("src/lib/supabase/server.ts");
      const adminSupabaseCode = readSrc("src/lib/supabase/admin.ts");

      assert.ok(
        serverSupabaseCode.includes("setDefaultAutoSelectFamily(false)") &&
          serverSupabaseCode.includes("setDefaultAutoSelectFamilyAttemptTimeout(5000)"),
        "server.ts must disable Node net autoSelectFamily 250ms race to prevent UND_ERR_CONNECT_TIMEOUT on cold sockets"
      );
      assert.ok(
        adminSupabaseCode.includes("setDefaultAutoSelectFamily(false)") &&
          adminSupabaseCode.includes("setDefaultAutoSelectFamilyAttemptTimeout(5000)"),
        "admin.ts must disable Node net autoSelectFamily 250ms race"
      );
    });

    it("provides instant (<16ms) client-side status tab filtering and Fulfill Order pending state on /seller/orders", () => {
      const sellerOrdersPageCode = readSrc("src/app/seller/orders/page.tsx");
      const sellerOrdersListCode = readSrc("src/app/seller/orders/seller-orders-list.tsx");
      const sellerFulfillmentCode = readSrc("src/app/seller/orders/[id]/seller-order-fulfillment.tsx");
      const orderActionsCode = readSrc("src/lib/orders/actions.ts");

      assert.ok(
        sellerOrdersPageCode.includes("Promise.all([") &&
          sellerOrdersPageCode.includes("<SellerOrdersList"),
        "SellerOrdersPage must fetch auth and orders concurrently and delegate to client SellerOrdersList"
      );
      assert.ok(
        sellerOrdersListCode.includes("setActiveStatus") &&
          sellerOrdersListCode.includes("window.history.replaceState") &&
          sellerOrdersListCode.includes("setNavigatingOrderId"),
        "SellerOrdersList must filter status tabs synchronously in memory (<16ms) and show immediate Opening... state on Fulfill Order"
      );
      assert.ok(
        sellerFulfillmentCode.includes("setCurrentStatus(targetStatus)") &&
          sellerFulfillmentCode.includes("if (loading) return;"),
        "SellerOrderFulfillment must update local status immediately on transition completion and guard against duplicate taps"
      );
      assert.ok(
        orderActionsCode.includes("shop:shops(id, name, slug, phone, seller_profiles(user_id))"),
        "getSellerOrderDetailAction must verify shop ownership inside the single seller_orders query"
      );
    });

    it("caches getSellerShopProfile with React.cache() and parallelizes Seller & Customer pages", () => {
      const sellerActionsCode = readSrc("src/lib/seller/actions.ts");
      const sellerProductsPageCode = readSrc("src/app/seller/products/page.tsx");
      const editProductPageCode = readSrc("src/app/seller/products/[id]/edit/page.tsx");
      const newProductPageCode = readSrc("src/app/seller/products/new/page.tsx");
      const customerOrdersPageCode = readSrc("src/app/account/orders/page.tsx");
      const orderDetailPageCode = readSrc("src/app/orders/[id]/page.tsx");

      assert.ok(
        sellerActionsCode.includes("getCachedSellerShopProfile = cache(") &&
          sellerActionsCode.includes("Promise.all(["),
        "getSellerShopProfile must be wrapped in React.cache() and fetch user_profiles + seller_profiles concurrently"
      );
      assert.ok(
        sellerProductsPageCode.includes("getSellerProducts({ shopId: shop.id })"),
        "SellerProductsPage must pass resolved shopId to getSellerProducts to avoid duplicate seller_profiles queries"
      );
      assert.ok(
        editProductPageCode.includes("Promise.all([") &&
          newProductPageCode.includes("Promise.all(["),
        "NewProductPage and EditProductPage must parallelize profile, product, categories, and taxonomy fetches"
      );
      assert.ok(
        customerOrdersPageCode.includes("Promise.all([") &&
          orderDetailPageCode.includes("Promise.all(["),
        "CustomerOrdersPage and OrderDetailPage must parallelize auth profile and order queries"
      );
    });

    it("provides global <16ms link pending feedback, MobileNav optimistic highlight, and route loading.tsx boundaries", () => {
      const touchProviderCode = readSrc("src/components/layout/touch-provider.tsx");
      const mobileNavCode = readSrc("src/components/layout/mobile-nav.tsx");
      const accountPageCode = readSrc("src/app/account/page.tsx");

      assert.ok(
        touchProviderCode.includes('data-nav-pending') &&
          touchProviderCode.includes('role="progressbar"'),
        "TouchProvider must mark clicked links with data-nav-pending and render top navigation progress indicator"
      );
      assert.ok(
        mobileNavCode.includes("pendingHref") && mobileNavCode.includes("setPendingHref"),
        "MobileNav must highlight tapped bottom nav items optimistically via pendingHref"
      );
      assert.ok(
        accountPageCode.includes('href="/account/orders"') &&
          accountPageCode.includes('href="/cart"') &&
          accountPageCode.includes('href="/wishlist"') &&
          accountPageCode.includes('href="/account/notifications"'),
        "AccountPage Quick Access must include My Orders & Tracking, Shopping Cart, Saved Wishlist, and Notifications"
      );

      const requiredLoadingFiles = [
        "src/app/loading.tsx",
        "src/app/search/loading.tsx",
        "src/app/products/[slug]/loading.tsx",
        "src/app/account/loading.tsx",
        "src/app/seller/loading.tsx",
        "src/app/admin/loading.tsx",
        "src/app/cart/loading.tsx",
        "src/app/checkout/loading.tsx",
      ];
      for (const loadingFile of requiredLoadingFiles) {
        assert.ok(
          fs.existsSync(path.resolve(process.cwd(), loadingFile)),
          `Route loading boundary ${loadingFile} must exist for instant Next.js App Router transitions`
        );
      }
    });
  });
});
