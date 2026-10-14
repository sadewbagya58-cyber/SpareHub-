"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  Store, 
  User, 
  Building, 
  Box, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  LogIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { SellerType } from "@/lib/types";
import { createShopAction, type ShopActionResult } from "@/lib/seller/actions";
import { slugify } from "@/lib/validators/shop";

interface SellerOnboardingFormProps {
  isAuthenticated: boolean;
  userEmail?: string;
}

export function SellerOnboardingForm({ isAuthenticated, userEmail = "" }: SellerOnboardingFormProps) {
  const router = useRouter();
  const [sellerType, setSellerType] = useState<SellerType>("retail_shop");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(userEmail);
  const [addressLine1, setAddressLine1] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [city, setCity] = useState("");

  const [isSubmitting, startTransition] = useTransition();
  const [result, setResult] = useState<ShopActionResult | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAuthenticated) {
      router.push("/login?redirect=/sell");
      return;
    }

    setResult(null);

    const formData = new FormData();
    formData.append("seller_type", sellerType);
    formData.append("name", shopName);
    formData.append("slug", slugify(shopName));
    formData.append("phone", phone);
    formData.append("email", email || userEmail);
    formData.append("address_line1", addressLine1);
    formData.append("district", district);
    formData.append("city", city);

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
    <form
      onSubmit={handleSubmit}
      className="p-6 sm:p-8 rounded-2xl border border-sparehub-border bg-white shadow-sm space-y-6"
    >
      {!isAuthenticated && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Please sign in or register an account before submitting your shop application.</span>
          </div>
          <Link href="/login?redirect=/sell">
            <Button variant="primary" size="sm" className="gap-1.5 shrink-0 text-xs">
              <LogIn className="w-3.5 h-3.5" />
              Sign In to Continue
            </Button>
          </Link>
        </div>
      )}

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

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark mb-2">
          Select Seller Category
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { id: "retail_shop", label: "Retail Spare Parts Shop", icon: Store },
            { id: "individual", label: "Individual Seller", icon: User },
            { id: "wholesaler", label: "Wholesale Distributor", icon: Building },
            { id: "importer", label: "Parts Direct Importer", icon: Box },
          ].map((t) => {
            const Icon = t.icon;
            const isSelected = sellerType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSellerType(t.id as SellerType)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "border-sparehub-orange bg-sparehub-orange-light/40 text-sparehub-dark ring-1 ring-sparehub-orange"
                    : "border-sparehub-border bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <Icon className={`w-4 h-4 ${isSelected ? "text-sparehub-orange" : "text-gray-400"}`} />
                <span className="text-xs font-semibold">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Input
        label="Shop / Business Name"
        placeholder="e.g. Lanka Precision Auto Spares"
        required
        value={shopName}
        onChange={(e) => setShopName(e.target.value)}
        disabled={isSubmitting}
        helperText="This will be the public name shown on your shop storefront and product cards."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Contact Phone Number"
          placeholder="e.g. 077 123 4567"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="Business Email"
          placeholder="e.g. contact@yourparts.lk"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-1 space-y-1.5">
          <label
            htmlFor="district-select"
            className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
          >
            Operating District
          </label>
          <select
            id="district-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none"
          >
            {SRI_LANKA_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-1">
          <Input
            label="City"
            placeholder="e.g. Panchikawatta"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            disabled={isSubmitting}
          />
        </div>

        <div className="sm:col-span-1">
          <Input
            label="Street Address"
            placeholder="e.g. 142 High Level Rd"
            required
            value={addressLine1}
            onChange={(e) => setAddressLine1(e.target.value)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="p-4 rounded-xl bg-sparehub-light border border-sparehub-border text-xs text-gray-600 space-y-1">
        <div className="font-bold text-sparehub-dark flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-sparehub-orange" />
          Required Verification Information:
        </div>
        <p>
          • Business Registration (BR) or National Identity Card (NIC) for individuals.<br />
          • Physical business operating location in Sri Lanka.<br />
          • Direct contact details for fulfillment coordination.
        </p>
      </div>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        disabled={isSubmitting}
        className="w-full font-bold shadow-sm"
      >
        {isSubmitting ? "Creating Your Shop..." : "Create Shop & Continue"}
      </Button>
    </form>
  );
}
