"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Truck,
  CheckCircle2,
  XCircle,
  MapPin,
  Phone,
  Banknote,
  Calendar,
  AlertCircle,
  ArrowLeft,
  ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatLKR } from "@/lib/utils";
import type { CustomerOrderSummary } from "@/lib/types";
import { cancelCustomerOrderAction } from "@/lib/orders/actions";

interface OrderDetailViewProps {
  order: CustomerOrderSummary;
}

export function OrderDetailView({ order }: OrderDetailViewProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasNonCancellableSubOrder = (order.sellerOrders || []).some(
    (so) =>
      so.status === "confirmed" ||
      so.status === "processing" ||
      so.status === "dispatched" || so.status === "delivered" ||
      so.status === "cancelled" ||
      so.status === "returned"
  );
  const canCancel =
    order.status === "pending" &&
    !hasNonCancellableSubOrder &&
    (order.sellerOrders || []).length > 0 &&
    (order.sellerOrders || []).every((so) => so.status === "placed");

  const handleCancelOrder = async () => {
    setCancelling(true);
    setErrorMessage(null);

    try {
      const res = await cancelCustomerOrderAction(order.id, cancelReason);
      if (!res.success) {
        setErrorMessage(res.message || "Failed to cancel order.");
      } else {
        setShowCancelModal(false);
        router.refresh();
      }
    } catch {
      setErrorMessage("Network error cancelling order. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "delivered":
        return <Badge variant="success" className="capitalize">{status}</Badge>;
      case "dispatched":
      case "partially_dispatched":
        return <Badge variant="orange" className="capitalize">{status.replace("_", " ")}</Badge>;
      case "processing":
      case "confirmed":
        return <Badge variant="neutral" className="capitalize text-blue-700 bg-blue-50 border-blue-200">{status}</Badge>;
      case "cancelled":
        return <Badge variant="error" className="capitalize">{status}</Badge>;
      default:
        return <Badge variant="neutral" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Navigation & Header */}
      <div className="space-y-4">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Orders
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
                Order {order.orderNumber}
              </h1>
              {getStatusBadge(order.status)}
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5" />
              Placed on {new Date(order.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {canCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 font-semibold"
            >
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-sparehub-error shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Grid: Sub-Orders by Vendor & Sidebar Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Vendor Sub-Orders */}
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-black text-sparehub-dark">
              Dispatched Sub-Orders ({order.sellerOrders?.length || 0} Vendors)
            </h2>
            <p className="text-xs text-gray-500">
              Each vendor shop packages and ships parts directly to your address.
            </p>
          </div>

          {(order.sellerOrders || []).map((subOrder) => (
            <div
              key={subOrder.id}
              className="rounded-2xl border border-sparehub-border bg-white overflow-hidden shadow-xs space-y-4"
            >
              {/* Sub-order Header */}
              <div className="px-5 py-4 bg-gray-50/80 border-b border-sparehub-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-sparehub-border flex items-center justify-center text-sparehub-orange shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-sparehub-dark">
                        {subOrder.shopName}
                      </h3>
                      {getStatusBadge(subOrder.status)}
                    </div>
                    <span className="text-[11px] font-mono text-gray-400 block">
                      Sub-Order: {subOrder.subOrderNumber}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[11px] text-gray-400 block">
                    Subtotal: {formatLKR(subOrder.subtotalMinor)}
                    {subOrder.deliveryFeeMinor > 0 && ` + Delivery: ${formatLKR(subOrder.deliveryFeeMinor)}`}
                  </span>
                  <span className="text-sm font-black text-sparehub-dark">
                    Total: {formatLKR(subOrder.totalAmountMinor || (subOrder.subtotalMinor + subOrder.deliveryFeeMinor))}
                  </span>
                </div>
              </div>

              {/* Courier Tracking Banner (if available) */}
              {subOrder.trackingNumber && (
                <div className="mx-5 p-3 rounded-xl bg-orange-50 border border-orange-200 text-xs text-orange-900 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Truck className="w-4 h-4 text-sparehub-orange shrink-0" />
                    <span>
                      Courier: <strong>{subOrder.courierName || "Standard Dispatch"}</strong> • Tracking: <code className="font-mono">{subOrder.trackingNumber}</code>
                    </span>
                  </div>
                  {subOrder.trackingUrl && (
                    <a
                      href={subOrder.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-bold text-sparehub-orange hover:underline text-[11px]"
                    >
                      Track Package <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              )}

              {/* Ordered Items List */}
              <div className="px-5 divide-y divide-gray-100">
                {(subOrder.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="py-3.5 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <p className="font-bold text-sparehub-dark line-clamp-1">
                        {item.productTitle}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-400 font-mono">
                        {item.brandName && <span>{item.brandName}</span>}
                        {item.partNumber && <span>• Part #: {item.partNumber}</span>}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-gray-500">
                        {item.quantity} × {formatLKR(item.unitPriceMinorUnits)}
                      </span>
                      <span className="block font-black text-sparehub-dark mt-0.5">
                        {formatLKR(item.totalPriceMinorUnits)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Audit / Tracking History */}
              {subOrder.history && subOrder.history.length > 0 && (
                <div className="px-5 pb-4 pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    Fulfillment Timeline
                  </span>
                  <div className="space-y-1.5">
                    {subOrder.history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-[11px] text-gray-500">
                        <CheckCircle2 className="w-3 h-3 text-sparehub-success shrink-0" />
                        <span className="font-medium text-gray-700 capitalize">{h.toStatus}</span>
                        <span className="text-gray-400">—</span>
                        <span>{h.notes || "Status updated"}</span>
                        <span className="text-gray-400 text-[10px] ml-auto">
                          {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Column: Order Summary & Delivery Address */}
        <div className="lg:col-span-4 space-y-6">
          {/* Destination & Contact */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-sparehub-dark pb-2 border-b border-sparehub-border flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sparehub-orange" />
              Delivery Destination
            </h3>

            <div className="space-y-2 text-xs text-gray-600">
              <p className="font-bold text-sparehub-dark text-sm">
                {order.shippingFullName}
              </p>
              <p className="flex items-center gap-1.5 text-gray-700">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {order.shippingPhone}
              </p>
              <div className="pt-1 leading-relaxed">
                <p>{order.shippingAddressLine1}</p>
                {order.shippingAddressLine2 && <p>{order.shippingAddressLine2}</p>}
                <p>
                  {order.shippingCity}, {order.shippingDistrict}
                  {order.shippingPostalCode ? ` ${order.shippingPostalCode}` : ""}
                </p>
              </div>

              {order.customerNotes && (
                <div className="pt-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <strong>Notes:</strong> {order.customerNotes}
                </div>
              )}
            </div>
          </div>

          {/* Payment & Financial Breakdown */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-sparehub-dark pb-2 border-b border-sparehub-border flex items-center gap-2">
              <Banknote className="w-4 h-4 text-sparehub-orange" />
              Payment Summary
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Method</span>
                <span className="font-bold text-sparehub-dark capitalize">
                  {order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Card"}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-500">Payment Status</span>
                {order.status === "cancelled" && order.paymentStatus === "unpaid" ? (
                  <span className="font-bold text-gray-500">Unpaid (Cancelled)</span>
                ) : order.paymentStatus === "captured" && order.paymentMethod === "cod" ? (
                  <span className="font-bold text-sparehub-success">Paid on Delivery</span>
                ) : (
                  <span className="font-bold text-sparehub-dark capitalize">
                    {order.paymentStatus.replace("_", " ")}
                  </span>
                )}
              </div>

              <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                <span className="text-gray-600">Items Subtotal</span>
                <span className="font-bold text-sparehub-dark">
                  {formatLKR(order.totalItemsSubtotalMinor)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-600">Delivery Fee</span>
                <span className="font-medium text-gray-700">
                  {order.totalDeliveryFeeMinor > 0 ? formatLKR(order.totalDeliveryFeeMinor) : "Free"}
                </span>
              </div>

              <div className="pt-3 border-t border-sparehub-border flex items-baseline justify-between">
                <span className="font-black text-sm text-sparehub-dark">Total Grand</span>
                <span className="font-black text-xl text-sparehub-dark">
                  {formatLKR(order.totalGrandMinor)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-bold text-base text-sparehub-dark">
                Cancel Order {order.orderNumber}?
              </h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Are you sure you want to cancel this order? Stock will be immediately restored to the sellers&apos; inventories.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-sparehub-dark">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="Ordered by mistake, changed vehicle, etc."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full rounded-lg border border-sparehub-border p-2 text-xs focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={cancelling}
                onClick={() => setShowCancelModal(false)}
              >
                Keep Order
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={cancelling}
                loadingText="Cancelling..."
                disabled={cancelling}
                onClick={handleCancelOrder}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
