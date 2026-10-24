"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, TrendingUp, ShieldAlert, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getShopActiveCommissionInfoAction } from "@/lib/commission/actions";
import { acceptProposedCommissionRateAction } from "@/lib/commission/billing-actions";

interface CommissionRateBannerProps {
  shopId: string;
}

export function CommissionRateBanner({ shopId }: CommissionRateBannerProps) {
  const [currentRateBps, setCurrentRateBps] = useState<number>(300);
  const [currentRuleName, setCurrentRuleName] = useState<string>("Standard Marketplace Baseline");
  const [proposedRule, setProposedRule] = useState<{
    id: string;
    rateBasisPoints: number;
    name: string;
    proposedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await getShopActiveCommissionInfoAction(shopId);
        if (isMounted && res.success) {
          setCurrentRateBps(res.currentRateBps);
          setCurrentRuleName(res.currentRuleName);
          setProposedRule(res.proposedRule || null);
        }
      } catch (e) {
        console.error("Failed to load active commission info:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [shopId, refreshKey]);

  const handleAccept = async () => {
    if (!proposedRule) return;
    setAccepting(true);
    setFeedback(null);

    const res = await acceptProposedCommissionRateAction(proposedRule.id, shopId);
    setAccepting(false);

    if (res.success) {
      setFeedback({ type: "success", text: res.message });
      setShowModal(false);
      setRefreshKey((k) => k + 1);
    } else {
      setFeedback({ type: "error", text: res.message });
    }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Current Active Commission Rate Card */}
      <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200/60 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-sparehub-orange" />
          </div>
          <div>
            <div className="text-xs font-bold text-sparehub-dark flex items-center gap-1.5">
              <span>Active Marketplace Commission:</span>
              <span className="text-sparehub-orange font-black text-sm">
                {(currentRateBps / 100).toFixed(2)}%
              </span>
              <span className="text-[10px] text-gray-400 font-mono">({currentRateBps} bps)</span>
            </div>
            <p className="text-[11px] text-gray-500">
              Rule: <span className="font-semibold text-gray-700">{currentRuleName}</span>. Applicable on eligible
              delivered product subtotal.
            </p>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Proposed Commission Rate Alert Banner */}
      {proposedRule && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 animate-in fade-in">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-0.5 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-700" />
                Proposed Rate Notice
              </span>
              <span className="text-xs text-gray-500">
                Proposed on {new Date(proposedRule.proposedAt).toLocaleDateString()}
              </span>
            </div>

            <h4 className="text-sm font-bold text-sparehub-dark">
              Revised Commission Proposed:{" "}
              <span className="text-sparehub-orange font-black text-base">
                {(proposedRule.rateBasisPoints / 100).toFixed(2)}%
              </span>
            </h4>
            <p className="text-xs text-gray-600 max-w-xl">
              SpareHub has proposed a customized commission rate for your shop. In accordance with marketplace rules, this
              rate will take effect <strong>only upon your recorded acceptance</strong>. Your current rate of{" "}
              <strong>{(currentRateBps / 100).toFixed(2)}%</strong> remains active until you accept.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowModal(true)}
            className="text-xs shrink-0 flex items-center gap-1.5"
          >
            Review &amp; Accept Rate
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Rate Acceptance Modal */}
      {showModal && proposedRule && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in zoom-in-95">
            <div className="border-b pb-3">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Seller Agreement Amendment
              </span>
              <h3 className="text-base font-black text-sparehub-dark">Accept Proposed Commission Rate</h3>
            </div>

            <div className="space-y-3 text-xs text-gray-600">
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                <div>
                  <span className="text-gray-400 block text-[10px]">Current Active Rate</span>
                  <span className="font-bold text-gray-700">{(currentRateBps / 100).toFixed(2)}%</span>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400" />
                <div className="text-right">
                  <span className="text-gray-400 block text-[10px]">Proposed New Rate</span>
                  <span className="font-black text-sparehub-orange text-sm">
                    {(proposedRule.rateBasisPoints / 100).toFixed(2)}%
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                By accepting below, you agree to amend your SpareHub Seller Agreement terms to apply a marketplace
                commission of <strong>{(proposedRule.rateBasisPoints / 100).toFixed(2)}%</strong> on all future
                delivered order items. Previously completed or delivered orders remain immutable.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowModal(false)}
                disabled={accepting}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleAccept}
                disabled={accepting}
                className="text-xs"
              >
                {accepting ? "Recording Acceptance..." : "I Accept Proposed Commission Rate"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
