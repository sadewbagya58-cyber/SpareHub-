import React from "react";
import Link from "next/link";
import { 
  ShieldCheck, 
  Truck, 
  Wrench, 
  CheckCircle2,
  PackageCheck,
  PackageSearch,
  ArrowRight,
  Store,
} from "lucide-react";
import { VehicleSelector } from "@/components/marketplace/vehicle-selector";
import { getVehicleTaxonomyHierarchy } from "@/lib/products/taxonomy";
import { getPublicProducts } from "@/lib/products/actions";
import { CategoryShortcuts } from "@/components/marketplace/category-shortcuts";
import { ProductCard } from "@/components/marketplace/product-card";
import { SellerCTASection } from "@/components/marketplace/seller-cta-section";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [taxonomy, liveProducts] = await Promise.all([
    getVehicleTaxonomyHierarchy(),
    getPublicProducts({ sort: "newest" }),
  ]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section with Prominent Vehicle Selector */}
      <section className="relative bg-gradient-to-b from-sparehub-light via-white to-white border-b border-sparehub-border/60 pt-6 pb-8 sm:pt-10 sm:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sparehub-orange-light text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-2.5 border border-sparehub-orange/20">
              <span className="w-2 h-2 rounded-full bg-sparehub-orange animate-pulse" />
              Sri Lanka&apos;s Multi-Vendor Automotive Marketplace
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-sparehub-dark leading-tight">
              Every Part. <span className="text-sparehub-orange">One Marketplace.</span>
            </h1>
            <p className="mt-2.5 sm:mt-3 text-sm sm:text-base md:text-lg text-gray-600 leading-relaxed">
              Find guaranteed compatible spare parts for your car, three-wheeler, motorcycle, van, or heavy vehicle from certified local vendors and parts importers across Sri Lanka.
            </p>
          </div>

          {/* Prominent Vehicle Selector Component */}
          <VehicleSelector taxonomy={taxonomy} />

          {/* Quick Value Badges */}
          <div className="mt-6 sm:mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-5 sm:pt-6 border-t border-sparehub-border/60">
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
              <span>Verified Fitment Guarantees</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-gray-700">
              <ShieldCheck className="w-4 h-4 text-sparehub-orange shrink-0" />
              <span>Independent Vendor Shops</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-gray-700">
              <Truck className="w-4 h-4 text-gray-700 shrink-0" />
              <span>Courier Delivery Across 25 Districts</span>
            </div>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-gray-700">
              <Wrench className="w-4 h-4 text-sparehub-dark shrink-0" />
              <span>OEM &amp; Aftermarket Catalog</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Featured / Recently Added Products (Real Data Only) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-sparehub-orange shrink-0" />
              <h2 className="text-lg sm:text-2xl font-black text-sparehub-dark tracking-tight">
                Verified Spare Parts Catalog
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
              Guaranteed fitment and genuine spares from verified merchant shops across Sri Lanka
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {liveProducts.slice(0, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-8 sm:p-12 text-center space-y-3">
            <PackageSearch className="w-10 h-10 text-gray-400 mx-auto" />
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="text-sm sm:text-base font-bold text-sparehub-dark">
                No spare parts listed yet
              </h3>
              <p className="text-xs text-gray-500">
                Are you an automotive parts shop or importer? Be among the first certified sellers to publish catalog listings on SpareHub!
              </p>
            </div>
            <div className="pt-2">
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

      {/* 3. Category Shortcuts Section (Vehicle Categories & Part Systems) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 w-full border-t border-sparehub-border/60">
        <CategoryShortcuts />
      </section>

      {/* 4. Multi-Vendor Seller Onboarding Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full border-t border-sparehub-border/60">
        <SellerCTASection />
      </section>
    </div>
  );
}
