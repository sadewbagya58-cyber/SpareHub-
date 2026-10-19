"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ShoppingCart, Store, ArrowUpRight } from "lucide-react";
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

  const productHref = product.slug ? `/products/${product.slug}` : undefined;

  return (
    <div className="group relative flex flex-col rounded-xl border border-sparehub-border bg-white p-4 shadow-xs hover:border-sparehub-orange hover:shadow-md transition-all">
      {/* Badge Bar: Demo / Verified + Condition */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        {product.isDemo ? (
          <Badge variant="demo" size="sm">
            DEMO PREVIEW
          </Badge>
        ) : (
          <Badge variant="success" size="sm">
            VERIFIED LISTING
          </Badge>
        )}

        <Badge
          variant={
            product.condition === "brand_new"
              ? "success"
              : product.condition === "reconditioned"
              ? "orange"
              : "neutral"
          }
          size="sm"
        >
          {product.condition === "brand_new"
            ? "Brand New"
            : product.condition === "reconditioned"
            ? "Reconditioned"
            : "Used"}
        </Badge>
      </div>

      {/* Part Image Visual */}
      <div className="relative aspect-4/3 w-full rounded-lg bg-sparehub-light flex flex-col items-center justify-center p-2 border border-sparehub-border/40 overflow-hidden mb-3">
        {product.imageUrl && product.imageUrl.startsWith("http") ? (
          <Image
            src={product.imageUrl}
            alt={product.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
          />
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-sparehub-orange font-black text-lg mb-1">
              ⚙️
            </div>
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              {product.brand}
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              PN: {product.partNumber}
            </span>
          </>
        )}
      </div>

      {/* Product Title & Brand */}
      <div className="flex-1">
        <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          {product.category}
        </div>

        {productHref ? (
          <Link href={productHref} className="block group-hover:text-sparehub-orange transition-colors">
            <h4 className="font-bold text-sm text-sparehub-dark line-clamp-2 mt-0.5">
              {product.title}
            </h4>
          </Link>
        ) : (
          <h4 className="font-bold text-sm text-sparehub-dark line-clamp-2 mt-0.5 group-hover:text-sparehub-orange transition-colors">
            {product.title}
          </h4>
        )}

        {/* Compatibility Notice */}
        <div className="mt-2 flex items-start gap-1 text-[11px] text-gray-600 bg-gray-50 p-2 rounded-md border border-gray-100">
          <CheckCircle2 className="w-3.5 h-3.5 text-sparehub-success shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1.5">
            {product.fitmentBadge && (
              <span
                className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  product.fitmentType === "exact_variant" || product.fitmentType === "universal"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {product.fitmentBadge}
              </span>
            )}
            <span className="line-clamp-1">{product.vehicleCompatibilitySummary}</span>
          </div>
        </div>

        {/* Seller Info */}
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500 border-t border-gray-100 pt-2">
          <span className="flex items-center gap-1 font-medium text-gray-700 truncate">
            <Store className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{product.shopName}</span>
          </span>
          <span className="text-gray-400 shrink-0">{product.shopLocation}</span>
        </div>
      </div>

      {/* Pricing & Add To Cart Button */}
      <div className="mt-4 pt-3 border-t border-sparehub-border/60 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-gray-400 block leading-tight">Price</span>
          <span className="text-base font-black text-sparehub-dark">
            {formatLKR(product.priceMinorUnits)}
          </span>
          {product.compareAtPriceMinorUnits && (
            <span className="block text-[10px] text-gray-400 line-through leading-none">
              {formatLKR(product.compareAtPriceMinorUnits)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {productHref ? (
            <Link
              href={productHref}
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-sparehub-dark hover:bg-sparehub-orange text-white text-xs font-bold rounded-lg transition-colors"
            >
              Details
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
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
                  Add
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
