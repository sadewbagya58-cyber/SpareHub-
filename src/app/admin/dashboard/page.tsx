import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Store, Users, FileText, Clock, ShoppingCart, Percent, DollarSign } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { PendingShopsList, type PendingShop } from "./pending-shops-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Platform Admin Center | SpareHub",
  description: "Platform governance, shop verification, and administrative audit controls.",
};

export default async function AdminDashboardPage() {
  const authData = await getCurrentUserProfile();

  if (!authData || !authData.user) {
    redirect("/login?redirect=/admin/dashboard");
  }

  const { profile } = authData;

  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  const isAdmin = roles.includes("platform_admin");

  if (!isAdmin) {
    redirect("/");
  }

  const supabase = await createServerSupabaseClient();

  // Fetch platform counts and moderation queue concurrently in a single parallel batch (1 roundtrip instead of 5 sequential)
  const [
    { count: activeShopCount },
    { count: suspendedShopCount },
    { count: userCount },
    { count: orderCount },
    { data: moderationShops },
  ] = await Promise.all([
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .neq("status", "suspended"),
    supabase
      .from("shops")
      .select("*", { count: "exact", head: true })
      .eq("status", "suspended"),
    supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("customer_orders")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("shops")
      .select("*, seller_profiles(*)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-sparehub-dark text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center font-black text-xl shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">SpareHub Admin Control Center</h1>
              <Badge variant="error" className="text-[10px]">
                Platform Administrator
              </Badge>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Supervisory governance, policy moderation, and immutable audit ledger
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/commissions"
            className="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-transparent text-white hover:bg-gray-800 gap-1.5 text-xs font-semibold px-3 py-1.5 h-8 transition-all active:scale-[0.97]"
          >
            <Percent className="w-3.5 h-3.5 text-sparehub-orange" />
            Commission Rules
          </Link>

          <Link
            href="/admin/financials"
            className="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-transparent text-white hover:bg-gray-800 gap-1.5 text-xs font-semibold px-3 py-1.5 h-8 transition-all active:scale-[0.97]"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            Financial Ledger
          </Link>

          <Link
            href="/account"
            className="inline-flex items-center justify-center rounded-lg border border-gray-600 bg-transparent text-white hover:bg-gray-800 text-xs font-semibold px-3 py-1.5 h-8 transition-all active:scale-[0.97]"
          >
            My Profile
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/admin/orders" className="group">
          <Card className="hover:border-sparehub-orange transition-all">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                  Platform Orders
                </p>
                <h2 className="text-2xl font-black text-sparehub-dark mt-1 group-hover:text-sparehub-orange transition-colors">
                  {orderCount ?? 0}
                </h2>
                <span className="text-[10px] text-gray-400">GMV &amp; sub-orders →</span>
              </div>
              <div className="p-3 rounded-xl bg-orange-50 text-sparehub-orange">
                <ShoppingCart className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        </Link>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Active Storefronts
              </p>
              <h2 className="text-2xl font-black text-sparehub-success mt-1">
                {activeShopCount ?? 0}
              </h2>
              <span className="text-[10px] text-gray-400">Live merchants</span>
            </div>
            <div className="p-3 rounded-xl bg-green-50 text-sparehub-success">
              <Store className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Suspended Shops
              </p>
              <h2 className="text-2xl font-black text-red-600 mt-1">
                {suspendedShopCount ?? 0}
              </h2>
              <span className="text-[10px] text-gray-400">Policy hold</span>
            </div>
            <div className="p-3 rounded-xl bg-red-50 text-red-600">
              <Clock className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Registered Users
              </p>
              <h2 className="text-2xl font-black text-sparehub-dark mt-1">
                {userCount ?? 0}
              </h2>
              <span className="text-[10px] text-gray-400">Platform members</span>
            </div>
            <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vendor Storefront Moderation Queue */}
      <PendingShopsList initialShops={(moderationShops as unknown as PendingShop[]) || []} />

      {/* Governance Guidance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-sparehub-orange" />
            Administrative Safety & Governance Principles
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-gray-600 leading-relaxed">
          <p>
            • <strong>Identity & Ownership Verification:</strong> Individual and retail sellers must submit genuine BR certificates, NIC photos, or importer documentation before shops transition to approved status.
          </p>
          <p>
            • <strong>Immutable Audit Trails:</strong> All administrative approval and suspension operations are permanently recorded with actor identity, timestamp, and IP addresses in the <code>admin_audit_logs</code> ledger.
          </p>
          <p>
            • <strong>Automated Concurrency Locks:</strong> Checkout operations enforce row-level locking on inventory to mathematically prevent concurrent overselling across multi-vendor checkouts.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
