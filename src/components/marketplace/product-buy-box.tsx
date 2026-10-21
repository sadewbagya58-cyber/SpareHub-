"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, Zap, Plus, Minus, Check, AlertCircle, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addToCartAction } from "@/lib/cart/actions";
import { WishlistButton } from "./wishlist-button";

interface ProductBuyBoxProps {
  productId: string;
  stockQuantity: number;
  isPublished: boolean;
  shopPhone?: string | null;
  shopEmail?: string | null;
  productTitle: string;
}

export function ProductBuyBox({
  productId,
  stockQuantity,
  isPublished,
  shopPhone,
  shopEmail,
  productTitle,
}: ProductBuyBoxProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [buyNowLoading, setBuyNowLoading] = useState(false);
  const [isPendingBuy, startBuyTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isOutOfStock = stockQuantity <= 0 || !isPublished;

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const res = await addToCartAction(productId, quantity);
      if (!res.success) {
        if (res.message?.includes("sign in")) {
          router.push(`/login?redirect=/products/${productId}`);
          return;
        }
        setErrorMessage(res.message || "Failed to add to cart.");
      } else {
        if (typeof res.cartCount === "number") {
          window.dispatchEvent(
            new CustomEvent("sparehub:cart-updated", {
              detail: { count: res.cartCount },
            })
          );
        }
        setSuccessMessage("Added to cart!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch {
      setErrorMessage("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setBuyNowLoading(true);
    startBuyTransition(() => {
      router.push(`/checkout?buyNow=${encodeURIComponent(productId)}&qty=${quantity}`);
    });
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Quantity Stepper */}
      {!isOutOfStock && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-sparehub-border">
          <span className="text-xs font-bold text-sparehub-dark">Quantity</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1 || loading || buyNowLoading}
              className="w-8 h-8 rounded-lg border border-sparehub-border bg-white flex items-center justify-center text-sparehub-dark hover:bg-gray-100 disabled:opacity-40 transition-colors"
              aria-label="Decrease quantity"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="w-10 text-center font-black text-sm text-sparehub-dark">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(stockQuantity, q + 1))}
              disabled={quantity >= stockQuantity || loading || buyNowLoading}
              className="w-8 h-8 rounded-lg border border-sparehub-border bg-white flex items-center justify-center text-sparehub-dark hover:bg-gray-100 disabled:opacity-40 transition-colors"
              aria-label="Increase quantity"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      {successMessage && (
        <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 font-bold flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 text-sparehub-success shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-sparehub-error shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main E-Commerce Action Buttons */}
      <div className="space-y-2">
        <Button
          type="button"
          variant="primary"
          size="lg"
          isLoading={loading}
          loadingText="Adding to Cart..."
          disabled={isOutOfStock || loading || buyNowLoading || isPendingBuy}
          onClick={handleAddToCart}
          className="w-full font-bold text-sm rounded-xl py-3 shadow-sm gap-2 justify-center"
        >
          <ShoppingCart className="w-4 h-4" />
          {isOutOfStock ? "Out of Stock" : "Add to Cart"}
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          isLoading={buyNowLoading || isPendingBuy}
          loadingText="Opening Checkout..."
          disabled={isOutOfStock || loading || buyNowLoading || isPendingBuy}
          onClick={handleBuyNow}
          className="w-full font-bold text-sm rounded-xl py-3 gap-2 justify-center border-sparehub-dark bg-sparehub-dark text-white hover:bg-neutral-800"
        >
          <Zap className="w-4 h-4 text-sparehub-orange" />
          Buy Now
        </Button>

        <WishlistButton productId={productId} variant="button" className="w-full" />
      </div>

      {/* Direct Vendor Inquiry Contacts */}
      <div className="pt-2 border-t border-sparehub-border space-y-2">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
          Direct Seller Contact
        </span>

        {shopPhone && (
          <a
            href={`tel:${shopPhone}`}
            className="w-full py-2.5 px-3 bg-gray-50 hover:bg-gray-100 text-sparehub-dark border border-sparehub-border font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Phone className="w-3.5 h-3.5 text-gray-500" />
            Call Seller: {shopPhone}
          </a>
        )}

        {shopEmail && (
          <a
            href={`mailto:${shopEmail}?subject=SpareHub Inquiry: ${encodeURIComponent(productTitle)}`}
            className="w-full py-2 px-3 bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 text-[11px] font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            Email Inquiry
          </a>
        )}
      </div>
    </div>
  );
}
