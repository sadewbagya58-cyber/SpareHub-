"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Store,
  MapPin,
  Lock,
  AlertCircle,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { formatLKR } from "@/lib/utils";
import type { CartResponse } from "@/lib/cart/actions";
import { processCheckoutAction, type CheckoutPayload } from "@/lib/orders/actions";
import { calculateMultiVendorDeliverySummary } from "@/lib/orders/delivery";

interface CheckoutFormProps {
  cart: CartResponse;
  initialProfile?: {
    fullName?: string;
    phone?: string;
    email?: string;
  };
  isBuyNow?: boolean;
  buyNowProductId?: string;
  buyNowQuantity?: number;
}

export function CheckoutForm({
  cart,
  initialProfile,
  isBuyNow = false,
  buyNowProductId,
  buyNowQuantity,
}: CheckoutFormProps) {
  const router = useRouter();

  // Form State
  const [fullName, setFullName] = useState(initialProfile?.fullName || "");
  const [phone, setPhone] = useState(initialProfile?.phone || "");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("cod");
  const [customerNotes, setCustomerNotes] = useState("");

  // Submission State
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `chk-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

  // Delivery fee summary based on selected destination district
  const deliverySummary = useMemo(() => {
    const shopList = cart.groups.map((g) => ({
      shop: {
        id: g.shopId,
        name: g.shopName,
        delivery_enabled: g.deliveryEnabled ?? true,
        default_delivery_fee_minor: g.defaultDeliveryFeeMinor ?? 0,
        district_delivery_fees: g.districtDeliveryFees || null,
        free_delivery_threshold_minor: g.freeDeliveryThresholdMinor ?? null,
        supported_districts: g.supportedDistricts || null,
        estimated_delivery_days: g.estimatedDeliveryDays || "2-4 business days",
      },
      merchandiseSubtotalMinor: g.subtotalMinorUnits,
    }));
    return calculateMultiVendorDeliverySummary(shopList, district);
  }, [cart.groups, district]);

  const totalDeliveryFee = deliverySummary.allowed ? deliverySummary.totalDeliveryFeeMinor : 0;
  const grandTotalWithDelivery = cart.totalGrandMinor + totalDeliveryFee;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!deliverySummary.allowed) {
      setErrorMessage(deliverySummary.error || "Delivery is unavailable for the selected district.");
      return;
    }

    setErrorMessage(null);
    setLoading(true);

    const payload: CheckoutPayload = {
      shippingFullName: fullName,
      shippingPhone: phone,
      shippingAddressLine1: addressLine1,
      shippingAddressLine2: addressLine2 || undefined,
      shippingDistrict: district,
      shippingCity: city,
      shippingPostalCode: postalCode || undefined,
      paymentMethod,
      customerNotes: customerNotes || undefined,
      idempotencyKey,
      isBuyNow,
      buyNowProductId,
      buyNowQuantity,
    };

    try {
      const res = await processCheckoutAction(payload);
      if (!res.success) {
        setErrorMessage(res.message || "Failed to process order.");
        setLoading(false);
      } else if (res.orderId) {
        if (!isBuyNow) {
          // Standard cart checkout clears the cart
          window.dispatchEvent(
            new CustomEvent("sparehub:cart-updated", {
              detail: { count: 0 },
            })
          );
        }
        // Successful order placement -> redirect to customer order tracking page
        router.push(`/orders/${res.orderId}`);
      }
    } catch {
      setErrorMessage("A network or server error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-3 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-sparehub-error shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Delivery & Payment Details */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Contact Information */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
              <User className="w-5 h-5 text-sparehub-orange" />
              <h2 className="text-base font-bold text-sparehub-dark">
                1. Recipient Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Kasun Perera"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Contact Phone Number <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  required
                  placeholder="0771234567 or +94771234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="text-xs"
                />
                <span className="text-[10px] text-gray-400">
                  Used by dispatch couriers for delivery updates
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Delivery Address (Sri Lanka) */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
              <MapPin className="w-5 h-5 text-sparehub-orange" />
              <h2 className="text-base font-bold text-sparehub-dark">
                2. Delivery Destination
              </h2>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Street Address Line 1 <span className="text-red-500">*</span>
                </label>
                <Input
                  type="text"
                  required
                  placeholder="House number, building, street name"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Address Line 2 (Optional)
                </label>
                <Input
                  type="text"
                  placeholder="Apartment, suite, unit, or landmark"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-sparehub-dark">
                    District <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full rounded-lg border border-sparehub-border bg-white px-3 py-2 text-xs text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                  >
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-sparehub-dark">
                    City / Town <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Nugegoda"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-sparehub-dark">
                    Postal Code
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. 10250"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-sparehub-dark">
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Special instructions for courier handling or garage delivery..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full rounded-lg border border-sparehub-border bg-white p-2.5 text-xs text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange resize-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payment Method */}
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
              <Banknote className="w-5 h-5 text-sparehub-orange" />
              <h2 className="text-base font-bold text-sparehub-dark">
                3. Payment Method
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Cash on Delivery */}
              <label
                className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "cod"
                    ? "border-sparehub-orange bg-orange-50/40 ring-1 ring-sparehub-orange"
                    : "border-sparehub-border bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-1 text-sparehub-orange focus:ring-sparehub-orange"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-sparehub-dark">
                      Cash on Delivery
                    </span>
                    <Badge variant="success" size="sm" className="text-[9px]">
                      Recommended
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Pay securely in cash or via local bank transfer directly to the courier upon delivery of your parts.
                  </p>
                </div>
              </label>

              {/* Option B: Online Card Payment */}
              <label
                className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                  paymentMethod === "online"
                    ? "border-sparehub-orange bg-orange-50/40 ring-1 ring-sparehub-orange"
                    : "border-sparehub-border bg-white hover:bg-gray-50"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="online"
                  checked={paymentMethod === "online"}
                  onChange={() => setPaymentMethod("online")}
                  className="mt-1 text-sparehub-orange focus:ring-sparehub-orange"
                />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-sparehub-dark">
                      Online Card Payment
                    </span>
                    <Badge variant="neutral" size="sm" className="text-[9px]">
                      Visa / Mastercard
                    </Badge>
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Integrated online gateway (PayHere / IPG Sandbox). Order records as pending online payment.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Order Review & Submit CTA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-5">
            <h2 className="text-base font-black text-sparehub-dark tracking-tight pb-3 border-b border-sparehub-border">
              Review Items &amp; Sub-Orders
            </h2>

            {/* Vendor Sub-Orders Breakdown */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
              {cart.groups.map((group) => (
                <div
                  key={group.shopId}
                  className="p-3.5 rounded-xl border border-sparehub-border bg-gray-50/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs pb-1.5 border-b border-gray-200">
                    <span className="font-bold text-sparehub-dark flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 text-sparehub-orange" />
                      {group.shopName}
                    </span>
                    <div className="text-right">
                      <span className="font-black text-sparehub-dark block">
                        {formatLKR(group.subtotalMinorUnits)}
                      </span>
                      {(() => {
                        const sf = deliverySummary.shopFees.find((s) => s.shopId === group.shopId);
                        if (!sf) return null;
                        if (sf.error) return <span className="text-[10px] text-red-600 block">Delivery unavailable</span>;
                        return (
                          <span className="text-[10px] text-gray-500 block">
                            + Delivery: {sf.isFree ? "Free" : formatLKR(sf.deliveryFeeMinor)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between text-[11px] text-gray-600"
                      >
                        <span className="line-clamp-1 max-w-[200px]">
                          {item.quantity}x {item.productTitle}
                        </span>
                        <span className="font-mono text-gray-800">
                          {formatLKR(item.priceMinorUnits * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Financial Totals */}
            <div className="pt-3 border-t border-sparehub-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-gray-600">
                <span>Items Subtotal</span>
                <span className="font-bold text-sparehub-dark">
                  {formatLKR(cart.totalGrandMinor)}
                </span>
              </div>

              <div className="flex items-center justify-between text-gray-600">
                <span>Estimated Delivery ({district})</span>
                <span className="font-medium text-sparehub-dark">
                  {deliverySummary.allowed
                    ? totalDeliveryFee > 0
                      ? formatLKR(totalDeliveryFee)
                      : "Free Delivery"
                    : "Unavailable"}
                </span>
              </div>

              {!deliverySummary.allowed && deliverySummary.error && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{deliverySummary.error}</span>
                </div>
              )}

              <div className="pt-3 border-t border-sparehub-border flex items-baseline justify-between">
                <div>
                  <span className="text-sm font-black text-sparehub-dark block">Grand Total</span>
                  <span className="text-[10px] text-gray-400">Total payable in LKR</span>
                </div>
                <span className="text-2xl font-black text-sparehub-dark">
                  {formatLKR(grandTotalWithDelivery)}
                </span>
              </div>
            </div>

            {/* Checkout Action Button */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={loading}
              loadingText="Placing Secure Order..."
              disabled={loading || !deliverySummary.allowed}
              className="w-full font-bold text-sm rounded-xl py-4 shadow-sm justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Place Order • {formatLKR(grandTotalWithDelivery)}
            </Button>

            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              By placing your order, you agree to SpareHub&apos;s customer terms, anti-counterfeit guarantee, and vendor direct dispatch policies.
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
