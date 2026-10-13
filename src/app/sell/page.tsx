"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Store, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Building, 
  User, 
  Box 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { SellerType } from "@/lib/types";

export default function SellPage() {
  const [sellerType, setSellerType] = useState<SellerType>("retail_shop");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [district, setDistrict] = useState("Colombo");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // Local mock action simulating form submission with scoped loading
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 400);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Marketplace
      </Link>

      <div className="max-w-2xl mb-8">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sparehub-orange-light text-sparehub-orange text-xs font-bold uppercase tracking-wider mb-3">
          <Store className="w-3.5 h-3.5" />
          Seller Registration
        </div>
        <h1 className="text-3xl font-black text-sparehub-dark tracking-tight">
          Open Your Vendor Shop on SpareHub
        </h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Join Sri Lanka&apos;s premier multi-vendor automotive spare parts marketplace. Expand your customer reach across all 25 districts with our verified seller platform.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="md:col-span-2">
          {submitted ? (
            <div className="p-8 rounded-2xl bg-green-50 border border-green-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-sparehub-success text-white flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-sparehub-dark">
                Application Received for Review
              </h3>
              <p className="text-xs text-gray-600 max-w-md mx-auto leading-relaxed">
                Thank you for applying to open a shop for <strong>{shopName || "your business"}</strong>. In Phase 5, this form connects to the secure Supabase document verification workflow where our platform administrators review your identity and business registration documents.
              </p>
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSubmitted(false)}
                >
                  Submit Another Application
                </Button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="p-6 sm:p-8 rounded-2xl border border-sparehub-border bg-white shadow-sm space-y-6"
            >
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
                />

                <div className="space-y-1.5">
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
                    className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none"
                  >
                    {SRI_LANKA_DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-sparehub-light border border-sparehub-border text-xs text-gray-600 space-y-1">
                <div className="font-bold text-sparehub-dark flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-sparehub-orange" />
                  Required Verification Documents:
                </div>
                <p>
                  • Business Registration (BR) or National Identity Card (NIC) for individuals.<br />
                  • Proof of business address and contact verification.<br />
                  • Importer documentation if registering as a direct importer.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSubmitting}
                loadingText="Submitting Application..."
                className="w-full font-bold shadow-sm"
              >
                Submit Shop Application
              </Button>
            </form>
          )}
        </div>

        {/* Verification & Policy Sidebar */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-sparehub-light border border-sparehub-border space-y-4">
            <h3 className="text-sm font-bold text-sparehub-dark">
              How Vendor Onboarding Works
            </h3>
            <ol className="space-y-3 text-xs text-gray-600">
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  1
                </span>
                <span><strong>Submit Details:</strong> Provide shop information, address, and category.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  2
                </span>
                <span><strong>Document Verification:</strong> Upload BR or NIC to our encrypted document vault.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  3
                </span>
                <span><strong>Admin Review:</strong> Platform administrators verify your credentials.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-sparehub-dark text-white flex items-center justify-center font-bold shrink-0 text-[10px]">
                  4
                </span>
                <span><strong>Start Selling:</strong> Publish products with vehicle compatibility tags.</span>
              </li>
            </ol>
          </div>

          <div className="p-5 rounded-2xl border border-amber-200 bg-amber-50/70 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-700" />
              Commission & Payout Policy Note
            </div>
            <p className="leading-relaxed">
              Platform commercial terms, commission rates, and payout cycles are subject to final platform owner authorization. No fees are charged during this initial onboarding registration phase.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
