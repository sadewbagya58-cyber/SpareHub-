import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import {
  getProductCategories,
  getVehicleTaxonomyHierarchy,
} from "@/lib/products/taxonomy";
import { ProductForm } from "@/components/seller/product-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Add New Spare Part | SpareHub Seller Center",
  description: "Create and publish a new automotive spare part listing on SpareHub.",
};

export default async function NewProductPage() {
  const profileData = await getSellerShopProfile();

  if (!profileData || !profileData.user) {
    redirect("/login?redirect=/seller/products/new");
  }

  const { shop } = profileData;

  if (!shop) {
    redirect("/seller/shop/new");
  }

  const [categories, vehicleTaxonomy] = await Promise.all([
    getProductCategories(),
    getVehicleTaxonomyHierarchy(),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header & Breadcrumb */}
      <div>
        <Link
          href="/seller/products"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Inventory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
              Add New Spare Part
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Storefront: <strong className="text-sparehub-dark">{shop.name}</strong> • Immediate self-service marketplace publication
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-sparehub-orange border border-orange-200 rounded-full text-[11px] font-bold self-start sm:self-auto">
            <Sparkles className="w-3.5 h-3.5" />
            Instant Publication Active
          </div>
        </div>
      </div>

      {/* Main Create Form */}
      <ProductForm
        mode="create"
        categories={categories}
        vehicleTaxonomy={vehicleTaxonomy}
      />
    </div>
  );
}
