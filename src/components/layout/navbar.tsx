"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Wrench, 
  Search, 
  Store, 
  Menu, 
  X, 
  MapPin, 
  ShieldCheck, 
  Phone,
  Heart,
  Bell
} from "lucide-react";
import { AuthNav } from "./auth-nav";
import { CartNavBadge } from "./cart-nav-badge";
import { NotificationNavBadge } from "./notification-nav-badge";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-sparehub-border bg-white shadow-xs">
      {/* Top Utility Bar */}
      <div className="bg-sparehub-dark text-white text-xs py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-sparehub-orange" />
              Sri Lanka Marketplace
            </span>
            <span className="hidden sm:flex items-center gap-1 text-gray-300">
              <ShieldCheck className="w-3.5 h-3.5 text-sparehub-success" />
              Verified Vendors & Genuine Spares
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:flex items-center gap-1 text-gray-300">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              Support: 011-SPAREHUB
            </span>
            <Link
              href="/sell"
              className="text-sparehub-orange hover:text-white transition-colors font-medium flex items-center gap-1"
            >
              <Store className="w-3.5 h-3.5" />
              Sell on SpareHub
            </Link>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3.5">
        <div className="flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Tagline */}
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 group shrink-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-sparehub-orange flex items-center justify-center text-white shadow-sm transition-transform group-hover:scale-105 shrink-0">
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 -rotate-45" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-black tracking-tight text-sparehub-dark flex items-center gap-1 leading-tight">
                SPARE<span className="text-sparehub-orange">HUB</span>
              </span>
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider -mt-0.5 hidden sm:block">
                Every Part. One Marketplace.
              </span>
            </div>
          </Link>

          {/* Quick Header Search Bar */}
          <div className="hidden lg:flex items-center flex-1 max-w-xl mx-4">
            <form action="/search" method="GET" className="relative w-full">
              <input
                type="text"
                name="q"
                placeholder="Search by Part Name, OEM Code (e.g. 04465-02220), or Brand..."
                className="w-full rounded-lg border border-sparehub-border bg-sparehub-light py-2 pl-10 pr-24 text-sm text-sparehub-dark focus:bg-white focus:border-sparehub-orange focus:outline-none focus:ring-2 focus:ring-sparehub-orange/20 transition-all"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <button
                type="submit"
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-sparehub-orange text-white text-xs font-semibold px-3 py-1.5 rounded-md hover:bg-sparehub-orange-hover transition-colors"
              >
                Search
              </button>
            </form>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1 sm:gap-2 md:gap-3 shrink-0">
            <Link href="/sell" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm" className="gap-1.5 font-semibold text-xs">
                <Store className="w-4 h-4 text-sparehub-orange" />
                Open Your Shop
              </Button>
            </Link>

            <Link
              href="/search"
              aria-label="Search Catalog"
              className="p-1.5 sm:p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors lg:hidden"
            >
              <Search className="w-4 h-4 sm:w-5 sm:h-5" />
            </Link>

            <Link
              href="/wishlist"
              aria-label="Saved Wishlist"
              className="p-1.5 sm:p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors"
            >
              <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" />
            </Link>

            <NotificationNavBadge />

            <CartNavBadge />

            <div className="hidden md:flex items-center">
              <AuthNav />
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 sm:p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors md:hidden"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              ) : (
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-sparehub-border bg-white px-4 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <form action="/search" method="GET" className="relative w-full">
            <input
              type="text"
              name="q"
              placeholder="Search part or OEM number..."
              className="w-full rounded-lg border border-sparehub-border bg-sparehub-light py-2 pl-9 pr-3 text-sm text-sparehub-dark focus:bg-white focus:outline-none focus:ring-2 focus:ring-sparehub-orange"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </form>

          <nav className="flex flex-col space-y-2">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-sparehub-dark hover:bg-sparehub-light"
            >
              Home Marketplace
            </Link>
            <Link
              href="/search"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-sparehub-dark hover:bg-sparehub-light"
            >
              All Spare Parts
            </Link>
            <Link
              href="/sell"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-sparehub-orange hover:bg-sparehub-orange-light flex items-center justify-between"
            >
              <span>Sell on SpareHub (Open Shop)</span>
              <Store className="w-4 h-4" />
            </Link>

            <Link
              href="/wishlist"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-sparehub-dark hover:bg-sparehub-light flex items-center justify-between"
            >
              <span>Saved Wishlist</span>
              <Heart className="w-4 h-4 text-gray-500" />
            </Link>

            <Link
              href="/account/notifications"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 rounded-md text-sm font-medium text-sparehub-dark hover:bg-sparehub-light flex items-center justify-between"
            >
              <span>Notifications</span>
              <Bell className="w-4 h-4 text-gray-500" />
            </Link>
            
            <AuthNav isMobile onNavigate={() => setMobileMenuOpen(false)} />
          </nav>
        </div>
      )}
    </header>
  );
}
