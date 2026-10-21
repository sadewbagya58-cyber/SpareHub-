"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CheckCircle2, ShoppingCart, Store, Zap, AlertCircle } from "lucide-react";
import { DemoProduct } from "@/lib/types";
import { formatLKR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "@/lib/cart/actions";
import { WishlistButton } from "./wishlist-button";

export interface ProductCardProps {
  product: DemoProduct;
}

export function ProductCard({ product }: ProductCardProps) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isBuying, setIsBuying] = useState(false);
  const [isPendingBuy, startBuyTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const productHref = product.slug ? `/products/${product.slug}` : undefined;
  const isOutOfStock = product.stockQuantity <= 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.isDemo) {
      setFeedback({ type: "error", text: "Demo item only." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (isOutOfStock) {
      setFeedback({ type: "error", text: "Out of stock." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsAdding(true);
    setFeedback(null);

    try {
      const res = await addToCartAction(product.id, 1);
      if (res.success) {
        setAdded(true);
        setFeedback({ type: "success", text: "Added to cart!" });
        if (typeof res.cartCount === "number") {
          window.dispatchEvent(
            new CustomEvent("sparehub:cart-updated", {
              detail: { count: res.cartCount },
            })
          );
        }
        setTimeout(() => {
          setAdded(false);
          setFeedback(null);
        }, 2500);
      } else {
        if (res.message?.includes("sign in")) {
          router.push(`/login?redirect=${encodeURIComponent(productHref || "/search")}`);
          return;
        }
        setFeedback({ type: "error", text: res.message || "Failed to add to cart" });
        setTimeout(() => setFeedback(null), 3500);
      }
    } catch {
      setFeedback({ type: "error", text: "Network error. Try again." });
      setTimeout(() => setFeedback(null), 3500);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBuyNow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (product.isDemo) {
      setFeedback({ type: "error", text: "Demo item only." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    if (isOutOfStock) {
      setFeedback({ type: "error", text: "Out of stock." });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    setIsBuying(true);
    startBuyTransition(() => {
      router.push(`/checkout?buyNow=${encodeURIComponent(product.id)}&qty=1`);
    });
  };

  return (
    <div className="group relative flex flex-col justify-between rounded-xl border border-sparehub-border bg-white p-2.5 sm:p-4 shadow-xs hover:border-sparehub-orange hover:shadow-md transition-all">
      <div>
        {/* Badge Bar: Verified Listing + Condition */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <Badge variant="success" size="sm" className="text-[9px] sm:text-[10px] px-1.5 py-0.5">
            VERIFIED
          </Badge>

          <Badge
            variant={
              product.condition === "brand_new"
                ? "success"
                : product.condition === "reconditioned"
                ? "orange"
                : "neutral"
            }
            size="sm"
            className="text-[9px] sm:text-[10px] px-1.5 py-0.5"
          >
            {product.condition === "brand_new"
              ? "Brand New"
              : product.condition === "reconditioned"
              ? "Reconditioned"
              : "Used"}
          </Badge>
        </div>

        {/* Part Image Visual */}
        <div className="relative aspect-4/3 w-full rounded-lg bg-sparehub-light overflow-hidden border border-sparehub-border/40 mb-2 sm:mb-3">
          {productHref ? (
            <Link
              href={productHref}
              className="block w-full h-full group-hover:opacity-95 transition-opacity"
            >
              {product.imageUrl && product.imageUrl.startsWith("http") ? (
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-sparehub-orange font-black text-sm sm:text-lg mb-1">
                    ⚙️
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate max-w-full">
                    {product.brand}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono truncate max-w-full">
                    PN: {product.partNumber}
                  </span>
                </div>
              )}
            </Link>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
              {product.imageUrl && product.imageUrl.startsWith("http") ? (
                <Image
                  src={product.imageUrl}
                  alt={product.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              ) : (
                <>
                  <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-white shadow-xs flex items-center justify-center text-sparehub-orange font-black text-sm sm:text-lg mb-1">
                    ⚙️
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate max-w-full">
                    {product.brand}
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono truncate max-w-full">
                    PN: {product.partNumber}
                  </span>
                </>
              )}
            </div>
          )}

          {!product.isDemo && (
            <div className="absolute top-2 right-2 z-10">
              <WishlistButton productId={product.id} />
            </div>
          )}
        </div>

        {/* Product Title & Brand */}
        <div className="text-[10px] sm:text-[11px] font-semibold text-gray-500 uppercase tracking-wider truncate">
          {product.category}
        </div>

        {productHref ? (
          <Link href={productHref} className="block group-hover:text-sparehub-orange transition-colors">
            <h4 className="font-bold text-xs sm:text-sm text-sparehub-dark line-clamp-2 mt-0.5 leading-snug">
              {product.title}
            </h4>
          </Link>
        ) : (
          <h4 className="font-bold text-xs sm:text-sm text-sparehub-dark line-clamp-2 mt-0.5 leading-snug group-hover:text-sparehub-orange transition-colors">
            {product.title}
          </h4>
        )}

        {/* Compatibility Notice */}
        <div className="mt-1.5 sm:mt-2 flex items-start gap-1 text-[10px] sm:text-[11px] text-gray-600 bg-gray-50 p-1.5 sm:p-2 rounded-md border border-gray-100">
          <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-sparehub-success shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1 flex flex-wrap items-center gap-1">
            {product.fitmentBadge && (
              <span
                className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider px-1 py-0.2 rounded ${
                  product.fitmentType === "exact_variant" || product.fitmentType === "universal"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {product.fitmentBadge}
              </span>
            )}
            <span className="line-clamp-1 text-[10px] sm:text-[11px]">{product.vehicleCompatibilitySummary}</span>
          </div>
        </div>

        {/* Seller Info */}
        <div className="mt-1.5 sm:mt-2 flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500 border-t border-gray-100 pt-1.5">
          <span className="flex items-center gap-1 font-medium text-gray-700 truncate max-w-[65%]">
            <Store className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate">{product.shopName}</span>
          </span>
          <span className="text-gray-400 shrink-0 text-[9px] sm:text-[10px]">{product.shopLocation}</span>
        </div>
      </div>

      {/* Pricing, Feedback & Action Buttons */}
      <div className="mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-sparehub-border/60">
        {/* Price and Stock Status */}
        <div className="flex items-baseline justify-between gap-1">
          <div>
            <span className="text-[9px] sm:text-[10px] text-gray-400 block leading-tight">Price</span>
            <span className="text-sm sm:text-base font-black text-sparehub-dark">
              {formatLKR(product.priceMinorUnits)}
            </span>
            {product.compareAtPriceMinorUnits && (
              <span className="block text-[9px] text-gray-400 line-through leading-none">
                {formatLKR(product.compareAtPriceMinorUnits)}
              </span>
            )}
          </div>
          <span
            className={`text-[9px] sm:text-[10px] font-bold ${
              isOutOfStock ? "text-red-500" : "text-emerald-600"
            }`}
          >
            {isOutOfStock ? "Out of Stock" : "In Stock"}
          </span>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mt-1.5 p-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 animate-in fade-in ${
              feedback.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-3 h-3 text-sparehub-success shrink-0" />
            ) : (
              <AlertCircle className="w-3 h-3 text-sparehub-error shrink-0" />
            )}
            <span className="truncate">{feedback.text}</span>
          </div>
        )}

        {/* Dual Actions: Add to Cart + Buy Now */}
        <div className="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 w-full">
          <Button
            type="button"
            size="sm"
            variant={added ? "secondary" : "outline"}
            isLoading={isAdding}
            loadingText="Adding..."
            disabled={isOutOfStock || isAdding || isBuying || isPendingBuy}
            onClick={handleAddToCart}
            className="flex-1 text-[11px] sm:text-xs font-bold py-1.5 px-2 h-8 sm:h-9 justify-center gap-1 border-sparehub-border hover:border-sparehub-orange"
          >
            {added ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-sparehub-success" />
                <span className="truncate">Added!</span>
              </>
            ) : (
              <>
                <ShoppingCart className="w-3 h-3" />
                <span className="truncate">{isOutOfStock ? "Unavailable" : "Add to Cart"}</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            variant="primary"
            isLoading={isBuying || isPendingBuy}
            loadingText="Opening..."
            disabled={isOutOfStock || isAdding || isBuying || isPendingBuy}
            onClick={handleBuyNow}
            className="flex-1 text-[11px] sm:text-xs font-bold py-1.5 px-2 h-8 sm:h-9 justify-center gap-1 bg-sparehub-dark hover:bg-neutral-800 text-white"
          >
            <Zap className="w-3 h-3 text-sparehub-orange" />
            <span className="truncate">Buy Now</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
