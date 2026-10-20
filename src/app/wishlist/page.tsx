"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Heart,
  ShoppingCart,
  Trash2,
  Package,
  Store,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react";
import { getWishlistAction, removeWishlistItemAction } from "@/lib/wishlist/actions";
import { addToCartAction } from "@/lib/cart/actions";
import { formatLKR } from "@/lib/utils";
import type { WishlistItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function WishlistPage() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cartAddingId, setCartAddingId] = useState<string | null>(null);
  const [addedMap, setAddedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await getWishlistAction();
        if (!isMounted) return;
        setItems(res.items);
      } catch {
        // fallback
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRemove = async (productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
    await removeWishlistItemAction(productId);
    window.dispatchEvent(new CustomEvent("sparehub:wishlist-updated"));
  };

  const handleAddToCart = async (productId: string) => {
    setCartAddingId(productId);
    try {
      const res = await addToCartAction(productId, 1);
      if (res.success) {
        setAddedMap((prev) => ({ ...prev, [productId]: true }));
        window.dispatchEvent(
          new CustomEvent("sparehub:cart-updated", { detail: { count: res.cartCount } })
        );
        setTimeout(() => {
          setAddedMap((prev) => ({ ...prev, [productId]: false }));
        }, 2000);
      } else {
        alert(res.message || "Could not add part to cart.");
      }
    } catch {
      alert("An unexpected error occurred.");
    } finally {
      setCartAddingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-sparehub-light py-8 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Breadcrumb Navigation */}
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-sparehub-orange">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-sparehub-dark font-medium">Saved Items</span>
        </nav>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-sparehub-dark flex items-center gap-2.5">
              <Heart className="w-6 h-6 text-red-500 fill-red-500" />
              My Saved Wishlist
              <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {items.length} {items.length === 1 ? "item" : "items"}
              </span>
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Keep track of compatible spare parts, compare prices, and purchase when ready.
            </p>
          </div>

          <Link href="/search">
            <Button variant="outline" size="sm" className="gap-2 font-medium">
              Browse More Parts
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {/* Wishlist Items Grid */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-sparehub-border p-12 text-center text-sm text-gray-500 animate-pulse">
            Loading your saved items...
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-2xl border border-sparehub-border p-12 text-center">
            <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-sparehub-dark">Your wishlist is empty</h3>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
              Save automotive parts while browsing to easily find them later or check back for stock updates.
            </p>
            <div className="mt-6">
              <Link href="/search">
                <Button className="bg-sparehub-orange hover:bg-sparehub-orange-hover text-white gap-2 font-bold">
                  Explore Spare Parts Catalog
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const p = item.product;
              if (!p) return null;
              const inStock = p.stockQuantity > 0;
              const isAdded = addedMap[p.id];

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-sparehub-border overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="relative aspect-video bg-gray-50 border-b border-sparehub-border/60">
                    {p.imageUrl ? (
                      <Image
                        src={p.imageUrl}
                        alt={p.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                        <Package className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-[11px]">No Image Available</span>
                      </div>
                    )}

                    {/* Stock badge */}
                    <div className="absolute top-2.5 left-2.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          inStock
                            ? "bg-emerald-500 text-white"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(p.id)}
                      title="Remove from wishlist"
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/90 text-gray-500 hover:text-red-600 shadow-2xs hover:bg-white transition-all cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 font-medium">
                        <Store className="w-3.5 h-3.5 text-gray-400" />
                        <span className="truncate">{p.shopName}</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-sparehub-success shrink-0" />
                      </div>

                      <Link
                        href={`/products/${p.slug}`}
                        className="text-sm font-bold text-sparehub-dark hover:text-sparehub-orange transition-colors line-clamp-2 mt-1"
                      >
                        {p.title}
                      </Link>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                        {p.brandName && (
                          <span className="font-semibold text-gray-700">{p.brandName}</span>
                        )}
                        {p.partNumber && (
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">
                            {p.partNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-sparehub-border/60 flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] text-gray-400 block uppercase font-semibold">
                          Price
                        </span>
                        <span className="text-base font-black text-sparehub-dark">
                          {formatLKR(p.priceMinorUnits)}
                        </span>
                      </div>

                      <Button
                        size="sm"
                        disabled={!inStock || cartAddingId === p.id}
                        onClick={() => handleAddToCart(p.id)}
                        className={`font-bold text-xs gap-1.5 ${
                          isAdded
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                            : "bg-sparehub-orange hover:bg-sparehub-orange-hover text-white"
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Added!
                          </>
                        ) : cartAddingId === p.id ? (
                          "Adding..."
                        ) : (
                          <>
                            <ShoppingCart className="w-3.5 h-3.5" />
                            Add to Cart
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
