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
  ShieldCheck,
  Send
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Seller Dashboard | SpareHub",
  description: "Manage your automotive spare parts shop, listings, and customer fulfillment.",
};

export default async function SellerDashboardPage() {
  const authData = await getCurrentUserProfile();

  if (!authData || !authData.user) {
    redirect("/login?redirect=/seller/dashboard");
  }

  const { user, profile } = authData;

  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  let isSeller = roles.includes("seller") || roles.includes("platform_admin");

  const supabase = await createServerSupabaseClient();

  // Fetch seller profile and associated shop
  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("*, shops(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (sellerProfile) {
    isSeller = true;
  }

  if (!isSeller) {
    redirect("/sell");
  }

  const shop = sellerProfile?.shops?.[0];

  const statusBadgeVariant =
    shop?.status === "approved"
      ? "success"
      : shop?.status === "rejected" || shop?.status === "suspended"
      ? "error"
      : shop?.status === "pending_review"
      ? "orange"
      : "neutral";

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-sparehub-border shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sparehub-dark text-white flex items-center justify-center font-black text-xl shadow-sm">
            <Store className="w-7 h-7 text-sparehub-orange" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-sparehub-dark">
                {shop?.name || profile?.full_name || "Vendor Store"}
              </h1>
              {shop?.status && (
                <Badge
                  variant={statusBadgeVariant}
                  className="capitalize text-[10px] uppercase font-bold"
                >
                  {shop.status.replace("_", " ")}
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

        <div className="flex items-center gap-3">
          {shop ? (
            <Link href="/seller/shop">
              <Button variant="primary" size="sm" className="gap-1.5">
                <Settings className="w-4 h-4" />
                Manage Shop Profile
              </Button>
            </Link>
          ) : (
            <Link href="/seller/shop/new">
              <Button variant="primary" size="sm" className="gap-1.5">
                <PlusCircle className="w-4 h-4" />
                Create Your Shop
              </Button>
            </Link>
          )}

          <Link href="/account">
            <Button variant="outline" size="sm">
              Customer Account
            </Button>
          </Link>
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
              <Link href="/seller/shop/new">
                <Button variant="primary" size="md" className="gap-2">
                  <PlusCircle className="w-4 h-4" />
                  Register Your Storefront
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Case 2: Status Notices when shop exists */
        <>
          {shop.status === "draft" && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-amber-900">
                    Action Required: Shop in Draft Mode
                  </h3>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    Your shop profile is saved but has not been submitted for platform review. Complete your profile and submit it to activate your public storefront.
                  </p>
                </div>
              </div>
              <Link href="/seller/shop">
                <Button variant="primary" size="sm" className="gap-1.5 shrink-0">
                  <Send className="w-3.5 h-3.5" />
                  Review & Submit
                </Button>
              </Link>
            </div>
          )}

          {shop.status === "pending_review" && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-900 flex items-start gap-3">
              <Clock className="w-5 h-5 shrink-0 text-blue-600 mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-blue-900">
                  Shop Application Pending Review
                </h3>
                <p className="text-xs text-blue-800 leading-relaxed">
                  Your shop is currently in the compliance review queue. Platform administrators verify all merchant credentials before activating listings.
                </p>
              </div>
            </div>
          )}

          {shop.status === "approved" && (
            <div className="p-4 rounded-xl border border-green-200 bg-green-50 text-green-900 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 shrink-0 text-sparehub-success mt-0.5" />
              <div>
                <h3 className="text-xs font-bold text-green-900">
                  Storefront Verified & Active
                </h3>
                <p className="text-xs text-green-800 leading-relaxed">
                  Your store is active on the SpareHub marketplace. You can list products and fulfill customer spare parts orders across Sri Lanka.
                </p>
              </div>
            </div>
          )}

          {shop.status === "rejected" && (
            <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-sparehub-error mt-0.5" />
                <div>
                  <h3 className="text-xs font-bold text-red-900">
                    Application Needs Attention
                  </h3>
                  <p className="text-xs text-red-800 leading-relaxed">
                    {shop.status_reason || "The administration team requested updates to your business information."}
                  </p>
                </div>
              </div>
              <Link href="/seller/shop">
                <Button variant="primary" size="sm" className="gap-1.5 shrink-0">
                  Update & Resubmit
                </Button>
              </Link>
            </div>
          )}

          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Listed Products</p>
                  <h2 className="text-2xl font-black text-sparehub-dark mt-1">0</h2>
                  <span className="text-[10px] text-gray-400">Ready for catalog</span>
                </div>
                <div className="p-3 rounded-xl bg-orange-50 text-sparehub-orange">
                  <Package className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Customer Orders</p>
                  <h2 className="text-2xl font-black text-sparehub-dark mt-1">0</h2>
                  <span className="text-[10px] text-gray-400">Fulfillment queue</span>
                </div>
                <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                  <ShoppingCart className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Net Earnings</p>
                  <h2 className="text-2xl font-black text-sparehub-dark mt-1">LKR 0.00</h2>
                  <span className="text-[10px] text-gray-400">Ledger balance</span>
                </div>
                <div className="p-3 rounded-xl bg-green-50 text-sparehub-success">
                  <DollarSign className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Shop Health</p>
                  <h2 className="text-sm font-bold text-sparehub-success mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Good Standing
                  </h2>
                  <span className="text-[10px] text-gray-400">
                    {shop.status === "approved" ? "Verified vendor" : "In review queue"}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
                  <Store className="w-6 h-6" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Management Shortcuts */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link href="/seller/shop" className="group">
              <Card className="hover:border-sparehub-orange transition-all h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Settings className="w-4 h-4 text-sparehub-orange" />
                      Shop Profile & Storefront Settings
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-sparehub-orange group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-500">
                  Update public shop name, district, address, phone number, description, and custom storefront URL slug.
                </CardContent>
              </Card>
            </Link>

            <Link href="/seller/shop" className="group">
              <Card className="hover:border-sparehub-orange transition-all h-full">
                <CardHeader>
                  <CardTitle className="text-sm font-bold flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4 text-sparehub-orange" />
                      Verification & Compliance Workflow
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-sparehub-orange group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-gray-500">
                  Track platform approval progress, view compliance feedback, and submit your shop details for verification.
                </CardContent>
              </Card>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
