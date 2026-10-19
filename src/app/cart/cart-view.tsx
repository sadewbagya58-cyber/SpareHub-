"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  ArrowRight,
  Store,
  MapPin,
  ShieldCheck,
  Truck,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatLKR } from "@/lib/utils";
import type { CartResponse } from "@/lib/cart/actions";
import {
  updateCartQuantityAction,
  removeCartItemAction,
  clearCartAction,
} from "@/lib/cart/actions";

interface CartViewProps {
  initialCart: CartResponse;
}

export function CartView({ initialCart }: CartViewProps) {
  const router = useRouter();
  const [cart, setCart] = useState<CartResponse>(initialCart);
  const [loadingItems, setLoadingItems] = useState<Record<string, boolean>>({});
  const [clearing, setClearing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdateQuantity = async (cartItemId: string, newQty: number) => {
    if (newQty <= 0) return;
    setLoadingItems((prev) => ({ ...prev, [cartItemId]: true }));
    setErrorMessage(null);

    try {
      const res = await updateCartQuantityAction(cartItemId, newQty);
      if (!res.success) {
        setErrorMessage(res.message || "Failed to update quantity.");
      } else {
        // Optimistic update
        setCart((prev) => {
          const updatedItems = prev.items.map((item) =>
            item.id === cartItemId ? { ...item, quantity: newQty } : item
          );
          let newGrandTotal = 0;
          let newTotalCount = 0;

          const groupMap = new Map();
          for (const item of updatedItems) {
            const sub = item.priceMinorUnits * item.quantity;
            newGrandTotal += sub;
            newTotalCount += item.quantity;

            if (!groupMap.has(item.shopId)) {
              groupMap.set(item.shopId, {
                shopId: item.shopId,
                shopName: item.shopName,
                shopSlug: item.shopSlug,
                shopDistrict: item.shopDistrict,
                items: [],
                subtotalMinorUnits: 0,
              });
            }
            const grp = groupMap.get(item.shopId);
            grp.items.push(item);
            grp.subtotalMinorUnits += sub;
          }

          return {
            ...prev,
            items: updatedItems,
            groups: Array.from(groupMap.values()),
            totalGrandMinor: newGrandTotal,
            totalItemCount: newTotalCount,
          };
        });
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error updating cart. Please try again.");
    } finally {
      setLoadingItems((prev) => ({ ...prev, [cartItemId]: false }));
    }
  };

  const handleRemoveItem = async (cartItemId: string) => {
    setLoadingItems((prev) => ({ ...prev, [cartItemId]: true }));
    setErrorMessage(null);

    try {
      const res = await removeCartItemAction(cartItemId);
      if (!res.success) {
        setErrorMessage(res.message || "Failed to remove item.");
      } else {
        setCart((prev) => {
          const updatedItems = prev.items.filter((item) => item.id !== cartItemId);
          let newGrandTotal = 0;
          let newTotalCount = 0;

          const groupMap = new Map();
          for (const item of updatedItems) {
            const sub = item.priceMinorUnits * item.quantity;
            newGrandTotal += sub;
            newTotalCount += item.quantity;

            if (!groupMap.has(item.shopId)) {
              groupMap.set(item.shopId, {
                shopId: item.shopId,
                shopName: item.shopName,
                shopSlug: item.shopSlug,
                shopDistrict: item.shopDistrict,
                items: [],
                subtotalMinorUnits: 0,
              });
            }
            const grp = groupMap.get(item.shopId);
            grp.items.push(item);
            grp.subtotalMinorUnits += sub;
          }

          return {
            ...prev,
            items: updatedItems,
            groups: Array.from(groupMap.values()),
            totalGrandMinor: newGrandTotal,
            totalItemCount: newTotalCount,
          };
        });
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error removing item. Please try again.");
    } finally {
      setLoadingItems((prev) => ({ ...prev, [cartItemId]: false }));
    }
  };

  const handleClearCart = async () => {
    if (!confirm("Are you sure you want to clear your entire cart?")) return;
    setClearing(true);
    setErrorMessage(null);

    try {
      const res = await clearCartAction();
      if (!res.success) {
        setErrorMessage(res.message || "Failed to clear cart.");
      } else {
        setCart((prev) => ({
          ...prev,
          items: [],
          groups: [],
          totalGrandMinor: 0,
          totalItemCount: 0,
        }));
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error clearing cart. Please try again.");
    } finally {
      setClearing(false);
    }
  };

  // Case 1: Empty Cart
  if (cart.items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <div className="p-8 sm:p-12 rounded-3xl border border-sparehub-border bg-white text-center space-y-5 shadow-xs">
          <div className="w-20 h-20 rounded-2xl bg-orange-50 text-sparehub-orange flex items-center justify-center mx-auto shadow-inner">
            <ShoppingCart className="w-10 h-10" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
              Your Shopping Cart is Empty
            </h1>
            <p className="text-xs text-gray-500 leading-relaxed">
              Explore thousands of OEM and aftermarket automotive replacement parts for cars, vans, three-wheelers, motorcycles, and trucks across Sri Lanka.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/search">
              <Button variant="primary" size="lg" className="font-bold gap-2">
                Browse Compatible Parts
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
            Shopping Cart
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            {cart.totalItemCount} {cart.totalItemCount === 1 ? "item" : "items"} from{" "}
            {cart.groups.length} {cart.groups.length === 1 ? "vendor" : "vendors"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={clearing}
            onClick={handleClearCart}
            className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {clearing ? "Clearing..." : "Clear Cart"}
          </Button>

          <Link href="/search">
            <Button variant="outline" size="sm" className="text-xs font-semibold">
              Continue Shopping
            </Button>
          </Link>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-sparehub-error shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Multi-Vendor Partitioned Items & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Vendor Grouped Items */}
        <div className="lg:col-span-8 space-y-6">
          {cart.groups.map((group) => (
            <div
              key={group.shopId}
              className="rounded-2xl border border-sparehub-border bg-white overflow-hidden shadow-xs"
            >
              {/* Vendor Header */}
              <div className="px-5 py-3.5 bg-gray-50/80 border-b border-sparehub-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white border border-sparehub-border flex items-center justify-center text-sparehub-orange shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-sparehub-dark flex items-center gap-1.5">
                      {group.shopName}
                      <Badge variant="neutral" size="sm" className="text-[10px] capitalize">
                        Verified Shop
                      </Badge>
                    </h3>
                    {group.shopDistrict && (
                      <span className="text-[11px] text-gray-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        Dispatches from {group.shopDistrict}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block">Vendor Subtotal</span>
                  <span className="text-sm font-bold text-sparehub-dark">
                    {formatLKR(group.subtotalMinorUnits)}
                  </span>
                </div>
              </div>

              {/* Items List within Shop Group */}
              <div className="divide-y divide-sparehub-border">
                {group.items.map((item) => {
                  const isItemBusy = Boolean(loadingItems[item.id]);

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      {/* Product Thumbnail & Details */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gray-100 border border-sparehub-border overflow-hidden shrink-0 flex items-center justify-center">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.imageUrl}
                              alt={item.productTitle}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ShoppingCart className="w-6 h-6 text-gray-400" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <Link
                            href={item.productSlug ? `/products/${item.productSlug}` : `/products/${item.productId}`}
                            className="text-sm font-bold text-sparehub-dark hover:text-sparehub-orange transition-colors line-clamp-2 leading-snug"
                          >
                            {item.productTitle}
                          </Link>

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500 font-mono">
                            {item.brandName && (
                              <span className="font-sans font-medium text-gray-700">
                                {item.brandName}
                              </span>
                            )}
                            {item.partNumber && <span>• Part #: {item.partNumber}</span>}
                          </div>

                          <div className="text-xs font-semibold text-sparehub-dark pt-0.5">
                            Unit Price: {formatLKR(item.priceMinorUnits)}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Stepper, Subtotal, Delete */}
                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                        {/* Stepper */}
                        <div className="flex items-center gap-1.5 border border-sparehub-border rounded-lg bg-gray-50/60 p-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                            disabled={item.quantity <= 1 || isItemBusy}
                            className="w-7 h-7 rounded border border-sparehub-border bg-white flex items-center justify-center text-sparehub-dark hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-8 text-center font-bold text-xs text-sparehub-dark">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                            disabled={item.quantity >= item.stockQuantity || isItemBusy}
                            className="w-7 h-7 rounded border border-sparehub-border bg-white flex items-center justify-center text-sparehub-dark hover:bg-gray-100 disabled:opacity-40 transition-colors"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Item Total */}
                        <div className="text-right min-w-[90px]">
                          <span className="text-sm font-black text-sparehub-dark">
                            {formatLKR(item.priceMinorUnits * item.quantity)}
                          </span>
                        </div>

                        {/* Trash Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={isItemBusy}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Order Summary & Checkout CTA */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-6">
            <h2 className="text-base font-black text-sparehub-dark tracking-tight pb-3 border-b border-sparehub-border">
              Order Summary
            </h2>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>Items Subtotal ({cart.totalItemCount} items)</span>
                <span className="font-bold text-sparehub-dark">
                  {formatLKR(cart.totalGrandMinor)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Delivery Charges</span>
                <span className="text-[11px] font-medium text-gray-500">
                  Seller-Managed Courier
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Discounts</span>
                <span className="font-medium text-gray-500">LKR 0.00</span>
              </div>

              <div className="pt-3 border-t border-sparehub-border flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-black text-sparehub-dark block">Grand Total</span>
                  <span className="text-[10px] text-gray-400">All prices in Sri Lankan Rupees</span>
                </div>
                <span className="text-xl font-black text-sparehub-dark">
                  {formatLKR(cart.totalGrandMinor)}
                </span>
              </div>
            </div>

            <Link href="/checkout" className="block">
              <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full font-bold text-sm rounded-xl py-3.5 shadow-sm justify-center gap-2"
              >
                Proceed to Checkout
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>

            {/* Marketplace Guarantees */}
            <div className="pt-4 border-t border-sparehub-border space-y-3 text-xs text-gray-600">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-sparehub-success shrink-0 mt-0.5" />
                <span>
                  <strong>Multi-Vendor Protection:</strong> Your purchase is split into individual vendor orders for transparent fulfillment.
                </span>
              </div>
              <div className="flex items-start gap-2.5">
                <Truck className="w-4 h-4 text-sparehub-orange shrink-0 mt-0.5" />
                <span>
                  <strong>Islandwide Dispatch:</strong> Direct dispatch from verified sellers across Sri Lanka.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
