import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const readSrc = (relPath) =>
  fs.readFileSync(path.resolve(process.cwd(), relPath), "utf-8");

describe("SpareHub Homepage UI/UX Redesign Verification", () => {
  const homePageCode = readSrc("src/app/page.tsx");
  const homeSearchBarCode = readSrc("src/components/marketplace/home-search-bar.tsx");
  const vehicleSelectorCode = readSrc("src/components/marketplace/vehicle-selector.tsx");
  const aboutPageCode = readSrc("src/app/about/page.tsx");
  const footerCode = readSrc("src/components/layout/footer.tsx");

  describe("1. Homepage Content Order & Compact Hero Section", () => {
    it("retains brand tagline and removes redundant 4-badge hero footer and oversized SellerCTASection", () => {
      assert.ok(
        homePageCode.includes("Every Part.") &&
          homePageCode.includes("One Marketplace."),
        "Hero must retain 'Every Part. One Marketplace.' tagline"
      );
      assert.ok(
        !homePageCode.includes("Courier Delivery Across 25 Districts"),
        "Redundant 4-badge row at the bottom of the hero must be removed"
      );
      assert.ok(
        !homePageCode.includes("<SellerCTASection"),
        "Oversized SellerCTASection must be removed from the main homepage flow"
      );
    });

    it("enforces the exact homepage section order: Hero -> HomeSearchBar -> VehicleSelector -> Featured Products -> CategoryShortcuts -> View All CTA", () => {
      const heroIdx = homePageCode.indexOf("Every Part.");
      const searchBarIdx = homePageCode.indexOf("<HomeSearchBar");
      const vehicleSelectorIdx = homePageCode.indexOf("<VehicleSelector");
      const productsIdx = homePageCode.indexOf("Verified Spare Parts Catalog");
      const categoriesIdx = homePageCode.indexOf("<CategoryShortcuts");
      const viewAllIdx = homePageCode.indexOf("View All Spare Parts");

      assert.ok(heroIdx !== -1, "Hero heading must exist");
      assert.ok(searchBarIdx !== -1, "HomeSearchBar must exist");
      assert.ok(vehicleSelectorIdx !== -1, "VehicleSelector must exist");
      assert.ok(productsIdx !== -1, "Featured products section must exist");
      assert.ok(categoriesIdx !== -1, "CategoryShortcuts must exist");
      assert.ok(viewAllIdx !== -1, "View All Spare Parts action must exist");

      assert.ok(heroIdx < searchBarIdx, "Hero must precede HomeSearchBar");
      assert.ok(
        searchBarIdx < vehicleSelectorIdx,
        "HomeSearchBar must precede VehicleSelector"
      );
      assert.ok(
        vehicleSelectorIdx < productsIdx,
        "VehicleSelector must precede Featured Products"
      );
      assert.ok(
        productsIdx < categoriesIdx,
        "Featured Products must precede CategoryShortcuts"
      );
      assert.ok(
        categoriesIdx < viewAllIdx,
        "CategoryShortcuts must precede View All Spare Parts CTA"
      );
    });
  });

  describe("2. Prominent Homepage Search Bar", () => {
    it("renders accessible search form with required placeholder, loading state, and duplicate-submit protection", () => {
      assert.ok(
        homeSearchBarCode.includes(
          'placeholder="Search spare parts, brands or OEM codes..."'
        ),
        "HomeSearchBar must use required placeholder text"
      );
      assert.ok(
        homeSearchBarCode.includes("/search?q=") &&
          homeSearchBarCode.includes("encodeURIComponent"),
        "HomeSearchBar must navigate to /search?q=..."
      );
      assert.ok(
        homeSearchBarCode.includes("if (isPending) return;"),
        "HomeSearchBar must prevent duplicate submissions"
      );
      assert.ok(
        homeSearchBarCode.includes("isLoading={isPending}"),
        "HomeSearchBar submit button must show immediate loading feedback"
      );
    });
  });

  describe("3. Expandable Vehicle Selector (Option B)", () => {
    it("rendersVehicleSelector with collapsible prop on homepage", () => {
      assert.ok(
        homePageCode.includes("<VehicleSelector taxonomy={taxonomy} collapsible />"),
        "Homepage must render VehicleSelector in collapsible mode"
      );
    });

    it("implements collapsed default card with 'Find Parts for Your Vehicle', supporting text, and 'Select Vehicle' button", () => {
      assert.ok(
        vehicleSelectorCode.includes("Find Parts for Your Vehicle"),
        "VehicleSelector must display 'Find Parts for Your Vehicle'"
      );
      assert.ok(
        vehicleSelectorCode.includes(
          "Choose your vehicle to find compatible spare parts"
        ),
        "VehicleSelector must display supporting text"
      );
      assert.ok(
        vehicleSelectorCode.includes("Select Vehicle") &&
          vehicleSelectorCode.includes('aria-controls="vehicle-selector-panel"'),
        "Collapsed VehicleSelector must provide accessible Select Vehicle trigger"
      );
    });

    it("supports selected-vehicle summary with Change Vehicle, Find Matching Parts, and Clear actions", () => {
      assert.ok(
        vehicleSelectorCode.includes("Selected Vehicle") &&
          vehicleSelectorCode.includes("Change Vehicle") &&
          vehicleSelectorCode.includes("Find Matching Parts") &&
          vehicleSelectorCode.includes("Clear"),
        "Collapsed VehicleSelector with active vehicle must display summary and Change/Find/Clear actions"
      );
    });
  });

  describe("4. Consolidated About SpareHub Page (/about)", () => {
    it("contains the 4 relocated informational pillars and #delivery, #support, #policies sections", () => {
      assert.ok(
        aboutPageCode.includes("Verified Vendors") &&
          aboutPageCode.includes("Islandwide Delivery") &&
          aboutPageCode.includes("Structured Compatibility") &&
          aboutPageCode.includes("Buyer Assistance"),
        "/about page must include all 4 relocated informational blocks"
      );
      assert.ok(
        aboutPageCode.includes('id="delivery"') &&
          aboutPageCode.includes('id="support"') &&
          aboutPageCode.includes('id="policies"'),
        "/about page must provide #delivery, #support, and #policies anchor sections"
      );
      assert.ok(
        aboutPageCode.includes("Pending Review"),
        "/about#policies must honestly state Pending Review status for policies still under review"
      );
    });
  });

  describe("5. Compact Footer", () => {
    it("renders compact footer with branding, tagline, copyright, and valid navigation links", () => {
      assert.ok(
        footerCode.includes("Every Part. One Marketplace."),
        "Footer must include brand tagline"
      );
      assert.ok(
        footerCode.includes("© 2026 SpareHub Sri Lanka. All rights reserved."),
        "Footer must include copyright notice"
      );
      assert.ok(
        footerCode.includes('href: "/about"') &&
          footerCode.includes('href: "/about#support"') &&
          footerCode.includes('href: "/about#delivery"') &&
          footerCode.includes('href: "/about#policies"') &&
          footerCode.includes('href: "/sell"'),
        "Footer must link to /about, /about#support, /about#delivery, /about#policies, and /sell"
      );
      assert.ok(
        !footerCode.includes("/seller/login"),
        "Footer must not contain dead /seller/login link"
      );
    });
  });
});
