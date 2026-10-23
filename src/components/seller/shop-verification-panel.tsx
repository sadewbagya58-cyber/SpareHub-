"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  Loader2,
  UserCheck,
  Home,
  Building2,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADDRESS_PROOF_TYPES,
  ADDRESS_PROOF_TYPE_LABELS,
  DEFAULT_ADDRESS_PROOF_MAX_AGE_MONTHS,
  checkAddressProofRecency,
  type AddressProofType,
  type ShopVerificationStatus,
  type VerificationDocumentType,
} from "@/lib/validators/shop";
import {
  uploadVerificationDocumentAction,
  deleteVerificationDocumentAction,
  submitShopVerificationAction,
  type SellerVerificationDocumentRecord,
} from "@/lib/seller/actions";

interface ShopVerificationPanelProps {
  shopId: string;
  shopName: string;
  verificationStatus: ShopVerificationStatus;
  verificationReason?: string | null;
  verificationSubmittedAt?: string | null;
  verificationReviewedAt?: string | null;
  initialOwnerLegalName?: string | null;
  initialResidentialAddress?: string | null;
  initialShopDocuments: SellerVerificationDocumentRecord[];
  reusableAccountNicDocuments: SellerVerificationDocumentRecord[];
}

export function ShopVerificationPanel({
  shopId,
  shopName,
  verificationStatus,
  verificationReason,
  verificationSubmittedAt,
  verificationReviewedAt,
  initialOwnerLegalName,
  initialResidentialAddress,
  initialShopDocuments,
  reusableAccountNicDocuments,
}: ShopVerificationPanelProps) {
  const router = useRouter();
  const [status, setStatus] = useState<ShopVerificationStatus>(verificationStatus);
  const [ownerLegalName, setOwnerLegalName] = useState(initialOwnerLegalName || "");
  const [residentialAddress, setResidentialAddress] = useState(
    initialResidentialAddress || ""
  );
  const [shopDocs, setShopDocs] = useState<SellerVerificationDocumentRecord[]>(
    initialShopDocuments || []
  );

  const hasReusableNicPair =
    reusableAccountNicDocuments.some((d) => d.document_type === "nic_front") &&
    reusableAccountNicDocuments.some((d) => d.document_type === "nic_back");

  const [reuseAccountNic, setReuseAccountNic] = useState<boolean>(hasReusableNicPair);

  // Address proof metadata inputs
  const existingAddressProof = shopDocs.find(
    (d) => d.document_type === "proof_of_address"
  );
  const [addressProofType, setAddressProofType] = useState<AddressProofType>(
    (existingAddressProof?.address_proof_type as AddressProofType) || "utility_bill"
  );
  const [documentIssuedDate, setDocumentIssuedDate] = useState<string>(
    existingAddressProof?.document_issued_date || ""
  );

  // Upload & Submit state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [isSubmitting, startSubmitTransition] = useTransition();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [recencyWarning, setRecencyWarning] = useState<string | null>(null);

  const getDocByType = (docType: VerificationDocumentType) =>
    shopDocs.find((d) => d.document_type === docType) || null;

  const getReusableNicByType = (docType: "nic_front" | "nic_back") =>
    reusableAccountNicDocuments.find((d) => d.document_type === docType) || null;

  const handleFileUpload = async (
    docType: VerificationDocumentType,
    file: File | null
  ) => {
    if (!file) return;
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setUploadingDocType(docType);

    try {
      const formData = new FormData();
      formData.append("shopId", shopId);
      formData.append("documentType", docType);
      formData.append("file", file);
      if (docType === "proof_of_address") {
        formData.append("addressProofType", addressProofType);
        if (documentIssuedDate) {
          formData.append("documentIssuedDate", documentIssuedDate);
        }
      }

      const res = await uploadVerificationDocumentAction(formData);
      if (res.error) {
        setFeedbackError(res.error);
      } else if (res.document) {
        setShopDocs((prev) => [
          res.document!,
          ...prev.filter((d) => d.document_type !== docType),
        ]);
        if (res.recencyWarning) {
          setRecencyWarning(res.recencyWarning);
        } else if (docType === "proof_of_address") {
          setRecencyWarning(null);
        }
        setFeedbackSuccess(res.message || "Document uploaded securely.");
        router.refresh();
      }
    } catch {
      setFeedbackError("Failed to upload verification document. Please try again.");
    } finally {
      setUploadingDocType(null);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    setFeedbackError(null);
    setFeedbackSuccess(null);
    setDeletingDocId(docId);

    try {
      const res = await deleteVerificationDocumentAction(docId);
      if (res.error) {
        setFeedbackError(res.error);
      } else {
        setShopDocs((prev) => prev.filter((d) => d.id !== docId));
        setFeedbackSuccess("Document removed.");
        router.refresh();
      }
    } catch {
      setFeedbackError("Failed to remove document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  const handleSubmitVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackError(null);
    setFeedbackSuccess(null);

    const formData = new FormData();
    formData.append("shopId", shopId);
    formData.append("owner_legal_name", ownerLegalName.trim());
    formData.append("residential_address", residentialAddress.trim());
    formData.append("reuse_account_nic", reuseAccountNic ? "true" : "false");

    startSubmitTransition(async () => {
      const res = await submitShopVerificationAction(null, formData);
      if (res.error) {
        setFeedbackError(res.error);
      } else {
        setStatus("pending_review");
        setFeedbackSuccess(
          res.message ||
            "Seller verification submitted for administrator review!"
        );
        router.refresh();
      }
    });
  };

  const liveRecencyCheck = documentIssuedDate
    ? checkAddressProofRecency(documentIssuedDate)
    : null;

  return (
    <div id="verification" className="scroll-mt-24 space-y-6">
      <Card className="border-2 border-sparehub-border overflow-hidden">
        <CardHeader className="bg-gray-50/80 border-b border-sparehub-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base font-black text-sparehub-dark flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-sparehub-orange" />
              Seller Identity &amp; Shop Verification ({shopName})
            </CardTitle>

            <div>
              {status === "approved" && (
                <Badge variant="success" className="uppercase text-[10px] font-bold">
                  Verified Seller Shop
                </Badge>
              )}
              {status === "pending_review" && (
                <Badge variant="orange" className="uppercase text-[10px] font-bold">
                  Pending Admin Review
                </Badge>
              )}
              {status === "resubmission_required" && (
                <Badge variant="error" className="uppercase text-[10px] font-bold">
                  Resubmission Required
                </Badge>
              )}
              {status === "rejected" && (
                <Badge variant="error" className="uppercase text-[10px] font-bold">
                  Verification Rejected
                </Badge>
              )}
              {status === "not_submitted" && (
                <Badge variant="error" className="uppercase text-[10px] font-bold">
                  Verification Required
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Status Contextual Banner */}
          {status === "not_submitted" && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-sparehub-error shrink-0 mt-0.5" />
              <div className="text-xs text-red-900 space-y-1">
                <p className="font-black text-sm">Shop Verification Required</p>
                <p className="text-red-800">
                  Your shop is open, but you must complete seller verification before publishing products. You can prepare product drafts and configure delivery fees while completing verification.
                </p>
              </div>
            </div>
          )}

          {status === "pending_review" && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950 space-y-1">
                <p className="font-black text-sm">
                  Verification Pending Administrator Review
                </p>
                <p className="text-amber-800">
                  Your verification documents have been submitted and are under review by SpareHub compliance administrators. Once approved, product publishing will be unlocked for <strong>{shopName}</strong>.
                </p>
                {verificationSubmittedAt && (
                  <p className="text-[11px] text-amber-700">
                    Submitted on{" "}
                    {new Date(verificationSubmittedAt).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {status === "resubmission_required" && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-950 space-y-1.5">
                <p className="font-black text-sm">
                  Document Resubmission Requested by Administrator
                </p>
                <p className="text-red-900 bg-white/80 p-2.5 rounded-lg border border-red-200 font-medium">
                  <strong>Reason:</strong>{" "}
                  {verificationReason ||
                    "Please upload clearer identity or residential address proof documents."}
                </p>
                <p className="text-red-800">
                  Please upload corrected documents below and click{" "}
                  <strong>&quot;Resubmit Verification for Review&quot;</strong>.
                </p>
              </div>
            </div>
          )}

          {status === "rejected" && (
            <div className="p-4 rounded-xl bg-red-50 border-2 border-red-300 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs text-red-950 space-y-1.5">
                <p className="font-black text-sm">Shop Verification Rejected</p>
                <p className="text-red-900 bg-white/80 p-2.5 rounded-lg border border-red-200 font-medium">
                  <strong>Administrator Note:</strong>{" "}
                  {verificationReason ||
                    "Verification could not be approved based on the submitted documentation."}
                </p>
                <p className="text-red-800">
                  Product publishing remains disabled for this shop. If you have updated official documentation, you may upload corrected files and submit a new review request.
                </p>
              </div>
            </div>
          )}

          {status === "approved" && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-950 space-y-1">
                <p className="font-black text-sm">
                  Seller Verification Approved — Product Publishing Active
                </p>
                <p className="text-emerald-800">
                  Your shop verification has been approved by SpareHub administration. You can publish products immediately to the live marketplace.
                </p>
                {verificationReviewedAt && (
                  <p className="text-[11px] text-emerald-700">
                    Approved on{" "}
                    {new Date(verificationReviewedAt).toLocaleDateString("en-LK", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Feedback alerts */}
          {feedbackError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-sparehub-error flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {feedbackError}
            </div>
          )}
          {feedbackSuccess && (
            <div className="p-3.5 rounded-xl bg-green-50 border border-green-200 text-xs font-semibold text-sparehub-success flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {feedbackSuccess}
            </div>
          )}
          {recencyWarning && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
              <span>{recencyWarning}</span>
            </div>
          )}

          <form onSubmit={handleSubmitVerification} className="space-y-6">
            {/* Step 1: Owner Identity & Residential Address */}
            <div className="space-y-4 p-4 rounded-xl bg-gray-50/70 border border-sparehub-border">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sparehub-dark flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-sparehub-orange" />
                1. Owner Legal Identity &amp; Residential Address
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Owner's Full Legal Name (As on NIC)"
                  value={ownerLegalName}
                  onChange={(e) => setOwnerLegalName(e.target.value)}
                  placeholder="e.g. Kasun Perera"
                  required
                  disabled={isSubmitting}
                />

                <Input
                  label="Residential Address"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  placeholder="e.g. No. 45, Temple Road, Maharagama"
                  required
                  disabled={isSubmitting}
                  helperText="Must match your residential address proof document."
                />
              </div>
            </div>

            {/* Step 2: NIC Front & Back (with Multi-Shop Reuse option) */}
            <div className="space-y-4 p-4 rounded-xl bg-gray-50/70 border border-sparehub-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sparehub-dark flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sparehub-orange" />
                  2. National Identity Card (NIC) — Required
                </h3>
                <span className="text-[11px] text-gray-500">
                  Private &amp; encrypted • Never shown publicly
                </span>
              </div>

              {hasReusableNicPair && (
                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-start justify-between gap-3">
                  <label className="flex items-start gap-2.5 cursor-pointer text-xs text-emerald-950">
                    <input
                      type="checkbox"
                      checked={reuseAccountNic}
                      onChange={(e) => setReuseAccountNic(e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-sparehub-orange rounded border-emerald-300 focus:ring-sparehub-orange"
                    />
                    <span>
                      <strong className="block font-bold">
                        Reuse NIC documents from my account
                      </strong>
                      Your customer account already has NIC Front and NIC Back documents on file from another shop. Leave this checked to reuse them without uploading again, or uncheck to upload replacement NIC images.
                    </span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(
                  [
                    {
                      type: "nic_front" as const,
                      title: "NIC Front Image",
                      subtitle: "Clear photo or scan of the front side of your NIC",
                    },
                    {
                      type: "nic_back" as const,
                      title: "NIC Back Image",
                      subtitle: "Clear photo or scan of the back side of your NIC",
                    },
                  ] as const
                ).map((nicItem) => {
                  const shopDoc = getDocByType(nicItem.type);
                  const reusedDoc =
                    !shopDoc && reuseAccountNic
                      ? getReusableNicByType(nicItem.type)
                      : null;
                  const activeDoc = shopDoc || reusedDoc;
                  const isUploadingThis = uploadingDocType === nicItem.type;

                  return (
                    <div
                      key={nicItem.type}
                      className="p-4 rounded-xl bg-white border border-sparehub-border flex flex-col justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-sparehub-dark">
                            {nicItem.title} <span className="text-red-500">*</span>
                          </span>
                          {activeDoc ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" />
                              {reusedDoc ? "Reused from Account" : "Uploaded"}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                              Required
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500">{nicItem.subtitle}</p>
                      </div>

                      {activeDoc && (
                        <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-mono text-[11px] text-gray-700">
                            {activeDoc.file_name}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            {activeDoc.signedUrl && (
                              <a
                                href={activeDoc.signedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-sparehub-orange hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Preview
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="inline-flex items-center justify-center gap-1.5 w-full px-3 py-2 rounded-lg border border-sparehub-border bg-gray-50 hover:bg-gray-100 text-xs font-bold text-sparehub-dark cursor-pointer transition-colors">
                          {isUploadingThis ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-sparehub-orange" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 text-sparehub-orange" />
                              {activeDoc ? "Upload Replacement File" : `Upload ${nicItem.title}`}
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,application/pdf"
                            className="hidden"
                            disabled={isUploadingThis || isSubmitting}
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              handleFileUpload(nicItem.type, f);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 3: Residential Address Proof (Required) */}
            <div className="space-y-4 p-4 rounded-xl bg-gray-50/70 border border-sparehub-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sparehub-dark flex items-center gap-2">
                  <Home className="w-4 h-4 text-sparehub-orange" />
                  3. Residential Address Proof — Required
                </h3>
                <span className="text-[11px] text-gray-500">
                  Issued within the previous {DEFAULT_ADDRESS_PROOF_MAX_AGE_MONTHS} months (standard policy)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                    Address Proof Document Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addressProofType}
                    onChange={(e) =>
                      setAddressProofType(e.target.value as AddressProofType)
                    }
                    className="w-full rounded-lg border border-sparehub-border bg-white py-2 px-3 text-sm text-sparehub-dark focus:border-sparehub-orange focus:outline-none"
                  >
                    {ADDRESS_PROOF_TYPES.map((typeKey) => (
                      <option key={typeKey} value={typeKey}>
                        {ADDRESS_PROOF_TYPE_LABELS[typeKey]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark">
                    Document Issue / Statement Date
                  </label>
                  <input
                    type="date"
                    value={documentIssuedDate}
                    onChange={(e) => setDocumentIssuedDate(e.target.value)}
                    className="w-full rounded-lg border border-sparehub-border bg-white py-2 px-3 text-sm text-sparehub-dark focus:border-sparehub-orange focus:outline-none"
                  />
                  {liveRecencyCheck?.warning && (
                    <p className="text-[11px] text-amber-700">
                      {liveRecencyCheck.warning}
                    </p>
                  )}
                  {liveRecencyCheck?.error && (
                    <p className="text-[11px] text-red-600">
                      {liveRecencyCheck.error}
                    </p>
                  )}
                </div>
              </div>

              {(() => {
                const addressDoc = getDocByType("proof_of_address");
                const isUploadingAddress = uploadingDocType === "proof_of_address";
                return (
                  <div className="p-4 rounded-xl bg-white border border-sparehub-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sparehub-dark">
                          Residential Address Proof File <span className="text-red-500">*</span>
                        </span>
                        {addressDoc ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Uploaded
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        Acceptable: Electricity bill, Water bill, Bank statement, or Government-issued address document (JPG, PNG, WEBP, or PDF up to 10 MB).
                      </p>
                      {addressDoc && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="font-mono text-[11px] text-gray-700">
                            {addressDoc.file_name}
                          </span>
                          {addressDoc.address_proof_type && (
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                              {ADDRESS_PROOF_TYPE_LABELS[
                                addressDoc.address_proof_type as AddressProofType
                              ] || addressDoc.address_proof_type}
                            </span>
                          )}
                          {addressDoc.signedUrl && (
                            <a
                              href={addressDoc.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sparehub-orange hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Preview
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-sparehub-border bg-gray-50 hover:bg-gray-100 text-xs font-bold text-sparehub-dark cursor-pointer shrink-0 transition-colors">
                      {isUploadingAddress ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sparehub-orange" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-sparehub-orange" />
                          {addressDoc ? "Replace Address Proof" : "Upload Address Proof"}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={isUploadingAddress || isSubmitting}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          handleFileUpload("proof_of_address", f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Step 4: Business Registration Certificate (Optional) */}
            <div className="space-y-3 p-4 rounded-xl bg-gray-50/70 border border-sparehub-border">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sparehub-dark flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-sparehub-orange" />
                  4. Business Registration (BR) Certificate — Optional
                </h3>
                <span className="text-[11px] text-gray-500">
                  Optional • Individual and home-based sellers do not need a BR
                </span>
              </div>

              {(() => {
                const brDoc = getDocByType("br_certificate");
                const isUploadingBr = uploadingDocType === "br_certificate";
                return (
                  <div className="p-4 rounded-xl bg-white border border-sparehub-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-sparehub-dark">
                          Business Registration Document
                        </span>
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          Optional
                        </span>
                        {brDoc && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3 h-3" />
                            Uploaded
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500">
                        If your shop has a Business Registration (BR) certificate, you may attach it here to expedite commercial vendor verification.
                      </p>
                      {brDoc && (
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          <span className="font-mono text-[11px] text-gray-700">
                            {brDoc.file_name}
                          </span>
                          {brDoc.signedUrl && (
                            <a
                              href={brDoc.signedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-sparehub-orange hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Preview
                            </a>
                          )}
                          {!brDoc.verified && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(brDoc.id)}
                              disabled={deletingDocId === brDoc.id}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:underline"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <label className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-sparehub-border bg-gray-50 hover:bg-gray-100 text-xs font-bold text-sparehub-dark cursor-pointer shrink-0 transition-colors">
                      {isUploadingBr ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-sparehub-orange" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5 text-sparehub-orange" />
                          {brDoc ? "Replace BR Certificate" : "Upload BR (Optional)"}
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        disabled={isUploadingBr || isSubmitting}
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          handleFileUpload("br_certificate", f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })()}
            </div>

            {/* Submit Verification Action Footer */}
            {status !== "approved" && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-sparehub-border">
                <p className="text-xs text-gray-500">
                  Required: NIC Front, NIC Back, and Residential Address Proof. Business Registration is optional.
                </p>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  isLoading={isSubmitting}
                  loadingText="Submitting Verification..."
                  disabled={isSubmitting || Boolean(uploadingDocType)}
                  className="w-full sm:w-auto"
                >
                  <ShieldCheck className="w-4 h-4 mr-1.5" />
                  {status === "resubmission_required"
                    ? "Resubmit Verification for Review"
                    : status === "pending_review"
                    ? "Update Submitted Verification"
                    : "Submit Verification for Review"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
