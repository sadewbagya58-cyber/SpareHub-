"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  ShoppingCart,
  ArrowRight,
  Calendar,
  MapPin,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatLKR } from "@/lib/utils";
import type { SellerSubOrder } from "@/lib/types";

interface SellerOrdersListProps {
  initialOrders: SellerSubOrder[];
  initialStatus: string;
}

const FILTER_TABS = [
  { label: "All Orders", value: "all" },
  { label: "New (Placed)", value: "placed" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Dispatched", value: "dispatched" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
] as const;

export function SellerOrdersList({
  initialOrders,
  initialStatus,
}: SellerOrdersListProps) {
  const [activeStatus, setActiveStatus] = useState<string>(initialStatus || "all");
  const [navigatingOrderId, setNavigatingOrderId] = useState<string | null>(null);

  const filteredOrders = useMemo(() => {
    if (!activeStatus || activeStatus === "all") {
      return initialOrders;
    }
    return initialOrders.filter((so) => so.status === activeStatus);
  }, [initialOrders, activeStatus]);

  const handleSelectTab = (statusValue: string) => {
    setActiveStatus(statusValue);
    if (typeof window !== "undefined") {
      const targetUrl =
        statusValue === "all"
          ? "/seller/orders"
          : `/seller/orders?status=${encodeURIComponent(statusValue)}`;
      window.history.replaceState(null, "", targetUrl);
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "delivered":
        return (
          <Badge variant="success" className="capitalize">
            {s}
          </Badge>
        );
      case "dispatched":
        return (
          <Badge variant="orange" className="capitalize">
            {s}
          </Badge>
        );
      case "processing":
      case "confirmed":
        return (
          <Badge
            variant="neutral"
            className="capitalize text-blue-700 bg-blue-50 border-blue-200"
          >
            {s}
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="error" className="capitalize">
            {s}
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="capitalize">
            {s}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Instant Client-Side Filter Tabs (<16ms synchronous state switch) */}
      <div
        role="tablist"
        aria-label="Filter seller orders by status"
        className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-sparehub-border scrollbar-none"
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          const count =
            tab.value === "all"
              ? initialOrders.length
              : initialOrders.filter((o) => o.status === tab.value).length;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelectTab(tab.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-150 whitespace-nowrap cursor-pointer active:scale-[0.97] inline-flex items-center gap-1.5 ${
                isActive
                  ? "bg-sparehub-orange text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-200/80 text-gray-600"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders List or Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl border border-sparehub-border bg-white text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-sparehub-orange flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-sparehub-dark">No Orders Found</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            {activeStatus === "all"
              ? "You haven't received any customer orders yet. Ensure your parts have accurate compatibility data to maximize search visibility."
              : `No orders currently in "${activeStatus}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((so) => {
            const isOpening = navigatingOrderId === so.id;
            return (
              <div
                key={so.id}
                className="p-5 sm:p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs hover:border-sparehub-orange/60 transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-mono text-sm font-black text-sparehub-dark">
                        {so.subOrderNumber}
                      </span>
                      {getStatusBadge(so.status)}
                      <span className="text-[11px] font-mono text-gray-400">
                        (Invoice: {so.customerOrder?.orderNumber})
                      </span>
                    </div>
                    <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      Ordered on{" "}
                      {new Date(so.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block uppercase tracking-wider">
                        Subtotal
                      </span>
                      <span className="text-base font-black text-sparehub-dark">
                        {formatLKR(so.subtotalMinor)}
                      </span>
                    </div>

                    <Link
                      href={`/seller/orders/${so.id}`}
                      onClick={() => setNavigatingOrderId(so.id)}
                      aria-busy={isOpening}
                      className="inline-flex items-center justify-center rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover text-xs px-3 py-1.5 gap-1.5 h-8 font-bold shadow-sm transition-all active:scale-[0.97]"
                    >
                      {isOpening ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Opening...
                        </>
                      ) : (
                        <>
                          Fulfill Order
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Link>
                  </div>
                </div>

                {/* Customer Delivery Summary & Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Customer Info */}
                  <div className="space-y-1 text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Customer Destination
                    </span>
                    <p className="font-bold text-sparehub-dark">
                      {so.customerOrder?.shippingFullName}
                    </p>
                    <p className="flex items-center gap-1 text-[11px]">
                      <MapPin className="w-3 h-3 text-sparehub-orange shrink-0" />
                      {so.customerOrder?.shippingCity},{" "}
                      {so.customerOrder?.shippingDistrict}
                    </p>
                    <p className="text-[11px] text-gray-500 font-mono">
                      Tel: {so.customerOrder?.shippingPhone}
                    </p>
                  </div>

                  {/* Items Summary */}
                  <div className="space-y-1 text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                      Purchased Parts ({so.items?.length || 0})
                    </span>
                    <div className="space-y-1">
                      {(so.items || []).map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="line-clamp-1 max-w-[220px]">
                            {item.quantity}× {item.productTitle}
                          </span>
                          <span className="font-mono text-gray-700">
                            {formatLKR(item.totalPriceMinorUnits)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
