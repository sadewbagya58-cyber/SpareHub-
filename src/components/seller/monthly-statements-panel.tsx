"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getSellerMonthlyStatementsAction,
  submitCommissionDisputeAction,
  type MonthlyStatementView,
} from "@/lib/commission/billing-actions";
import { formatLKR } from "@/lib/utils";

interface MonthlyStatementsPanelProps {
  shopId: string;
}

export function MonthlyStatementsPanel({ shopId }: MonthlyStatementsPanelProps) {
  const [statements, setStatements] = useState<MonthlyStatementView[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatement, setSelectedStatement] = useState<MonthlyStatementView | null>(null);

  // Dispute modal state
  const [isDisputing, setIsDisputing] = useState(false);
  const [disputeAmount, setDisputeAmount] = useState<number>(0);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputeMessage, setDisputeMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await getSellerMonthlyStatementsAction(shopId);
        if (!isMounted) return;
        if (res.success) {
          setStatements(res.statements);
        }
      } catch (e) {
        console.error("Failed to load statements:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [shopId]);

  const handleDisputeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatement) return;
    setDisputeSubmitting(true);
    setDisputeMessage(null);

    const res = await submitCommissionDisputeAction({
      statementId: selectedStatement.id,
      shopId,
      disputedAmountMinor: Math.round(disputeAmount * 100),
      reason: disputeReason,
      evidenceUrls: [],
    });

    setDisputeSubmitting(false);
    if (res.success) {
      setDisputeMessage(res.message);
      setIsDisputing(false);
      // Reload statements
      const reload = await getSellerMonthlyStatementsAction(shopId);
      if (reload.success) setStatements(reload.statements);
    } else {
      setDisputeMessage(res.message || "Failed to submit dispute.");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Paid
          </span>
        );
      case "partially_paid":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
            Partially Paid
          </span>
        );
      case "overdue":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            Overdue
          </span>
        );
      case "disputed":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
            Disputed Under Review
          </span>
        );
      case "issued":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            Payment Due
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Informational Guidance */}
      <div className="p-4 rounded-xl bg-white border border-sparehub-border shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-sparehub-dark flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sparehub-orange" />
            Monthly Commission Statements &amp; Settlement Schedule
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Statements are generated on the 1st of each month for delivered orders. Payment is due by the{" "}
            <strong>10th</strong>, with a 7-day grace period extending to the <strong>17th</strong>.
          </p>
        </div>
      </div>

      {disputeMessage && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
          <span>{disputeMessage}</span>
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-sparehub-border animate-pulse text-xs text-gray-500">
          Loading monthly billing statements...
        </div>
      ) : statements.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-2xl border border-sparehub-border space-y-2">
          <FileText className="w-8 h-8 text-gray-300 mx-auto" />
          <h4 className="text-xs font-bold text-gray-700">No Statements Issued Yet</h4>
          <p className="text-[11px] text-gray-500 max-w-sm mx-auto">
            Statements are issued automatically at the close of each calendar month when delivered order items accrue
            commission.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-sparehub-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-sparehub-dark divide-y divide-gray-100">
              <thead className="bg-gray-50/70 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Statement #</th>
                  <th className="py-3.5 px-4">Billing Period</th>
                  <th className="py-3.5 px-4 text-right">Delivered Sales</th>
                  <th className="py-3.5 px-4 text-right">Rate</th>
                  <th className="py-3.5 px-4 text-right">Commission Earned</th>
                  <th className="py-3.5 px-4 text-right">Undisputed Due</th>
                  <th className="py-3.5 px-4">Due Date</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {statements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-sparehub-orange">{s.statementNumber}</td>
                    <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                      {s.periodStart} to {s.periodEnd}
                    </td>
                    <td className="py-3.5 px-4 text-right font-medium">{formatLKR(s.totalDeliveredSalesMinor)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-[11px]">
                      {(s.effectiveCommissionRateBps / 100).toFixed(2)}%
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-sparehub-dark">
                      {formatLKR(s.commissionEarnedMinor)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-sparehub-orange">
                      {formatLKR(s.undisputedAmountDueMinor)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-gray-500 font-medium">
                      {s.dueDate}
                      <span className="block text-[10px] text-gray-400">Grace: {s.gracePeriodEnd}</span>
                    </td>
                    <td className="py-3.5 px-4 text-center">{getStatusBadge(s.status)}</td>
                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedStatement(s)}
                        className="text-xs h-8 px-2.5"
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statement Detail & Payment Instructions Modal */}
      {selectedStatement && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  SpareHub Commission Statement
                </span>
                <h3 className="text-lg font-black text-sparehub-dark">{selectedStatement.statementNumber}</h3>
                <p className="text-xs text-gray-500">
                  Billing Period: {selectedStatement.periodStart} to {selectedStatement.periodEnd}
                </p>
              </div>
              <div>{getStatusBadge(selectedStatement.status)}</div>
            </div>

            {/* Financial Reconciliation Breakdown */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-gray-500 block text-[10px]">Delivered Sales</span>
                <span className="font-bold text-sparehub-dark">
                  {formatLKR(selectedStatement.totalDeliveredSalesMinor)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Applicable Rate</span>
                <span className="font-bold text-sparehub-dark">
                  {(selectedStatement.effectiveCommissionRateBps / 100).toFixed(2)}%
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Commission Earned</span>
                <span className="font-bold text-sparehub-dark">
                  {formatLKR(selectedStatement.commissionEarnedMinor)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Prior Unpaid Balance</span>
                <span className="font-bold text-amber-700">
                  {formatLKR(selectedStatement.previousUnpaidBalanceMinor)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Payments Received</span>
                <span className="font-bold text-emerald-700">
                  - {formatLKR(selectedStatement.paymentsReceivedMinor)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block text-[10px]">Undisputed Balance Due</span>
                <span className="font-black text-sparehub-orange text-sm">
                  {formatLKR(selectedStatement.undisputedAmountDueMinor)}
                </span>
              </div>
            </div>

            {/* Bank Transfer Remittance Instructions */}
            <div className="p-4 rounded-xl border border-sparehub-orange/30 bg-orange-50/50 space-y-2 text-xs">
              <div className="font-bold text-sparehub-dark flex items-center gap-1.5">
                <Building className="w-4 h-4 text-sparehub-orange" />
                SpareHub Bank Transfer Payment Instructions
              </div>
              <p className="text-gray-600 text-[11px] leading-relaxed">
                Please transfer the undisputed amount due to SpareHub&#39;s nominated commercial account before the due
                date (<strong>{selectedStatement.dueDate}</strong>) using your statement number as the transaction
                narrative.
              </p>
              <div className="bg-white p-3 rounded-lg border border-orange-200 font-mono text-[11px] text-gray-800 space-y-1">
                <div>Bank: Commercial Bank of Ceylon PLC</div>
                <div>Account Name: SpareHub Marketplace (Pvt) Ltd</div>
                <div>Account Number: 1000-8492-3810</div>
                <div>Branch: Colombo Super Branch (Code: 014)</div>
                <div>
                  Payment Reference: <strong>{selectedStatement.statementNumber}</strong>
                </div>
              </div>
            </div>

            {/* Dispute Modal Section */}
            {isDisputing ? (
              <form onSubmit={handleDisputeSubmit} className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                <div className="font-bold text-purple-950 text-xs">Raise Formal Statement Dispute</div>
                <p className="text-[11px] text-purple-800">
                  If there are delivered orders or fees you wish to dispute, specify the amount and supporting reason.
                  Disputed amounts are held and exempt from overdue penalties while under review.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900 block">Disputed Amount (LKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    max={(selectedStatement.undisputedAmountDueMinor / 100).toFixed(2)}
                    value={disputeAmount || ""}
                    onChange={(e) => setDisputeAmount(parseFloat(e.target.value) || 0)}
                    placeholder="e.g. 1500.00"
                    className="w-full h-10 px-3 text-xs bg-white border border-purple-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-purple-900 block">Dispute Reason &amp; Order Evidence *</label>
                  <textarea
                    required
                    rows={3}
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Specify the affected sub-orders, return slip numbers, or calculation discrepancies..."
                    className="w-full p-2.5 text-xs bg-white border border-purple-300 rounded-lg focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDisputing(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={disputeSubmitting || disputeAmount <= 0}
                    className="text-xs"
                  >
                    {disputeSubmitting ? "Submitting..." : "Submit Dispute"}
                  </Button>
                </div>
              </form>
            ) : null}

            {/* Modal Controls */}
            <div className="flex items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Statement
                </Button>

                {!isDisputing && selectedStatement.status !== "paid" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDisputing(true);
                      setDisputeAmount(selectedStatement.undisputedAmountDueMinor / 100);
                    }}
                    className="text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                  >
                    Raise Dispute
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedStatement(null);
                  setIsDisputing(false);
                }}
                className="text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
