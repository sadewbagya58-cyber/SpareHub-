"use client";

import React, { useState, useTransition } from "react";
import {
  MapPin,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  UserCheck,
  Home,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  suspendShopAction,
  reinstateShopAction,
  getShopVerificationDocumentsAdminAction,
  approveShopVerificationAction,
  requestShopResubmissionAction,
  rejectShopVerificationAction,
  type AdminActionResult,
} from "@/lib/admin/actions";
import {
  ADDRESS_PROOF_TYPE_LABELS,
  checkAddressProofRecency,
  type AddressProofType,
} from "@/lib/validators/shop";
import type { SellerVerificationDocumentRecord } from "@/lib/seller/actions";

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
  verification_status?: string | null;
  verification_reason?: string | null;
  verification_submitted_at?: string | null;
  verification_reviewed_at?: string | null;
  owner_legal_name?: string | null;
  residential_address?: string | null;
  shop_category?: string | null;
  fraud_escalated?: boolean | null;
  fraud_escalation_notes?: string | null;
  created_at: string;
  seller_profiles: {
    seller_type: string;
    id_number?: string | null;
    id_type?: string | null;
    owner_legal_name?: string | null;
    residential_address?: string | null;
  } | null;
}

interface PendingShopsListProps {
  initialShops: PendingShop[];
}

