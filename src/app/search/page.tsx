import React, { Suspense } from "react";
import Link from "next/link";
import { Filter, ArrowLeft, RotateCcw } from "lucide-react";
import { DemoCatalog } from "@/components/marketplace/demo-catalog";
import { Badge } from "@/components/ui/badge";

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
          Showing available listings with verified vehicle compatibility
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

      {/* Results Catalog */}
      <DemoCatalog />
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
