import React from "react";
import { 
  ShieldCheck, 
  Truck, 
  Wrench, 
  CheckCircle2
} from "lucide-react";
import { VehicleSelector } from "@/components/marketplace/vehicle-selector";
import { getVehicleTaxonomyHierarchy } from "@/lib/products/taxonomy";
import { CategoryShortcuts } from "@/components/marketplace/category-shortcuts";
import { DemoCatalog } from "@/components/marketplace/demo-catalog";
import { SellerCTASection } from "@/components/marketplace/seller-cta-section";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const taxonomy = await getVehicleTaxonomyHierarchy();

  return (
    <div className="flex flex-col min-h-screen">
      {/* 1. Hero Section with Prominent Vehicle Selector */}
      <section className="relative bg-gradient-to-b from-sparehub-light via-white to-white border-b border-sparehub-border/60 pt-8 pb-12 sm:pt-12 sm:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sparehub-orange-light text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-3 border border-sparehub-orange/20">
              <span className="w-2 h-2 rounded-full bg-sparehub-orange animate-pulse" />
              Sri Lanka&apos;s Multi-Vendor Automotive Marketplace
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-sparehub-dark leading-tight">
              Every Part. <span className="text-sparehub-orange">One Marketplace.</span>
            </h1>
            <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed">
              Find guaranteed compatible spare parts for your car, three-wheeler, motorcycle, van, or heavy vehicle from certified local vendors and parts importers across Sri Lanka.
            </p>
          </div>

          {/* Prominent Vehicle Selector Component */}
          <VehicleSelector taxonomy={taxonomy} />

          {/* Quick Value Badges */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-sparehub-border/60">
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
              <span>Verified Fitment Guarantees</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <ShieldCheck className="w-4 h-4 text-sparehub-orange shrink-0" />
              <span>Independent Vendor Shops</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <Truck className="w-4 h-4 text-gray-700 shrink-0" />
              <span>Courier Delivery Across 25 Districts</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
              <Wrench className="w-4 h-4 text-sparehub-dark shrink-0" />
              <span>OEM &amp; Aftermarket Catalog</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Category Shortcuts Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <CategoryShortcuts />
      </section>

      {/* 3. Demo Product Showcase Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full">
        <DemoCatalog />
      </section>

      {/* 4. Multi-Vendor Seller Onboarding Call to Action */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 w-full">
        <SellerCTASection />
      </section>
    </div>
  );
}
