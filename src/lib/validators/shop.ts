import { z } from "zod";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";

/**
 * Converts a string into a clean, URL-safe slug.
 * Removes special characters, replaces spaces/underscores with hyphens,
 * and collapses multiple hyphens.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-") // Replace multiple - with single -
    .replace(/^-+/, "") // Trim - from start of text
    .replace(/-+$/, ""); // Trim - from end of text
}

const phoneRegex = /^(?:(?:\+?94)|0)?(?:7\d{8}|[1-689]\d{8})$/;

export const shopCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Shop name must be at least 2 characters")
    .max(100, "Shop name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    )
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1,000 characters")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Please enter a valid phone number (e.g., 0771234567 or +94771234567)"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid shop email address")
    .max(255, "Email is too long"),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(150, "Address line 1 cannot exceed 150 characters"),
  address_line2: z
    .string()
    .trim()
    .max(150, "Address line 2 cannot exceed 150 characters")
    .optional()
    .or(z.literal("")),
  district: z.enum(SRI_LANKA_DISTRICTS, {
    error: "Please select a valid Sri Lankan administrative district",
  }),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City cannot exceed 100 characters"),
  postal_code: z
    .string()
    .trim()
    .max(10, "Postal code cannot exceed 10 characters")
    .optional()
    .or(z.literal("")),
  logo_url: z
    .string()
    .trim()
    .url("Logo must be a valid URL")
    .optional()
    .or(z.literal("")),
  cover_url: z
    .string()
    .trim()
    .url("Cover image must be a valid URL")
    .optional()
    .or(z.literal("")),
  seller_type: z
    .enum(["retail_shop", "individual", "wholesaler", "importer", "authorized_dealer", "distributor"])
    .default("retail_shop"),
  owner_legal_name: z
    .string()
    .trim()
    .min(2, "Owner's full legal name must be at least 2 characters")
    .max(120, "Owner's full legal name cannot exceed 120 characters"),
  residential_address: z
    .string()
    .trim()
    .min(5, "Residential address must be at least 5 characters")
    .max(300, "Residential address cannot exceed 300 characters"),
});

export const shopUpdateSchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier"),
  name: z
    .string()
    .trim()
    .min(2, "Shop name must be at least 2 characters")
    .max(100, "Shop name cannot exceed 100 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(120, "Slug cannot exceed 120 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens"
    ),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1,000 characters")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Please enter a valid phone number (e.g., 0771234567 or +94771234567)"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid shop email address")
    .max(255, "Email is too long"),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters")
    .max(150, "Address line 1 cannot exceed 150 characters"),
  address_line2: z
    .string()
    .trim()
    .max(150, "Address line 2 cannot exceed 150 characters")
    .optional()
    .or(z.literal("")),
  district: z.enum(SRI_LANKA_DISTRICTS, {
    error: "Please select a valid Sri Lankan administrative district",
  }),
  city: z
    .string()
    .trim()
    .min(2, "City must be at least 2 characters")
    .max(100, "City cannot exceed 100 characters"),
  postal_code: z
    .string()
    .trim()
    .max(10, "Postal code cannot exceed 10 characters")
    .optional()
    .or(z.literal("")),
  logo_url: z
    .string()
    .trim()
    .url("Logo must be a valid URL")
    .optional()
    .or(z.literal("")),
  cover_url: z
    .string()
    .trim()
    .url("Cover image must be a valid URL")
    .optional()
    .or(z.literal("")),
  owner_legal_name: z
    .string()
    .trim()
    .min(2, "Owner's full legal name must be at least 2 characters")
    .max(120, "Owner's full legal name cannot exceed 120 characters")
    .optional()
    .or(z.literal("")),
  residential_address: z
    .string()
    .trim()
    .min(5, "Residential address must be at least 5 characters")
    .max(300, "Residential address cannot exceed 300 characters")
    .optional()
    .or(z.literal("")),
  seller_type: z
    .enum(["retail_shop", "individual", "wholesaler", "importer", "authorized_dealer", "distributor"])
    .optional(),
});

export type ShopCreateInput = z.infer<typeof shopCreateSchema>;
export type ShopUpdateInput = z.infer<typeof shopUpdateSchema>;

export const SHOP_BRANDING_BUCKET = "product-images" as const;

export const ALLOWED_SHOP_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedShopImageMimeType = (typeof ALLOWED_SHOP_IMAGE_MIME_TYPES)[number];

export const MAX_SHOP_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type ShopBrandingAssetType = "logo" | "cover";

export interface ShopBrandingFileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a shop branding image file (logo or cover banner) for MIME type and file size.
 */
