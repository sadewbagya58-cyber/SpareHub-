import React from "react";
import Link from "next/link";
import { Wrench } from "lucide-react";

const FOOTER_LINKS = [
  { label: "About SpareHub", href: "/about" },
  { label: "Help & Support", href: "/about#support" },
  { label: "Delivery Information", href: "/about#delivery" },
  { label: "Policies", href: "/about#policies" },
  { label: "Sell on SpareHub", href: "/sell" },
] as const;

export function Footer() {
  return (
    <footer className="border-t border-sparehub-border bg-sparehub-dark text-white pt-6 pb-20 md:py-7 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Branding & Tagline */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <div className="w-7 h-7 rounded-lg bg-sparehub-orange flex items-center justify-center text-white shrink-0">
                <Wrench className="w-3.5 h-3.5 -rotate-45" />
              </div>
              <span className="text-base font-black tracking-tight text-white">
                SPARE<span className="text-sparehub-orange">HUB</span>
              </span>
            </Link>
            <span className="text-gray-600 hidden sm:inline">•</span>
            <p className="text-xs text-gray-400 font-medium">
              Every Part. One Marketplace.
            </p>
          </div>

          {/* Compact Essential Links */}
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-gray-300"
          >
            {FOOTER_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-sparehub-orange transition-colors py-0.5"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Copyright Row */}
        <div className="pt-3.5 border-t border-gray-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[11px] text-gray-500">
          <p>© 2026 SpareHub Sri Lanka. All rights reserved.</p>
          <p>Colombo, Sri Lanka • Multi-Vendor Automotive Spare Parts</p>
        </div>
      </div>
    </footer>
  );
}
