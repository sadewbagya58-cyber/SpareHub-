"use client";

import React, { useState, useTransition } from "react";
import { 
  Store, 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  AlertTriangle, 
  Image as ImageIcon 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ShopBrandingUploader } from "@/components/seller/shop-branding-uploader";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { updateShopAction, submitShopForReviewAction, type ShopActionResult } from "@/lib/seller/actions";
import { slugify } from "@/lib/validators/shop";

interface ShopData {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string | null;
  district: string;
  city: string;
  postal_code: string | null;
  logo_url: string | null;
  cover_url: string | null;
  status: "draft" | "pending_review" | "approved" | "rejected" | "suspended";
  status_reason: string | null;
  approved_at: string | null;
  created_at: string;
}

interface ShopFormProps {
  shop: ShopData;
  sellerType?: string;
}

export function ShopForm({ shop, sellerType }: ShopFormProps) {
  // Form fields
  const [name, setName] = useState(shop.name);
  const [slug, setSlug] = useState(shop.slug);
  const [description, setDescription] = useState(shop.description || "");
  const [phone, setPhone] = useState(shop.phone);
  const [email, setEmail] = useState(shop.email);
  const [addressLine1, setAddressLine1] = useState(shop.address_line1);
  const [addressLine2, setAddressLine2] = useState(shop.address_line2 || "");
  const [district, setDistrict] = useState(shop.district || "Colombo");
  const [city, setCity] = useState(shop.city);
  const [postalCode, setPostalCode] = useState(shop.postal_code || "");
  const [logoUrl, setLogoUrl] = useState(shop.logo_url || "");
  const [coverUrl, setCoverUrl] = useState(shop.cover_url || "");

  // UI state
  const [isAutoSlug, setIsAutoSlug] = useState(false);
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isSubmittingReview, startReviewTransition] = useTransition();
  const [updateResult, setUpdateResult] = useState<ShopActionResult | null>(null);
  const [reviewResult, setReviewResult] = useState<ShopActionResult | null>(null);

  // Handle name change with auto-slug suggestion if user desires
  const handleNameChange = (val: string) => {
    setName(val);
    if (isAutoSlug) {
      setSlug(slugify(val));
    }
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateResult(null);

    const formData = new FormData();
    formData.append("shopId", shop.id);
    formData.append("name", name);
    formData.append("slug", slug || slugify(name));
    formData.append("description", description);
    formData.append("phone", phone);
    formData.append("email", email);
    formData.append("address_line1", addressLine1);
    formData.append("address_line2", addressLine2);
    formData.append("district", district);
    formData.append("city", city);
    formData.append("postal_code", postalCode);
    formData.append("logo_url", logoUrl);
    formData.append("cover_url", coverUrl);

    startUpdateTransition(async () => {
      const res = await updateShopAction(null, formData);
      setUpdateResult(res);
    });
  };

  const handleActivateShop = () => {
    setReviewResult(null);
    const formData = new FormData();
    formData.append("shopId", shop.id);

    startReviewTransition(async () => {
      const res = await submitShopForReviewAction(null, formData);
      setReviewResult(res);
    });
  };

  const isLive = shop.status !== "suspended" && shop.status !== "draft";
  const statusBadgeVariant =
    shop.status === "suspended"
      ? "error"
      : shop.status === "draft"
      ? "neutral"
      : "success";

  return (
    <div className="space-y-8">
      {/* Storefront Status & Branding Banner */}
      <div className="overflow-hidden rounded-2xl bg-white border border-sparehub-border shadow-xs">
        {coverUrl && (
          <div className="relative h-32 sm:h-40 w-full bg-neutral-900 overflow-hidden border-b border-sparehub-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverUrl}
              alt={`${name || shop.name} cover banner`}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-sparehub-light flex items-center justify-center text-sparehub-dark border border-sparehub-border overflow-hidden shrink-0 shadow-2xs">
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt={`${name || shop.name} logo`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="w-6 h-6 text-sparehub-orange" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-sparehub-dark truncate">{name || shop.name}</h2>
                  <Badge variant={statusBadgeVariant} className="text-[10px] uppercase font-bold">
                    {shop.status === "suspended" ? "Suspended" : shop.status === "draft" ? "Draft Mode" : "Storefront Active"}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  Marketplace URL: <code className="text-sparehub-dark font-mono">/shop/{slug || shop.slug}</code>
                  {sellerType && <span className="ml-2 capitalize text-gray-400">({sellerType.replace("_", " ")})</span>}
                </p>
              </div>
            </div>

            {/* Action button based on state */}
            {shop.status === "draft" && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleActivateShop}
                disabled={isSubmittingReview}
                className="gap-2 shrink-0 bg-green-600 hover:bg-green-700"
              >
                <ShieldCheck className="w-4 h-4" />
                {isSubmittingReview ? "Activating..." : "Activate Storefront Live"}
              </Button>
            )}

            {isLive && (
              <div className="flex items-center gap-2 text-xs font-semibold text-sparehub-success bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 shrink-0">
                <ShieldCheck className="w-4 h-4" />
                Storefront Live &amp; Self-Service Ready
              </div>
            )}
          </div>

          {/* Status contextual alert message */}
          {shop.status === "draft" && (
            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-bold">Your shop is currently in Draft mode.</p>
                <p className="text-amber-800 mt-0.5">
                  Click <strong>&quot;Activate Storefront Live&quot;</strong> whenever you are ready to publish parts and receive customer orders. No platform approval wait required.
                </p>
              </div>
            </div>
          )}

          {shop.status === "suspended" && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-sparehub-error mt-0.5" />
              <div>
                <p className="font-bold">Storefront Suspended</p>
                <p className="text-red-800 mt-0.5">
                  Platform administration has placed your shop on hold: <em>&quot;{shop.status_reason || "Compliance review required."}&quot;</em>
                </p>
              </div>
            </div>
          )}

          {/* Activation Feedback */}
          {reviewResult?.error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-sparehub-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {reviewResult.error}
            </div>
          )}
          {reviewResult?.success && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-medium text-sparehub-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {reviewResult.message}
            </div>
          )}
        </div>
      </div>

      {/* Shop Details Edit Form */}
      <form onSubmit={handleUpdate} className="space-y-6">
        {/* Form Feedback */}
        {updateResult?.error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-sparehub-error flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {updateResult.error}
          </div>
        )}
        {updateResult?.success && (
          <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs font-semibold text-sparehub-success flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {updateResult.message}
          </div>
        )}

        {/* Section 1: Core Store Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Store className="w-4 h-4 text-sparehub-orange" />
              Storefront Identity &amp; URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Shop / Business Name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Colombo Precision Auto Spares"
                required
                disabled={isUpdating}
              />

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                    URL Slug
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoSlug(!isAutoSlug);
                      if (!isAutoSlug) setSlug(slugify(name));
                    }}
                    className="text-[11px] text-sparehub-orange hover:underline font-medium"
                  >
                    {isAutoSlug ? "Custom Slug" : "Auto-generate"}
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-400 select-none">
                    /shop/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setIsAutoSlug(false);
                      setSlug(slugify(e.target.value));
                    }}
                    placeholder="colombo-precision-auto"
                    required
                    disabled={isUpdating}
                    className="w-full rounded-lg border border-sparehub-border bg-white py-2 pl-16 pr-3 text-sm text-sparehub-dark font-mono focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  Unique public URL identifying your vendor shop on SpareHub.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                Shop Description &amp; Overview
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="Describe the vehicle makes you specialize in, warranty policies, and genuine parts guarantees..."
                disabled={isUpdating}
                className="w-full rounded-lg border border-sparehub-border bg-white p-3 text-sm text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
              />
              <div className="flex justify-between text-[11px] text-gray-400">
                <span>Shown on your public storefront and vendor profile.</span>
                <span>{description.length}/1000 characters</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Contact & Operating Location */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <MapPin className="w-4 h-4 text-sparehub-orange" />
              Location &amp; Official Contacts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Primary Business Phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="077 123 4567 or 011 234 5678"
                required
                disabled={isUpdating}
                helperText="Sri Lankan local (07x) or landline format for customer fulfillment inquiries."
              />

              <Input
                label="Official Business Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sales@yourpartscompany.lk"
                required
                disabled={isUpdating}
                helperText="Used for order notifications and platform correspondence."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Physical Address Line 1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="e.g. 142 Panchikawatta Road"
                required
                disabled={isUpdating}
              />

              <Input
                label="Address Line 2 (Optional)"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="e.g. Suite 4B, 2nd Floor"
                disabled={isUpdating}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                  Operating District
                </label>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  disabled={isUpdating}
                  className="w-full rounded-lg border border-sparehub-border bg-white py-2 px-3 text-sm text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                >
                  {SRI_LANKA_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <Input
                label="City / Town"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Colombo 10"
                required
                disabled={isUpdating}
              />

              <Input
                label="Postal Code (Optional)"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="e.g. 01000"
                disabled={isUpdating}
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Branding & Visual Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-sparehub-orange" />
              Storefront Branding Assets
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <ShopBrandingUploader
              assetType="logo"
              name="logo_url"
              label="Shop Logo Image"
              helperText="Square 1:1 image recommended for your shop profile badge and product pages."
              value={logoUrl}
              onChange={setLogoUrl}
              shopId={shop.id}
              shopName={name}
              disabled={isUpdating}
            />

            <ShopBrandingUploader
              assetType="cover"
              name="cover_url"
              label="Storefront Cover Banner"
              helperText="Wide 16:9 or 3:1 header banner displayed at the top of your public shop page."
              value={coverUrl}
              onChange={setCoverUrl}
              shopId={shop.id}
              shopName={name}
              disabled={isUpdating}
            />
          </CardContent>
        </Card>

        {/* Form Actions Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-sparehub-border">
          <p className="text-xs text-gray-400">
            Changes to your shop profile and branding assets are saved immediately to your storefront.
          </p>

          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={isUpdating}
            loadingText="Saving Changes..."
            disabled={isUpdating}
            className="w-full sm:w-auto min-w-[160px]"
          >
            Save Shop Details
          </Button>
        </div>
      </form>
    </div>
  );
}
