import React, { Suspense } from "react";
import Link from "next/link";
import {
  Filter,
  ArrowLeft,
  RotateCcw,
  PackageCheck,
  Car,
  PackageSearch,
  X,
  SlidersHorizontal,
} from "lucide-react";
import { ProductCard } from "@/components/marketplace/product-card";
import { SearchVehicleBanner } from "@/components/marketplace/search-vehicle-banner";
import { Badge } from "@/components/ui/badge";
import { getPublicProducts } from "@/lib/products/actions";
import {
  getVehicleTaxonomyHierarchy,
  getProductCategories,
  resolveAndValidateVehicleQueryParams,
} from "@/lib/products/taxonomy";

export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    type?: string;
    make?: string;
    model?: string;
    variant?: string;
    category?: string;
    condition?: string;
    brand?: string;
    sort?: string;
    page?: string;
  }>;
}

function buildSearchUrl(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v && v.trim()) sp.set(k, v.trim());
  });
  const qs = sp.toString();
  return qs ? `/search?${qs}` : "/search";
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const { q, type, make, model, variant, category, condition, brand, sort } = params;

  const hasRawVehicleParams = Boolean(type || make || model || variant);
  const sortMode = (sort as "newest" | "price_asc" | "price_desc" | "name_asc") || "newest";

  // When no vehicle filter parameters are present, fetch taxonomy, categories, and products in a single parallel batch
  const [taxonomy, categories, preloadedProducts] = await Promise.all([
    getVehicleTaxonomyHierarchy(),
    getProductCategories(),
    !hasRawVehicleParams
      ? getPublicProducts({
          search: q,
          category,
          condition: condition && condition !== "all" ? condition : undefined,
          brand: brand && brand !== "all" ? brand : undefined,
          sort: sortMode,
        })
      : Promise.resolve(null),
  ]);

  // Server-side validation and sanitization of untrusted vehicle parameters
  const validatedVehicle = resolveAndValidateVehicleQueryParams(
    { type, make, model, variant },
    taxonomy
  );

  const selectedCategoryObj = category
    ? categories.find((c) => c.slug === category)
    : undefined;

  // Fetch live published products from non-suspended shops (reusing preloaded batch when no vehicle filter was requested)
  const liveProducts =
    preloadedProducts ??
    (await getPublicProducts({
      search: q,
      category,
      condition: condition && condition !== "all" ? condition : undefined,
      brand: brand && brand !== "all" ? brand : undefined,
      vehicleTypeId: validatedVehicle.vehicleType?.id,
      vehicleMakeId: validatedVehicle.vehicleMake?.id,
      vehicleModelId: validatedVehicle.vehicleModel?.id,
      vehicleVariantId: validatedVehicle.vehicleVariant?.id,
      sort: sortMode,
    }));

  const hasVehicleFilter = validatedVehicle.hasFilter;
  const hasOtherFilters = Boolean(q || category || condition || brand || sort);
  const hasAnyFilter = hasVehicleFilter || hasOtherFilters;

  // URL to clear vehicle filter while preserving other active filters
  const clearVehicleUrl = buildSearchUrl({
    q,
    category,
    condition,
    brand,
    sort,
  });

  // URL for preserving non-vehicle params in vehicle selector
  const preserveParams: Record<string, string | undefined> = {
    q,
    category,
    condition,
    brand,
    sort,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* 1. Header and Breadcrumbs */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Marketplace
        </Link>
        {hasAnyFilter && (
          <Link
            href="/search"
            className="inline-flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-sparehub-orange transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset All Filters
          </Link>
        )}
      </div>

      {/* 2. Page Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
          {q
            ? `Search Results for "${q}"`
            : hasVehicleFilter
            ? `Compatible Parts for ${validatedVehicle.displayLabel}`
            : "Spare Parts Catalog"}
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Showing available listings with verified vehicle compatibility across Sri Lanka
        </p>
      </div>

      {/* 3. Interactive Vehicle Selector & Fitment Banner */}
      <SearchVehicleBanner
        taxonomy={taxonomy}
        validatedVehicle={validatedVehicle}
        preserveParams={preserveParams}
        clearVehicleUrl={clearVehicleUrl}
      />

      {/* 4. Controls Row: Category shortcuts, Condition, Sort & Active Filter Chips */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-sparehub-border">
          {/* Category Tabs (Scrollable) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-semibold no-scrollbar">
            <Link
              href={buildSearchUrl({ ...preserveParams, ...validatedVehicle.sanitizedParams, category: undefined })}
              className={`px-3 py-1.5 rounded-full shrink-0 transition-colors ${
                !category
                  ? "bg-sparehub-dark text-white shadow-xs"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              All Categories
            </Link>
            {categories.slice(0, 8).map((cat) => {
              const isSelected = category === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={buildSearchUrl({
                    ...preserveParams,
                    ...validatedVehicle.sanitizedParams,
                    category: isSelected ? undefined : cat.slug,
                  })}
                  className={`px-3 py-1.5 rounded-full shrink-0 transition-colors ${
                    isSelected
                      ? "bg-sparehub-orange text-white shadow-xs"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat.name}
                </Link>
              );
            })}
          </div>

          {/* Condition & Sort Controls */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0">
            {/* Condition Filter */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400 text-[11px] font-medium hidden sm:inline">
                Condition:
              </span>
              <div className="inline-flex rounded-lg border border-sparehub-border bg-gray-50 p-0.5 text-xs font-semibold">
                {[
                  { id: "", label: "All" },
                  { id: "brand_new", label: "New" },
                  { id: "reconditioned", label: "Recon" },
                  { id: "used", label: "Used" },
                ].map((c) => {
                  const isActive = (condition || "") === c.id;
                  return (
                    <Link
                      key={c.id}
                      href={buildSearchUrl({
                        ...preserveParams,
                        ...validatedVehicle.sanitizedParams,
                        condition: c.id ? c.id : undefined,
                      })}
                      className={`px-2 py-1 rounded-md transition-colors ${
                        isActive
                          ? "bg-white text-sparehub-dark shadow-2xs font-bold"
                          : "text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-gray-400 text-[11px] font-medium hidden sm:inline">
                Sort:
              </span>
              <div className="inline-flex rounded-lg border border-sparehub-border bg-white text-xs font-semibold text-gray-700">
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    ...validatedVehicle.sanitizedParams,
                    sort: sort === "price_asc" ? "price_desc" : "price_asc",
                  })}
                  className="px-2.5 py-1.5 hover:text-sparehub-orange flex items-center gap-1"
                  title="Toggle Price Sorting"
                >
                  <SlidersHorizontal className="w-3 h-3 text-gray-400" />
                  {sort === "price_asc"
                    ? "Price: Low to High"
                    : sort === "price_desc"
                    ? "Price: High to Low"
                    : "Newest"}
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" />
              Active:
            </span>

            {/* Vehicle Type Chip */}
            {validatedVehicle.vehicleType && (
              <Badge variant="orange" size="md" className="gap-1.5">
                Type: {validatedVehicle.vehicleType.name}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    type: undefined,
                    make: undefined,
                    model: undefined,
                    variant: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Vehicle Make Chip */}
            {validatedVehicle.vehicleMake && (
              <Badge variant="orange" size="md" className="gap-1.5">
                Make: {validatedVehicle.vehicleMake.name}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    type: validatedVehicle.sanitizedParams.type,
                    make: undefined,
                    model: undefined,
                    variant: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Vehicle Model Chip */}
            {validatedVehicle.vehicleModel && (
              <Badge variant="orange" size="md" className="gap-1.5">
                Model: {validatedVehicle.vehicleModel.name}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    type: validatedVehicle.sanitizedParams.type,
                    make: validatedVehicle.sanitizedParams.make,
                    model: undefined,
                    variant: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Vehicle Variant Chip */}
            {validatedVehicle.vehicleVariant && (
              <Badge variant="neutral" size="md" className="gap-1.5">
                Chassis: {validatedVehicle.vehicleVariant.generation_chassis}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    type: validatedVehicle.sanitizedParams.type,
                    make: validatedVehicle.sanitizedParams.make,
                    model: validatedVehicle.sanitizedParams.model,
                    variant: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Category Chip */}
            {selectedCategoryObj && (
              <Badge variant="neutral" size="md" className="gap-1.5">
                Category: {selectedCategoryObj.name}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    ...validatedVehicle.sanitizedParams,
                    category: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Condition Chip */}
            {condition && condition !== "all" && (
              <Badge variant="neutral" size="md" className="gap-1.5">
                Condition: {condition.replace("_", " ")}
                <Link
                  href={buildSearchUrl({
                    ...preserveParams,
                    ...validatedVehicle.sanitizedParams,
                    condition: undefined,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}

            {/* Keyword Chip */}
            {q && (
              <Badge variant="neutral" size="md" className="gap-1.5">
                Keyword: &quot;{q}&quot;
                <Link
                  href={buildSearchUrl({
                    ...validatedVehicle.sanitizedParams,
                    category,
                    condition,
                    brand,
                    sort,
                  })}
                  className="hover:text-black ml-0.5"
                >
                  <X className="w-3 h-3" />
                </Link>
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* 5. LIVE PRODUCTS LIST */}
      {liveProducts.length > 0 ? (
        <div className="space-y-6 pt-2">
          <div className="flex items-center justify-between pb-3 border-b border-sparehub-border">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-sparehub-success" />
              <h2 className="text-xl font-black text-sparehub-dark tracking-tight">
                Verified Matching Listings ({liveProducts.length})
              </h2>
              <span className="text-xs font-bold bg-green-100 text-sparehub-success px-2 py-0.5 rounded-full border border-green-200">
                ACTIVE VENDORS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
            {liveProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      ) : (
        /* Empty Results State */
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/50 p-8 sm:p-12 text-center space-y-4 my-6">
          <div className="w-14 h-14 rounded-2xl bg-white border border-sparehub-border shadow-xs flex items-center justify-center mx-auto text-sparehub-orange">
            {hasVehicleFilter ? (
              <Car className="w-7 h-7" />
            ) : (
              <PackageSearch className="w-7 h-7" />
            )}
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-sparehub-dark">
              {hasVehicleFilter
                ? `No parts found matching ${validatedVehicle.displayLabel}`
                : "No matching parts found in the catalog"}
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              {hasVehicleFilter ? (
                <>
                  We could not find any active vendor listings specifically mapped to this vehicle selection with your current filter criteria.
                </>
              ) : (
                <>
                  No listings matched your keywords or filters. Try adjusting your search term or browsing by category.
                </>
              )}
            </p>
          </div>

          {/* Action suggestions */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5">
            {hasVehicleFilter && (
              <Link
                href={clearVehicleUrl}
                className="px-4 py-2 rounded-xl bg-sparehub-dark hover:bg-sparehub-orange text-white text-xs font-bold transition-colors shadow-xs"
              >
                Clear Vehicle Filter
              </Link>
            )}
            {hasAnyFilter && (
              <Link
                href="/search"
                className="px-4 py-2 rounded-xl border border-sparehub-border bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-2xs"
              >
                Reset All Filters
              </Link>
            )}
            <Link
              href="/"
              className="px-4 py-2 rounded-xl border border-sparehub-border bg-white text-xs font-semibold text-gray-600 hover:text-sparehub-orange transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </div>
      )}
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
