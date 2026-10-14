import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, Store, Users, FileText, Clock } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  // Fetch count of pending shops and users
  const { count: pendingShopCount } = await supabase
    .from("shops")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending_review");

  const { count: approvedShopCount } = await supabase
    .from("shops")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  const { count: userCount } = await supabase
    .from("user_profiles")
    .select("*", { count: "exact", head: true });

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
              Supervisory governance, shop onboarding queue, and immutable audit ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/account">
            <Button variant="outline" size="sm" className="bg-transparent border-gray-600 text-white hover:bg-gray-800">
              My Profile
            </Button>
          </Link>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Pending Shop Approvals
              </p>
              <h2 className="text-3xl font-black text-amber-600 mt-2">
                {pendingShopCount ?? 0}
              </h2>
              <span className="text-[11px] text-gray-400">Applications awaiting document review</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-600">
              <Clock className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Approved Vendors
              </p>
              <h2 className="text-3xl font-black text-sparehub-success mt-2">
                {approvedShopCount ?? 0}
              </h2>
              <span className="text-[11px] text-gray-400">Active merchant storefronts</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-green-50 text-sparehub-success">
              <Store className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Registered Platform Users
              </p>
              <h2 className="text-3xl font-black text-sparehub-dark mt-2">
                {userCount ?? 0}
              </h2>
              <span className="text-[11px] text-gray-400">Customers, sellers, & admins</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-blue-50 text-blue-600">
              <Users className="w-7 h-7" />
            </div>
          </CardContent>
        </Card>
      </div>

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
