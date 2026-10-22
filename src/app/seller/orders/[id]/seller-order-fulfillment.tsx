"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  Phone,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Package
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatLKR } from "@/lib/utils";
import type { SellerSubOrder } from "@/lib/types";
import { updateSellerOrderStatusAction } from "@/lib/orders/actions";

interface SellerOrderFulfillmentProps {
  subOrder: SellerSubOrder;
}

export function SellerOrderFulfillment({ subOrder }: SellerOrderFulfillmentProps) {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dispatch Form State
  const [courierName, setCourierName] = useState(subOrder.courierName || "Domex Courier");
  const [trackingNumber, setTrackingNumber] = useState(subOrder.trackingNumber || "");
  const [trackingUrl, setTrackingUrl] = useState(subOrder.trackingUrl || "");
  const [showDispatchModal, setShowDispatchModal] = useState(false);

  // Cancel Form State
  const [cancellationReason, setCancellationReason] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  const handleStatusTransition = async (
    targetStatus: "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled",
    options?: { courierName?: string; trackingNumber?: string; trackingUrl?: string; cancellationReason?: string }
  ) => {
    setLoading(true);
    setActionStatus(targetStatus);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await updateSellerOrderStatusAction(subOrder.id, targetStatus, options);
      if (!res.success) {
        setErrorMessage(res.message || "Failed to update status.");
      } else {
        setSuccessMessage(`Order status updated to ${targetStatus}!`);
        setShowDispatchModal(false);
        setShowCancelModal(false);
        router.refresh();
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Network or server error updating fulfillment status. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      setActionStatus(null);
    }
  };

  const currentStatus = subOrder.status;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
      {/* Top Header */}
      <div>
        <Link
          href="/seller/orders"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Store Orders
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
                Fulfill Order {subOrder.subOrderNumber}
              </h1>
              <Badge variant="orange" className="capitalize">
                {currentStatus}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Customer Invoice: <code className="font-mono text-sparehub-dark font-bold">{subOrder.customerOrder?.orderNumber}</code>
              {" • "}
              Placed on {new Date(subOrder.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-gray-400 block uppercase tracking-wider">
              Store Subtotal
            </span>
            <span className="text-2xl font-black text-sparehub-dark">
              {formatLKR(subOrder.subtotalMinor)}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-sparehub-success shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-sparehub-error shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Fulfillment Status Progress Bar */}
      <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Fulfillment Stage
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { key: "placed", label: "1. Placed" },
            { key: "confirmed", label: "2. Confirmed" },
            { key: "processing", label: "3. Packing" },
            { key: "dispatched", label: "4. Dispatched" },
          ].map((stage) => {
            const isCompleted =
              (stage.key === "placed") ||
              (stage.key === "confirmed" && ["confirmed", "processing", "dispatched", "delivered"].includes(currentStatus)) ||
              (stage.key === "processing" && ["processing", "dispatched", "delivered"].includes(currentStatus)) ||
              (stage.key === "dispatched" && ["dispatched", "delivered"].includes(currentStatus));

            const isCurrent = currentStatus === stage.key;

            return (
              <div
                key={stage.key}
                className={`p-3 rounded-xl border text-center transition-all ${
                  isCurrent
                    ? "border-sparehub-orange bg-orange-50/60 font-bold text-sparehub-orange"
                    : isCompleted
                    ? "border-green-200 bg-green-50/50 text-sparehub-success font-semibold"
                    : "border-gray-200 bg-gray-50 text-gray-400 font-medium"
                }`}
              >
                <span className="text-xs">{stage.label}</span>
              </div>
            );
          })}
        </div>

        {/* Action Controls based on currentStatus */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          {currentStatus === "placed" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={actionStatus === "confirmed"}
                loadingText="Confirming..."
                disabled={loading}
                onClick={() => handleStatusTransition("confirmed")}
                className="gap-2 font-bold"
              >
                <CheckCircle2 className="w-4 h-4" />
                Accept &amp; Confirm Order
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={loading}
                onClick={() => setShowCancelModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
              >
                Reject Order
              </Button>
            </>
          )}

          {currentStatus === "confirmed" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                isLoading={actionStatus === "processing"}
                loadingText="Updating..."
                disabled={loading}
                onClick={() => handleStatusTransition("processing")}
                className="gap-2 font-bold bg-blue-600 hover:bg-blue-700"
              >
                <Package className="w-4 h-4" />
                Start Packing (Processing)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={loading}
                onClick={() => setShowCancelModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
              >
                Cancel Order
              </Button>
            </>
          )}

          {currentStatus === "processing" && (
            <>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={loading}
                onClick={() => setShowDispatchModal(true)}
                className="gap-2 font-bold"
              >
                <Truck className="w-4 h-4" />
                Mark Dispatched &amp; Add Tracking
              </Button>
              <Button
                type="button"
                variant="outline"
                size="md"
                disabled={loading}
                onClick={() => setShowCancelModal(true)}
                className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
              >
                Cancel Order
              </Button>
            </>
          )}

          {currentStatus === "dispatched" && (
            <Button
              type="button"
              variant="primary"
              size="md"
              isLoading={actionStatus === "delivered"}
              loadingText="Marking..."
              disabled={loading}
              onClick={() => handleStatusTransition("delivered")}
              className="gap-2 font-bold bg-green-600 hover:bg-green-700"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Delivered
            </Button>
          )}

          {currentStatus === "delivered" && (
            <div className="flex items-center gap-2 text-xs font-bold text-sparehub-success bg-green-50 px-3 py-2 rounded-xl border border-green-200">
              <CheckCircle2 className="w-4 h-4" />
              Order fully fulfilled and delivered to customer.
            </div>
          )}

          {currentStatus === "cancelled" && (
            <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl border border-red-200">
              <XCircle className="w-4 h-4" />
              Order cancelled. Stock has been restored. Reason: {subOrder.cancellationReason || "None"}
            </div>
          )}
        </div>
      </div>

      {/* Main Grid: Order Items & Customer Address */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Ordered Items List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <h2 className="text-base font-bold text-sparehub-dark pb-2 border-b border-sparehub-border flex items-center gap-2">
              <Package className="w-4 h-4 text-sparehub-orange" />
              Ordered Spare Parts ({subOrder.items?.length || 0})
            </h2>

            <div className="divide-y divide-gray-100">
              {(subOrder.items || []).map((item) => (
                <div key={item.id} className="py-3.5 flex items-center justify-between gap-4 text-xs">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="font-bold text-sparehub-dark">
                      {item.productTitle}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                      {item.brandName && <span>{item.brandName}</span>}
                      {item.partNumber && <span>• Part #: {item.partNumber}</span>}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-gray-500 block">
                      {item.quantity} × {formatLKR(item.unitPriceMinorUnits)}
                    </span>
                    <span className="font-black text-sparehub-dark mt-0.5">
                      {formatLKR(item.totalPriceMinorUnits)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>Merchandise Subtotal</span>
                <span className="font-bold text-sparehub-dark">{formatLKR(subOrder.subtotalMinor)}</span>
              </div>
              <div className="flex items-center justify-between text-gray-600">
                <span>Delivery Fee (Courier)</span>
                <span className="font-medium text-gray-700">
                  {subOrder.deliveryFeeMinor > 0 ? formatLKR(subOrder.deliveryFeeMinor) : "Free"}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200 flex items-center justify-between font-bold text-sm text-sparehub-dark">
                <span>Sub-Order Total</span>
                <span>{formatLKR(subOrder.totalAmountMinor || (subOrder.subtotalMinor + subOrder.deliveryFeeMinor))}</span>
              </div>
            </div>
          </div>

          {/* Audit History Timeline */}
          {subOrder.history && subOrder.history.length > 0 && (
            <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Fulfillment Activity Trail
              </h3>
              <div className="space-y-2">
                {subOrder.history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2.5 text-xs text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="font-bold capitalize text-sparehub-dark">{h.toStatus}:</span>
                    <span className="text-gray-600">{h.notes}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer Shipping Address */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-sparehub-dark pb-2 border-b border-sparehub-border flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sparehub-orange" />
              Delivery Destination
            </h3>

            <div className="space-y-2.5 text-xs text-gray-600">
              <p className="font-bold text-sparehub-dark text-sm">
                {subOrder.customerOrder?.shippingFullName}
              </p>

              {subOrder.customerOrder?.shippingPhone && (
                <a
                  href={`tel:${subOrder.customerOrder.shippingPhone}`}
                  className="flex items-center gap-1.5 text-sparehub-orange font-bold hover:underline"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {subOrder.customerOrder.shippingPhone}
                </a>
              )}

              <div className="pt-1 leading-relaxed text-gray-700">
                <p>{subOrder.customerOrder?.shippingAddressLine1}</p>
                {subOrder.customerOrder?.shippingAddressLine2 && (
                  <p>{subOrder.customerOrder.shippingAddressLine2}</p>
                )}
                <p className="font-semibold text-sparehub-dark">
                  {subOrder.customerOrder?.shippingCity}, {subOrder.customerOrder?.shippingDistrict}
                  {subOrder.customerOrder?.shippingPostalCode ? ` ${subOrder.customerOrder.shippingPostalCode}` : ""}
                </p>
              </div>

              {subOrder.customerOrder?.customerNotes && (
                <div className="pt-2 text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-200">
                  <strong>Customer Instructions:</strong> {subOrder.customerOrder.customerNotes}
                </div>
              )}
            </div>
          </div>

          {/* Payment Notice */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-2 text-xs">
            <h3 className="font-bold text-sparehub-dark">Payment Mode</h3>
            <p className="text-gray-600">
              Method: <strong className="capitalize">{subOrder.customerOrder?.paymentMethod === "cod" ? "Cash on Delivery (Courier Collects)" : "Online Payment"}</strong>
            </p>
            <p className="text-gray-500 text-[11px]">
              Status:{" "}
              {currentStatus === "cancelled" && subOrder.customerOrder?.paymentStatus === "unpaid" ? (
                <strong className="text-gray-500">Unpaid (Cancelled)</strong>
              ) : currentStatus === "delivered" && subOrder.customerOrder?.paymentMethod === "cod" ? (
                <strong className="text-sparehub-success">Paid on Delivery</strong>
              ) : (
                <strong className="capitalize">{subOrder.customerOrder?.paymentStatus.replace("_", " ")}</strong>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Dispatch Modal */}
      {showDispatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 pb-2 border-b border-sparehub-border">
              <Truck className="w-5 h-5 text-sparehub-orange" />
              <h3 className="font-bold text-base text-sparehub-dark">
                Dispatch Order &amp; Courier Details
              </h3>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Courier Service Name
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Domex, PromptX, Pronto, Koombiyo, Citypak"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Courier Tracking Waybill / Consignment #
                </label>
                <Input
                  type="text"
                  placeholder="e.g. DMX-88912389"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Tracking Web URL (Optional)
                </label>
                <Input
                  type="url"
                  placeholder="https://domex.lk/tracking?id=..."
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => setShowDispatchModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={actionStatus === "dispatched"}
                loadingText="Recording Dispatch..."
                disabled={loading || !trackingNumber.trim()}
                onClick={() =>
                  handleStatusTransition("dispatched", {
                    courierName,
                    trackingNumber,
                    trackingUrl: trackingUrl || undefined,
                  })
                }
              >
                Confirm Dispatch
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl animate-in zoom-in-95">
            <div className="flex items-center gap-2 text-red-600 pb-2 border-b border-sparehub-border">
              <XCircle className="w-5 h-5" />
              <h3 className="font-bold text-base text-sparehub-dark">
                Reject / Cancel Sub-Order?
              </h3>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              If you cancel, items will be marked unfulfilled and inventory stock will be restored automatically.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-sparehub-dark">
                Cancellation Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                placeholder="Item damaged during packing, out of stock, customer requested cancel, etc."
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                className="w-full rounded-lg border border-sparehub-border p-2 text-xs focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loading}
                onClick={() => setShowCancelModal(false)}
              >
                Close
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={actionStatus === "cancelled"}
                loadingText="Cancelling..."
                disabled={loading || !cancellationReason.trim()}
                onClick={() =>
                  handleStatusTransition("cancelled", {
                    cancellationReason,
                  })
                }
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
