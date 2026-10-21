"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Percent,
  Search,
  X,
  CreditCard,
} from "lucide-react";
import {
  getAdminFinancialsAction,
  settleCommissionLedgerAction,
  bulkSettleShopEarningsAction,
} from "@/lib/commission/actions";
import { formatLKR } from "@/lib/utils";
import type { AdminFinancialsSummary, CommissionLedgerItem } from "@/lib/types";
import { Button } from "@/components/ui/button";

export default function AdminFinancialsPage() {
  const [summary, setSummary] = useState<AdminFinancialsSummary>({
    totalGrossGmvMinor: 0,
    totalPlatformRevenueMinor: 0,
    totalEarnedRevenueMinor: 0,
    pendingSellerPayoutsMinor: 0,
    totalSettledPayoutsMinor: 0,
    totalLedgerCount: 0,
  });
  const [ledger, setLedger] = useState<CommissionLedgerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Settlement modal state
  const [settlingItem, setSettlingItem] = useState<CommissionLedgerItem | null>(null);
  const [payoutRef, setPayoutRef] = useState("");
  const [isBulk, setIsBulk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const res = await getAdminFinancialsAction();
      if (res.success) {
        setSummary(res.summary);
        setLedger(res.ledger);
      }
    } catch (e) {
      console.error("Failed to load financials:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const res = await getAdminFinancialsAction();
        if (!isMounted) return;
        if (res.success) {
          setSummary(res.summary);
          setLedger(res.ledger);
        }
      } catch (e) {
        console.error("Failed to load financials:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenSettle = (item: CommissionLedgerItem, bulk = false) => {
    setSettlingItem(item);
    setIsBulk(bulk);
    const suffix = item.id.replace(/-/g, "").slice(0, 6).toUpperCase();
    setPayoutRef(`SLIP-${suffix}`);
    setModalError(null);
  };

  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingItem) return;
    if (payoutRef.trim().length < 3) {
      setModalError("Please enter a valid payout bank reference number.");
      return;
    }

    setSubmitting(true);
    setModalError(null);

    try {
      let res;
      if (isBulk) {
        res = await bulkSettleShopEarningsAction(settlingItem.shopId, payoutRef.trim());
      } else {
        res = await settleCommissionLedgerAction(settlingItem.id, payoutRef.trim());
      }

      if (res.success) {
        setSettlingItem(null);
        await loadData();
      } else {
        setModalError(res.message);
      }
    } catch {
      setModalError("Failed to record settlement.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredLedger = ledger.filter((item) => {
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSub = (item.subOrderNumber || "").toLowerCase().includes(q);
      const matchShop = (item.shopName || "").toLowerCase().includes(q);
      const matchProd = (item.productTitle || "").toLowerCase().includes(q);
      const matchRef = (item.payoutReference || "").toLowerCase().includes(q);
      return matchSub || matchShop || matchProd || matchRef;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "earned":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Earned (Pending Payout)
          </span>
        );
      case "accrued":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" />
            Accrued (In Transit)
          </span>
        );
      case "settled":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Building className="w-3 h-3 text-blue-600" />
            Settled
          </span>
        );
      case "cancelled":
      case "refunded":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertCircle className="w-3 h-3 text-red-600" />
            {status}
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
          <span className="text-sparehub-dark font-medium">Financial Ledger &amp; Payouts</span>
        </nav>

        {/* Page Header */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-4 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-sparehub-dark flex items-center gap-2 sm:gap-2.5">
                <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 shrink-0" />
                Marketplace Financial Ledger &amp; Settlements
              </h1>
              <span className="bg-emerald-100 text-emerald-900 text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0">
                {ledger.length} Transactions
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Supervise platform gross merchandise value (GMV), platform commission deductions, and record merchant payouts.
            </p>
          </div>

          <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
            <Link
              href="/admin/commissions"
              className="inline-flex items-center justify-center font-bold text-xs rounded-lg border border-sparehub-border bg-white text-sparehub-dark hover:bg-sparehub-light px-3 py-1.5 gap-1.5 h-8 whitespace-nowrap transition-all active:scale-[0.97]"
            >
              <Percent className="w-4 h-4 text-sparehub-orange" />
              Commission Rules
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
              Gross Marketplace Volume
            </span>
            <div className="text-xl font-black text-sparehub-dark">
              {formatLKR(summary.totalGrossGmvMinor)}
            </div>
            <span className="text-[10px] text-gray-400">Total customer orders</span>
          </div>

          <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
              Total Platform Revenue
            </span>
            <div className="text-xl font-black text-sparehub-orange">
              {formatLKR(summary.totalPlatformRevenueMinor)}
            </div>
            <span className="text-[10px] text-gray-400">All calculated fees</span>
          </div>

          <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
              Cleared Platform Revenue
            </span>
            <div className="text-xl font-black text-emerald-600">
              {formatLKR(summary.totalEarnedRevenueMinor)}
            </div>
            <span className="text-[10px] text-gray-400">From delivered orders</span>
          </div>

          <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
              Pending Seller Payouts
            </span>
            <div className="text-xl font-black text-amber-600">
              {formatLKR(summary.pendingSellerPayoutsMinor)}
            </div>
            <span className="text-[10px] text-gray-400">Awaiting bank settlement</span>
          </div>

          <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs space-y-1">
            <span className="text-[11px] text-gray-500 font-bold uppercase tracking-wider block">
              Total Settled Payouts
            </span>
            <div className="text-xl font-black text-blue-600">
              {formatLKR(summary.totalSettledPayoutsMinor)}
            </div>
            <span className="text-[10px] text-gray-400">Transferred to vendors</span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {["all", "earned", "accrued", "settled", "cancelled"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors capitalize shrink-0 ${
                  statusFilter === st
                    ? "bg-sparehub-dark text-white shadow-xs"
                    : "bg-gray-50 text-gray-600 border border-sparehub-border hover:bg-gray-100"
                }`}
              >
                {st === "all"
                  ? `All (${ledger.length})`
                  : st === "earned"
                  ? "Earned (Ready to Settle)"
                  : st === "accrued"
                  ? "Accrued"
                  : st === "settled"
                  ? "Settled"
                  : "Cancelled"}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <input
              type="text"
              placeholder="Search order, shop, or ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs rounded-xl border border-sparehub-border bg-gray-50 py-2 pl-9 pr-3 focus:bg-white focus:border-sparehub-orange focus:outline-none"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>

        {/* Ledger Table Section */}
        <div className="bg-white rounded-2xl border border-sparehub-border overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-12 text-center text-xs text-gray-400 animate-pulse">
              Loading financial records...
            </div>
          ) : filteredLedger.length === 0 ? (
            <div className="p-12 text-center">
              <DollarSign className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">No financial records found</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Financial records will automatically appear as customers complete checkouts.
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

                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/orders/${item.sellerOrderId}`}
                          className="font-mono text-xs font-bold text-sparehub-orange hover:underline"
                        >
                          {item.subOrderNumber || `#${item.sellerOrderId.slice(0, 8)}`}
                        </Link>
                        <span className="text-xs font-bold text-gray-700 truncate max-w-[50%]">
                          {item.shopName}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-sparehub-dark line-clamp-1">
                        {item.productTitle || "Automotive Spare Part"}
                      </h4>
                      {item.productPartNumber && (
                        <span className="text-[10px] text-gray-400 font-mono block">
                          PN: {item.productPartNumber}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 text-xs">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-medium">Gross GMV</span>
                        <span className="font-semibold text-gray-800">{formatLKR(item.itemSubtotalMinor)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-gray-400 block font-medium">
                          Fee ({(item.commissionRateBps / 100).toFixed(2)}%)
                        </span>
                        <span className="font-bold text-sparehub-orange">
                          + {formatLKR(item.commissionAmountMinor)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-gray-200 bg-emerald-50/50 -mx-4 -mb-4 px-4 py-2.5">
                      <div>
                        <span className="text-[10px] text-gray-500 block">Seller Net Due</span>
                        <span className="text-sm font-black text-emerald-700">
                          {formatLKR(item.sellerNetEarningMinor)}
                        </span>
                      </div>

                      {item.status === "earned" && (
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => handleOpenSettle(item, false)}
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 shadow-xs"
                          >
                            Settle
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenSettle(item, true)}
                            title="Settle all earned items for this merchant"
                            className="h-8 text-xs text-gray-700 font-semibold px-2"
                          >
                            Bulk
                          </Button>
                        </div>
                      )}

                      {item.payoutReference && (
                        <span className="text-[10px] text-gray-500 font-mono">
                          Ref: {item.payoutReference}
                        </span>
                      )}
                    </div>
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
                      <th className="py-3 px-4">Merchant Shop</th>
                      <th className="py-3 px-4">Product Snapshot</th>
                      <th className="py-3 px-4 text-right">Gross GMV</th>
                      <th className="py-3 px-4 text-right">Fee Rate</th>
                      <th className="py-3 px-4 text-right">Platform Fee</th>
                      <th className="py-3 px-4 text-right">Seller Net</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
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
                            href={`/orders/${item.sellerOrderId}`}
                            className="text-sparehub-orange hover:underline"
                          >
                            {item.subOrderNumber || `#${item.sellerOrderId.slice(0, 8)}`}
                          </Link>
                        </td>

                        <td className="py-3.5 px-4 whitespace-nowrap font-semibold">
                          {item.shopName}
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
                          <span className="block text-[10px] text-gray-400 truncate max-w-[100px]">
                            {item.appliedRuleName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right text-sparehub-orange font-bold whitespace-nowrap">
                          {formatLKR(item.commissionAmountMinor)}
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

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {item.status === "earned" && (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                onClick={() => handleOpenSettle(item, false)}
                                className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5"
                              >
                                Settle
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenSettle(item, true)}
                                title="Settle all earned items for this merchant"
                                className="h-7 text-[11px] text-gray-600 font-semibold px-2"
                              >
                                Bulk Shop
                              </Button>
                            </div>
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
      </div>

      {/* Settlement Confirmation Modal */}
      {settlingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-sparehub-border w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-sparehub-border">
              <h3 className="font-bold text-base text-sparehub-dark flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-600" />
                {isBulk ? "Bulk Merchant Settlement" : "Record Payout Settlement"}
              </h3>
              <button
                type="button"
                onClick={() => setSettlingItem(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="p-4 rounded-xl bg-gray-50 border border-sparehub-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500 font-semibold">Vendor Shop:</span>
                <span className="font-bold text-sparehub-dark">{settlingItem.shopName}</span>
              </div>
              {!isBulk && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Sub-Order:</span>
                    <span className="font-mono font-bold">{settlingItem.subOrderNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Net Payout Amount:</span>
                    <span className="font-black text-emerald-600 text-sm">
                      {formatLKR(settlingItem.sellerNetEarningMinor)}
                    </span>
                  </div>
                </>
              )}
              {isBulk && (
                <p className="text-amber-800 bg-amber-50 p-2 rounded-lg text-[11px] font-medium">
                  This will mark all eligible <strong>Earned</strong> balances for this vendor as settled.
                </p>
              )}
            </div>

            <form onSubmit={handleConfirmSettle} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Bank Transfer Reference / Cheque # *
                </label>
                <input
                  type="text"
                  value={payoutRef}
                  onChange={(e) => setPayoutRef(e.target.value)}
                  placeholder="e.g., BOC-ONLINE-REF-99420"
                  required
                  className="w-full rounded-xl border border-sparehub-border p-2.5 font-mono text-xs focus:border-sparehub-orange focus:outline-none"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Reference code provided by the Sri Lankan bank or payment slip.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-sparehub-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSettlingItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  isLoading={submitting}
                  loadingText="Recording Settlement..."
                  disabled={submitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                >
                  Confirm Settlement
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