export function validateShopBrandingFile(
  file: { type?: string; size?: number; name?: string } | null | undefined,
  assetLabel: string = "Image"
): ShopBrandingFileValidationResult {
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return {
      valid: false,
      error: `Please select a valid ${assetLabel.toLowerCase()} file to upload.`,
    };
  }

  if (
    !file.type ||
    !ALLOWED_SHOP_IMAGE_MIME_TYPES.includes(file.type as AllowedShopImageMimeType)
  ) {
    return {
      valid: false,
      error: `Invalid ${assetLabel.toLowerCase()} format. Only JPG, PNG, and WEBP images are allowed.`,
    };
  }

  if (file.size > MAX_SHOP_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `${assetLabel} exceeds the 5 MB maximum size limit.`,
    };
  }

  return { valid: true };
}

/**
 * Extracts the storage object path within the public `product-images` bucket
 * only if the URL belongs to the specified authenticated `userId` and is a shop branding asset.
 * Returns null for external URLs or paths not owned by `userId`.
 */
export function extractOwnedStoragePath(
  url: string | null | undefined,
  userId: string
): string | null {
  if (!url || !userId || typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  const marker = `/storage/v1/object/public/${SHOP_BRANDING_BUCKET}/`;
  const markerIndex = trimmedUrl.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const rawPath = trimmedUrl
    .slice(markerIndex + marker.length)
    .split("?")[0]
    .split("#")[0];

  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    decodedPath = rawPath;
  }

  // Prevent path traversal and strictly enforce user folder ownership
  if (
    decodedPath.includes("..") ||
    decodedPath.startsWith("/") ||
    !decodedPath.startsWith(`${userId}/shop-`)
  ) {
    return null;
  }

  return decodedPath;
}

export const shopDeliverySettingsSchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier"),
  delivery_enabled: z.boolean(),
  default_delivery_fee_lkr: z
    .number()
    .min(0, "Default delivery fee cannot be negative")
    .max(100000, "Delivery fee is too high"),
  free_delivery_threshold_lkr: z
    .number()
    .min(0, "Free delivery threshold cannot be negative")
    .max(10000000, "Threshold is too high")
    .nullable()
    .optional(),
  district_fees_lkr: z
    .record(z.string(), z.number().min(0, "District delivery fee cannot be negative"))
    .optional(),
  supported_districts: z.array(z.string()).nullable().optional(),
  estimated_delivery_days: z
    .string()
    .trim()
    .max(50, "Estimated delivery days text is too long")
    .optional(),
});

export type ShopDeliverySettingsInput = z.infer<typeof shopDeliverySettingsSchema>;

// ============================================================================
// Seller Verification & Multi-Shop Compliance Validators
// ============================================================================

export const VERIFICATION_DOCUMENTS_BUCKET = "verification-documents" as const;

export const SHOP_VERIFICATION_STATUSES = [
  "not_submitted",
  "pending_review",
  "approved",
  "rejected",
  "resubmission_required",
] as const;

export type ShopVerificationStatus = (typeof SHOP_VERIFICATION_STATUSES)[number];

export const VERIFICATION_DOCUMENT_TYPES = [
  "nic_front",
  "nic_back",
  "proof_of_address",
  "br_certificate",
  "tax_document",
  "importer_license",
] as const;

export type VerificationDocumentType = (typeof VERIFICATION_DOCUMENT_TYPES)[number];

export const REQUIRED_VERIFICATION_DOCUMENT_TYPES = [
  "nic_front",
  "nic_back",
  "proof_of_address",
] as const;

export const ADDRESS_PROOF_TYPES = [
  "utility_bill",
  "bank_statement",
  "government_document",
  "other",
] as const;

export type AddressProofType = (typeof ADDRESS_PROOF_TYPES)[number];

export const ADDRESS_PROOF_TYPE_LABELS: Record<AddressProofType, string> = {
  utility_bill: "Electricity or Water Bill",
  bank_statement: "Bank Statement",
  government_document: "Government-Issued Address Document",
  other: "Other Acceptable Residential Address Proof",
};

