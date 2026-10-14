"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { 
  Store, 
  MapPin, 
  Building, 
  User, 
  Box, 
  CheckCircle2, 
  AlertCircle,
  PlusCircle,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { SellerType } from "@/lib/types";
import { createShopAction, type ShopActionResult } from "@/lib/seller/actions";
import { slugify } from "@/lib/validators/shop";

interface CreateShopFormProps {
  initialEmail?: string;
  initialSellerType?: string;
}

export function CreateShopForm({ initialEmail = "", initialSellerType = "retail_shop" }: CreateShopFormProps) {
  const router = useRouter();
  const [sellerType, setSellerType] = useState<SellerType>(initialSellerType as SellerType);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isAutoSlug, setIsAutoSlug] = useState(true);
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [coverUrl, setCoverUrl] = useState("");

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ShopActionResult | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (isAutoSlug) {
      setSlug(slugify(val));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);

    const formData = new FormData();
    formData.append("seller_type", sellerType);
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

    startTransition(async () => {
      const res = await createShopAction(null, formData);
      setResult(res);

      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Alert Result */}
      {result?.error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-sparehub-error flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {result.error}
        </div>
      )}
      {result?.success && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-xs font-semibold text-sparehub-success flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {result.message}
        </div>
      )}

      {/* Seller Category Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold">1. Select Seller Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: "retail_shop", label: "Retail Shop", desc: "Local physical storefront", icon: Store },
              { id: "individual", label: "Individual Seller", desc: "Reconditioned/used spares", icon: User },
              { id: "wholesaler", label: "Wholesaler", desc: "Volume distribution", icon: Building },
              { id: "importer", label: "Parts Importer", desc: "Direct OEM/aftermarket importer", icon: Box },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = sellerType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSellerType(t.id as SellerType)}
                  className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? "border-sparehub-orange bg-sparehub-orange-light/30 text-sparehub-dark ring-2 ring-sparehub-orange shadow-xs"
                      : "border-sparehub-border bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 mb-2 ${isSelected ? "text-sparehub-orange" : "text-gray-400"}`} />
                  <span className="text-xs font-bold text-sparehub-dark">{t.label}</span>
                  <span className="text-[11px] text-gray-500 mt-0.5">{t.desc}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Basic Shop Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Store className="w-4 h-4 text-sparehub-orange" />
            2. Storefront Identity & Slug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Shop / Business Name"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="e.g. Lanka Precision Auto Spares"
              required
              disabled={isPending}
              helperText="The public storefront name shown to buyers across Sri Lanka."
            />

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                  Storefront URL Slug
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
                  placeholder="lanka-precision-auto"
                  required
                  disabled={isPending}
                  className="w-full rounded-lg border border-sparehub-border bg-white py-2 pl-16 pr-3 text-sm text-sparehub-dark font-mono focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                />
              </div>
              <p className="text-[11px] text-gray-400">
                Preview: <code>sparehub.lk/shop/{slug || "your-slug"}</code>
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
              Shop Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="Describe what vehicle brands you support, whether parts are brand-new or reconditioned, and warranty information..."
              disabled={isPending}
              className="w-full rounded-lg border border-sparehub-border bg-white p-3 text-sm text-sparehub-dark focus:border-sparehub-orange focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location & Official Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sparehub-orange" />
            3. Contact & Location Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Contact Phone Number"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="077 123 4567 or 011 234 5678"
              required
              disabled={isPending}
              helperText="Sri Lankan mobile (07x) or landline format."
            />

            <Input
              label="Official Contact Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="shop@example.com"
              required
              disabled={isPending}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Address Line 1"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="e.g. 84 Panchikawatta Road"
              required
              disabled={isPending}
            />

            <Input
              label="Address Line 2 (Optional)"
              value={addressLine2}
              onChange={(e) => setAddressLine2(e.target.value)}
              placeholder="e.g. Ground Floor"
              disabled={isPending}
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
                disabled={isPending}
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
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Colombo 10"
              required
              disabled={isPending}
            />

            <Input
              label="Postal Code (Optional)"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="e.g. 01000"
              disabled={isPending}
            />
          </div>
        </CardContent>
      </Card>

      {/* Optional Branding URLs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-sparehub-orange" />
            4. Storefront Media (Optional)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Logo URL (Optional)"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://.../logo.png"
              disabled={isPending}
              helperText="Square 1:1 image URL."
            />

            <Input
              label="Cover Banner URL (Optional)"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://.../cover.jpg"
              disabled={isPending}
              helperText="Wide 16:9 or 3:1 banner URL."
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Submit */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-sparehub-border">
        <p className="text-xs text-gray-500">
          Your storefront will be activated immediately upon creation. No administrator approval wait required.
        </p>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={isPending}
          className="w-full sm:w-auto min-w-[200px] gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          {isPending ? "Initializing Shop..." : "Create Shop & Start Listing"}
        </Button>
      </div>
    </form>
  );
}
