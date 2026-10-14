import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, Package, ShoppingCart, DollarSign, Clock, CheckCircle2 } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
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
  const isSeller = roles.includes("seller") || roles.includes("platform_admin");

  if (!isSeller) {
    redirect("/sell");
  }

  const supabase = await createServerSupabaseClient();

  // Fetch seller profile and associated shop
  const { data: sellerProfile } = await supabase
    .from("seller_profiles")
    .select("*, shops(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  const shop = sellerProfile?.shops?.[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-sparehub-border shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500 text-white flex items-center justify-center font-black text-xl shadow-sm">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-sparehub-dark">
                {shop?.name || profile?.full_name || "Vendor Store"}
              </h1>
              {shop?.status && (
                <Badge
                  variant={shop.status === "approved" ? "success" : "orange"}
                  className="capitalize text-[10px]"
                >
                  {shop.status.replace("_", " ")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Seller Type: <span className="font-semibold capitalize text-sparehub-dark">{sellerProfile?.seller_type || "Registered Seller"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/account">
            <Button variant="outline" size="sm">
              Customer Account
            </Button>
          </Link>
        </div>
      </div>

      {/* Shop Verification Alert if pending or draft */}
      {shop?.status !== "approved" && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3">
          <Clock className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-xs font-bold text-amber-900">
              Shop Verification in Progress
            </h2>
            <p className="text-xs text-amber-800 leading-relaxed">
              Your vendor application is currently under review by our compliance team. Once verified, your products will be published to the public SpareHub marketplace.
            </p>
          </div>
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
              <span className="text-[10px] text-gray-400">Identity verified</span>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
              <Store className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
