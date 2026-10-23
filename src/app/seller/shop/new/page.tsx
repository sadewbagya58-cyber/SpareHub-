import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Store } from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { CreateShopForm } from "./create-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Register New Shop | SpareHub Seller Center",
  description: "Set up your multi-vendor automotive spare parts shop on SpareHub.",
};

export default async function NewShopPage() {
  const profileData = await getSellerShopProfile();

  if (!profileData || !profileData.user) {
    redirect("/login?redirect=/seller/shop/new");
  }

  const { user, userProfile, sellerProfile, shops } = profileData;
  const existingShopCount = shops?.length || 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <Link
          href="/seller/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Seller Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sparehub-orange-light text-sparehub-orange flex items-center justify-center font-bold">
            <Store className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
            {existingShopCount > 0
              ? "Open an Additional Storefront"
              : "Register Your Automotive Storefront"}
          </h1>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {existingShopCount > 0
            ? `You currently manage ${existingShopCount} shop${existingShopCount > 1 ? "s" : ""} under your account. Each shop has its own independent verification status and catalog.`
            : "Complete the details below to open your vendor shop on SpareHub. No phone OTP required."}
        </p>
      </div>

      <CreateShopForm
        initialEmail={user.email || ""}
        initialSellerType={sellerProfile?.seller_type || "retail_shop"}
        initialOwnerLegalName={
          sellerProfile?.owner_legal_name || userProfile?.full_name || ""
        }
        initialResidentialAddress={sellerProfile?.residential_address || ""}
        initialPhone={userProfile?.phone || ""}
      />
    </div>
  );
}
