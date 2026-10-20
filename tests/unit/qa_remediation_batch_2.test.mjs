import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("SH-QA-005: Mobile Layout & Header Overflow Verification", () => {
  const navbarPath = path.resolve(process.cwd(), "src/components/layout/navbar.tsx");
  const cartBadgePath = path.resolve(process.cwd(), "src/components/layout/cart-nav-badge.tsx");
  const notifBadgePath = path.resolve(process.cwd(), "src/components/layout/notification-nav-badge.tsx");
  const vehicleSelectorPath = path.resolve(process.cwd(), "src/components/marketplace/vehicle-selector.tsx");
  const globalsCssPath = path.resolve(process.cwd(), "src/app/globals.css");

  const navbarCode = fs.readFileSync(navbarPath, "utf-8");
  const cartBadgeCode = fs.readFileSync(cartBadgePath, "utf-8");
  const notifBadgeCode = fs.readFileSync(notifBadgePath, "utf-8");
  const vehicleSelectorCode = fs.readFileSync(vehicleSelectorPath, "utf-8");
  const globalsCssCode = fs.readFileSync(globalsCssPath, "utf-8");

  it("ensures navbar right action controls have responsive padding and icon sizing", () => {
    assert.ok(
      navbarCode.includes("gap-1 sm:gap-2 md:gap-3"),
      "Navbar right actions must use responsive gaps"
    );
    assert.ok(
      navbarCode.includes("p-1.5 sm:p-2"),
      "Navbar buttons must use responsive padding for mobile viewports"
    );
  });

  it("hides desktop AuthNav dropdown in top bar on mobile to prevent cramped overflow", () => {
    assert.ok(
      navbarCode.includes('<div className="hidden md:flex items-center">') &&
      navbarCode.includes("<AuthNav />"),
      "Desktop AuthNav dropdown button must be hidden on mobile (handled by drawer & bottom nav)"
    );
  });

  it("ensures notification and cart badges are responsive and do not clip on narrow screens", () => {
    assert.ok(
      cartBadgeCode.includes("p-1.5 sm:p-2"),
      "CartNavBadge must use responsive padding"
    );
    assert.ok(
      notifBadgeCode.includes("p-1.5 sm:p-2"),
      "NotificationNavBadge must use responsive padding"
    );
    assert.ok(
      notifBadgeCode.includes("fixed inset-x-2") || notifBadgeCode.includes("sm:absolute"),
      "Notification dropdown must use viewport-aware positioning on mobile"
    );
  });

  it("ensures vehicle selector category tabs wrap cleanly without horizontal scrolling", () => {
    assert.ok(
      vehicleSelectorCode.includes("flex flex-wrap gap-1.5 sm:gap-2"),
      "Vehicle selector category tabs must wrap responsively"
    );
    assert.ok(
      !vehicleSelectorCode.includes("min-w-max pb-1"),
      "Vehicle selector must not force min-w-max horizontal scroll on categories"
    );
  });

  it("enforces overflow-x clip in globals.css to protect against root mobile overflow", () => {
    assert.ok(
      globalsCssCode.includes("overflow-x: clip") || globalsCssCode.includes("overflow-x: hidden"),
      "Global CSS must prevent horizontal viewport scrolling"
    );
  });
});

