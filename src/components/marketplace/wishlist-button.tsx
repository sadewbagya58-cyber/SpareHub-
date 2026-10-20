"use client";

import React, { useState } from "react";
import { Heart } from "lucide-react";
import { toggleWishlistItemAction } from "@/lib/wishlist/actions";

interface WishlistButtonProps {
  productId: string;
  initialSaved?: boolean;
  variant?: "icon" | "button";
  className?: string;
}

export function WishlistButton({
  productId,
  initialSaved = false,
  variant = "icon",
  className = "",
}: WishlistButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [prevInitialSaved, setPrevInitialSaved] = useState(initialSaved);
  const [loading, setLoading] = useState(false);

  // Synchronize state when initialSaved prop changes (React recommended pattern)
  if (prevInitialSaved !== initialSaved) {
    setPrevInitialSaved(initialSaved);
    setSaved(initialSaved);
  }

  const handleToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    // Optimistic toggle
    const nextSaved = !saved;
    setSaved(nextSaved);
    setLoading(true);

    try {
      const res = await toggleWishlistItemAction(productId);
      if (res.success) {
        setSaved(res.inWishlist);
        window.dispatchEvent(
          new CustomEvent("sparehub:wishlist-updated", {
            detail: { productId, inWishlist: res.inWishlist },
          })
        );
      } else {
        // Revert on failure
        setSaved(saved);
        if (res.message?.includes("sign in")) {
          alert("Please sign in to save parts to your wishlist.");
        }
      }
    } catch {
      setSaved(saved);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border font-bold text-xs transition-all cursor-pointer ${
          saved
            ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "border-sparehub-border bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300"
        } ${className}`}
      >
        <Heart
          className={`w-4 h-4 transition-transform ${
            saved ? "fill-red-500 text-red-500 scale-110" : "text-gray-500"
          }`}
        />
        <span>{saved ? "Saved to Wishlist" : "Save to Wishlist"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
      className={`p-2 rounded-full backdrop-blur-xs transition-all cursor-pointer shadow-xs ${
        saved
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-white/85 text-gray-500 hover:text-red-500 hover:bg-white"
      } ${className}`}
    >
      <Heart
        className={`w-4 h-4 transition-transform ${
          saved ? "fill-red-500 text-red-500 scale-110" : ""
        }`}
      />
    </button>
  );
}
