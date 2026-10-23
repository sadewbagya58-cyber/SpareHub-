"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  PlusCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import { selectActiveShopAction } from "@/lib/seller/actions";

export interface SwitchableShopItem {
  id: string;
  name: string;
  slug: string;
  status: string;
  verification_status?: string | null;
  district?: string | null;
}

interface ShopSwitcherProps {
  shops: SwitchableShopItem[];
  activeShopId?: string | null;
}

export function ShopSwitcher({ shops, activeShopId }: ShopSwitcherProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [switchingToId, setSwitchingToId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!shops || shops.length === 0) {
    return null;
  }

  const handleSelectShop = (shopId: string) => {
    if (shopId === activeShopId || isPending) return;
    setErrorMsg(null);
    setSwitchingToId(shopId);

    startTransition(async () => {
      const res = await selectActiveShopAction(shopId);
      if (res.error) {
        setErrorMsg(res.error);
        setSwitchingToId(null);
      } else {
        setSwitchingToId(null);
        router.refresh();
      }
    });
  };

  const renderVerificationPill = (verificationStatus?: string | null) => {
    switch (verificationStatus) {
      case "approved":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Verified
          </span>
        );
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
            <Clock className="w-3 h-3 text-amber-600" />
            Pending Review
          </span>
        );
      case "resubmission_required":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-800 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-orange-600" />
            Resubmit Docs
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3 text-red-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3 text-red-600" />
            Unverified
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-sparehub-border p-4 shadow-2xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Store className="w-4 h-4 text-sparehub-orange shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider text-sparehub-dark">
            Your Shops ({shops.length})
          </span>
          <span className="text-[11px] text-gray-500 hidden sm:inline">
            • Each shop has independent verification &amp; catalog management
          </span>
        </div>

        <Link
          href="/seller/shop/new"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-sparehub-orange hover:text-sparehub-orange-hover transition-colors self-start sm:self-auto"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          Open Another Shop
        </Link>
      </div>

      {errorMsg && (
        <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {shops.map((s) => {
          const isActive = s.id === activeShopId;
          const isSwitchingThis = switchingToId === s.id && isPending;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => handleSelectShop(s.id)}
              disabled={isPending}
              className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs transition-all border text-left ${
                isActive
                  ? "bg-sparehub-dark text-white border-sparehub-dark font-bold shadow-xs"
                  : "bg-gray-50 hover:bg-gray-100 text-sparehub-dark border-sparehub-border font-medium"
              }`}
            >
              {isSwitchingThis ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sparehub-orange shrink-0" />
              ) : (
                <Store
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-sparehub-orange" : "text-gray-400"
                  }`}
                />
              )}
              <span className="truncate max-w-[180px]">{s.name}</span>
              {renderVerificationPill(s.verification_status)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
