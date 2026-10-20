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
        <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-sparehub-dark flex items-center gap-2.5">
                <DollarSign className="w-7 h-7 text-emerald-600" />
                Earnings &amp; Financial Ledger
              </h1>
              <span className="bg-amber-100 text-amber-900 text-xs font-bold px-2.5 py-0.5 rounded-full">
                {shopName}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Transparent, item-by-item accounting of gross sales, marketplace commission deductions, and net payouts.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/seller/orders"
              className="text-xs font-bold text-sparehub-orange hover:underline px-3 py-1.5"
            >
              View Orders →
            </Link>
          </div>
        </div>

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
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["all", "earned", "accrued", "settled", "cancelled"].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors capitalize shrink-0 ${
                filter === st
                  ? "bg-sparehub-dark text-white"
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

        {/* Detailed Financial Ledger Table */}
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
            <div className="overflow-x-auto">
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
          )}
        </div>
      </div>
    </div>
  );
}
