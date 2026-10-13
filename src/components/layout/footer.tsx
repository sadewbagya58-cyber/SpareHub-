import React from "react";
import Link from "next/link";
import { Wrench, ShieldCheck, Truck, Headphones } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-sparehub-border bg-sparehub-dark text-white pt-12 pb-16 md:pb-12 mt-auto">
      {/* Reassurance Value Props */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 border-b border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-gray-800/80 text-sparehub-orange shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Verified Vendors</h4>
              <p className="text-xs text-gray-400 mt-1">
                Every shop is reviewed with verified identity and business documentation.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-gray-800/80 text-sparehub-orange shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Islandwide Delivery</h4>
              <p className="text-xs text-gray-400 mt-1">
                Direct courier delivery across all 25 districts in Sri Lanka.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-gray-800/80 text-sparehub-orange shrink-0">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Structured Compatibility</h4>
              <p className="text-xs text-gray-400 mt-1">
                Filter by chassis code, engine variant, and model year before buying.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-lg bg-gray-800/80 text-sparehub-orange shrink-0">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Buyer Assistance</h4>
              <p className="text-xs text-gray-400 mt-1">
                Help with finding hard-to-source parts and reconciling OEM part numbers.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand Col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-sparehub-orange flex items-center justify-center text-white">
                <Wrench className="w-4 h-4 -rotate-45" />
              </div>
              <span className="text-lg font-black tracking-tight text-white">
                SPARE<span className="text-sparehub-orange">HUB</span>
              </span>
            </div>
            <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
              Every Part. One Marketplace. The dedicated multi-vendor marketplace connecting Sri Lankan vehicle owners, garages, and fleets with authentic spare parts vendors.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
              <span>Colombo, Sri Lanka</span>
              <span>•</span>
              <span>English / Sinhala / Tamil (Planned)</span>
            </div>
          </div>

          {/* Vehicle Categories */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
              Vehicles
            </h5>
            <ul className="space-y-2 text-xs text-gray-400">
              <li><Link href="/search?type=car" className="hover:text-sparehub-orange transition-colors">Passenger Cars</Link></li>
              <li><Link href="/search?type=three_wheeler" className="hover:text-sparehub-orange transition-colors">Three-Wheelers</Link></li>
              <li><Link href="/search?type=motorcycle" className="hover:text-sparehub-orange transition-colors">Motorcycles</Link></li>
              <li><Link href="/search?type=van" className="hover:text-sparehub-orange transition-colors">Vans & Commercial</Link></li>
              <li><Link href="/search?type=heavy_machinery" className="hover:text-sparehub-orange transition-colors">Heavy Machinery</Link></li>
            </ul>
          </div>

          {/* Sellers */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
              Sell on SpareHub
            </h5>
            <ul className="space-y-2 text-xs text-gray-400">
              <li><Link href="/sell" className="hover:text-sparehub-orange transition-colors">Open a Vendor Shop</Link></li>
              <li><Link href="/sell#requirements" className="hover:text-sparehub-orange transition-colors">Seller Verification</Link></li>
              <li><Link href="/sell#seller-types" className="hover:text-sparehub-orange transition-colors">Supported Seller Types</Link></li>
              <li><Link href="/seller/login" className="hover:text-sparehub-orange transition-colors">Seller Portal Sign In</Link></li>
            </ul>
          </div>

          {/* Policies & Support */}
          <div>
            <h5 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-3">
              Support & Policies
            </h5>
            <ul className="space-y-2 text-xs text-gray-400">
              <li><span className="text-gray-500">Contact Support (011-SPAREHUB)</span></li>
              <li><span className="text-gray-500">Return Policy (Pending Review)</span></li>
              <li><span className="text-gray-500">COD Policy (Pending Review)</span></li>
              <li><span className="text-gray-500">Terms of Marketplace</span></li>
            </ul>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 border-t border-gray-800 text-center md:flex md:justify-between text-xs text-gray-500">
        <p>© 2026 SpareHub Sri Lanka. All rights reserved.</p>
        <p className="mt-2 md:mt-0">Every Part. One Marketplace.</p>
      </div>
    </footer>
  );
}
