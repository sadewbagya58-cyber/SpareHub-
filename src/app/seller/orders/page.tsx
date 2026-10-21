import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingCart,
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getSellerOrdersAction } from "@/lib/orders/actions";
import { Badge } from "@/components/ui/badge";
import { formatLKR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller Orders Fulfillment | SpareHub",
  description: "Fulfill customer orders, track courier dispatches, and manage store sub-orders.",
};

interface SellerOrdersPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SellerOrdersPage({ searchParams }: SellerOrdersPageProps) {
  const authData = await getCurrentUserProfile();
  if (!authData || !authData.user) {
    redirect("/login?redirect=/seller/orders");
  }

  const { status } = await searchParams;
  const currentStatus = status || "all";

  const { orders, shopName } = await getSellerOrdersAction(currentStatus);

  const filterTabs = [
    { label: "All Orders", value: "all" },
    { label: "New (Placed)", value: "placed" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Processing", value: "processing" },
    { label: "Dispatched", value: "dispatched" },
    { label: "Delivered", value: "delivered" },
    { label: "Cancelled", value: "cancelled" },
  ];

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "delivered":
        return <Badge variant="success" className="capitalize">{s}</Badge>;
      case "dispatched":
        return <Badge variant="orange" className="capitalize">{s}</Badge>;
      case "processing":
      case "confirmed":
        return <Badge variant="neutral" className="capitalize text-blue-700 bg-blue-50 border-blue-200">{s}</Badge>;
      case "cancelled":
        return <Badge variant="error" className="capitalize">{s}</Badge>;
      default:
        return <Badge variant="neutral" className="capitalize">{s}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/seller/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Seller Dashboard
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
                Store Orders &amp; Fulfillment
              </h1>
              <Badge variant="orange" size="sm">
                {shopName || "Vendor"}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Process customer purchases, record courier dispatches, and track delivered parts.
            </p>
          </div>

          <Link
            href="/seller/products"
            className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 gap-1.5 h-8 font-semibold transition-all active:scale-[0.97]"
          >
            Manage Products
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-sparehub-border scrollbar-none">
        {filterTabs.map((tab) => {
          const isActive = currentStatus === tab.value;
          return (
            <Link
              key={tab.value}
              href={tab.value === "all" ? "/seller/orders" : `/seller/orders?status=${tab.value}`}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? "bg-sparehub-orange text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Orders List or Empty State */}
      {orders.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl border border-sparehub-border bg-white text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-sparehub-orange flex items-center justify-center mx-auto">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-sparehub-dark">No Orders Found</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            {currentStatus === "all"
              ? "You haven't received any customer orders yet. Ensure your parts have accurate compatibility data to maximize search visibility."
              : `No orders currently in "${currentStatus}" status.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((so) => (
            <div
              key={so.id}
              className="p-5 sm:p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs hover:border-sparehub-orange/60 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
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
                    Ordered on {new Date(so.createdAt).toLocaleDateString("en-US", {
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
                    className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover text-xs px-3 py-1.5 gap-1 h-8 font-bold shadow-sm transition-all active:scale-[0.97]"
                  >
                    Fulfill Order
                    <ArrowRight className="w-3.5 h-3.5" />
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
                    {so.customerOrder?.shippingCity}, {so.customerOrder?.shippingDistrict}
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
                      <div key={idx} className="flex items-center justify-between text-[11px]">
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
          ))}
        </div>
      )}
    </div>
  );
}
