import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  Plus,
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  Store,
} from "lucide-react";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { getSellerProducts } from "@/lib/products/actions";
import { getProductCategories } from "@/lib/products/taxonomy";
import { Card } from "@/components/ui/card";
import { ProductsList } from "./products-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Product Catalog Management | SpareHub Seller Center",
  description: "Add, update, and manage your automotive spare parts inventory on SpareHub.",
};

export default async function SellerProductsPage() {
  const profileData = await getSellerShopProfile();

  if (!profileData || !profileData.user) {
    redirect("/login?redirect=/seller/products");
  }

  const { shop } = profileData;

  // If seller has no shop yet, guide them to create one
  if (!shop) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        <Card className="border-dashed border-2 p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto text-sparehub-orange mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-sparehub-dark">
            Shop Registration Required
          </h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-2 mb-6">
            You must configure your seller shop before you can list automotive parts in the catalog. Setting up your shop takes less than a minute.
          </p>
          <Link
            href="/seller/shop/new"
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            Create Your Shop Now
          </Link>
        </Card>
      </div>
    );
  }

  // Fetch seller's products and categories
  const [{ products }, categories] = await Promise.all([
    getSellerProducts(),
    getProductCategories(),
  ]);

  const totalProducts = products.length;
  const publishedCount = products.filter((p) => p.is_published).length;
  const outOfStockCount = products.filter((p) => p.stock_quantity === 0).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/seller/dashboard"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
            Inventory & Spare Parts
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Storefront: <strong className="text-sparehub-dark">{shop.name}</strong> • Immediate self-service publication active
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Link
            href="/seller/products/new"
            className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add New Part
          </Link>
        </div>
      </div>

      {/* Quick Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-sparehub-border flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-sparehub-orange">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-sparehub-dark block">
              {totalProducts}
            </span>
            <span className="text-xs text-gray-500">Total Listed Parts</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-sparehub-border flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center text-sparehub-success">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-sparehub-dark block">
              {publishedCount}
            </span>
            <span className="text-xs text-gray-500">Live on Marketplace</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-sparehub-border flex items-center gap-3 shadow-2xs">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-black text-sparehub-dark block">
              {outOfStockCount}
            </span>
            <span className="text-xs text-gray-500">Out of Stock</span>
          </div>
        </div>
      </div>

      {/* Main Products List Table with local client controls */}
      <ProductsList
        initialProducts={products}
        categories={categories}
      />
    </div>
  );
}
