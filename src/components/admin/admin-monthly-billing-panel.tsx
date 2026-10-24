"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getAdminMonthlyStatementsAction,
  generateMonthlyStatementsAction,
  recordAdminCommissionPaymentAction,
  toggleShopRestrictionsAction,
  type MonthlyStatementView,
} from "@/lib/commission/billing-actions";
import { formatLKR } from "@/lib/utils";

export function AdminMonthlyBillingPanel() {
  const [statements, setStatements] = useState<MonthlyStatementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  // Statement Generation State
  const now = new Date();
  const [genYear, setGenYear] = useState<number>(now.getFullYear());
  const [genMonth, setGenMonth] = useState<number>(now.getMonth() + 1);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Payment Recording Modal State
  const [selectedStmtForPayment, setSelectedStmtForPayment] = useState<MonthlyStatementView | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [paymentNotes, setPaymentNotes] = useState<string>("");
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Shop Restriction Modal State
  const [selectedStmtForRestrict, setSelectedStmtForRestrict] = useState<MonthlyStatementView | null>(null);
  const [restrictPublishing, setRestrictPublishing] = useState(true);
  const [restrictOrders, setRestrictOrders] = useState(false);
  const [restrictReason, setRestrictReason] = useState("");
  const [restricting, setRestricting] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchStatements() {
      try {
        const res = await getAdminMonthlyStatementsAction({
          status: filterStatus === "all" ? undefined : filterStatus,
        });
        if (isMounted && res.success) {
          setStatements(res.statements);
        }
      } catch (e) {
        console.error("Failed to load admin statements:", e);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    fetchStatements();
    return () => {
      isMounted = false;
    };
  }, [filterStatus, refreshKey]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenMessage(null);

    const res = await generateMonthlyStatementsAction(genYear, genMonth);
    setGenerating(false);

    if (res.success) {
      setGenMessage({ type: "success", text: res.message });
      setLoading(true);
      setRefreshKey((k) => k + 1);
    } else {
      setGenMessage({ type: "error", text: res.message });
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStmtForPayment) return;
    setRecordingPayment(true);

    const res = await recordAdminCommissionPaymentAction({
      statementId: selectedStmtForPayment.id,
      shopId: selectedStmtForPayment.shopId,
      amountMinor: Math.round(paymentAmount * 100),
      paymentMethod: "bank_transfer",
      paymentReference: paymentRef.trim(),
      paymentDate,
      verificationNotes: paymentNotes.trim() || undefined,
    });

    setRecordingPayment(false);
    if (res.success) {
      setSelectedStmtForPayment(null);
      setPaymentRef("");
      setPaymentNotes("");
      setLoading(true);
      setRefreshKey((k) => k + 1);
    } else {
      alert(res.message);
    }
  };

  const handleApplyRestrictions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStmtForRestrict) return;
    setRestricting(true);

    const res = await toggleShopRestrictionsAction(selectedStmtForRestrict.shopId, {
      publishingRestricted: restrictPublishing,
      ordersRestricted: restrictOrders,
      reason: restrictReason.trim() || "Overdue commission payment beyond 7-day grace period.",
    });

    setRestricting(false);
    if (res.success) {
      setSelectedStmtForRestrict(null);
      setRestrictReason("");
      alert(res.message);
    } else {
      alert(res.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statement Generation Section */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-black text-sparehub-dark flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sparehub-orange" />
              Monthly Commission Statement Billing Engine
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate calendar month statements for delivered vendor orders. Payment due date is automatically set to
              the 10th of following month with 7-day grace period (17th).
            </p>
          </div>
        </div>

        {genMessage && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
              genMessage.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {genMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{genMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleGenerate} className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="font-bold text-gray-700">Year:</label>
            <input
              type="number"
              min="2026"
              max="2035"
              value={genYear}
              onChange={(e) => setGenYear(parseInt(e.target.value))}
              className="w-24 h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none font-bold"
            />
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="font-bold text-gray-700">Billing Month:</label>
            <select
              value={genMonth}
              onChange={(e) => setGenMonth(parseInt(e.target.value))}
              className="h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none font-bold text-xs"
            >
              {[
                "1 - January",
                "2 - February",
                "3 - March",
                "4 - April",
                "5 - May",
                "6 - June",
                "7 - July",
                "8 - August",
                "9 - September",
                "10 - October",
                "11 - November",
                "12 - December",
              ].map((m, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <Button type="submit" variant="primary" size="md" disabled={generating} className="text-xs ml-auto">
            {generating ? "Generating..." : "Generate Monthly Statements"}
          </Button>
        </form>
      </div>

      {/* Filter and Statements Table */}
      <div className="bg-white rounded-2xl border border-sparehub-border shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold text-sparehub-dark uppercase tracking-wider">
              Issued Statements ({statements.length})
            </h4>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {["all", "issued", "partially_paid", "paid", "overdue", "disputed"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors capitalize ${
                  filterStatus === st
                    ? "bg-sparehub-dark text-white"
                    : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
                }`}
              >
                {st.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-gray-400 animate-pulse">Loading statements...</div>
        ) : statements.length === 0 ? (
          <div className="p-8 text-center text-xs text-gray-500">No monthly statements match current filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-sparehub-dark divide-y divide-gray-100">
              <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Statement #</th>
                  <th className="py-3 px-4">Vendor Shop</th>
                  <th className="py-3 px-4">Period</th>
                  <th className="py-3 px-4 text-right">Delivered Sales</th>
                  <th className="py-3 px-4 text-right">Commission</th>
                  <th className="py-3 px-4 text-right">Payments Recv</th>
                  <th className="py-3 px-4 text-right">Undisputed Due</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-sparehub-orange">{s.statementNumber}</td>
                    <td className="py-3.5 px-4 font-semibold">{s.shopName}</td>
                    <td className="py-3.5 px-4 text-gray-500 whitespace-nowrap">
                      {s.periodStart} to {s.periodEnd}
                    </td>
                    <td className="py-3.5 px-4 text-right">{formatLKR(s.totalDeliveredSalesMinor)}</td>
                    <td className="py-3.5 px-4 text-right font-medium">{formatLKR(s.commissionEarnedMinor)}</td>
                    <td className="py-3.5 px-4 text-right text-emerald-700 font-medium">
                      {formatLKR(s.paymentsReceivedMinor)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-sparehub-orange">
                      {formatLKR(s.undisputedAmountDueMinor)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-gray-600">
                      {s.dueDate}
                      <span className="block text-[10px] text-gray-400">Grace: {s.gracePeriodEnd}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                          s.status === "paid"
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                            : s.status === "overdue"
                            ? "bg-red-50 text-red-800 border border-red-200"
                            : s.status === "disputed"
                            ? "bg-purple-50 text-purple-800 border border-purple-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {s.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {s.status !== "paid" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedStmtForPayment(s);
                              setPaymentAmount(s.undisputedAmountDueMinor / 100);
                            }}
                            className="text-[11px] h-7 px-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                          >
                            Record Bank Payment
                          </Button>
                        )}

                        {s.status === "overdue" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedStmtForRestrict(s)}
                            className="text-[11px] h-7 px-2 border-red-300 text-red-700 hover:bg-red-50"
                          >
                            Restrict Shop
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Verified Manual Payment Modal */}
      {selectedStmtForPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95"
          >
            <div className="border-b pb-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Financial Reconciliation
              </span>
              <h3 className="text-base font-black text-sparehub-dark">Record Verified Bank Payment</h3>
              <p className="text-xs text-gray-500">
                Statement: <strong>{selectedStmtForPayment.statementNumber}</strong> ({selectedStmtForPayment.shopName})
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Payment Amount (LKR) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="1"
                  value={paymentAmount || ""}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Bank Payment Reference / Slip ID *</label>
                <input
                  type="text"
                  required
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. CBC-TXN-984210"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Verification Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Verified via Commercial Bank statement"
                  className="w-full h-10 px-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedStmtForPayment(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" disabled={recordingPayment} className="text-xs">
                {recordingPayment ? "Saving..." : "Record Verified Payment"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Shop Overdue Restrictions Modal */}
      {selectedStmtForRestrict && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleApplyRestrictions}
            className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 border-2 border-red-500"
          >
            <div className="border-b pb-3">
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider flex items-center gap-1">
                <Ban className="w-3.5 h-3.5" />
                Overdue Commission Enforcement
              </span>
              <h3 className="text-base font-black text-sparehub-dark">Apply Vendor Shop Restrictions</h3>
              <p className="text-xs text-gray-500">
                Shop: <strong>{selectedStmtForRestrict.shopName}</strong> (Overdue Balance:{" "}
                {formatLKR(selectedStmtForRestrict.undisputedAmountDueMinor)})
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-red-900 text-[11px] leading-relaxed">
                Applying restrictions prevents the vendor from publishing new products or accepting new orders until
                undisputed overdue balances are reconciled.
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={restrictPublishing}
                    onChange={(e) => setRestrictPublishing(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span>Restrict New Product Publishing</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                  <input
                    type="checkbox"
                    checked={restrictOrders}
                    onChange={(e) => setRestrictOrders(e.target.checked)}
                    className="w-4 h-4 accent-red-600 rounded"
                  />
                  <span>Restrict New Order Placement</span>
                </label>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason for Administrative Restriction *</label>
                <textarea
                  required
                  rows={2}
                  value={restrictReason}
                  onChange={(e) => setRestrictReason(e.target.value)}
                  placeholder="Overdue commission statement past 7-day grace period."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedStmtForRestrict(null)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={restricting}
                className="text-xs bg-red-600 hover:bg-red-700 text-white"
              >
                {restricting ? "Applying..." : "Apply Restrictions"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