export const ALLOWED_VERIFICATION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export type AllowedVerificationMimeType = (typeof ALLOWED_VERIFICATION_MIME_TYPES)[number];

export const MAX_VERIFICATION_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const DEFAULT_ADDRESS_PROOF_MAX_AGE_MONTHS = 3;

export interface VerificationDocumentValidationResult {
  valid: boolean;
  error?: string;
  recencyWarning?: string;
}

/**
 * Checks whether a residential address proof issue date is within the configured recency window
 * (default: previous 3 months), while allowing administrative discretion for reasonable exceptions.
 */
export function checkAddressProofRecency(
  issuedDateStr?: string | null,
  maxAgeMonths: number = DEFAULT_ADDRESS_PROOF_MAX_AGE_MONTHS,
  referenceDate: Date = new Date()
): {
  isValidDate: boolean;
  isWithinRecencyWindow: boolean;
  ageInDays?: number;
  warning?: string;
  error?: string;
} {
  if (!issuedDateStr || !issuedDateStr.trim()) {
    return {
      isValidDate: true,
      isWithinRecencyWindow: true,
      warning: `Please ensure your residential address document was issued within the last ${maxAgeMonths} months.`,
    };
  }

  const parsed = new Date(issuedDateStr);
  if (Number.isNaN(parsed.getTime())) {
    return {
      isValidDate: false,
      isWithinRecencyWindow: false,
      error: "Please enter a valid document issue date.",
    };
  }

  const diffMs = referenceDate.getTime() - parsed.getTime();
  if (diffMs < -86400000) {
    return {
      isValidDate: false,
      isWithinRecencyWindow: false,
      error: "Document issue date cannot be in the future.",
    };
  }

  const ageInDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const maxAllowedDays = maxAgeMonths * 31;

  if (ageInDays > maxAllowedDays) {
    return {
      isValidDate: true,
      isWithinRecencyWindow: false,
      ageInDays,
      warning: `This document appears to be older than ${maxAgeMonths} months (${ageInDays} days old). Standard policy requires a utility bill or statement from the previous ${maxAgeMonths} months, though administrators may review reasonable exceptions.`,
    };
  }

  return {
    isValidDate: true,
    isWithinRecencyWindow: true,
    ageInDays,
  };
}

/**
 * Validates a verification document file before uploading to the private `verification-documents` bucket.
 */
export function validateVerificationDocumentFile(
  file: { type?: string; size?: number; name?: string } | null | undefined,
  documentType: string,
  options?: {
    addressProofType?: string | null;
    documentIssuedDate?: string | null;
  }
): VerificationDocumentValidationResult {
  if (!VERIFICATION_DOCUMENT_TYPES.includes(documentType as VerificationDocumentType)) {
    return {
      valid: false,
      error: "Invalid verification document category selected.",
    };
  }

  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return {
      valid: false,
      error: "Please select a valid document or image file to upload.",
    };
  }

  if (
    !file.type ||
    !ALLOWED_VERIFICATION_MIME_TYPES.includes(file.type as AllowedVerificationMimeType)
  ) {
    return {
      valid: false,
      error: "Unsupported file format. Only JPG, PNG, WEBP images and PDF documents are allowed.",
    };
  }

  if (file.size > MAX_VERIFICATION_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: "Verification document exceeds the 10 MB maximum file size limit.",
    };
  }

  if (documentType === "proof_of_address") {
    const proofType = options?.addressProofType;
    if (
      !proofType ||
      !ADDRESS_PROOF_TYPES.includes(proofType as AddressProofType)
    ) {
      return {
        valid: false,
        error: "Please select the residential address proof document type (e.g. Electricity/Water Bill, Bank Statement, or Government Document).",
      };
    }

    const recency = checkAddressProofRecency(options?.documentIssuedDate);
    if (!recency.isValidDate) {
      return {
        valid: false,
        error: recency.error || "Invalid document issue date.",
      };
    }

    return {
      valid: true,
      recencyWarning: recency.warning,
    };
  }

  return { valid: true };
}

/**
 * Validates whether a shop has all required verification documents ready to submit for review.
 * Supports reusing NIC front & back documents already uploaded/verified under the same user account.
 */
