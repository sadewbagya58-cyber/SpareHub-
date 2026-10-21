import React from "react";
import Link from "next/link";
import { 
  Store, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Settings
} from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { SellerOnboardingForm } from "./seller-onboarding-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Open Your Vendor Shop | SpareHub Sri Lanka",
  description: "Join Sri Lanka's leading automotive spare parts marketplace. Expand your customer reach across all 25 districts.",
};

export default async function SellPage() {
  const profileData = await getSellerShopProfile();
  const user = profileData?.user;
  const shop = profileData?.shop;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="max-w-2xl mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sparehub-orange-light text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-3">
          <Store className="w-3.5 h-3.5" />
          Seller Registration & Onboarding
        </div>
        <h1 className="text-3xl font-black text-sparehub-dark tracking-tight">
          Open Your Vendor Shop on SpareHub
        </h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Join Sri Lanka&apos;s premier multi-vendor automotive spare parts marketplace. Expand your customer reach across all 25 districts with our verified seller platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="md:col-span-2">
          {shop ? (
            /* User already has a shop */
            <div className="p-8 rounded-2xl bg-white border border-sparehub-border shadow-xs text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-green-50 text-sparehub-success border border-green-200 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-sparehub-dark">
                  Storefront Already Registered: &quot;{shop.name}&quot;
                </h3>
                <p className="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
                  Your seller account already has an active shop registered on SpareHub. You can manage your storefront, list products, and fulfill orders directly from your seller portal.
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/seller/dashboard"
                  className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm text-sm px-4 py-2 gap-2 h-10 font-bold transition-all active:scale-[0.97]"
                >
                  <Store className="w-4 h-4" />
                  Go to Seller Dashboard
                </Link>
                <Link
                  href="/seller/shop"
                  className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-sm px-4 py-2 gap-2 h-10 font-semibold transition-all active:scale-[0.97]"
                >
                  <Settings className="w-4 h-4" />
                  Manage Shop Profile
                </Link>
              </div>
            </div>
          ) : (
            /* User does not have a shop -> Render Onboarding Form */
            <SellerOnboardingForm
              isAuthenticated={!!user}
              userEmail={user?.email || ""}
            />
          )}
        </div>

        {/* Verification & Policy Sidebar */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-sparehub-light border border-sparehub-border space-y-4">
            <h3 className="text-sm font-bold text-sparehub-dark">
              How Vendor Onboarding Works
            </h3>
            <ol className="space-y-3 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  1
                </span>
                <span><strong>Submit Shop Details:</strong> Enter your shop name, contact information, district, and seller category.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  2
                </span>
                <span><strong>Set Up Your Storefront:</strong> Customize your shop profile, logo, banner, and business description.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  3
                </span>
                <span><strong>Add Spare Parts:</strong> List parts with accurate vehicle compatibility, stock, and pricing in LKR.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  4
                </span>
                <span><strong>Publish and Start Selling:</strong> Activate your listings immediately and begin receiving customer orders across Sri Lanka.</span>
              </li>
            </ol>
          </div>

          <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Commission & Payout Policy Note
            </div>
            <p className="leading-relaxed">
              Platform commercial terms, commission rates, and payout cycles are subject to platform owner authorization. No fees are charged during this initial registration phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
