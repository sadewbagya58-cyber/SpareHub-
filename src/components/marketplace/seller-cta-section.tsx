import React from "react";
import Link from "next/link";
import { Store, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SellerCTASection() {
  const sellerTypes = [
    {
      title: "Retail Auto Parts Stores",
      desc: "Reach vehicle owners and workshops across Sri Lanka with online order management.",
    },
    {
      title: "Individual Sellers",
      desc: "Sell rare or surplus parts directly to buyers with secure identity verification.",
    },
    {
      title: "Wholesale Distributors",
      desc: "Supply bulk orders to regional retailers, fleets, and commercial garages.",
    },
    {
      title: "Direct Parts Importers",
      desc: "List fresh consignments of OEM and aftermarket parts directly to the market.",
    },
  ];

  return (
    <section className="rounded-2xl bg-sparehub-dark text-white p-6 sm:p-10 relative overflow-hidden border border-gray-800 shadow-xl">
      {/* Background Accent Grid */}
      <div className="absolute right-0 top-0 -mt-10 -mr-10 w-96 h-96 bg-sparehub-orange/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sparehub-orange/20 text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-4 border border-sparehub-orange/30">
            <Store className="w-3.5 h-3.5" />
            Multi-Vendor Marketplace
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Grow Your Automotive Spares Business on SpareHub
          </h2>
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">
            SpareHub enables registered automotive spare parts merchants, importers, and verified individual sellers to open their own shop, manage stock, and sell islandwide.
          </p>
        </div>

        {/* 4 Seller Types Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-800">
          {sellerTypes.map((type, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] font-mono text-sparehub-orange font-bold uppercase">
                  Class 0{idx + 1}
                </span>
                <h4 className="text-sm font-bold text-white mt-1">{type.title}</h4>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">{type.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Row */}
        <div className="mt-8 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <ShieldCheck className="w-4 h-4 text-sparehub-success" />
            <span>All vendor shops require identity & business verification before selling</span>
          </div>

          <Link href="/sell" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto font-bold gap-2 text-sm shadow-md"
            >
              Open Your Vendor Shop
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
