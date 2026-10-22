import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  Store, 
  Package, 
  ShoppingCart, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  Settings, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck
} from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatLKR } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller Dashboard | SpareHub",
  description: "Manage your automotive spare parts shop, listings, and customer fulfillment.",
};

export default async function SellerDashboardPage() {
  const [sellerData, supabase] = await Promise.all([
    getSellerShopProfile(),
    createServerSupabaseClient(),
  ]);

  if (!sellerData || !sellerData.user) {
    redirect("/login?redirect=/seller/dashboard");
  }

  const { userProfile: profile, sellerProfile, shop } = sellerData;

  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  let isSeller = roles.includes("seller") || roles.includes("platform_admin");

  if (sellerProfile) {
    isSeller = true;
  }

  if (!isSeller) {
    redirect("/sell");
  }

  let productCount = 0;
  let orderCount = 0;
  let netEarningsMinor = 0;

  if (shop) {
    const [{ count }, { count: oCount, data: ordersData }] = await Promise.all([
      supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shop.id),
      supabase
        .from("seller_orders")
        .select("total_amount_minor, status")
        .eq("shop_id", shop.id),
    ]);

    productCount = count ?? 0;
    orderCount = oCount ?? (ordersData ? ordersData.length : 0);
    if (ordersData) {
      netEarningsMinor = ordersData
        .filter((o) => o.status !== "cancelled")
        .reduce((acc, o) => acc + (Number(o.total_amount_minor) || 0), 0);
    }
  }

  const isSuspended = shop?.status === "suspended";
  const isDraft = shop?.status === "draft";
  const statusBadgeVariant = isSuspended ? "error" : isDraft ? "neutral" : "success";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="overflow-hidden rounded-2xl bg-white border border-sparehub-border shadow-xs">
        {shop?.cover_url && (
          <div className="relative h-28 sm:h-36 w-full bg-neutral-900 overflow-hidden border-b border-sparehub-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shop.cover_url}
              alt={`${shop.name} cover banner`}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-6">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-sparehub-dark text-white flex items-center justify-center font-black text-xl shadow-sm overflow-hidden shrink-0 border border-sparehub-border">
              {shop?.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.logo_url}
                  alt={`${shop.name} logo`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="w-7 h-7 text-sparehub-orange" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-sparehub-dark truncate">
                  {shop?.name || profile?.full_name || "Vendor Store"}
                </h1>
                {shop?.status && (
                  <Badge
                    variant={statusBadgeVariant}
                    className="capitalize text-[10px] uppercase font-bold shrink-0"
                  >
                    {isSuspended ? "Suspended" : isDraft ? "Draft Mode" : "Storefront Active"}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Seller Type:{" "}
                <span className="font-semibold capitalize text-sparehub-dark">
                  {sellerProfile?.seller_type?.replace("_", " ") || "Registered Seller"}
                </span>
                {shop?.district && (
                  <span className="ml-2 text-gray-400">
                    • Operating District: <span className="font-medium text-sparehub-dark">{shop.district}</span>
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full lg:w-auto">
            {shop ? (
              <>
                <Link
                  href="/seller/products/new"
                  className="w-full sm:w-auto inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm text-xs px-3.5 py-2 sm:py-1.5 gap-1.5 h-10 sm:h-8 transition-all active:scale-[0.97]"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  Add Product
                </Link>
                <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:w-auto">
                  <Link
                    href="/seller/products"
                    className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-2.5 py-1.5 gap-1.5 h-10 sm:h-8 transition-all active:scale-[0.97] text-center"
                  >
                    <Package className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">My Products ({productCount})</span>
                  </Link>
                  <Link
                    href="/seller/shop"
                    className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-2.5 py-1.5 gap-1.5 h-10 sm:h-8 transition-all active:scale-[0.97] text-center"
                  >
                    <Settings className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Shop Settings</span>
                  </Link>
                  <Link
                    href="/seller/earnings"
                    className="inline-flex items-center justify-center font-medium rounded-lg border border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 text-xs px-2.5 py-1.5 gap-1.5 h-10 sm:h-8 transition-all active:scale-[0.97] text-center"
                  >
                    <DollarSign className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                    <span className="truncate">Earnings &amp; Payouts</span>
                  </Link>
                  <Link
                    href="/account"
                    className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-2.5 py-1.5 h-10 sm:h-8 transition-all active:scale-[0.97] text-center"
                  >
                    <span className="truncate">My Account</span>
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Link
                  href="/seller/shop/new"
                  className="w-full sm:w-auto inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm text-xs px-3.5 py-2 sm:py-1.5 gap-1.5 h-10 sm:h-8 transition-all active:scale-[0.97]"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  Create Your Shop
                </Link>
                <Link
                  href="/account"
                  className="w-full sm:w-auto inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-xs px-3 py-1.5 h-10 sm:h-8 transition-all active:scale-[0.97]"
                >
                  My Account
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case 1: Empty State when seller has NO shop registered yet */}
      {!shop ? (
        <Card className="border-dashed border-2 border-sparehub-orange/40 bg-orange-50/20">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 text-sparehub-orange flex items-center justify-center mx-auto">
              <Store className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h2 className="text-lg font-bold text-sparehub-dark">
                Complete Your Vendor Setup
              </h2>
              <p className="text-xs text-gray-600 leading-relaxed">
                You are registered as a seller on SpareHub, but you haven&apos;t created your shop profile yet.
                Provide your shop name, contact information, and operating district to start selling.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/seller/shop/new"
                className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm text-sm px-4 py-2 gap-2 h-10 font-bold transition-all active:scale-[0.97]"
              >
                <PlusCircle className="w-4 h-4" />
                Register Your Storefront
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Case 2: Status Notices when shop exists */
        <>
          {isSuspended && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0 text-sparehub-error mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-red-900">
                  Storefront Suspended by Platform Administration
                </h3>
                <p className="text-xs text-red-800 leading-relaxed">
                  {shop.status_reason || "Your storefront is currently on hold. Please contact support or update your business details."}
                </p>
              </div>
            </div>
          )}

          {isDraft && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-900">
                    Storefront in Draft Mode
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Your shop profile is set to draft mode. You can activate it at any time to publish your listings to buyers across Sri Lanka.
                  </p>
                </div>
              </div>
              <Link
                href="/seller/shop"
                className="inline-flex items-center justify-center font-medium rounded-lg bg-green-600 hover:bg-green-700 text-white shadow-sm text-xs px-3 py-1.5 gap-1.5 h-8 font-bold shrink-0 transition-all active:scale-[0.97]"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Activate Storefront Live
              </Link>
            </div>
          )}

          {!isSuspended && !isDraft && (
            <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-green-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 text-sparehub-success mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-green-900">
                  Storefront Active &amp; Ready for Sales
                </h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  Your store is active on the SpareHub marketplace. You can add products, update inventory, and fulfill customer spare parts orders across Sri Lanka.
                </p>
              </div>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/seller/products" className="group">
              <Card className="hover:border-sparehub-orange transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Listed Products</p>
                    <h2 className="text-2xl font-black text-sparehub-dark mt-1 group-hover:text-sparehub-orange transition-colors">
                      {productCount}
                    </h2>
                    <span className="text-[10px] text-gray-400">View &amp; manage catalog →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-orange-50 text-sparehub-orange">
                    <Package className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/seller/orders" className="group">
              <Card className="hover:border-sparehub-orange transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Customer Orders</p>
                    <h2 className="text-2xl font-black text-sparehub-dark mt-1 group-hover:text-sparehub-orange transition-colors">
                      {orderCount}
                    </h2>
                    <span className="text-[10px] text-gray-400">Fulfillment queue →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/seller/earnings" className="group">
              <Card className="hover:border-sparehub-orange transition-all">
                <CardContent className="p-5 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Earnings &amp; Payouts</p>
                    <h2 className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 group-hover:text-sparehub-orange transition-colors">
                      {formatLKR(netEarningsMinor)}
                    </h2>
                    <span className="text-[10px] text-gray-400">Ledger &amp; statement →</span>
                  </div>
                  <div className="p-3 rounded-xl bg-green-50 text-sparehub-success">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Shop Health</p>
                  <h2 className="text-sm font-bold text-sparehub-success mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Good Standing
                  </h2>
                  <span className="text-[10px] text-gray-400">
                    {!isSuspended ? "Active storefront" : "On administrative hold"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                  <Store className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link href="/seller/products" className="group">
              <Card className="hover:border-sparehub-orange transition-all h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-sparehub-orange" />
                      Manage Products &amp; Inventory
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-sparehub-orange group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-500">
                  Add, edit, publish, and unpublish parts. Adjust stock quantities, pricing in LKR, and structured vehicle fitment.
                </CardContent>
              </Card>
            </Link>

            <Link href="/seller/products/new" className="group">
              <Card className="hover:border-sparehub-orange transition-all h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <PlusCircle className="w-4 h-4 text-sparehub-orange" />
                      Add New Spare Part
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-sparehub-orange group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-500">
                  List a new spare part listing with photos, OEM part number, condition, warranty details, and vehicle compatibility.
                </CardContent>
              </Card>
            </Link>

            <Link href="/seller/shop" className="group">
              <Card className="hover:border-sparehub-orange transition-all h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-sparehub-orange" />
                      Shop Profile &amp; Settings
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-sparehub-orange group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-500">
                  Update public shop name, operational district, contact information, description, and custom storefront URL slug.
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
