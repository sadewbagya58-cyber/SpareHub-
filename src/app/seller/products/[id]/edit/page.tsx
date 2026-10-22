import React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { getSellerProductById } from "@/lib/products/actions";
import {
  getProductCategories,
  getVehicleTaxonomyHierarchy,
} from "@/lib/products/taxonomy";
import { ProductForm } from "@/components/seller/product-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Edit Spare Part | SpareHub Seller Center",
  description: "Update product pricing, stock, vehicle fitment, and photo gallery.",
};

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [profileData, { product, error }, categories, vehicleTaxonomy] = await Promise.all([
    getSellerShopProfile(),
    getSellerProductById(id),
    getProductCategories(),
    getVehicleTaxonomyHierarchy(),
  ]);

  if (!profileData || !profileData.user) {
    redirect(`/login?redirect=/seller/products/${id}/edit`);
  }

  const { shop } = profileData;
  if (!shop) {
    redirect("/seller/shop/new");
  }

  if (error || !product) {
    notFound();
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/seller/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Inventory
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
            Edit Spare Part
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Storefront: <strong className="text-sparehub-dark">{shop.name}</strong> • SKU: <span className="font-mono text-gray-700">{product.part_number || "N/A"}</span>
          </p>
        </div>

        {product.is_published && (
          <Link
            href={`/products/${product.slug}`}
            target="_blank"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-sparehub-border text-xs font-semibold text-sparehub-dark hover:bg-sparehub-light transition-colors self-start sm:self-auto"
          >
            <ExternalLink className="w-4 h-4 text-gray-500" />
            View Live Listing
          </Link>
        )}
      </div>

      {/* Main Edit Form */}
      <ProductForm
        mode="edit"
        initialData={product}
        categories={categories}
        vehicleTaxonomy={vehicleTaxonomy}
      />
    </div>
  );
}
