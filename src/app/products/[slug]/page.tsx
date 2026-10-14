import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Store,
  CheckCircle2,
  ShieldCheck,
  Phone,
  Mail,
  MapPin,
  Car,
  Layers,
  ExternalLink,
} from "lucide-react";
import { getPublicProductBySlug } from "@/lib/products/actions";
import { formatLKR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ProductGallery } from "@/components/marketplace/product-gallery";

interface ProductFitmentItem {
  id: string;
  notes?: string | null;
  is_exact_fit: boolean;
  make_name: string;
  model_name: string;
}

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    return {
      title: "Product Not Found | SpareHub",
    };
  }

  return {
    title: `${product.title} | SpareHub Sri Lanka`,
    description: `Buy ${product.brand_name} ${product.title} (Part #${product.part_number || "N/A"}) from verified vendor ${product.shops?.name} on SpareHub.`,
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getPublicProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const shop = product.shops;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
        <Link href="/" className="hover:text-sparehub-orange transition-colors">
          Home
        </Link>
        <span>/</span>
        <Link href="/search" className="hover:text-sparehub-orange transition-colors">
          Catalog
        </Link>
        <span>/</span>
        {product.categories?.name && (
          <>
            <Link
              href={`/search?category=${product.categories.slug}`}
              className="hover:text-sparehub-orange transition-colors"
            >
              {product.categories.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-sparehub-dark truncate max-w-xs">{product.title}</span>
      </div>

      {/* Main Product Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Gallery & Fitment */}
        <div className="lg:col-span-7 space-y-8">
          <ProductGallery images={product.images} title={product.title} />

          {/* Vehicle Compatibility Section */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
              <Car className="w-5 h-5 text-sparehub-orange" />
              <h3 className="font-bold text-base text-sparehub-dark">
                Vehicle Fitment & Compatibility
              </h3>
            </div>

            {product.is_universal ? (
              <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-sparehub-success shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sm font-bold">
                    Universal Fitment Part
                  </strong>
                  <span>
                    This item conforms to universal industry standards and fits any standard vehicle conforming to the technical specifications.
                  </span>
                </div>
              </div>
            ) : product.compatibilities && product.compatibilities.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-gray-500">
                  Verified compatibility for Sri Lankan vehicles:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {product.compatibilities.map((c: ProductFitmentItem) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-sparehub-border bg-gray-50/50 flex items-start gap-2.5"
                    >
                      <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-sparehub-dark block truncate">
                          {c.make_name} {c.model_name}
                        </span>
                        {c.notes && (
                          <span className="text-[11px] text-gray-500 block">
                            {c.notes}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-sparehub-success uppercase tracking-wider block mt-0.5">
                          {c.is_exact_fit ? "Direct OEM Fit" : "Compatible"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500">
                Fitment information was not explicitly specified. Please contact the seller directly to verify compatibility with your vehicle chassis or registration number.
              </div>
            )}
          </div>

          {/* Technical Description */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-4 shadow-xs">
            <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
              <Layers className="w-5 h-5 text-sparehub-orange" />
              <h3 className="font-bold text-base text-sparehub-dark">
                Description & Specifications
              </h3>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
              {product.description}
            </div>
          </div>
        </div>

        {/* Right Column: Pricing, Overview & Vendor Card */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-5 shadow-xs">
            {/* Badges: Category & Condition */}
            <div className="flex flex-wrap items-center gap-2">
              {product.categories?.name && (
                <Badge variant="neutral" size="sm">
                  {product.categories.name}
                </Badge>
              )}
              <Badge
                variant={
                  product.condition === "brand_new"
                    ? "success"
                    : product.condition === "reconditioned"
                    ? "orange"
                    : "neutral"
                }
                size="sm"
              >
                {product.condition === "brand_new"
                  ? "Brand New"
                  : product.condition === "reconditioned"
                  ? "Reconditioned"
                  : "Used"}
              </Badge>
              {Boolean(product.warranty_period_months && product.warranty_period_months > 0) && (
                <Badge variant="orange" size="sm">
                  {product.warranty_period_months}-Month Warranty
                </Badge>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-2xl font-black text-sparehub-dark tracking-tight leading-snug">
                {product.title}
              </h1>
              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-500 font-mono">
                <span>
                  Brand: <strong className="text-sparehub-dark font-sans">{product.brand_name}</strong>
                </span>
                {product.part_number && (
                  <span>
                    • SKU: <strong className="text-sparehub-dark">{product.part_number}</strong>
                  </span>
                )}
                {product.oem_part_number && (
                  <span>
                    • OEM: <strong className="text-sparehub-dark">{product.oem_part_number}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Pricing Block */}
            <div className="p-4 rounded-xl bg-gray-50 border border-sparehub-border space-y-1">
              <span className="text-xs text-gray-500 block">Selling Price</span>
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-sparehub-dark">
                  {formatLKR(product.price_minor_units)}
                </span>
                {product.compare_at_price_minor_units && (
                  <span className="text-sm text-gray-400 line-through">
                    {formatLKR(product.compare_at_price_minor_units)}
                  </span>
                )}
              </div>

              {/* Stock Indicator */}
              <div className="pt-2 flex items-center gap-2">
                {product.stock_quantity > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-sparehub-success">
                    <span className="w-2 h-2 rounded-full bg-sparehub-success animate-pulse" />
                    In Stock ({product.stock_quantity} units available)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Currently Out of Stock
                  </span>
                )}
              </div>
            </div>

            {/* Warranty Details */}
            {product.warranty_details && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-orange-50/50 border border-orange-100 text-xs text-gray-700">
                <ShieldCheck className="w-4 h-4 text-sparehub-orange shrink-0 mt-0.5" />
                <div>
                  <strong className="block text-sparehub-dark font-bold">
                    Seller Warranty
                  </strong>
                  <span>{product.warranty_details}</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2 pt-2">
              {shop?.phone && (
                <a
                  href={`tel:${shop.phone}`}
                  className="w-full py-3 px-4 bg-sparehub-orange hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  Call Seller: {shop.phone}
                </a>
              )}

              {shop?.email && (
                <a
                  href={`mailto:${shop.email}?subject=SpareHub Inquiry: ${encodeURIComponent(product.title)}`}
                  className="w-full py-2.5 px-4 bg-sparehub-light hover:bg-gray-200 text-sparehub-dark border border-sparehub-border font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4 text-gray-500" />
                  Send In-Stock Inquiry via Email
                </a>
              )}
            </div>
          </div>

          {/* Seller Storefront Card */}
          {shop && (
            <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-sparehub-border">
                <div className="flex items-center gap-2">
                  <Store className="w-5 h-5 text-sparehub-orange" />
                  <h3 className="font-bold text-sm text-sparehub-dark uppercase tracking-wider">
                    Sold By
                  </h3>
                </div>

                <Link
                  href={`/shop/${shop.slug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-bold text-sparehub-orange hover:underline"
                >
                  Visit Store
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div>
                <h4 className="text-base font-bold text-sparehub-dark">
                  {shop.name}
                </h4>
                {shop.description && (
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                    {shop.description}
                  </p>
                )}
              </div>

              <div className="space-y-2 text-xs text-gray-600 pt-1">
                {shop.city && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>
                      {shop.address_line1 ? `${shop.address_line1}, ` : ""}
                      {shop.city}, {shop.district}
                    </span>
                  </div>
                )}
                {shop.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{shop.phone}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-sparehub-border/60">
                <div className="flex items-center gap-1.5 text-[11px] text-sparehub-success font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Direct Sri Lankan Automotive Vendor
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
