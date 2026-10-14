"use client";

import React, { useState, useTransition } from "react";
import { 
  MapPin, 
  Phone, 
  Mail, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { approveShopAction, rejectShopAction, type AdminActionResult } from "@/lib/admin/actions";

export interface PendingShop {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string;
  email: string;
  district: string;
  city: string;
  address_line1: string;
  status: string;
  created_at: string;
  seller_profiles: {
    seller_type: string;
    id_number?: string | null;
    id_type?: string | null;
  } | null;
}

interface PendingShopsListProps {
  initialShops: PendingShop[];
}

export function PendingShopsList({ initialShops }: PendingShopsListProps) {
  const [shops, setShops] = useState<PendingShop[]>(initialShops);
  const [actionShopId, setActionShopId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const handleApprove = (shopId: string) => {
    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      const res = await approveShopAction(shopId);
      setResult(res);
      if (res.success) {
        setShops((prev) => prev.filter((s) => s.id !== shopId));
      }
      setActionShopId(null);
    });
  };

  const handleReject = (shopId: string) => {
    if (!rejectReason || rejectReason.trim().length < 5) {
      setResult({ error: "Please enter a descriptive rejection reason (at least 5 characters)." });
      return;
    }

    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      const res = await rejectShopAction(shopId, rejectReason);
      setResult(res);
      if (res.success) {
        setShops((prev) => prev.filter((s) => s.id !== shopId));
        setRejectingId(null);
        setRejectReason("");
      }
      setActionShopId(null);
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            Vendor Shop Approval Queue ({shops.length})
          </span>
          <span className="text-xs text-gray-500 font-normal">
            Platform governance & merchant review
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {result?.error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-sparehub-error flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {result.error}
          </div>
        )}
        {result?.success && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-xs font-semibold text-sparehub-success flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {result.message}
          </div>
        )}

        {shops.length === 0 ? (
          <div className="p-8 text-center space-y-2 border border-dashed border-sparehub-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-sparehub-success mx-auto" />
            <p className="text-sm font-bold text-sparehub-dark">All Shop Applications Reviewed</p>
            <p className="text-xs text-gray-400">
              There are no vendor shops awaiting platform verification at this time.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sparehub-border/70">
            {shops.map((s) => (
              <div key={s.id} className="py-4 first:pt-0 last:pb-0 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-sparehub-dark">{s.name}</h4>
                      <Badge variant="orange" className="text-[9px] uppercase font-bold">
                        Pending Review
                      </Badge>
                      {s.seller_profiles?.seller_type && (
                        <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {s.seller_profiles.seller_type.replace("_", " ")}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">
                      Slug: /shop/{s.slug}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => handleApprove(s.id)}
                      disabled={isPending && actionShopId === s.id}
                      className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isPending && actionShopId === s.id ? "Approving..." : "Approve Shop"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (rejectingId === s.id) {
                          setRejectingId(null);
                        } else {
                          setRejectingId(s.id);
                          setRejectReason("");
                        }
                      }}
                      disabled={isPending && actionShopId === s.id}
                      className="gap-1 text-sparehub-error border-red-200 hover:bg-red-50 text-xs h-8"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-gray-600 bg-sparehub-light/60 p-3 rounded-lg border border-sparehub-border/60">
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{s.district}, {s.city} ({s.address_line1})</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{s.phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span>{s.email}</span>
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-gray-500 italic pl-1 border-l-2 border-sparehub-orange">
                    &quot;{s.description}&quot;
                  </p>
                )}

                {/* Inline Rejection Reason Box */}
                {rejectingId === s.id && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2.5 animate-in fade-in duration-150">
                    <label className="block text-xs font-bold text-red-900">
                      Rejection Reason (Sent directly to seller for correction)
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="e.g. Please provide a verified local trade address or registered phone number..."
                      rows={2}
                      className="w-full rounded-lg border border-red-200 bg-white p-2.5 text-xs text-sparehub-dark focus:outline-none focus:ring-1 focus:ring-sparehub-error"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRejectingId(null)}
                        className="text-xs h-7"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleReject(s.id)}
                        disabled={isPending && actionShopId === s.id}
                        className="bg-sparehub-error hover:bg-red-700 text-white text-xs h-7 gap-1"
                      >
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
