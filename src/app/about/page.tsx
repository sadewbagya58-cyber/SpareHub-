import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ShieldCheck,
  Truck,
  Wrench,
  Headphones,
  Store,
  FileText,
  ArrowRight,
  CheckCircle2,
  MapPin,
  Clock,
} from "lucide-react";

export const metadata: Metadata = {
  title: "About SpareHub — Every Part. One Marketplace.",
  description:
    "Learn how SpareHub connects Sri Lankan vehicle owners, workshops, and fleets with verified automotive spare parts vendors across all 25 districts.",
};

export default function AboutPage() {
  const corePillars = [
    {
      icon: ShieldCheck,
      title: "Verified Vendors",
      description:
        "Every shop is reviewed with verified identity and business documentation before listing inventory on the marketplace.",
    },
    {
      icon: Truck,
      title: "Islandwide Delivery",
      description:
        "Direct courier delivery across all 25 districts in Sri Lanka with transparent, seller-managed shipping fees shown upfront.",
    },
    {
      icon: Wrench,
      title: "Structured Compatibility",
      description:
        "Filter by vehicle category, manufacturer, model, chassis code, engine variant, and model year before buying.",
    },
    {
      icon: Headphones,
      title: "Buyer Assistance",
      description:
        "Help with finding hard-to-source parts, verifying fitment badges, and reconciling OEM and aftermarket part numbers.",
    },
  ];

  return (
    <div className="min-h-screen bg-sparehub-light/40 pb-16">
      {/* Header Banner */}
      <section className="bg-sparehub-dark text-white border-b border-gray-800 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sparehub-orange/20 text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-3 border border-sparehub-orange/30">
            <Wrench className="w-3.5 h-3.5" />
            About SpareHub Sri Lanka
          </div>
          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            Every Part. <span className="text-sparehub-orange">One Marketplace.</span>
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-gray-300 max-w-2xl leading-relaxed">
            SpareHub is the dedicated multi-vendor automotive spare parts marketplace connecting Sri Lankan vehicle owners, garages, and commercial fleets with verified parts merchants and importers.
          </p>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
        {/* 1. Core Marketplace Pillars (Relocated from Homepage & Footer) */}
        <section aria-labelledby="pillars-heading" className="space-y-4">
          <div>
            <h2
              id="pillars-heading"
              className="text-lg sm:text-xl font-black text-sparehub-dark tracking-tight"
            >
              Why Vehicle Owners &amp; Workshops Use SpareHub
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Built specifically for Sri Lanka&apos;s diverse vehicle fleet and spare parts ecosystem
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {corePillars.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={pillar.title}
                  className="rounded-xl bg-white border border-sparehub-border p-4 sm:p-5 shadow-2xs flex items-start gap-3.5"
                >
                  <div className="p-2.5 rounded-lg bg-sparehub-orange-light text-sparehub-orange border border-sparehub-orange/20 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-sparehub-dark">
                      {pillar.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
                      {pillar.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Delivery Information (#delivery) */}
        <section
          id="delivery"
          aria-labelledby="delivery-heading"
          className="scroll-mt-20 rounded-xl bg-white border border-sparehub-border p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sparehub-dark text-white shrink-0">
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-sparehub-orange" />
            </div>
            <div>
              <h2
                id="delivery-heading"
                className="text-base sm:text-lg font-black text-sparehub-dark"
              >
                Delivery Information
              </h2>
              <p className="text-xs text-gray-500">
                Courier fulfillment across all 25 Sri Lankan districts
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm text-gray-600 leading-relaxed">
            <div className="rounded-lg bg-sparehub-light/60 border border-sparehub-border p-3.5 space-y-1.5">
              <div className="font-bold text-sparehub-dark flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sparehub-orange shrink-0" />
                Transparent Seller-Managed Delivery Costs
              </div>
              <p>
                Each product listing displays its exact delivery cost (or Free Delivery) upfront on the product page, in your cart, and during checkout. Multi-vendor orders group items by seller shop so you can track each shipment independently.
              </p>
            </div>
            <div className="rounded-lg bg-sparehub-light/60 border border-sparehub-border p-3.5 space-y-1.5">
              <div className="font-bold text-sparehub-dark flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
                25-District Coverage &amp; Order Tracking
              </div>
              <p>
                Verified sellers dispatch orders to all 25 districts in Sri Lanka, from Colombo, Gampaha, and Kalutara to Kandy, Galle, Kurunegala, Jaffna, and Anuradhapura. Real-time order status updates are available in your customer account.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Help & Support (#support) */}
        <section
          id="support"
          aria-labelledby="support-heading"
          className="scroll-mt-20 rounded-xl bg-white border border-sparehub-border p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sparehub-dark text-white shrink-0">
              <Headphones className="w-4 h-4 sm:w-5 sm:h-5 text-sparehub-orange" />
            </div>
            <div>
              <h2
                id="support-heading"
                className="text-base sm:text-lg font-black text-sparehub-dark"
              >
                Help &amp; Support
              </h2>
              <p className="text-xs text-gray-500">
                Assistance with vehicle fitment, OEM part numbers, and order tracking
              </p>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-gray-600 space-y-2 leading-relaxed">
            <p>
              Need help matching an OEM part number, checking chassis compatibility, or following up on an existing order?
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700 font-medium">
              <li>
                <strong>Order Status &amp; Tracking:</strong> Track live sub-order fulfillment directly from{" "}
                <Link href="/account/orders" className="text-sparehub-orange hover:underline font-bold">
                  My Orders &amp; Tracking
                </Link>
                .
              </li>
              <li>
                <strong>Compatibility Verification:</strong> Check the fitment table and OEM part codes listed on each product detail page before placing your order.
              </li>
              <li>
                <strong>Support Desk (Colombo, Sri Lanka):</strong> Hotline &amp; support ticketing (<span className="font-mono text-xs">011-SPAREHUB</span>).
              </li>
            </ul>
          </div>
        </section>

        {/* 4. Marketplace Policies (#policies) */}
        <section
          id="policies"
          aria-labelledby="policies-heading"
          className="scroll-mt-20 rounded-xl bg-white border border-sparehub-border p-5 sm:p-6 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sparehub-dark text-white shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-sparehub-orange" />
            </div>
            <div>
              <h2
                id="policies-heading"
                className="text-base sm:text-lg font-black text-sparehub-dark"
              >
                Marketplace Policies
              </h2>
              <p className="text-xs text-gray-500">
                Current policy status for buyers and vendor shops
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
            <div className="rounded-lg border border-sparehub-border p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sparehub-dark">Return Policy</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                  <Clock className="w-3 h-3" />
                  Pending Review
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Standardized marketplace return and replacement terms for damaged or mismatched parts are currently under final administrative review.
              </p>
            </div>

            <div className="rounded-lg border border-sparehub-border p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sparehub-dark">Cash on Delivery (COD)</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                  Active
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                Orders support Cash on Delivery across Sri Lanka. Formal COD dispute and uncollected-parcel handling guidelines are pending final review.
              </p>
            </div>

            <div className="rounded-lg border border-sparehub-border p-3.5 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sparehub-dark">Vendor Verification</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                  Enforced
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                All seller shops require identity and business verification before publishing spare parts to the public catalog.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Sell on SpareHub Callout */}
        <section className="rounded-xl bg-sparehub-dark text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-sparehub-orange uppercase tracking-wider">
              <Store className="w-3.5 h-3.5" />
              Sell on SpareHub
            </div>
            <h2 className="text-base sm:text-lg font-black text-white">
              Are you an automotive spare parts retailer, distributor, or importer?
            </h2>
            <p className="text-xs text-gray-300">
              Open a verified vendor shop to list your catalog and fulfill orders across Sri Lanka.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              href="/sell"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover text-xs sm:text-sm font-bold transition-all active:scale-[0.97]"
            >
              <span>Open a Vendor Shop</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/search"
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-700 bg-gray-900 text-white hover:bg-gray-800 text-xs sm:text-sm font-bold transition-all active:scale-[0.97]"
            >
              <span>Browse Catalog</span>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
