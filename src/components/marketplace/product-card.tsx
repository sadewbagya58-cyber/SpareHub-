"use client";

import React, { useState } from "react";
import { CheckCircle2, ShoppingCart, Store } from "lucide-react";
import { DemoProduct } from "@/lib/types";
import { formatLKR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ProductCardProps {
  product: DemoProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddToCart = () => {
    setIsAdding(true);
    // Simulate instantaneous client-side state update without blocking external UI
    setTimeout(() => {
      setIsAdding(false);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }, 300);
  };

  return (
    <div className="group relative flex flex-col rounded-xl border border-sparehub-border bg-white p-4 shadow-xs hover:border-sparehub-orange hover:shadow-md transition-all">
      {/* Demo / Preview Watermark Badge */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <Badge variant="demo" size="sm">
          DEMO PREVIEW
        </Badge>
        <Badge
          variant={product.condition === "brand_new" ? "success" : "neutral"}
          size="sm"
        >
          {product.condition === "brand_new" ? "Brand New" : "Reconditioned"}
        </Badge>
      </div>

      {/* Part Image Placeholder / Visual */}
      <div className="relative aspect-4/3 w-full rounded-lg bg-sparehub-light flex flex-col items-center justify-center p-4 border border-sparehub-border/40 overflow-hidden mb-3">
        <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-sparehub-orange font-black text-lg mb-1">
          ⚙️
        </div>
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
          {product.brand}
        </span>
        <span className="text-[10px] text-gray-400 font-mono">
          PN: {product.partNumber}
        </span>
      </div>

      {/* Product Title & Brand */}
      <div className="flex-1">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {product.category}
        </div>
        <h4 className="font-bold text-sm text-sparehub-dark line-clamp-2 mt-0.5 group-hover:text-sparehub-orange transition-colors">
          {product.title}
        </h4>

        {/* Compatibility Notice */}
        <div className="mt-2 flex items-start gap-1 text-[11px] text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-sparehub-success shrink-0 mt-0.5" />
          <span className="line-clamp-1">{product.vehicleCompatibilitySummary}</span>
        </div>

        {/* Seller Info (Demonstration placeholder clearly stated) */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-2">
          <span className="flex items-center gap-1 font-medium text-gray-700">
            <Store className="w-3 h-3 text-gray-400" />
            {product.shopName}
          </span>
          <span className="text-gray-400">{product.shopLocation}</span>
        </div>
      </div>

      {/* Pricing & Add To Cart Button */}
      <div className="mt-4 pt-3 border-t border-sparehub-border/60 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-gray-400 block leading-tight">Price</span>
          <span className="text-base font-black text-sparehub-dark">
            {formatLKR(product.priceMinorUnits)}
          </span>
        </div>

        <Button
          type="button"
          size="sm"
          variant={added ? "secondary" : "primary"}
          isLoading={isAdding}
          loadingText="Adding..."
          onClick={handleAddToCart}
          className="text-xs font-bold"
        >
          {added ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-sparehub-success" />
              Added!
            </>
          ) : (
            <>
              <ShoppingCart className="w-3.5 h-3.5" />
              Add to Cart
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
