"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  Building,
  HelpCircle,
} from "lucide-react";
import { getSellerEarningsAction } from "@/lib/commission/actions";
import { formatLKR } from "@/lib/utils";
import type { SellerEarningsSummary, CommissionLedgerItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { CommissionRateBanner } from "@/components/seller/commission-rate-banner";
import { MonthlyStatementsPanel } from "@/components/seller/monthly-statements-panel";

export default function SellerEarningsPage() {
  const [summary, setSummary] = useState<SellerEarningsSummary>({
    totalGrossSalesMinor: 0,
    totalCommissionMinor: 0,
    netEarningsMinor: 0,
    availableBalanceMinor: 0,
    pendingClearanceMinor: 0,
    settledPayoutsMinor: 0,
    cancelledMinor: 0,
    totalOrdersCount: 0,
  });
  const [ledger, setLedger] = useState<CommissionLedgerItem[]>([]);
  const [shopName, setShopName] = useState<string>("My Store");
  const [shopId, setShopId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"ledger" | "statements">("ledger");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      try {
        const res = await getSellerEarningsAction();
        if (!isMounted) return;
        if (res.success) {
          setSummary(res.summary);
          setLedger(res.ledger);
          if (res.shopName) setShopName(res.shopName);
          if (res.shopId) setShopId(res.shopId);
        }
      } catch (e) {
        console.error("Failed to load seller earnings:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredLedger = ledger.filter((item) => {
    if (filter === "all") return true;
    return item.status === filter;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "earned":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available for Payout
          </span>
        );
      case "accrued":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Delivery
          </span>
        );
      case "settled":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Building className="w-3 h-3 text-blue-600" />
            Payout Settled
          </span>
        );
      case "cancelled":
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-red-600" />
            {status === "refunded" ? "Refunded" : "Cancelled"}
          </span>
        );
      default:
        return <Badge variant="neutral">{status}</Badge>;
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
          <Link href="/seller/dashboard" className="hover:text-sparehub-orange">
            Seller Dashboard
          </Link>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-sparehub-dark font-medium">Earnings &amp; Financials</span>
        </nav>

        {/* Page Header Banner */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-4 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-sparehub-dark flex items-center gap-2 sm:gap-2.5">
                <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
                Earnings &amp; Financial Ledger
              </h1>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                {shopName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Transparent, item-by-item accounting of gross sales, marketplace commission deductions, and net payouts.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <Link
              href="/seller/orders"
              className="text-xs font-bold text-sparehub-orange hover:underline px-3 py-1.5"
            >
              View Orders →
            </Link>
          </div>
        </div>

        {/* Active Commission Rate & Proposed Rate Notice */}
        {shopId && <CommissionRateBanner shopId={shopId} />}

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeTab === "ledger"
                ? "border-sparehub-orange text-sparehub-orange"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Delivered Order Items Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("statements")}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
              activeTab === "statements"
                ? "border-sparehub-orange text-sparehub-orange"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Monthly Commission Statements (Due 10th)
          </button>
        </div>

        {activeTab === "statements" ? (
          shopId ? (
            <MonthlyStatementsPanel shopId={shopId} />
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border text-xs text-gray-500">
              No active vendor shop found.
            </div>
          )
        ) : (
          <>
            {/* Summary Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Available Balance */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <span>Available for Payout</span>
              <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-emerald-600">
              {formatLKR(summary.availableBalanceMinor)}
            </div>
            <p className="text-[11px] text-gray-400">
              Orders marked delivered &amp; cleared for settlement
            </p>
          </div>

          {/* 2. Pending Clearance */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <span>Pending Clearance</span>
              <span className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-amber-600">
              {formatLKR(summary.pendingClearanceMinor)}
            </div>
            <p className="text-[11px] text-gray-400">
              In-transit or processing sub-orders
            </p>
          </div>

          {/* 3. Settled Payouts */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <span>Total Settled (Paid Out)</span>
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Building className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-sparehub-dark">
              {formatLKR(summary.settledPayoutsMinor)}
            </div>
            <p className="text-[11px] text-gray-400">
              Transferred directly to your merchant account
            </p>
          </div>

          {/* 4. Platform Commission */}
          <div className="bg-white rounded-2xl border border-sparehub-border p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500 font-semibold uppercase tracking-wider">
              <span>Marketplace Commission</span>
              <span className="p-2 rounded-xl bg-gray-50 text-gray-600">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-black text-gray-700">
              {formatLKR(summary.totalCommissionMinor)}
            </div>
            <p className="text-[11px] text-gray-400">
              From {formatLKR(summary.totalGrossSalesMinor)} gross volume
            </p>
          </div>
        </div>

        {/* Payout Policy Explainer */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
          <ShieldCheck className="w-5 h-5 text-sparehub-orange shrink-0 mt-0.5" />
          <div className="text-xs text-gray-700 leading-relaxed">
            <strong className="block text-sparehub-dark font-bold mb-0.5">
              SpareHub Payout &amp; Commission Policy
            </strong>
            When an order is placed, commission and net earnings are initially held in <em>Pending Clearance</em>. Once the buyer receives the package and the order is updated to <em>Delivered</em>, earnings transition immediately to <em>Available for Payout</em>. Payouts are scheduled via direct Sri Lankan bank transfer.
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {["all", "earned", "accrued", "settled", "cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors capitalize shrink-0 ${
                filter === st
                  ? "bg-sparehub-dark text-white shadow-xs"
                  : "bg-white text-gray-600 border border-sparehub-border hover:bg-gray-50"
              }`}
            >
              {st === "all"
                ? `All Transactions (${ledger.length})`
                : st === "earned"
                ? "Available for Payout"
                : st === "accrued"
                ? "Pending Clearance"
                : st === "settled"
                ? "Settled Payouts"
                : "Cancelled / Refunded"}
            </button>
          ))}
        </div>

        {/* Detailed Financial Ledger Section */}
        <div className="bg-white rounded-2xl border border-sparehub-border overflow-hidden shadow-xs">
          <div className="p-4 border-b border-sparehub-border bg-gray-50/70 flex items-center justify-between">
            <h2 className="text-sm font-bold text-sparehub-dark flex items-center gap-2">
              Financial Audit Line Items ({filteredLedger.length})
            </h2>
            <span className="text-[11px] text-gray-400">
              Immutable ledger records
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
              Loading financial records...
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="p-12 text-center">
              <HelpCircle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">No transactions found</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Earnings records will appear automatically when customers purchase items from your shop.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile View: Stacked Responsive Financial Cards */}
              <div className="block md:hidden divide-y divide-gray-100">
                {filteredLedger.map((item) => (
                  <div key={`m-${item.id}`} className="p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-gray-500 font-medium">
                        {new Date(item.createdAt).toLocaleDateString("en-LK", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <div className="shrink-0">{getStatusBadge(item.status)}</div>
                    </div>

                    <div>
                      <Link
                        href={`/seller/orders/${item.sellerOrderId}`}
                        className="font-mono text-xs font-bold text-sparehub-orange hover:underline inline-block"
                      >
                        {item.subOrderNumber || `#${item.sellerOrderId.slice(0, 8)}`}
                      </Link>
                      <h4 className="text-xs font-bold text-sparehub-dark line-clamp-1 mt-0.5">
                        {item.productTitle || "Automotive Spare Part"}
                      </h4>
                      {item.productPartNumber && (
                        <span className="text-[10px] text-gray-400 font-mono block">
                          PN: {item.productPartNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-gray-400 block font-medium">Gross Subtotal</span>
                        <span className="font-semibold text-gray-800">{formatLKR(item.itemSubtotalMinor)}</span>
                      </div>
                      <div className="text-right space-y-0.5">
                        <span className="text-[10px] text-gray-400 block font-medium">
                          Fee ({(item.commissionRateBps / 100).toFixed(2)}%)
                        </span>
                        <span className="font-semibold text-gray-600">- {formatLKR(item.commissionAmountMinor)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-gray-200 bg-emerald-50/50 -mx-4 -mb-4 px-4 py-2.5">
                      <span className="text-xs font-bold text-gray-700">Net Seller Earning</span>
                      <span className="text-sm font-black text-emerald-700">{formatLKR(item.sellerNetEarningMinor)}</span>
                    </div>

                    {item.payoutReference && (
                      <div className="text-[10px] text-gray-500 font-mono bg-gray-50 p-1.5 rounded text-center">
                        Bank Settlement Ref: {item.payoutReference}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View: Full Audit Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs text-sparehub-dark divide-y divide-gray-100">
                  <thead className="bg-gray-50/50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Sub-Order</th>
                      <th className="py-3 px-4">Product Snapshot</th>
                      <th className="py-3 px-4 text-right">Gross Subtotal</th>
                      <th className="py-3 px-4 text-right">Commission Rate</th>
                      <th className="py-3 px-4 text-right">Platform Fee</th>
                      <th className="py-3 px-4 text-right">Net Earning</th>
                      <th className="py-3 px-4 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLedger.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleDateString("en-LK", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold whitespace-nowrap">
                          <Link
                            href={`/seller/orders/${item.sellerOrderId}`}
                            className="text-sparehub-orange hover:underline"
                          >
                            {item.subOrderNumber || `#${item.sellerOrderId.slice(0, 8)}`}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold truncate">
                            {item.productTitle || "Automotive Spare Part"}
                          </div>
                          {item.productPartNumber && (
                            <span className="text-[10px] text-gray-400 font-mono">
                              PN: {item.productPartNumber}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium whitespace-nowrap">
                          {formatLKR(item.itemSubtotalMinor)}
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <span className="font-mono text-[11px] text-gray-600">
                            {(item.commissionRateBps / 100).toFixed(2)}%
                          </span>
                          <span className="block text-[10px] text-gray-400 truncate max-w-[120px]">
                            {item.appliedRuleName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right text-gray-600 font-medium whitespace-nowrap">
                          - {formatLKR(item.commissionAmountMinor)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-black text-emerald-600 whitespace-nowrap">
                          {formatLKR(item.sellerNetEarningMinor)}
                        </td>

                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getStatusBadge(item.status)}
                          {item.payoutReference && (
                            <span className="block text-[10px] text-gray-400 font-mono mt-0.5">
                              Ref: {item.payoutReference}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
