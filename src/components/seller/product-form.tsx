"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Loader2,
  Package,
  Layers,
  DollarSign,
  Globe,
} from "lucide-react";
import { ProductImageUploader } from "@/components/seller/product-image-uploader";
import { CompatibilityBuilder } from "@/components/seller/compatibility-builder";
import {
  productSlugify,
  type ProductImageItem,
  type ProductCompatibilityItem,
  type PartCondition,
  type ProductStatus,
} from "@/lib/validators/product";
import {
  createProductAction,
  updateProductAction,
  type SellerProductDetail,
} from "@/lib/products/actions";
import {
  type CategoryOption,
  type VehicleTypeOption,
  type VehicleMakeOption,
  type VehicleModelOption,
} from "@/lib/products/taxonomy";

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: SellerProductDetail | null;
  categories: CategoryOption[];
  vehicleTaxonomy: {
    vehicleTypes: VehicleTypeOption[];
    vehicleMakes: VehicleMakeOption[];
    vehicleModels: VehicleModelOption[];
  };
}

export function ProductForm({
  mode,
  initialData,
  categories,
  vehicleTaxonomy,
}: ProductFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Basic Information
  const [title, setTitle] = useState(initialData?.title || "");
  const [slug, setSlug] = useState(initialData?.slug || "");
  const [slugCustomized, setSlugCustomized] = useState(mode === "edit");
  const [categoryId, setCategoryId] = useState(
    initialData?.category_id || categories[0]?.id || ""
  );
  const [brandName, setBrandName] = useState(initialData?.brand_name || "");
  const [partNumber, setPartNumber] = useState(initialData?.part_number || "");
  const [oemPartNumber, setOemPartNumber] = useState(
    initialData?.oem_part_number || ""
  );
  const [condition, setCondition] = useState<PartCondition>(
    initialData?.condition || "brand_new"
  );
  const [description, setDescription] = useState(
    initialData?.description || ""
  );

  // Pricing & Inventory
  const [price, setPrice] = useState<string>(
    initialData?.price_lkr != null ? String(initialData.price_lkr) : ""
  );
  const [compareAtPrice, setCompareAtPrice] = useState<string>(
    initialData?.compare_at_price_lkr != null
      ? String(initialData.compare_at_price_lkr)
      : ""
  );
  const [stockQuantity, setStockQuantity] = useState<string>(
    initialData?.stock_quantity != null
      ? String(initialData.stock_quantity)
      : "1"
  );

  // Warranty
  const [warrantyMonths, setWarrantyMonths] = useState<string>(
    initialData?.warranty_period_months != null
      ? String(initialData.warranty_period_months)
      : "0"
  );
  const [warrantyDetails, setWarrantyDetails] = useState(
    initialData?.warranty_details || ""
  );

  // Visibility & Publication
  const [isPublished, setIsPublished] = useState<boolean>(
    initialData?.is_published ?? true
  );
  const [status, setStatus] = useState<ProductStatus>(
    initialData?.status && initialData.status !== "banned"
      ? (initialData.status as ProductStatus)
      : "active"
  );

  // Images & Fitment
  const [images, setImages] = useState<ProductImageItem[]>(
    initialData?.images || []
  );
  const [isUniversal, setIsUniversal] = useState<boolean>(
    initialData?.is_universal ?? false
  );
  const [compatibilities, setCompatibilities] = useState<
    ProductCompatibilityItem[]
  >(initialData?.compatibilities || []);

  // Feedback states
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-slug generator on title or part number change
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (!slugCustomized) {
      setSlug(productSlugify(newTitle, partNumber));
    }
  };

  const handlePartNumberChange = (newPartNo: string) => {
    setPartNumber(newPartNo);
    if (!slugCustomized) {
      setSlug(productSlugify(title, newPartNo));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setErrorMessage("Please enter a valid price in LKR (minimum 0).");
      return;
    }

    const numCompare = compareAtPrice ? parseFloat(compareAtPrice) : null;
    if (numCompare != null && numCompare > 0 && numCompare < numPrice) {
      setErrorMessage(
        "Original compare-at price must be greater than or equal to selling price."
      );
      return;
    }

    const numStock = parseInt(stockQuantity, 10);
    if (isNaN(numStock) || numStock < 0) {
      setErrorMessage("Please enter a valid stock quantity (0 or more).");
      return;
    }

    const numWarranty = parseInt(warrantyMonths, 10) || 0;

    startTransition(async () => {
      try {
        if (mode === "create") {
          const res = await createProductAction({
            title,
            slug: slug || productSlugify(title, partNumber),
            category_id: categoryId,
            brand_name: brandName,
            part_number: partNumber || undefined,
            oem_part_number: oemPartNumber || undefined,
            condition,
            description,
            price: numPrice,
            compare_at_price: numCompare,
            stock_quantity: numStock,
            warranty_period_months: numWarranty,
            warranty_details: warrantyDetails || undefined,
            is_universal: isUniversal,
            is_published: isPublished,
            images,
            compatibilities,
          });

          if (res.error) {
            setErrorMessage(res.error);
          } else {
            setSuccessMessage("Product listed successfully! Redirecting...");
            setTimeout(() => {
              router.push("/seller/products");
              router.refresh();
            }, 1000);
          }
        } else {
          // Edit mode
          if (!initialData?.id) {
            setErrorMessage("Missing product ID for update.");
            return;
          }

          const res = await updateProductAction({
            productId: initialData.id,
            title,
            slug,
            category_id: categoryId,
            brand_name: brandName,
            part_number: partNumber || undefined,
            oem_part_number: oemPartNumber || undefined,
            condition,
            description,
            price: numPrice,
            compare_at_price: numCompare,
            stock_quantity: numStock,
            warranty_period_months: numWarranty,
            warranty_details: warrantyDetails || undefined,
            is_universal: isUniversal,
            is_published: isPublished,
            status,
            images,
            compatibilities,
          });

          if (res.error) {
            setErrorMessage(res.error);
          } else {
            setSuccessMessage("Product updated successfully! Redirecting...");
            setTimeout(() => {
              router.push("/seller/products");
              router.refresh();
            }, 1000);
          }
        }
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred."
        );
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Feedback Messages */}
      {errorMessage && (
        <div className="flex items-start gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
          <div>
            <strong className="font-bold block">Validation Error</strong>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
          <CheckCircle className="w-5 h-5 shrink-0 text-sparehub-success" />
          <strong className="font-bold">{successMessage}</strong>
        </div>
      )}

      {/* SECTION 1: Basic Part Information */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
          <Package className="w-5 h-5 text-sparehub-orange" />
          <h3 className="font-bold text-base text-sparehub-dark">
            Part Identification & Categorization
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Part Title / Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Front Ceramic Brake Pads Set (OEM Spec)"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:ring-1 focus:ring-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Slug */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              URL Slug (Search-Engine Friendly)
            </label>
            <div className="flex items-center">
              <span className="text-xs text-gray-400 bg-gray-50 px-3 py-2.5 border border-r-0 border-sparehub-border rounded-l-xl select-none">
                sparehub.lk/products/
              </span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => {
                  setSlugCustomized(true);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                className="flex-1 px-3.5 py-2.5 text-sm font-mono border border-sparehub-border rounded-r-xl focus:border-sparehub-orange focus:outline-none"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl bg-white focus:border-sparehub-orange focus:outline-none"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Part Manufacturer / Brand <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Toyota Genuine, Denso, Brembo, TVS"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Part Number / SKU */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Part Number / SKU (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 04465-02220 or BAJ-2415-08"
              value={partNumber}
              onChange={(e) => handlePartNumberChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* OEM Number */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              OEM Cross-Reference Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 04465-YZZE1"
              value={oemPartNumber}
              onChange={(e) => setOemPartNumber(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-mono border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Condition */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-2">
              Item Condition <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  id: "brand_new",
                  label: "Brand New (Unused)",
                  desc: "Factory sealed in original box",
                },
                {
                  id: "reconditioned",
                  label: "Reconditioned",
                  desc: "Professionally restored & tested",
                },
                {
                  id: "used",
                  label: "Used (Working)",
                  desc: "Genuine used part with test report",
                },
              ].map((item) => (
                <label
                  key={item.id}
                  className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                    condition === item.id
                      ? "border-sparehub-orange bg-sparehub-orange/5 ring-1 ring-sparehub-orange"
                      : "border-sparehub-border hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="condition"
                      value={item.id}
                      checked={condition === item.id}
                      onChange={(e) =>
                        setCondition(e.target.value as PartCondition)
                      }
                      className="text-sparehub-orange focus:ring-sparehub-orange"
                    />
                    <span className="text-xs font-bold text-sparehub-dark">
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 pl-5">
                    {item.desc}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Part Description & Technical Specs <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              placeholder="Provide key technical details: country of manufacture, material, fitment instructions, box contents..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: Pricing, Inventory & Warranty */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
          <DollarSign className="w-5 h-5 text-sparehub-orange" />
          <h3 className="font-bold text-base text-sparehub-dark">
            Pricing, Stock & Warranty
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selling Price */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Selling Price (LKR) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 select-none">
                Rs.
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="7500.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm font-semibold border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
              />
            </div>
          </div>

          {/* Compare at Price */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Original / MRP (LKR)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400 select-none">
                Rs.
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="Optional strike-through"
                value={compareAtPrice}
                onChange={(e) => setCompareAtPrice(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
              />
            </div>
          </div>

          {/* Stock Quantity */}
          <div>
            <label className="block text-xs font-bold text-sparehub-dark uppercase tracking-wider mb-1">
              Stock Quantity Available <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="1"
              min="0"
              required
              placeholder="e.g. 10"
              value={stockQuantity}
              onChange={(e) => setStockQuantity(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Warranty Months */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Warranty Duration (Months)
            </label>
            <input
              type="number"
              step="1"
              min="0"
              placeholder="0 for no warranty"
              value={warrantyMonths}
              onChange={(e) => setWarrantyMonths(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>

          {/* Warranty Terms */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Warranty Terms / Conditions (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. 6-Month Replacement Warranty on Manufacturing Defects"
              value={warrantyDetails}
              onChange={(e) => setWarrantyDetails(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-sparehub-border rounded-xl focus:border-sparehub-orange focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: Product Photos */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs">
        <ProductImageUploader images={images} onChange={setImages} maxImages={8} />
      </div>

      {/* SECTION 4: Vehicle Compatibility / Fitment */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-sparehub-border">
          <Layers className="w-5 h-5 text-sparehub-orange" />
          <h3 className="font-bold text-base text-sparehub-dark">
            Vehicle Fitment & Compatibility
          </h3>
        </div>

        <CompatibilityBuilder
          compatibilities={compatibilities}
          onChange={setCompatibilities}
          isUniversal={isUniversal}
          onUniversalToggle={setIsUniversal}
          vehicleTypes={vehicleTaxonomy.vehicleTypes}
          vehicleMakes={vehicleTaxonomy.vehicleMakes}
          vehicleModels={vehicleTaxonomy.vehicleModels}
        />
      </div>

      {/* SECTION 5: Publishing & Self-Service Activation */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 space-y-4 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-sparehub-border">
          <Globe className="w-5 h-5 text-sparehub-orange" />
          <h3 className="font-bold text-base text-sparehub-dark">
            Marketplace Visibility & Publication
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-orange-50/50 border border-orange-100">
          <div>
            <label className="text-sm font-bold text-sparehub-dark flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="w-4 h-4 text-sparehub-orange rounded border-gray-300 focus:ring-sparehub-orange"
              />
              Publish to Marketplace Immediately
            </label>
            <p className="text-xs text-gray-600 mt-1">
              {isPublished
                ? "This product will be immediately visible to car owners and buyers across Sri Lanka. No admin review required."
                : "Saved as private draft. You can publish it anytime when ready."}
            </p>
          </div>

          <div className="shrink-0">
            {isPublished ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-sparehub-success text-xs font-bold rounded-full border border-green-200">
                <CheckCircle className="w-3.5 h-3.5" />
                Live on Marketplace
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-bold rounded-full border border-gray-300">
                Draft Mode
              </span>
            )}
          </div>
        </div>

        {mode === "edit" && (
          <div className="pt-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Inventory Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductStatus)}
              className="w-full sm:w-64 px-3 py-2 text-xs border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none"
            >
              <option value="active">Active (Available for purchase)</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="archived">Archived (Delisted)</option>
            </select>
          </div>
        )}
      </div>

      {/* Form Submission Actions */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-sparehub-border">
        <Link
          href="/seller/products"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Cancel & Back to Inventory
        </Link>

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-6 py-3 bg-sparehub-orange hover:bg-orange-600 text-white font-bold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving Product...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              {mode === "create" ? "Create & Publish Listing" : "Save Changes"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
