import React from "react";
import Link from "next/link";
import { ShoppingCart, ArrowLeft, ArrowRight, Store } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CartPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Continue Shopping
      </Link>

      <div className="flex items-center justify-between mb-8 pb-4 border-b border-sparehub-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            SpareHub multi-vendor partitioned cart
          </p>
        </div>
      </div>

      {/* Cart Container Preview */}
      <div className="p-8 rounded-2xl border border-sparehub-border bg-white text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-sparehub-light text-gray-400 flex items-center justify-center mx-auto">
          <ShoppingCart className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-sparehub-dark">
          Your Cart is Currently Empty
        </h3>
        <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
          Browse our catalog of verified automotive spare parts for cars, three-wheelers, motorcycles, and commercial vehicles. In Phase 9, items from multiple vendors will be partitioned here with transparent per-shop delivery calculations.
        </p>

        <div className="pt-4">
          <Link href="/search">
            <Button variant="primary" size="md" className="font-bold gap-2">
              Browse Spare Parts Catalog
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Architectural Notice */}
      <div className="mt-8 p-4 rounded-xl bg-gray-50 border border-gray-200 flex items-start gap-3 text-xs text-gray-600">
        <Store className="w-4 h-4 text-sparehub-orange shrink-0 mt-0.5" />
        <p>
          <strong>Multi-Vendor Cart Architecture:</strong> When multiple items are added from different shops, SpareHub groups items by vendor shop to enable independent fulfillment, courier tracking, and payment reconciliation.
        </p>
      </div>
    </div>
  );
}
