import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ShoppingBag,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Store,
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getCustomerOrdersAction } from "@/lib/orders/actions";
import { Badge } from "@/components/ui/badge";
import { formatLKR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Orders | SpareHub",
  description: "View and track your automotive spare parts orders on SpareHub.",
};

export default async function CustomerOrdersPage() {
  const authData = await getCurrentUserProfile();
  if (!authData || !authData.user) {
    redirect("/login?redirect=/account/orders");
  }

  const orders = await getCustomerOrdersAction();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge variant="success" className="capitalize">{status}</Badge>;
      case "partially_dispatched":
      case "processing":
      case "confirmed":
        return <Badge variant="neutral" className="capitalize text-blue-700 bg-blue-50 border-blue-200">{status.replace("_", " ")}</Badge>;
      case "cancelled":
        return <Badge variant="error" className="capitalize">{status}</Badge>;
      default:
        return <Badge variant="neutral" className="capitalize">{status}</Badge>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Account
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sparehub-border">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
              My Orders &amp; Tracking
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Track status, courier dispatches, and order history across verified vendors.
            </p>
          </div>

          <Link
            href="/search"
            className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 gap-1.5 h-8 font-semibold transition-all active:scale-[0.97]"
          >
            Browse More Parts
          </Link>
        </div>
      </div>

      {/* Orders List or Empty State */}
      {orders.length === 0 ? (
        <div className="p-8 sm:p-12 rounded-3xl border border-sparehub-border bg-white text-center space-y-4 shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 text-sparehub-orange flex items-center justify-center mx-auto">
            <ShoppingBag className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-sparehub-dark">No Orders Placed Yet</h2>
          <p className="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
            You haven&apos;t placed any automotive spare parts orders yet. Use our vehicle selector to find parts guaranteed to fit your model.
          </p>
          <div className="pt-2">
            <Link
              href="/search"
              className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover text-sm px-4 py-2 gap-2 h-10 font-bold shadow-sm transition-all active:scale-[0.97]"
            >
              Find Vehicle Parts
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="p-5 sm:p-6 rounded-2xl border border-sparehub-border bg-white shadow-xs hover:border-sparehub-orange/60 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-sm font-black text-sparehub-dark">
                      {order.orderNumber}
                    </span>
                    {getStatusBadge(order.status)}
                  </div>
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5">
                    <Calendar className="w-3 h-3" />
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block uppercase tracking-wider">
                      Grand Total
                    </span>
                    <span className="text-base font-black text-sparehub-dark">
                      {formatLKR(order.totalGrandMinor)}
                    </span>
                  </div>

                  <Link
                    href={`/orders/${order.id}`}
                    className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover text-xs px-3 py-1.5 gap-1 h-8 font-bold shadow-sm transition-all active:scale-[0.97]"
                  >
                    View Details
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>

              {/* Sub-orders summary */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                <span className="font-semibold text-gray-800">
                  {order.sellerOrders?.length || 0}{" "}
                  {order.sellerOrders?.length === 1 ? "Vendor Sub-Order" : "Vendor Sub-Orders"}:
                </span>
                {(order.sellerOrders || []).map((so) => (
                  <span
                    key={so.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200 text-[11px]"
                  >
                    <Store className="w-3 h-3 text-sparehub-orange" />
                    {so.shopName} ({so.status})
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
