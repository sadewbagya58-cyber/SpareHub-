import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Store, ArrowLeft, PlusCircle, ExternalLink } from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { Card, CardContent } from "@/components/ui/card";
import { ShopForm } from "./shop-form";
import { ShopDeliverySettings } from "@/components/seller/shop-delivery-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shop Management | SpareHub Seller Center",
  description: "Manage your storefront profile, location, contact information, and review status.",
};

export default async function SellerShopPage() {
  const profileData = await getSellerShopProfile();

  if (!profileData || !profileData.user) {
    redirect("/login?redirect=/seller/shop");
  }

  const { sellerProfile, shop } = profileData;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/seller/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Seller Dashboard
          </Link>
          <h1 className="text-2xl font-black text-sparehub-dark tracking-tight">
            Shop Profile & Settings
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure your public vendor storefront details, operational district, and compliance information.
          </p>
        </div>

        {shop && shop.status !== "suspended" && (
          <Link
            href={`/shop/${shop.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-sparehub-border text-xs font-semibold text-sparehub-dark hover:bg-sparehub-light transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
            View Live Storefront
          </Link>
        )}
      </div>

      {/* When NO shop exists: Empty State Card */}
      {!shop ? (
        <Card className="border-dashed border-2">
          <CardContent className="p-10 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 text-sparehub-orange flex items-center justify-center mx-auto shadow-sm">
              <Store className="w-8 h-8" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h2 className="text-xl font-bold text-sparehub-dark">
                No Storefront Registered Yet
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed">
                You haven&apos;t set up your automotive spare parts shop on SpareHub yet.
                Create your store profile to start listing parts, managing inventory across Sri Lanka, and receiving customer orders.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/seller/shop/new"
                className="inline-flex items-center justify-center font-medium rounded-lg bg-sparehub-orange text-white hover:bg-sparehub-orange-hover shadow-sm text-sm px-4 py-2 gap-2 h-10 font-bold transition-all active:scale-[0.97]"
              >
                <PlusCircle className="w-4 h-4" />
                Register Your Storefront
              </Link>
              <Link
                href="/seller/dashboard"
                className="inline-flex items-center justify-center font-medium rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light text-sm px-4 py-2 h-10 font-semibold transition-all active:scale-[0.97]"
              >
                Seller Dashboard
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* When shop exists: Edit Form, Compliance & Delivery Management */
        <div className="space-y-8">
          <ShopForm shop={shop} sellerType={sellerProfile?.seller_type} />
          <ShopDeliverySettings shop={shop} />
        </div>
      )}
    </div>
  );
}
