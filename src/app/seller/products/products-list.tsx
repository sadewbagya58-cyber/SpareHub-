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
  isShopVerified?: boolean;
}

export function ProductsList({
  initialProducts,
  categories,
  isShopVerified = false,
}: ProductsListProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

    if (!currentPublished && !isShopVerified) {
      setActionError(
        "Your shop is open, but you must complete seller verification before publishing products."
      );
      return;
    }

    setTogglingId(productId);

    startTransition(async () => {
      try {
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
      } catch {
        setActionError("Failed to update product visibility.");
      } finally {
        setTogglingId(null);
      }
    });
  };

  const handleDelete = (productId: string) => {
    if (confirmDeleteId !== productId) {
      setConfirmDeleteId(productId);
      return;
    }

    setConfirmDeleteId(null);
    setDeletingId(productId);
    setActionMessage(null);
    setActionError(null);

    startTransition(async () => {
      try {
        const res = await deleteProductAction(productId);
        if (res.error) {
          setActionError(res.error);
        } else {
          setActionMessage("Product listing deleted successfully.");
          router.refresh();
        }
      } catch {
        setActionError("Failed to delete product.");
      } finally {
        setDeletingId(null);
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
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-sparehub-border shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by part title, SKU/part number, brand..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
          />
        </div>

        {/* Filter Dropdowns & Add Part Action */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex md:items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full md:w-auto min-w-0 text-xs py-2 px-3 border border-sparehub-border rounded-xl bg-white focus:border-sparehub-orange focus:outline-none truncate"
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
            className="w-full md:w-auto min-w-0 text-xs py-2 px-3 border border-sparehub-border rounded-xl bg-white focus:border-sparehub-orange focus:outline-none truncate"
          >
            <option value="all">All Statuses</option>
            <option value="published">Published (Live)</option>
            <option value="draft">Drafts Only</option>
            <option value="out_of_stock">Out of Stock</option>
          </select>

          {/* Add Part Button */}
          <Link
            href="/seller/products/new"
            className="w-full sm:col-span-2 md:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4 shrink-0" />
            Add Part
          </Link>
        </div>
      </div>

      {/* Products Table / Mobile Cards or Empty State */}
      {filteredProducts.length === 0 ? (
        <div className="p-8 sm:p-12 text-center bg-white rounded-2xl border border-dashed border-gray-300 space-y-4">
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
              className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 bg-sparehub-orange hover:bg-orange-600 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 shrink-0" />
              List Your First Part Now
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sparehub-border shadow-xs overflow-hidden">
          {/* Mobile Product Cards (< md) */}
          <div className="md:hidden divide-y divide-gray-100">
            {filteredProducts.map((p) => (
              <div
                key={p.id}
                className="p-4 space-y-3 hover:bg-sparehub-light/30 transition-colors"
              >
                {/* Top row: Image, Title, Brand/SKU */}
                <div className="flex items-start gap-3">
                  <div className="relative w-14 h-14 rounded-xl bg-gray-100 overflow-hidden border border-gray-200 shrink-0">
                    {p.primary_image_url ? (
                      <Image
                        src={p.primary_image_url}
                        alt={p.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 font-black text-sm">
                        ⚙️
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/seller/products/${p.id}/edit`}
                      className="text-sm font-bold text-sparehub-dark hover:text-sparehub-orange transition-colors line-clamp-2 leading-snug"
                    >
                      {p.title}
                    </Link>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-gray-500 font-mono">
                      <span className="font-semibold text-gray-700">
                        {p.brand_name}
                      </span>
                      {p.part_number && (
                        <>
                          <span>•</span>
                          <span className="break-all">SKU: {p.part_number}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Badges row: Condition, Category, Publication Status */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      p.condition === "brand_new"
                        ? "success"
                        : p.condition === "reconditioned"
                        ? "orange"
                        : "neutral"
                    }
                    size="sm"
                    className="whitespace-nowrap shrink-0"
                  >
                    {p.condition === "brand_new"
                      ? "Brand New"
                      : p.condition === "reconditioned"
                      ? "Reconditioned"
                      : "Used"}
                  </Badge>

                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-[11px] font-medium">
                    {p.category_name || "Uncategorized"}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleTogglePublish(p.id, p.is_published)}
                    disabled={isPending}
                    className={`ml-auto inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all shrink-0 ${
                      p.is_published
                        ? "bg-green-100 text-sparehub-success hover:bg-green-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
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
                </div>

                {/* Bottom row: Price, Stock, Actions */}
                <div className="pt-2.5 border-t border-gray-100 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-extrabold text-sparehub-dark text-sm">
                        {formatLKR(p.price_minor_units)}
                      </span>
                      {p.compare_at_price_lkr && (
                        <span className="text-[10px] text-gray-400 line-through">
                          Rs. {p.compare_at_price_lkr.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px]">
                      {p.stock_quantity > 0 ? (
                        <span className="inline-flex items-center gap-1 font-bold text-sparehub-dark">
                          <span className="w-1.5 h-1.5 rounded-full bg-sparehub-success" />
                          {p.stock_quantity} in stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-red-600">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          Out of stock
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-1 shrink-0">
                    {p.is_published && (
                      <Link
                        href={`/products/${p.slug}`}
                        target="_blank"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-sparehub-dark bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
                        title="View public product page"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span className="sr-only sm:not-sr-only">View</span>
                      </Link>
                    )}

                    <Link
                      href={`/seller/products/${p.id}/edit`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-sparehub-dark hover:text-sparehub-orange bg-gray-50 hover:bg-orange-50 border border-gray-200 rounded-lg transition-colors"
                      title="Edit product"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDelete(p.id)}
                      disabled={deletingId === p.id}
                      className={`inline-flex items-center justify-center p-1.5 transition-colors disabled:opacity-50 rounded-lg border ${
                        confirmDeleteId === p.id
                          ? "bg-red-100 text-red-700 font-bold text-[10px] px-2 border-red-300"
                          : "text-gray-500 hover:text-red-600 bg-gray-50 hover:bg-red-50 border-gray-200"
                      }`}
                      title="Delete listing"
                    >
                      {deletingId === p.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                      ) : confirmDeleteId === p.id ? (
                        "Confirm?"
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Product Table (>= md) */}
          <div className="hidden md:block overflow-x-auto">
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
                    <td className="py-3 px-4 text-gray-600 font-medium whitespace-nowrap">
                      {p.category_name || "Uncategorized"}
                    </td>

                    {/* Condition */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge
                        variant={
                          p.condition === "brand_new"
                            ? "success"
                            : p.condition === "reconditioned"
                            ? "orange"
                            : "neutral"
                        }
                        size="sm"
                        className="whitespace-nowrap"
                      >
                        {p.condition === "brand_new"
                          ? "Brand New"
                          : p.condition === "reconditioned"
                          ? "Reconditioned"
                          : "Used"}
                      </Badge>
                    </td>

                    {/* Stock */}
                    <td className="py-3 px-4 whitespace-nowrap">
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
                    <td className="py-3 px-4 whitespace-nowrap">
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
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(p.id, p.is_published)}
                        disabled={togglingId === p.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all disabled:opacity-50 ${
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
                        {togglingId === p.id ? (
                          <Loader2 className="w-3 h-3 animate-spin text-current" />
                        ) : p.is_published ? (
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
                    <td className="py-3 px-4 text-right whitespace-nowrap">
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
                          onClick={() => handleDelete(p.id)}
                          disabled={deletingId === p.id}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            confirmDeleteId === p.id
                              ? "bg-red-100 text-red-700 font-bold text-[10px] px-2"
                              : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                          title="Delete listing"
                        >
                          {deletingId === p.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-red-600" />
                          ) : confirmDeleteId === p.id ? (
                            "Confirm?"
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
          <div className="p-4 bg-gray-50/50 border-t border-sparehub-border flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-gray-500">
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
