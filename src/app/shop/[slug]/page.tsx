import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Store,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Package,
  ArrowLeft,
  ChevronRight,
} from "lucide-react";
import { getPublicShopBySlug } from "@/lib/seller/actions";
import { formatLKR } from "@/lib/utils";

export const dynamic = "force-dynamic";

const CONDITION_LABELS: Record<string, string> = {
  brand_new: "Brand New",
  reconditioned: "Reconditioned",
  used: "Used",
};

export default async function PublicShopStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicShopBySlug(slug);

  if (!data || !data.shop) {
    notFound();
  }

  const { shop, products } = data;

  return (
    <div className="min-h-screen bg-[#F5F5F5] pb-16">
      {/* Breadcrumb bar */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-2 text-xs text-neutral-500">
          <Link
            href="/search"
            className="inline-flex items-center gap-1 hover:text-[#FF6B00] font-medium transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Marketplace
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-neutral-300" />
          <span className="font-semibold text-neutral-800 truncate">
            {shop.name}
          </span>
        </div>
      </div>

      {/* Storefront Hero Banner & Branding Card */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xs">
          {/* Cover Banner */}
          <div className="relative h-40 sm:h-56 w-full bg-linear-to-r from-[#171717] via-neutral-800 to-[#FF6B00]/80 overflow-hidden">
            {shop.cover_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.cover_url}
                alt={`${shop.name} cover banner`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center opacity-20">
                <Store className="h-20 w-20 text-white" />
              </div>
            )}
          </div>

          {/* Shop Identity & Contact Bar */}
          <div className="p-5 sm:p-7">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="h-20 w-20 sm:h-24 sm:w-24 -mt-12 sm:-mt-14 relative z-10 rounded-2xl border-4 border-white bg-neutral-100 shadow-md overflow-hidden flex items-center justify-center shrink-0">
                  {shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={shop.logo_url}
                      alt={`${shop.name} logo`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Store className="h-9 w-9 text-[#FF6B00]" />
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900">
                      {shop.name}
                    </h1>
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                      Active Storefront
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#FF6B00]" />
                      {shop.city}, {shop.district} District
                    </span>
                    {shop.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5 text-neutral-400" />
                        {shop.phone}
                      </span>
                    )}
                    {shop.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-neutral-400" />
                        {shop.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start">
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 px-4 py-2.5 text-center">
                  <p className="text-lg font-extrabold text-neutral-900">
                    {products.length}
                  </p>
                  <p className="text-[11px] font-medium text-neutral-500">
                    Active Parts
                  </p>
                </div>
              </div>
            </div>

            {shop.description && (
              <p className="mt-4 pt-4 border-t border-neutral-100 text-sm text-neutral-600 leading-relaxed max-w-4xl">
                {shop.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shop Catalog Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center gap-2">
            <Package className="h-5 w-5 text-[#FF6B00]" />
            Available Spare Parts ({products.length})
          </h2>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            <Package className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900">
              No active listings yet
            </h3>
            <p className="text-xs text-neutral-500 mt-1">
              This shop has not published any active spare parts at the moment.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {products.map((product) => {
              const categoryObj = product.categories as unknown as {
                name: string;
                slug: string;
              } | null;

              return (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="group rounded-2xl border border-neutral-200 bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-[#FF6B00]/50 transition-all flex flex-col"
                >
                  <div className="relative aspect-4/3 w-full bg-neutral-100 overflow-hidden border-b border-neutral-100 flex items-center justify-center">
                    {product.primaryImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.primaryImage}
                        alt={product.title}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <Package className="h-10 w-10 text-neutral-300" />
                    )}
                    <span className="absolute top-2.5 left-2.5 rounded-md bg-neutral-900/80 backdrop-blur-xs px-2 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                      {CONDITION_LABELS[product.condition] || product.condition}
                    </span>
                  </div>

                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      {categoryObj?.name && (
                        <p className="text-[11px] font-semibold text-[#FF6B00] uppercase tracking-wider">
                          {categoryObj.name}
                        </p>
                      )}
                      <h3 className="text-sm font-bold text-neutral-900 line-clamp-2 mt-0.5 group-hover:text-[#FF6B00] transition-colors">
                        {product.title}
                      </h3>
                      {(product.brand_name || product.part_number) && (
                        <p className="text-xs text-neutral-500 mt-1 truncate">
                          {product.brand_name}
                          {product.brand_name && product.part_number ? " • " : ""}
                          {product.part_number ? `PN: ${product.part_number}` : ""}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-neutral-100 flex items-baseline justify-between gap-2">
                      <span className="text-base font-extrabold text-neutral-900">
                        {formatLKR(product.price_minor_units)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          product.stock_quantity > 0
                            ? "text-emerald-600"
                            : "text-red-500"
                        }`}
                      >
                        {product.stock_quantity > 0
                          ? `${product.stock_quantity} in stock`
                          : "Out of stock"}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