export function validateVerificationSubmissionCompleteness(
  shopDocuments: Array<{ document_type: string; address_proof_type?: string | null }>,
  accountDocuments: Array<{ document_type: string; verified?: boolean }> = []
): {
  ready: boolean;
  missingTypes: VerificationDocumentType[];
  reusingAccountNic: boolean;
  error?: string;
} {
  const shopDocTypes = new Set(shopDocuments.map((d) => d.document_type));
  const accountDocTypes = new Set(accountDocuments.map((d) => d.document_type));

  const hasShopNicFront = shopDocTypes.has("nic_front");
  const hasShopNicBack = shopDocTypes.has("nic_back");
  const hasAccountNicFront = accountDocTypes.has("nic_front");
  const hasAccountNicBack = accountDocTypes.has("nic_back");

  const hasNicFront = hasShopNicFront || hasAccountNicFront;
  const hasNicBack = hasShopNicBack || hasAccountNicBack;
  const hasProofOfAddress = shopDocTypes.has("proof_of_address");

  const missingTypes: VerificationDocumentType[] = [];
  if (!hasNicFront) missingTypes.push("nic_front");
  if (!hasNicBack) missingTypes.push("nic_back");
  if (!hasProofOfAddress) missingTypes.push("proof_of_address");

  const reusingAccountNic =
    (!hasShopNicFront && hasAccountNicFront) || (!hasShopNicBack && hasAccountNicBack);

  if (missingTypes.length > 0) {
    const labels: Record<string, string> = {
      nic_front: "NIC Front Image",
      nic_back: "NIC Back Image",
      proof_of_address: "Residential Address Proof",
    };
    const missingList = missingTypes.map((t) => labels[t] || t).join(", ");
    return {
      ready: false,
      missingTypes,
      reusingAccountNic,
      error: `Please upload all required verification documents before submitting: ${missingList}. (Business Registration is optional.)`,
    };
  }

  return {
    ready: true,
    missingTypes: [],
    reusingAccountNic,
  };
}

/**
 * Validates whether a shop verification status transition is permitted.
 * Sellers can only submit/resubmit to `pending_review`.
 * Platform administrators can approve, request resubmission (with reason), or reject (with reason).
 */
export function canTransitionShopVerificationStatus(
  currentStatus: ShopVerificationStatus,
  targetStatus: ShopVerificationStatus,
  isAdmin: boolean,
  reason?: string | null
): { allowed: boolean; error?: string } {
  if (!SHOP_VERIFICATION_STATUSES.includes(targetStatus)) {
    return { allowed: false, error: "Invalid verification status." };
  }

  if (!isAdmin) {
    if (
      targetStatus === "pending_review" &&
      (currentStatus === "not_submitted" ||
        currentStatus === "resubmission_required" ||
        currentStatus === "rejected" ||
        currentStatus === "pending_review")
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: "Unauthorized: Only platform administrators can approve or reject seller verification.",
    };
  }

  // Admin transitions
  if (targetStatus === "resubmission_required" || targetStatus === "rejected") {
    if (!reason || reason.trim().length < 5) {
      return {
        allowed: false,
        error: "A clear reason (at least 5 characters) is required when requesting resubmission or rejecting verification.",
      };
    }
  }

  return { allowed: true };
}

/**
 * Enforces the critical business rule:
 * A shop must not publish products (`is_published = true`) unless that shop's `verification_status === 'approved'`.
 */
export function canShopPublishProducts(
  shop: {
    status?: string | null;
    verification_status?: string | null;
  } | null | undefined
): { allowed: boolean; reason?: string } {
  if (!shop) {
    return {
      allowed: false,
      reason: "You must create a shop before listing products.",
    };
  }

  if (shop.status === "suspended") {
    return {
      allowed: false,
      reason: "Your shop is currently suspended. You cannot publish products while suspended.",
    };
  }

  if (shop.verification_status !== "approved") {
    const statusMessages: Record<string, string> = {
      not_submitted:
        "Your shop is open, but you must complete seller verification before publishing products. You can still save products as drafts.",
      pending_review:
        "Your seller verification is currently under administrator review. You can save products as drafts and publish them once verification is approved.",
      resubmission_required:
        "Administrator review requested updated verification documents. Please complete verification resubmission before publishing products.",
      rejected:
        "Your shop verification was rejected. You cannot publish products without approved seller verification.",
    };
    return {
      allowed: false,
      reason:
        statusMessages[shop.verification_status || "not_submitted"] ||
        "Shop verification is required before publishing products.",
    };
  }

  return { allowed: true };
}



