import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getSellerOrdersAction } from "@/lib/orders/actions";
import { Badge } from "@/components/ui/badge";
import { SellerOrdersList } from "./seller-orders-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller Orders Fulfillment | SpareHub",
  description: "Fulfill customer orders, track courier dispatches, and manage store sub-orders.",
};

interface SellerOrdersPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function SellerOrdersPage({ searchParams }: SellerOrdersPageProps) {
  const [authData, resolvedParams, ordersResult] = await Promise.all([
    getCurrentUserProfile(),
    searchParams,
    getSellerOrdersAction("all"),
  ]);

  if (!authData || !authData.user) {
    redirect("/login?redirect=/seller/orders");
  }

  const currentStatus = resolvedParams.status || "all";
  const { orders, shopName } = ordersResult;

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
            className="inline-flex items-center justify-center rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 gap-1.5 h-8 font-semibold transition-all active:scale-[0.97]"
          >
            Manage Products
          </Link>
        </div>
      </div>

      {/* Client-side Instant Filter Tabs & Orders List */}
      <SellerOrdersList
        initialOrders={orders}
        initialStatus={currentStatus}
      />
    </div>
  );
}
