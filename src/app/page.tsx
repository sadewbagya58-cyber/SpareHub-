import React from "react";
import Link from "next/link";
import {
  PackageCheck,
  PackageSearch,
  ArrowRight,
  Store,
  Sparkles,
} from "lucide-react";
import { HomeSearchBar } from "@/components/marketplace/home-search-bar";
import { VehicleSelector } from "@/components/marketplace/vehicle-selector";
import { getVehicleTaxonomyHierarchy } from "@/lib/products/taxonomy";
import { getPublicProducts } from "@/lib/products/actions";
import { CategoryShortcuts } from "@/components/marketplace/category-shortcuts";
import { ProductCard } from "@/components/marketplace/product-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [taxonomy, liveProducts] = await Promise.all([
    getVehicleTaxonomyHierarchy(),
    getPublicProducts({ sort: "newest" }),
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Compact Hero Section + Search Bar + Expandable Vehicle Selector */}
      <section className="relative bg-gradient-to-b from-sparehub-light via-white to-white border-b border-sparehub-border/60 pt-4 pb-5 sm:pt-6 sm:pb-7">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-3.5 sm:space-y-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sparehub-orange-light text-sparehub-orange text-[10px] sm:text-[11px] font-bold uppercase tracking-wider mb-1.5 border border-sparehub-orange/20">
              <span className="w-1.5 h-1.5 rounded-full bg-sparehub-orange animate-pulse" />
              Sri Lanka&apos;s Multi-Vendor Automotive Marketplace
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-sparehub-dark leading-tight">
              Every Part. <span className="text-sparehub-orange">One Marketplace.</span>
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm md:text-base text-gray-600 leading-snug">
              Source compatible OEM and aftermarket spare parts from verified local vendors and parts importers across Sri Lanka.
            </p>
          </div>

          {/* 2. Prominent Homepage Search Bar */}
          <HomeSearchBar />

          {/* 3. Expandable Vehicle Selector (Collapsed by default on homepage) */}
          <VehicleSelector taxonomy={taxonomy} collapsible />
        </div>
      </section>

      {/* 4. Featured Product Listings — Latest Listings (Real Data Only) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5 text-sparehub-orange shrink-0" />
              <h2 className="text-base sm:text-xl font-black text-sparehub-dark tracking-tight">
                Verified Spare Parts Catalog
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sparehub-orange-light text-sparehub-orange text-[10px] font-bold uppercase tracking-wider border border-sparehub-orange/20">
                <Sparkles className="w-3 h-3" />
                Latest Listings
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Recently added spares with verified fitment from certified Sri Lankan vendor shops
            </p>
          </div>
          <Link
            href="/search"
            className="text-xs sm:text-sm font-bold text-sparehub-orange hover:text-sparehub-orange-hover flex items-center gap-1 shrink-0 ml-3"
          >
            <span>View All</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {liveProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            {liveProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-6 sm:p-10 text-center space-y-3">
            <PackageSearch className="w-9 h-9 text-gray-400 mx-auto" />
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-sparehub-dark">
                No spare parts listed yet
              </h3>
              <p className="text-xs text-gray-500">
                Are you an automotive parts shop or importer? Be among the first certified sellers to publish catalog listings on SpareHub!
              </p>
            </div>
            <div className="pt-1">
              <Link
                href="/sell"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sparehub-orange text-white text-xs font-bold hover:bg-sparehub-orange-hover transition-colors shadow-xs"
              >
                <Store className="w-4 h-4" />
                Open Your Shop &amp; List Parts
              </Link>
            </div>
          </div>
        )}
      </section>

      {/* 5. Browse by Vehicle Category & Part System */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full border-t border-sparehub-border/60">
        <CategoryShortcuts />
      </section>

      {/* 6. Clear Action to View All Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8 sm:pb-10 w-full">
        <div className="rounded-xl bg-sparehub-light border border-sparehub-border p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <h3 className="text-sm sm:text-base font-bold text-sparehub-dark">
              Looking for a specific OEM part number or component?
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Explore the complete SpareHub catalog with advanced filters by vehicle, brand, condition, and price.
            </p>
          </div>
          <Link
            href="/search"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-sparehub-dark text-white hover:bg-gray-800 text-xs sm:text-sm font-bold shrink-0 transition-all active:scale-[0.97] shadow-xs"
          >
            <span>View All Spare Parts</span>
            <ArrowRight className="w-4 h-4 text-sparehub-orange" />
          </Link>
        </div>
      </section>
    </div>
  );
}
