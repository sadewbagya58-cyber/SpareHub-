import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { 
  User, 
  Mail, 
  ShieldCheck, 
  ShoppingBag, 
  Store, 
  Lock, 
  LogOut,
  Calendar
} from "lucide-react";
import { getCurrentUserProfile, logoutAction } from "@/lib/auth/actions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My Account | SpareHub",
  description: "Manage your SpareHub customer account, profile settings, and order history.",
};

export default async function AccountPage() {
  const authData = await getCurrentUserProfile();

  if (!authData || !authData.user) {
    redirect("/login?redirect=/account");
  }

  const { user, profile } = authData;

  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  const isSeller = roles.includes("seller") || roles.includes("platform_admin");
  const isAdmin = roles.includes("platform_admin");

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white border border-sparehub-border shadow-xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-sparehub-orange text-white flex items-center justify-center font-black text-xl shadow-sm">
            {(profile?.full_name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-sparehub-dark">
                {profile?.full_name || "Valued Customer"}
              </h1>
              {roles.map((r: string) => (
                <Badge
                  key={r}
                  variant={r === "platform_admin" ? "error" : r === "seller" ? "orange" : "neutral"}
                  className="capitalize text-[10px]"
                >
                  {r.replace("_", " ")}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form action={logoutAction}>
            <Button variant="outline" size="sm" type="submit" className="gap-1.5 text-gray-600">
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile & Settings */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-sparehub-orange" />
                Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm
                initialFullName={profile?.full_name || ""}
                initialPhone={profile?.phone || ""}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-sparehub-success" />
                Account Security & Credentials
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs text-gray-600">
              <div className="flex items-center justify-between py-2 border-b border-sparehub-border/60">
                <span className="flex items-center gap-2 text-gray-500">
                  <Mail className="w-4 h-4 text-gray-400" />
                  Primary Email
                </span>
                <span className="font-semibold text-sparehub-dark">{user.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-sparehub-border/60">
                <span className="flex items-center gap-2 text-gray-500">
                  <Lock className="w-4 h-4 text-gray-400" />
                  Password
                </span>
                <span className="text-gray-400">••••••••••••</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="flex items-center gap-2 text-gray-500">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  Member Since
                </span>
                <span className="font-semibold text-sparehub-dark">
                  {new Date(profile?.created_at || user.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Portal Shortcuts */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Access</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link
                href="/cart"
                className="flex items-center justify-between p-3.5 rounded-xl border border-sparehub-border hover:bg-sparehub-light transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-50 text-sparehub-orange">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xs font-bold text-sparehub-dark group-hover:text-sparehub-orange transition-colors">
                      Shopping Cart
                    </h2>
                    <p className="text-[11px] text-gray-500">View items ready for checkout</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-400">&rarr;</span>
              </Link>

              {isSeller ? (
                <Link
                  href="/seller/dashboard"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-100 text-amber-800">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-sparehub-dark group-hover:text-amber-800 transition-colors">
                        Seller Dashboard
                      </h2>
                      <p className="text-[11px] text-gray-500">Manage parts catalog & orders</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-700">&rarr;</span>
                </Link>
              ) : (
                <Link
                  href="/sell"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-sparehub-orange/40 bg-orange-50/30 hover:bg-orange-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-sparehub-orange text-white">
                      <Store className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-sparehub-orange">Open a Vendor Shop</h2>
                      <p className="text-[11px] text-gray-500">Start selling automotive parts</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-sparehub-orange">&rarr;</span>
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin/dashboard"
                  className="flex items-center justify-between p-3.5 rounded-xl border border-red-200 bg-red-50/40 hover:bg-red-50 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-700">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-xs font-bold text-sparehub-dark group-hover:text-red-700 transition-colors">
                        Admin Control Center
                      </h2>
                      <p className="text-[11px] text-gray-500">Shop approvals & platform metrics</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-red-700">&rarr;</span>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
