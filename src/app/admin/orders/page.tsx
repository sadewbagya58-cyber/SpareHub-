import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Search,
  ShoppingCart,
  Calendar,
  DollarSign,
  Store,
  ArrowRight
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getAdminOrdersAction } from "@/lib/orders/actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatLKR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Orders Oversight | SpareHub",
  description: "Platform-wide customer orders, multi-vendor sub-orders, and GMV monitoring.",
};

interface AdminOrdersPageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const authData = await getCurrentUserProfile();
  if (!authData || !authData.user) {
    redirect("/login?redirect=/admin/orders");
  }

  const { profile } = authData;
  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  if (!roles.includes("platform_admin")) {
    redirect("/");
  }

  const { q, status } = await searchParams;
  const currentStatus = status || "all";
  const searchQuery = q || "";

  const { orders, totalCount, totalGmvMinor } = await getAdminOrdersAction({
    query: searchQuery,
    status: currentStatus,
  });

  const filterTabs = [
    { label: "All Orders", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Confirmed", value: "confirmed" },
    { label: "Processing", value: "processing" },
    { label: "Partially Dispatched", value: "partially_dispatched" },
    { label: "Completed", value: "completed" },
    { label: "Cancelled", value: "cancelled" },
  ];

  const getStatusBadge = (s: string) => {
    switch (s) {
      case "completed":
        return <Badge variant="success" className="capitalize">{s}</Badge>;
      case "partially_dispatched":
      case "processing":
      case "confirmed":
        return <Badge variant="neutral" className="capitalize text-blue-700 bg-blue-50 border-blue-200">{s.replace("_", " ")}</Badge>;
      case "cancelled":
        return <Badge variant="error" className="capitalize">{s}</Badge>;
      default:
        return <Badge variant="neutral" className="capitalize">{s}</Badge>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Top Banner */}
      <div>
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin Control Center
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
                Platform Orders Oversight
              </h1>
              <Badge variant="error" size="sm">
                Admin
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Supervise all customer orders, multi-vendor sub-orders, and payment reconciliation across Sri Lanka.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 gap-1.5 h-8 font-semibold transition-all active:scale-[0.97]"
            >
              Shop Moderation
            </Link>
          </div>
        </div>
      </div>

      {/* Financial Metrics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Total Orders Placed</p>
              <h2 className="text-2xl font-black text-sparehub-dark mt-1">
                {totalCount}
              </h2>
              <span className="text-[10px] text-gray-400">All customer invoices</span>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 text-sparehub-orange">
              <ShoppingCart className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium">Platform Gross Merchandise Value (GMV)</p>
              <h2 className="text-2xl font-black text-sparehub-success mt-1">
                {formatLKR(totalGmvMinor)}
              </h2>
              <span className="text-[10px] text-gray-400">Cumulative sales volume</span>
            </div>
            <div className="p-3 rounded-xl bg-green-50 text-sparehub-success">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Status Filters */}
      <div className="space-y-4">
        <form method="GET" action="/admin/orders" className="relative max-w-md">
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by Order #, Customer Name, or Phone..."
            className="w-full rounded-xl border border-sparehub-border bg-white py-2.5 pl-10 pr-24 text-xs text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange shadow-xs"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          {currentStatus !== "all" && (
            <input type="hidden" name="status" value={currentStatus} />
          )}
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-sparehub-dark text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-sparehub-border scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = currentStatus === tab.value;
            const href = tab.value === "all"
              ? (searchQuery ? `/admin/orders?q=${encodeURIComponent(searchQuery)}` : "/admin/orders")
              : `/admin/orders?status=${tab.value}${searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : ""}`;

            return (
              <Link
                key={tab.value}
                href={href}
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
      </div>

      {/* Orders Table */}
      {orders.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl border border-sparehub-border bg-white text-center space-y-3 shadow-xs">
          <ShoppingCart className="w-10 h-10 text-gray-400 mx-auto" />
          <h2 className="text-base font-bold text-sparehub-dark">No Orders Found</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {searchQuery
              ? `No orders matching query "${searchQuery}".`
              : "No customer orders placed yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-5 rounded-2xl border border-sparehub-border bg-white shadow-xs space-y-4 hover:border-sparehub-orange/60 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-black text-sparehub-dark">
                      {order.orderNumber}
                    </span>
                    {getStatusBadge(order.status)}
                    <span className="text-[11px] text-gray-400 capitalize">
                      ({order.paymentMethod === "cod" ? "COD" : order.paymentMethod === "online" ? "Online" : "Unspecified"} • {order.paymentStatus ? order.paymentStatus.replace("_", " ") : "Pending"})
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">
                      Invoice Total
                    </span>
                    <span className="text-base font-black text-sparehub-dark">
                      {formatLKR(order.totalGrandMinor)}
                    </span>
                  </div>

                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 gap-1 h-8 font-bold transition-all active:scale-[0.97]"
                  >
                    Inspect
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Recipient & Vendor Sub-orders details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-0.5 text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Customer Details
                  </span>
                  <p className="font-bold text-sparehub-dark">{order.shippingFullName}</p>
                  <p className="text-[11px]">Tel: {order.shippingPhone}</p>
                  <p className="text-[11px] text-gray-500">
                    {order.shippingCity}, {order.shippingDistrict}
                  </p>
                </div>

                <div className="space-y-1 text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    Vendor Sub-Orders ({order.sellerOrders?.length || 0})
                  </span>
                  <div className="space-y-1">
                    {(order.sellerOrders || []).map((so) => (
                      <div key={so.id} className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 font-medium text-gray-800">
                          <Store className="w-3 h-3 text-sparehub-orange" />
                          {so.shopName} ({so.subOrderNumber})
                        </span>
                        <span className="font-mono text-gray-700">
                          {formatLKR(so.subtotalMinor)} ({so.status})
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