describe("SH-QA-006 & SH-QA-007: Homepage Product Discovery UX & Demo Data Removal", () => {
  const homePagePath = path.resolve(process.cwd(), "src/app/page.tsx");
  const searchPagePath = path.resolve(process.cwd(), "src/app/search/page.tsx");
  const productCardPath = path.resolve(process.cwd(), "src/components/marketplace/product-card.tsx");

  const homePageCode = fs.readFileSync(homePagePath, "utf-8");
  const searchPageCode = fs.readFileSync(searchPagePath, "utf-8");
  const productCardCode = fs.readFileSync(productCardPath, "utf-8");

  it("ensures homepage queries real published products from Supabase", () => {
    assert.ok(
      homePageCode.includes("getPublicProducts"),
      "HomePage must import and call getPublicProducts"
    );
    assert.ok(
      !homePageCode.includes("<DemoCatalog />"),
      "HomePage must not render DemoCatalog"
    );
    assert.ok(
      !homePageCode.includes("import { DemoCatalog }"),
      "HomePage must not import DemoCatalog"
    );
  });

  it("positions product showcase directly below vehicle selector for fast mobile discovery", () => {
    const vehicleSelectorIdx = homePageCode.indexOf("<VehicleSelector");
    const productShowcaseIdx = homePageCode.indexOf("Verified Spare Parts Catalog");
    const categoryShortcutsIdx = homePageCode.indexOf("<CategoryShortcuts");

    assert.ok(vehicleSelectorIdx !== -1, "VehicleSelector must exist on homepage");
    assert.ok(productShowcaseIdx !== -1, "Product showcase must exist on homepage");
    assert.ok(categoryShortcutsIdx !== -1, "CategoryShortcuts must exist on homepage");

    assert.ok(
      vehicleSelectorIdx < productShowcaseIdx,
      "VehicleSelector must come first"
    );
    assert.ok(
      productShowcaseIdx < categoryShortcutsIdx,
      "Product showcase must appear before CategoryShortcuts for immediate discovery"
    );
  });

  it("ensures homepage renders honest empty state when no products exist", () => {
    assert.ok(
      homePageCode.includes("No spare parts listed yet"),
      "HomePage must render clean empty state when no products are found"
    );
    assert.ok(
      homePageCode.includes("/sell"),
      "Empty state must provide CTA to open shop and list parts"
    );
  });

  it("ensures search page does not render demo catalog fallbacks", () => {
    assert.ok(
      !searchPageCode.includes("<DemoCatalog />"),
      "Search page must not render DemoCatalog fallback"
    );
    assert.ok(
      !searchPageCode.includes("Sample Demonstration Catalog"),
      "Search page must not render sample demo catalog label"
    );
  });

  it("ensures product cards display verified listing status without demo preview badges", () => {
    assert.ok(
      productCardCode.includes("VERIFIED"),
      "ProductCard must show VERIFIED listing badge"
    );
    assert.ok(
      !productCardCode.includes('variant="demo"'),
      "ProductCard must not render variant demo badge"
    );
  });
});

describe("SH-QA-008: Responsive Seller & Admin Financial UI", () => {
  const sellerEarningsPath = path.resolve(process.cwd(), "src/app/seller/earnings/page.tsx");
  const adminCommissionsPath = path.resolve(process.cwd(), "src/app/admin/commissions/page.tsx");
  const adminFinancialsPath = path.resolve(process.cwd(), "src/app/admin/financials/page.tsx");

  const sellerEarningsCode = fs.readFileSync(sellerEarningsPath, "utf-8");
  const adminCommissionsCode = fs.readFileSync(adminCommissionsPath, "utf-8");
  const adminFinancialsCode = fs.readFileSync(adminFinancialsPath, "utf-8");

  it("ensures /seller/earnings provides stacked mobile cards and desktop table", () => {
    assert.ok(
      sellerEarningsCode.includes("block md:hidden") && sellerEarningsCode.includes("hidden md:block"),
      "Seller earnings must provide dual mobile-stacked and desktop-table layouts"
    );
    assert.ok(
      sellerEarningsCode.includes("flex flex-wrap items-center gap-1.5 sm:gap-2"),
      "Seller earnings filter tabs must wrap responsively"
    );
    assert.ok(
      sellerEarningsCode.includes("text-xl sm:text-2xl font-black"),
      "Seller earnings heading must use responsive text size"
    );
  });

  it("ensures /admin/commissions fixes header wrapping, button layout, and mobile cards", () => {
    assert.ok(
      adminCommissionsCode.includes("text-xl sm:text-2xl font-black"),
      "Admin commissions heading must use responsive text size"
    );
    assert.ok(
      adminCommissionsCode.includes("flex flex-wrap sm:flex-nowrap"),
      "Admin commissions action buttons must wrap cleanly on mobile"
    );
    assert.ok(
      adminCommissionsCode.includes("block md:hidden") && adminCommissionsCode.includes("hidden md:block"),
      "Admin commissions must provide stacked cards on mobile and full table on desktop"
    );
  });

  it("ensures /admin/financials provides stacked mobile cards and responsive search/filters", () => {
    assert.ok(
      adminFinancialsCode.includes("block md:hidden") && adminFinancialsCode.includes("hidden md:block"),
      "Admin financials must provide stacked cards on mobile and full table on desktop"
    );
    assert.ok(
      adminFinancialsCode.includes("flex flex-wrap items-center gap-1.5 sm:gap-2"),
      "Admin financials filter tabs must wrap cleanly"
    );
    assert.ok(
      adminFinancialsCode.includes("w-full md:w-72"),
      "Admin financials search bar must be full width on mobile"
    );
  });
});
