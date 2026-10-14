"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  Package,
  AlertCircle,
  Loader2,
  CheckCircle,
} from "lucide-react";
import { formatLKR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  toggleProductPublishAction,
  deleteProductAction,
  type SellerProductListItem,
} from "@/lib/products/actions";
import { type CategoryOption } from "@/lib/products/taxonomy";

interface ProductsListProps {
  initialProducts: SellerProductListItem[];
  categories: CategoryOption[];
}

export function ProductsList({
  initialProducts,
  categories,
}: ProductsListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter products locally for instantaneous UX
  const filteredProducts = initialProducts.filter((product) => {
    const matchesSearch =
      searchTerm.trim() === "" ||
      product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.part_number &&
        product.part_number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      product.brand_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "all" || product.category_id === selectedCategory;

    const matchesStatus =
      selectedStatus === "all" ||
      (selectedStatus === "published" && product.is_published) ||
      (selectedStatus === "draft" && !product.is_published) ||
      (selectedStatus === "out_of_stock" && product.stock_quantity === 0);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleTogglePublish = (productId: string, currentPublished: boolean) => {
    setActionMessage(null);
    setActionError(null);

    startTransition(async () => {
      const res = await toggleProductPublishAction(productId, !currentPublished);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage(
          !currentPublished
            ? "Product is now live on the marketplace."
            : "Product un-published and moved to draft."
        );
        router.refresh();
      }
    });
  };

  const handleDelete = (productId: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}"?`)) {
      return;
    }

    setDeletingId(productId);
    setActionMessage(null);
    setActionError(null);

    startTransition(async () => {
      const res = await deleteProductAction(productId);
      setDeletingId(null);
      if (res.error) {
        setActionError(res.error);
      } else {
        setActionMessage("Product listing deleted successfully.");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Action Messages */}
      {actionMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl">
          <CheckCircle className="w-4 h-4 shrink-0 text-sparehub-success" />
          <span className="font-semibold">{actionMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span className="font-semibold">{actionError}</span>
        </div>
      )}

      {/* Control Bar: Search & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-sparehub-border shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by part title, SKU/part number, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs py-2 px-3 border border-sparehub-border rounded-xl bg-white focus:border-sparehub-orange focus:outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="text-xs py-2 px-3 border border-sparehub-border rounded-xl bg-white focus:border-sparehub-orange focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published (Live)</option>
            <option value="draft">Drafts Only</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* Add Part Button */}
          <Link
            href="/seller/products/new"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Add Part
          </Link>
        </div>
      </div>

      {/* Products Table or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto text-sparehub-orange">
            <Package className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-sparehub-dark">
              {searchTerm || selectedCategory !== "all" || selectedStatus !== "all"
                ? "No matching parts found"
                : "No spare parts in your inventory yet"}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              {searchTerm || selectedCategory !== "all" || selectedStatus !== "all"
                ? "Try clearing your search query or filters to see all listed items."
                : "Add your first genuine or reconditioned automotive spare part to start receiving inquiries and orders immediately."}
            </p>
          </div>
          <div>
            <Link
              href="/seller/products/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              List Your First Part Now
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sparehub-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-sparehub-border text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Part / Product</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Price (LKR)</th>
                  <th className="py-3 px-4">Visibility</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredProducts.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-sparehub-light/40 transition-colors group"
                  >
                    {/* Thumbnail & Title */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-12 rounded-lg bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                          {p.primary_image_url ? (
                            <Image
                              src={p.primary_image_url}
                              alt={p.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 font-black text-xs">
                              ⚙️
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/seller/products/${p.id}/edit`}
                            className="font-bold text-sparehub-dark hover:text-sparehub-orange transition-colors line-clamp-1"
                          >
                            {p.title}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 font-mono">
                            <span className="font-semibold text-gray-700">
                              {p.brand_name}
                            </span>
                            {p.part_number && (
                              <>
                                <span>•</span>
                                <span>SKU: {p.part_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 text-gray-600 font-medium">
                      {p.category_name || "Uncategorized"}
                    </td>

                    {/* Condition */}
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          p.condition === "brand_new"
                            ? "success"
                            : p.condition === "reconditioned"
                            ? "orange"
                            : "neutral"
                        }
                        size="sm"
                      >
                        {p.condition === "brand_new"
                          ? "Brand New"
                          : p.condition === "reconditioned"
                          ? "Reconditioned"
                          : "Used"}
                      </Badge>
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-4">
                      {p.stock_quantity > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-sparehub-dark">
                          <span className="w-2 h-2 rounded-full bg-sparehub-success" />
                          {p.stock_quantity} in stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-600">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          Out of stock
                        </span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-sparehub-dark text-sm">
                        {formatLKR(p.price_minor_units)}
                      </span>
                      {p.compare_at_price_lkr && (
                        <span className="block text-[10px] text-gray-400 line-through">
                          Rs. {p.compare_at_price_lkr.toLocaleString()}
                        </span>
                      )}
                    </td>

                    {/* Visibility & Instant Publish Toggle */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(p.id, p.is_published)}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          p.is_published
                            ? "bg-green-100 text-sparehub-success hover:bg-green-200"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                        title={
                          p.is_published
                            ? "Click to unpublish and switch to Draft"
                            : "Click to publish immediately to marketplace"
                        }
                      >
                        {p.is_published ? (
                          <>
                            <Eye className="w-3 h-3" />
                            Live
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Draft
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {p.is_published && (
                          <Link
                            href={`/products/${p.slug}`}
                            target="_blank"
                            className="p-1.5 text-gray-400 hover:text-sparehub-dark hover:bg-gray-100 rounded-lg transition-colors"
                            title="View public product page"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                        )}

                        <Link
                          href={`/seller/products/${p.id}/edit`}
                          className="p-1.5 text-gray-400 hover:text-sparehub-orange hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit product"
                        >
                          <Edit3 className="w-4 h-4" />
                        </Link>

                        <button
                          type="button"
                          onClick={() => handleDelete(p.id, p.title)}
                          disabled={deletingId === p.id}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete listing"
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer info */}
          <div className="p-4 bg-gray-50/50 border-t border-sparehub-border flex items-center justify-between text-xs text-gray-500">
            <span>
              Showing {filteredProducts.length} of {initialProducts.length} items
            </span>
            <span className="font-medium text-gray-400">
              SpareHub Sri Lanka — Automotive Multi-Vendor Catalog
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
