"use client";

import React, { useState, useEffect } from "react";
import {
  CreditCard,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Power,
  Banknote,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getShopPaymentGatewayAction,
  saveShopPaymentGatewayAction,
  testShopPaymentGatewayAction,
  disconnectShopPaymentGatewayAction,
  type ShopPaymentGatewayView,
} from "@/lib/payments/actions";
import {
  SUPPORTED_GATEWAY_PROVIDERS,
  GATEWAY_PROVIDER_LABELS,
  type GatewayProvider,
} from "@/lib/validators/business-rules";

interface ShopPaymentGatewayPanelProps {
  shopId: string;
}

export function ShopPaymentGatewayPanel({ shopId }: ShopPaymentGatewayPanelProps) {
  const [gateway, setGateway] = useState<ShopPaymentGatewayView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form state
  const [provider, setProvider] = useState<GatewayProvider>("payhere");
  const [merchantId, setMerchantId] = useState("");
  const [merchantSecret, setMerchantSecret] = useState("");
  const [isSandbox, setIsSandbox] = useState(true);
  const [isEnabled, setIsEnabled] = useState(false);
  const [codEnabled, setCodEnabled] = useState(true);
  const [isChangingSecret, setIsChangingSecret] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        const res = await getShopPaymentGatewayAction(shopId);
        if (!isMounted) return;
        if (res.success && res.gateway) {
          setGateway(res.gateway);
          setProvider(res.gateway.gatewayProvider);
          setMerchantId(res.gateway.merchantId);
          setIsSandbox(res.gateway.isSandbox);
          setIsEnabled(res.gateway.isEnabled);
          setCodEnabled(res.gateway.codEnabled);
          setMerchantSecret(res.gateway.maskedSecret);
        }
      } catch (e) {
        console.error("Failed to load gateway:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [shopId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    const payload = {
      shopId,
      gatewayProvider: provider,
      merchantId: merchantId.trim(),
      merchantSecret: merchantSecret.trim(),
      isSandbox,
      isEnabled,
      codEnabled,
    };

    const res = await saveShopPaymentGatewayAction(payload);
    setSaving(false);

    if (res.success) {
      setStatusMessage({ type: "success", text: res.message || "Payment settings updated successfully." });
      setIsChangingSecret(false);
      const reload = await getShopPaymentGatewayAction(shopId);
      if (reload.gateway) {
        setGateway(reload.gateway);
        setMerchantSecret(reload.gateway.maskedSecret);
      }
    } else {
      setStatusMessage({ type: "error", text: res.error || "Failed to save settings." });
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setStatusMessage(null);
    const res = await testShopPaymentGatewayAction(shopId);
    setTesting(false);
    setStatusMessage({
      type: res.success ? "success" : "error",
      text: res.message,
    });
    const reload = await getShopPaymentGatewayAction(shopId);
    if (reload.gateway) setGateway(reload.gateway);
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your online payment gateway? Online card checkout will be disabled.")) {
      return;
    }
    setDisconnecting(true);
    const res = await disconnectShopPaymentGatewayAction(shopId);
    setDisconnecting(false);
    setStatusMessage({
      type: res.success ? "success" : "error",
      text: res.message,
    });
    const reload = await getShopPaymentGatewayAction(shopId);
    if (reload.gateway) {
      setGateway(reload.gateway);
      setMerchantId("");
      setMerchantSecret("");
      setIsEnabled(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center bg-white rounded-2xl border border-sparehub-border animate-pulse">
        <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2 animate-bounce" />
        <p className="text-xs text-gray-500">Loading payment gateway configurations...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-sparehub-border p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <h2 className="text-lg font-black text-sparehub-dark flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-sparehub-orange" />
            Seller Payment Gateway &amp; Cash on Delivery
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Connect your own approved Sri Lankan merchant gateway. Online payments flow directly into your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {gateway?.isEnabled ? (
            <Badge variant="success" className="text-xs px-2.5 py-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Online Payments Active
            </Badge>
          ) : (
            <Badge variant="neutral" className="text-xs px-2.5 py-1">
              Online Payments Disabled
            </Badge>
          )}

          {gateway?.codEnabled ? (
            <Badge variant="orange" className="text-xs px-2.5 py-1 flex items-center gap-1.5">
              <Banknote className="w-3.5 h-3.5" />
              COD Enabled
            </Badge>
          ) : (
            <Badge variant="error" className="text-xs px-2.5 py-1">
              COD Disabled
            </Badge>
          )}
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center gap-3 animate-in fade-in ${
            statusMessage.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Business Notice */}
      <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 space-y-1.5">
        <div className="font-bold flex items-center gap-1.5 text-amber-950">
          <Info className="w-4 h-4 text-amber-700" />
          SpareHub Merchant Payment Architecture
        </div>
        <p className="text-amber-800 leading-relaxed text-[11px]">
          Customer payments are deposited directly into your merchant account by your payment provider. SpareHub does
          not hold or redistribute your customer funds. Marketplace commission is billed separately via monthly
          statements.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Gateway Provider Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-gray-700">Supported Payment Gateway</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value as GatewayProvider)}
            className="w-full h-11 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-sparehub-orange focus:outline-none transition-colors"
          >
            {SUPPORTED_GATEWAY_PROVIDERS.map((p) => (
              <option key={p} value={p}>
                {GATEWAY_PROVIDER_LABELS[p]}
              </option>
            ))}
          </select>
        </div>

        {/* Credentials Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700">Merchant Identifier (Merchant ID) *</label>
            <input
              type="text"
              required
              value={merchantId}
              onChange={(e) => setMerchantId(e.target.value)}
              placeholder="e.g. 121XXXX"
              className="w-full h-11 px-3 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-sparehub-orange focus:outline-none transition-colors font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 flex items-center justify-between">
              <span>Merchant Secret / Hash Key *</span>
              {gateway?.hasSecret && !isChangingSecret && (
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingSecret(true);
                    setMerchantSecret("");
                  }}
                  className="text-[11px] text-sparehub-orange font-semibold hover:underline"
                >
                  Change Key
                </button>
              )}
            </label>
            <div className="relative">
              <input
                type={isChangingSecret || !gateway?.hasSecret ? "text" : "password"}
                required
                disabled={gateway?.hasSecret && !isChangingSecret}
                value={merchantSecret}
                onChange={(e) => setMerchantSecret(e.target.value)}
                placeholder="Enter merchant secret key"
                className="w-full h-11 px-3 pr-9 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-sparehub-orange focus:outline-none transition-colors font-mono disabled:opacity-75 disabled:cursor-not-allowed"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute right-3 top-3.5" />
            </div>
          </div>
        </div>

        {/* Mode & Feature Toggles */}
        <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-sparehub-dark">Sandbox / Test Mode</div>
              <p className="text-[11px] text-gray-500">
                Process test transactions using provider sandbox credentials before switching to production.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isSandbox}
              onChange={(e) => setIsSandbox(e.target.checked)}
              className="w-5 h-5 accent-sparehub-orange rounded cursor-pointer"
            />
          </div>

          <div className="border-t border-gray-200/60 pt-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-sparehub-dark">Enable Online Card Payments</div>
              <p className="text-[11px] text-gray-500">Allow customers to pay via debit/credit card during checkout.</p>
            </div>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-5 h-5 accent-sparehub-orange rounded cursor-pointer"
            />
          </div>

          <div className="border-t border-gray-200/60 pt-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-sparehub-dark">Enable Cash on Delivery (COD)</div>
              <p className="text-[11px] text-gray-500">Accept payment upon physical delivery by your courier.</p>
            </div>
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
              className="w-5 h-5 accent-sparehub-orange rounded cursor-pointer"
            />
          </div>
        </div>

        {/* Test Diagnostics Box */}
        {gateway?.lastTestedAt && (
          <div className="text-[11px] text-gray-600 bg-gray-50 p-3 rounded-xl border border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                Last Tested:{" "}
                {new Date(gateway.lastTestedAt).toLocaleString("en-LK", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span className="text-gray-400">|</span>
              <span
                className={`font-semibold ${
                  gateway.lastTestStatus === "success" ? "text-emerald-700" : "text-red-700"
                }`}
              >
                {gateway.lastTestMessage || gateway.lastTestStatus}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing || !gateway?.merchantId}
              onClick={handleTest}
              className="text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? "animate-spin" : ""}`} />
              Test Credentials
            </Button>

            {gateway?.hasSecret && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disconnecting}
                onClick={handleDisconnect}
                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1.5 border-red-200"
              >
                <Power className="w-3.5 h-3.5" />
                Disconnect
              </Button>
            )}
          </div>

          <Button type="submit" variant="primary" size="md" disabled={saving} className="text-xs">
            {saving ? "Saving Settings..." : "Save Payment Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}
