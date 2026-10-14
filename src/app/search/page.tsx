import React, { Suspense } from "react";
import Link from "next/link";
import { Filter, ArrowLeft, RotateCcw, PackageCheck } from "lucide-react";
import { DemoCatalog } from "@/components/marketplace/demo-catalog";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { getPublicProducts } from "@/lib/products/actions";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    make?: string;
    model?: string;
    variant?: string;
    category?: string;
  }>;
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { q, type, make, model, variant, category } = params;

  const hasFilters = Boolean(q || type || make || model || category);

  // Fetch live published products from non-suspended shops
  const liveProducts = await getPublicProducts({
    search: q,
    category,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header and Breadcrumbs */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        {hasFilters && (
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-sparehub-orange"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear All Filters
          </Link>
        )}
      </div>

      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
          {q ? `Search Results for "${q}"` : "Spare Parts Catalog"}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Showing available listings with verified vehicle compatibility across Sri Lanka
        </p>

        {/* Active Filter Chips */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-sparehub-border">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Active Filters:
            </span>
            {type && (
              <Badge variant="orange" size="md">
                Vehicle Type: {type}
              </Badge>
            )}
            {make && (
              <Badge variant="orange" size="md">
                Make: {make}
              </Badge>
            )}
            {model && (
              <Badge variant="orange" size="md">
                Model: {model}
              </Badge>
            )}
            {variant && (
              <Badge variant="neutral" size="md">
                Variant: {variant}
              </Badge>
            )}
            {category && (
              <Badge variant="neutral" size="md">
                Category: {category}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* LIVE PRODUCTS SECTION */}
      {liveProducts.length > 0 && (
        <div className="space-y-6 mb-12">
          <div className="flex items-center justify-between pb-3 border-b border-sparehub-border">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-sparehub-success" />
              <h2 className="text-xl font-black text-sparehub-dark tracking-tight">
                Live Verified Listings ({liveProducts.length})
              </h2>
              <span className="text-xs font-bold bg-green-100 text-sparehub-success px-2 py-0.5 rounded-full border border-green-200">
                ACTIVE VENDORS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {liveProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* DEMO / FALLBACK CATALOG */}
      <div className="space-y-4">
        {liveProducts.length > 0 ? (
          <div className="pt-6 border-t border-dashed border-gray-300">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
              Featured Sample Catalog (Demo Mode)
            </h3>
            <DemoCatalog />
          </div>
        ) : (
          <DemoCatalog />
        )}
      </div>
    </div>
  );
}

export default function SearchPage(props: SearchPageProps) {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 text-center text-xs text-gray-500">
          Loading catalog search results...
        </div>
      }
    >
      <SearchResults {...props} />
    </Suspense>
  );
}