export function PendingShopsList({ initialShops }: PendingShopsListProps) {
  const [shops, setShops] = useState<PendingShop[]>(initialShops);
  const [queueFilter, setQueueFilter] = useState<string>("all");
  const [actionShopId, setActionShopId] = useState<string | null>(null);
  const [suspendingId, setSuspendingId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Verification review drawer state
  const [inspectingShopId, setInspectingShopId] = useState<string | null>(null);
  const [loadingDocsShopId, setLoadingDocsShopId] = useState<string | null>(null);
  const [docsByShopId, setDocsByShopId] = useState<
    Record<string, SellerVerificationDocumentRecord[]>
  >({});

  // Resubmission / Rejection modal state
  const [reviewDecisionMode, setReviewDecisionMode] = useState<{
    shopId: string;
    type: "resubmission_required" | "rejected";
  } | null>(null);
  const [decisionReason, setDecisionReason] = useState("");
  const [escalateFraud, setEscalateFraud] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminActionResult | null>(null);

  const handleInspectDocuments = async (shopId: string) => {
    if (inspectingShopId === shopId) {
      setInspectingShopId(null);
      return;
    }

    setInspectingShopId(shopId);
    setLoadingDocsShopId(shopId);
    setResult(null);

    try {
      const res = await getShopVerificationDocumentsAdminAction(shopId);
      if (res.success) {
        setDocsByShopId((prev) => ({ ...prev, [shopId]: res.documents }));
      } else if (res.error) {
        setResult({ error: res.error });
      }
    } catch {
      setResult({ error: "Failed to load verification documents." });
    } finally {
      setLoadingDocsShopId(null);
    }
  };

  const handleApproveVerification = (shopId: string) => {
    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      const res = await approveShopVerificationAction(shopId);
      setResult(res);
      if (res.success) {
        setShops((prev) =>
          prev.map((s) =>
            s.id === shopId
              ? {
                  ...s,
                  status: "approved",
                  verification_status: "approved",
                  verification_reason: null,
                  fraud_escalated: false,
                }
              : s
          )
        );
        setReviewDecisionMode(null);
      }
      setActionShopId(null);
    });
  };

  const handleConfirmDecision = (shopId: string) => {
    if (!reviewDecisionMode) return;
    if (!decisionReason || decisionReason.trim().length < 5) {
      setResult({
        error:
          "Please provide a clear reason (at least 5 characters) for requesting resubmission or rejecting verification.",
      });
      return;
    }

    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      if (reviewDecisionMode.type === "resubmission_required") {
        const res = await requestShopResubmissionAction(shopId, decisionReason);
        setResult(res);
        if (res.success) {
          setShops((prev) =>
            prev.map((s) =>
              s.id === shopId
                ? {
                    ...s,
                    verification_status: "resubmission_required",
                    verification_reason: decisionReason.trim(),
                  }
                : s
            )
          );
          setReviewDecisionMode(null);
          setDecisionReason("");
        }
      } else {
        const res = await rejectShopVerificationAction(shopId, decisionReason, {
          escalateFraud,
          suspendShop: escalateFraud,
        });
        setResult(res);
        if (res.success) {
          setShops((prev) =>
            prev.map((s) =>
              s.id === shopId
                ? {
                    ...s,
                    status: escalateFraud ? "suspended" : s.status,
                    verification_status: "rejected",
                    verification_reason: decisionReason.trim(),
                    fraud_escalated: escalateFraud,
                  }
                : s
            )
          );
          setReviewDecisionMode(null);
          setDecisionReason("");
          setEscalateFraud(false);
        }
      }
      setActionShopId(null);
    });
  };

  const handleSuspend = (shopId: string) => {
    if (!suspendReason || suspendReason.trim().length < 5) {
      setResult({
        error: "Please enter a descriptive suspension reason (at least 5 characters).",
      });
      return;
    }

    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      const res = await suspendShopAction(shopId, suspendReason);
      setResult(res);
      if (res.success) {
        setShops((prev) =>
          prev.map((s) => (s.id === shopId ? { ...s, status: "suspended" } : s))
        );
        setSuspendingId(null);
        setSuspendReason("");
      }
      setActionShopId(null);
    });
  };

  const handleReinstate = (shopId: string) => {
    setActionShopId(shopId);
    setResult(null);

    startTransition(async () => {
      const res = await reinstateShopAction(shopId);
      setResult(res);
      if (res.success) {
        setShops((prev) =>
          prev.map((s) => (s.id === shopId ? { ...s, status: "approved" } : s))
        );
      }
      setActionShopId(null);
    });
  };

  const pendingReviewCount = shops.filter(
    (s) => s.verification_status === "pending_review"
  ).length;

  const filteredShops = shops.filter((s) => {
    const vStatus = s.verification_status || "not_submitted";
    if (queueFilter === "all") return true;
    if (queueFilter === "pending_review") return vStatus === "pending_review";
    if (queueFilter === "resubmission_required")
      return vStatus === "resubmission_required";
    if (queueFilter === "approved") return vStatus === "approved";
    if (queueFilter === "not_submitted") return vStatus === "not_submitted";
    if (queueFilter === "rejected")
      return vStatus === "rejected" || Boolean(s.fraud_escalated);
    return true;
  });

  const renderVerificationBadge = (shop: PendingShop) => {
    const vStatus = shop.verification_status || "not_submitted";
    if (shop.fraud_escalated) {
      return (
        <Badge variant="error" className="text-[9px] uppercase font-bold">
          Fraud Escalated
        </Badge>
      );
    }
    switch (vStatus) {
      case "approved":
        return (
          <Badge variant="success" className="text-[9px] uppercase font-bold">
            Verified Seller
          </Badge>
        );
      case "pending_review":
        return (
          <Badge variant="orange" className="text-[9px] uppercase font-bold">
            Verification Pending Review
          </Badge>
        );
      case "resubmission_required":
        return (
          <Badge variant="orange" className="text-[9px] uppercase font-bold">
            Resubmission Requested
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="error" className="text-[9px] uppercase font-bold">
            Verification Rejected
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" className="text-[9px] uppercase font-bold">
            Verification Not Submitted
          </Badge>
        );
    }
  };

  const docTypeLabel: Record<string, string> = {
    nic_front: "NIC Front Image",
    nic_back: "NIC Back Image",
    proof_of_address: "Residential Address Proof",
    br_certificate: "Business Registration (BR)",
  };

  return (
    <Card>
      <CardHeader className="space-y-4">
        <CardTitle className="text-base flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-sparehub-orange" />
            Seller Verification &amp; Storefront Moderation Queue ({filteredShops.length})
          </span>
          {pendingReviewCount > 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full">
              <Clock className="w-3.5 h-3.5" />
              {pendingReviewCount} Awaiting Verification Review
            </span>
          )}
        </CardTitle>

        {/* Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: `All Shops (${shops.length})` },
            {
              id: "pending_review",
              label: `Pending Review (${pendingReviewCount})`,
            },
            { id: "resubmission_required", label: "Resubmission Required" },
            { id: "approved", label: "Verified" },
            { id: "not_submitted", label: "Not Submitted" },
            { id: "rejected", label: "Rejected / Escalated" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setQueueFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                queueFilter === tab.id
                  ? "bg-sparehub-dark text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
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

        {filteredShops.length === 0 ? (
          <div className="p-8 text-center space-y-2 border border-dashed border-sparehub-border rounded-xl">
            <CheckCircle2 className="w-8 h-8 text-sparehub-success mx-auto" />
            <p className="text-sm font-bold text-sparehub-dark">
              No Shops Match Selected Filter
            </p>
            <p className="text-xs text-gray-400">
              Switch filter tabs above to view other vendor storefronts.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-sparehub-border/70">
            {filteredShops.map((s) => {
              const vStatus = s.verification_status || "not_submitted";
              const legalName =
                s.owner_legal_name || s.seller_profiles?.owner_legal_name || "Not provided";
              const residentialAddr =
                s.residential_address ||
                s.seller_profiles?.residential_address ||
                "Not provided";
              const categoryLabel = (
                s.shop_category ||
                s.seller_profiles?.seller_type ||
                "retail_shop"
              ).replace("_", " ");
              const isInspecting = inspectingShopId === s.id;
              const loadedDocs = docsByShopId[s.id] || [];

              return (
                <div key={s.id} className="py-5 first:pt-0 last:pb-0 space-y-3.5">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-bold text-sparehub-dark">
                          {s.name}
                        </h4>
                        <Badge
                          variant={
                            s.status === "approved"
                              ? "success"
                              : s.status === "suspended"
                              ? "error"
                              : "neutral"
                          }
                          className="text-[9px] uppercase font-bold"
                        >
                          {s.status === "approved"
                            ? "Active Storefront"
                            : s.status === "suspended"
                            ? "Suspended"
                            : s.status}
                        </Badge>
                        {renderVerificationBadge(s)}
                        <span className="text-[10px] uppercase font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                          {categoryLabel}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">
                        Slug: /shop/{s.slug}
                      </p>
                    </div>

                    {/* Verification & Storefront Moderation Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectDocuments(s.id)}
                        className="gap-1.5 text-xs h-8 border-sparehub-border"
                      >
                        <FileText className="w-3.5 h-3.5 text-sparehub-orange" />
                        {isInspecting ? "Hide Documents" : "Inspect Verification Docs"}
                      </Button>

                      {vStatus !== "approved" && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isPending && actionShopId === s.id}
                          loadingText="Approving..."
                          onClick={() => handleApproveVerification(s.id)}
                          disabled={isPending && actionShopId === s.id}
                          className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Approve Verification
                        </Button>
                      )}

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewDecisionMode({
                            shopId: s.id,
                            type: "resubmission_required",
                          });
                          setDecisionReason(s.verification_reason || "");
                          setEscalateFraud(false);
                        }}
                        disabled={isPending && actionShopId === s.id}
                        className="gap-1 text-amber-800 border-amber-300 hover:bg-amber-50 text-xs h-8"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Request Resubmission
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReviewDecisionMode({
                            shopId: s.id,
                            type: "rejected",
                          });
                          setDecisionReason(s.verification_reason || "");
                          setEscalateFraud(Boolean(s.fraud_escalated));
                        }}
                        disabled={isPending && actionShopId === s.id}
                        className="gap-1 text-red-700 border-red-200 hover:bg-red-50 text-xs h-8"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        Reject Verification
                      </Button>

                      {s.status === "suspended" ? (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isPending && actionShopId === s.id}
                          loadingText="Reinstating..."
                          onClick={() => handleReinstate(s.id)}
                          disabled={isPending && actionShopId === s.id}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Reinstate Shop
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (suspendingId === s.id) {
                              setSuspendingId(null);
                            } else {
                              setSuspendingId(s.id);
                              setSuspendReason("");
                            }
                          }}
                          disabled={isPending && actionShopId === s.id}
                          className="gap-1 text-sparehub-error border-red-200 hover:bg-red-50 text-xs h-8"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          Suspend
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Owner Identity, Residential Address & Business Contact Summary */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 text-xs text-gray-700 bg-sparehub-light/60 p-3.5 rounded-xl border border-sparehub-border/60">
                    <div className="flex items-start gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-sparehub-orange shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Owner Legal Name
                        </span>
                        <span className="font-semibold text-sparehub-dark">
                          {legalName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <Home className="w-3.5 h-3.5 text-sparehub-orange shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Residential Address
                        </span>
                        <span className="font-medium text-sparehub-dark">
                          {residentialAddr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-start gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sparehub-orange shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] font-bold uppercase text-gray-400 block">
                          Shop / Business Address
                        </span>
                        <span className="font-medium text-sparehub-dark">
                          {s.address_line1} ({s.city}, {s.district})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{s.phone}</span>
                    </div>

                    <div className="flex items-center gap-1.5 truncate">
                      <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{s.email}</span>
                    </div>

                    {s.verification_reason && (
                      <div className="sm:col-span-2 lg:col-span-3 pt-1.5 border-t border-gray-200 text-xs text-red-900">
                        <strong>Last Verification Note / Reason:</strong>{" "}
                        {s.verification_reason}
                      </div>
                    )}
                  </div>

                  {/* Verification Documents Drawer */}
                  {isInspecting && (
                    <div className="p-4 rounded-xl bg-gray-50 border border-sparehub-border space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-black uppercase tracking-wider text-sparehub-dark flex items-center gap-2">
                          <FileText className="w-4 h-4 text-sparehub-orange" />
                          Submitted Seller Verification Documents
                        </h5>
                        <span className="text-[11px] text-gray-500">
                          Short-lived signed URLs (private bucket)
                        </span>
                      </div>

                      {loadingDocsShopId === s.id ? (
                        <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                          <Loader2 className="w-4 h-4 animate-spin text-sparehub-orange" />
                          Generating secure signed document links...
                        </div>
                      ) : loadedDocs.length === 0 ? (
                        <p className="text-xs text-gray-500 py-3">
                          No verification documents have been uploaded for this shop yet.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {loadedDocs.map((doc) => {
                            const recency =
                              doc.document_type === "proof_of_address" &&
                              doc.document_issued_date
                                ? checkAddressProofRecency(doc.document_issued_date)
                                : null;

                            return (
                              <div
                                key={doc.id}
                                className="p-3.5 rounded-xl bg-white border border-sparehub-border flex flex-col justify-between gap-2.5"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-sparehub-dark">
                                      {docTypeLabel[doc.document_type] ||
                                        doc.document_type}
                                    </span>
                                    <div className="flex items-center gap-1.5">
                                      {doc.reused_from_document_id && (
                                        <span className="text-[10px] font-semibold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                                          Reused Account NIC
                                        </span>
                                      )}
                                      {doc.verified && (
                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                                          Verified
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <p className="text-[11px] font-mono text-gray-600 truncate">
                                    {doc.file_name}
                                  </p>

                                  {doc.address_proof_type && (
                                    <p className="text-[11px] text-gray-600">
                                      <strong>Proof Type:</strong>{" "}
                                      {ADDRESS_PROOF_TYPE_LABELS[
                                        doc.address_proof_type as AddressProofType
                                      ] || doc.address_proof_type}
                                      {doc.document_issued_date && (
                                        <span className="ml-2">
                                          • <strong>Issued:</strong>{" "}
                                          {doc.document_issued_date}
                                        </span>
                                      )}
                                    </p>
                                  )}

                                  {recency && !recency.isWithinRecencyWindow && (
                                    <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      Older than 3 months ({recency.ageInDays} days old)
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                                  <span className="text-[10px] text-gray-400">
                                    Uploaded{" "}
                                    {new Date(doc.created_at).toLocaleDateString(
                                      "en-LK"
                                    )}
                                  </span>
                                  {doc.signedUrl ? (
                                    <a
                                      href={doc.signedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-bold text-sparehub-orange hover:underline"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" />
                                      Open Signed Document
                                    </a>
                                  ) : (
                                    <span className="text-[11px] text-gray-400">
                                      Link unavailable
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline Resubmission / Rejection Decision Box */}
                  {reviewDecisionMode?.shopId === s.id && (
                    <div className="p-4 rounded-xl bg-amber-50/90 border border-amber-300 space-y-3">
                      <label className="block text-xs font-bold text-amber-950">
                        {reviewDecisionMode.type === "resubmission_required"
                          ? "Reason for Requesting Document Resubmission (Shown to Seller)"
                          : "Reason for Rejecting Shop Verification (Shown to Seller)"}
                      </label>
                      <textarea
                        value={decisionReason}
                        onChange={(e) => setDecisionReason(e.target.value)}
                        placeholder={
                          reviewDecisionMode.type === "resubmission_required"
                            ? "e.g. NIC back image is blurry or utility bill address does not match residential address..."
                            : "e.g. Submitted identity documents could not be verified..."
                        }
                        rows={2}
                        className="w-full rounded-lg border border-amber-300 bg-white p-2.5 text-xs text-sparehub-dark focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                      />

                      {reviewDecisionMode.type === "rejected" && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-red-900 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={escalateFraud}
                            onChange={(e) => setEscalateFraud(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded border-red-300"
                          />
                          Escalate for suspected forged documents / fraud investigation (also suspends shop)
                        </label>
                      )}

                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setReviewDecisionMode(null)}
                          className="text-xs h-7"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isPending && actionShopId === s.id}
                          loadingText="Saving Decision..."
                          onClick={() => handleConfirmDecision(s.id)}
                          disabled={isPending && actionShopId === s.id}
                          className={`text-white text-xs h-7 ${
                            reviewDecisionMode.type === "rejected"
                              ? "bg-red-600 hover:bg-red-700"
                              : "bg-amber-600 hover:bg-amber-700"
                          }`}
                        >
                          {reviewDecisionMode.type === "resubmission_required"
                            ? "Confirm Resubmission Request"
                            : "Confirm Verification Rejection"}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Inline Suspension Reason Box */}
                  {suspendingId === s.id && (
                    <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-2.5">
                      <label className="block text-xs font-bold text-red-900">
                        Suspension Reason (Platform Moderation Notice)
                      </label>
                      <textarea
                        value={suspendReason}
                        onChange={(e) => setSuspendReason(e.target.value)}
                        placeholder="e.g. Reported counterfeit parts or trade license discrepancy..."
                        rows={2}
                        className="w-full rounded-lg border border-red-200 bg-white p-2.5 text-xs text-sparehub-dark focus:outline-none focus:ring-1 focus:ring-sparehub-error"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSuspendingId(null)}
                          className="text-xs h-7"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isPending && actionShopId === s.id}
                          loadingText="Suspending..."
                          onClick={() => handleSuspend(s.id)}
                          disabled={isPending && actionShopId === s.id}
                          className="bg-sparehub-error hover:bg-red-700 text-white text-xs h-7 gap-1"
                        >
                          Confirm Suspension
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
