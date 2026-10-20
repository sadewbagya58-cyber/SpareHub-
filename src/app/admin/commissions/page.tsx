"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Percent,
  Plus,
  ShieldCheck,
  ChevronRight,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Layers,
  Store,
  Globe,
  Power,
  X,
} from "lucide-react";
import {
  getCommissionRulesAction,
  getCommissionRuleFormOptionsAction,
  createCommissionRuleAction,
  toggleCommissionRuleAction,
  deleteCommissionRuleAction,
} from "@/lib/commission/actions";
import type { CommissionRuleItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function AdminCommissionsPage() {
  const [rules, setRules] = useState<CommissionRuleItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [shops, setShops] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form state
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState("");
  const [ruleType, setRuleType] = useState<"platform_default" | "category_override" | "shop_override">("platform_default");
  const [rateBps, setRateBps] = useState<number>(500);
  const [categoryId, setCategoryId] = useState("");
  const [shopId, setShopId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [effectiveUntil, setEffectiveUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const [rulesRes, optsRes] = await Promise.all([
          getCommissionRulesAction(),
          getCommissionRuleFormOptionsAction(),
        ]);
        if (!isMounted) return;
        if (rulesRes.success) setRules(rulesRes.rules);
        setCategories(optsRes.categories);
        setShops(optsRes.shops);
      } catch (e) {
        console.error("Failed to load commission data:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (name.trim().length < 3) {
      setFormError("Rule name must be at least 3 characters.");
      return;
    }

    if (rateBps < 0 || rateBps > 10000) {
      setFormError("Rate must be between 0 and 10000 basis points (0% to 100%).");
      return;
    }

    if (ruleType === "category_override" && !categoryId) {
      setFormError("Please select a target category.");
      return;
    }

    if (ruleType === "shop_override" && !shopId) {
      setFormError("Please select a target vendor shop.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await createCommissionRuleAction({
        name: name.trim(),
        ruleType,
        rateBasisPoints: rateBps,
        categoryId: ruleType === "category_override" ? categoryId : null,
        shopId: ruleType === "shop_override" ? shopId : null,
        effectiveFrom,
        effectiveUntil: effectiveUntil || null,
      });

      if (res.success) {
        setFormSuccess(res.message);
        setName("");
        setRateBps(500);
        setCategoryId("");
        setShopId("");
        setEffectiveUntil("");
        // Reload list
        const updated = await getCommissionRulesAction();
        if (updated.success) setRules(updated.rules);
        setTimeout(() => {
          setShowModal(false);
          setFormSuccess(null);
        }, 1500);
      } else {
        setFormError(res.message);
      }
    } catch {
      setFormError("An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (ruleId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, isActive: nextStatus } : r))
    );
    const res = await toggleCommissionRuleAction(ruleId, nextStatus);
    if (!res.success) {
      // Revert on failure
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, isActive: currentStatus } : r))
      );
      alert(res.message);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm("Are you sure you want to delete this commission rule? This cannot be undone.")) return;
    setRules((prev) => prev.filter((r) => r.id !== ruleId));
    const res = await deleteCommissionRuleAction(ruleId);
    if (!res.success) {
      alert(res.message);
      const updated = await getCommissionRulesAction();
      if (updated.success) setRules(updated.rules);
    }
  };

  const getRuleTypeBadge = (type: string) => {
    switch (type) {
      case "platform_default":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
            <Globe className="w-3 h-3 text-purple-600" />
            Platform Default
          </span>
        );
      case "category_override":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Layers className="w-3 h-3 text-blue-600" />
            Category Override
          </span>
        );
      case "shop_override":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Store className="w-3 h-3 text-amber-600" />
            Shop Override
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-sparehub-light py-8 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-gray-500">
          <Link href="/" className="hover:text-sparehub-orange">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <Link href="/admin/dashboard" className="hover:text-sparehub-orange">
            Admin Control Center
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-sparehub-dark font-medium">Commission Rules</span>
        </nav>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-sparehub-dark flex items-center gap-2.5">
                <Percent className="w-7 h-7 text-sparehub-orange" />
                Commission Configuration Engine
              </h1>
              <span className="bg-purple-100 text-purple-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {rules.length} Configured
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Configure marketplace commission percentages across platform defaults, product categories, and vendor-specific agreements.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start sm:self-auto">
            <Link href="/admin/financials">
              <Button variant="outline" size="sm" className="font-semibold text-xs">
                Financial Ledger →
              </Button>
            </Link>
            <Button
              onClick={() => setShowModal(true)}
              size="sm"
              className="bg-sparehub-dark hover:bg-neutral-800 text-white font-bold gap-1.5"
            >
              <Plus className="w-4 h-4 text-sparehub-orange" />
              New Commission Rule
            </Button>
          </div>
        </div>

        {/* Priority Fallback Notice */}
        <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-900 leading-relaxed">
            <strong className="block font-bold mb-0.5">
              Configurable Fallback Resolution Priority:
            </strong>
            <span className="font-semibold">1. Shop Override</span> (Specific merchant agreement) &gt;{" "}
            <span className="font-semibold">2. Category Override</span> (Product category rate) &gt;{" "}
            <span className="font-semibold">3. Platform Default</span> (Marketplace baseline).
            Past transactions are immutable and preserved at their historically calculated rate.
          </div>
        </div>

        {/* Rules Table */}
        <div className="bg-white rounded-2xl border border-sparehub-border overflow-hidden shadow-xs">
          <div className="p-4 border-b border-sparehub-border bg-gray-50/70 flex items-center justify-between">
            <h2 className="text-sm font-bold text-sparehub-dark">Active &amp; Archived Rules</h2>
            <span className="text-[11px] text-gray-400">100 basis points = 1.00%</span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
              Loading commission rules...
            </div>
          ) : rules.length === 0 ? (
            <div className="p-12 text-center">
              <Percent className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">No commission rules defined</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Click &quot;New Commission Rule&quot; to establish your marketplace fee schedule.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-sparehub-dark divide-y divide-gray-100">
                <thead className="bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Rule Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Applied Scope</th>
                    <th className="py-3 px-4 text-right">Commission Rate</th>
                    <th className="py-3 px-4">Effective Period</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      className={`hover:bg-gray-50/60 transition-colors ${
                        !rule.isActive ? "opacity-60 bg-gray-50/30" : ""
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-sparehub-dark">
                        {rule.name}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getRuleTypeBadge(rule.ruleType)}
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {rule.ruleType === "shop_override" ? (
                          <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Store className="w-3.5 h-3.5 text-amber-600" />
                            {rule.shopName || "Specific Shop"}
                          </span>
                        ) : rule.ruleType === "category_override" ? (
                          <span className="font-semibold text-gray-800 flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            {rule.categoryName || "Category"}
                          </span>
                        ) : (
                          <span className="text-gray-500">Marketplace-Wide</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="text-sm font-black text-sparehub-dark">
                          {(rule.rateBasisPoints / 100).toFixed(2)}%
                        </span>
                        <span className="block text-[10px] text-gray-400 font-mono">
                          {rule.rateBasisPoints} bps
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                        <span>
                          {new Date(rule.effectiveFrom).toLocaleDateString("en-LK", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {rule.effectiveUntil && (
                          <span className="block text-[10px] text-gray-400">
                            Until:{" "}
                            {new Date(rule.effectiveUntil).toLocaleDateString("en-LK", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggle(rule.id, rule.isActive)}
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full cursor-pointer transition-colors ${
                            rule.isActive
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {rule.isActive ? "Active" : "Disabled"}
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleDelete(rule.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                          title="Delete Rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-sparehub-border w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sparehub-border">
              <h3 className="font-bold text-base text-sparehub-dark flex items-center gap-2">
                <Percent className="w-5 h-5 text-sparehub-orange" />
                Create New Commission Rule
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Rule Name *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Performance Engine Parts 6%"
                  required
                  className="w-full rounded-xl border border-sparehub-border p-2.5 focus:border-sparehub-orange focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Rule Type *
                </label>
                <select
                  value={ruleType}
                  onChange={(e) =>
                    setRuleType(
                      e.target.value as "platform_default" | "category_override" | "shop_override"
                    )
                  }
                  className="w-full rounded-xl border border-sparehub-border p-2.5 focus:border-sparehub-orange focus:outline-none"
                >
                  <option value="platform_default">Platform Default (Global Baseline)</option>
                  <option value="category_override">Category Override</option>
                  <option value="shop_override">Shop Override (Merchant Agreement)</option>
                </select>
              </div>

              {ruleType === "category_override" && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Select Product Category *
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-sparehub-border p-2.5 focus:border-sparehub-orange focus:outline-none"
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {ruleType === "shop_override" && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Select Vendor Shop *
                  </label>
                  <select
                    value={shopId}
                    onChange={(e) => setShopId(e.target.value)}
                    required
                    className="w-full rounded-xl border border-sparehub-border p-2.5 focus:border-sparehub-orange focus:outline-none"
                  >
                    <option value="">-- Choose Vendor Shop --</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Basis Points & Percentage Input */}
              <div className="p-3.5 rounded-xl bg-gray-50 border border-sparehub-border space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-700">
                    Commission Rate (Basis Points) *
                  </label>
                  <span className="font-black text-sm text-sparehub-orange">
                    {(rateBps / 100).toFixed(2)}%
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  max={10000}
                  step={25}
                  value={rateBps}
                  onChange={(e) => setRateBps(Number(e.target.value))}
                  required
                  className="w-full rounded-xl border border-sparehub-border p-2 bg-white focus:border-sparehub-orange focus:outline-none"
                />
                <div className="flex gap-2 text-[10px] text-gray-500">
                  <button
                    type="button"
                    onClick={() => setRateBps(250)}
                    className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 font-bold"
                  >
                    2.50% (250)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateBps(500)}
                    className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 font-bold"
                  >
                    5.00% (500)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateBps(750)}
                    className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 font-bold"
                  >
                    7.50% (750)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRateBps(1000)}
                    className="px-2 py-0.5 rounded bg-gray-200 hover:bg-gray-300 font-bold"
                  >
                    10.00% (1000)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    required
                    className="w-full rounded-xl border border-sparehub-border p-2 focus:border-sparehub-orange focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-700 mb-1">
                    Effective Until (Optional)
                  </label>
                  <input
                    type="date"
                    value={effectiveUntil}
                    onChange={(e) => setEffectiveUntil(e.target.value)}
                    className="w-full rounded-xl border border-sparehub-border p-2 focus:border-sparehub-orange focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sparehub-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={submitting}
                  className="bg-sparehub-orange hover:bg-sparehub-orange-hover text-white font-bold"
                >
                  {submitting ? "Saving..." : "Create Rule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
