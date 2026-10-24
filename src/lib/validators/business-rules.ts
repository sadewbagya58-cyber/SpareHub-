import { z } from "zod";

/**
 * Supported payment gateway providers in Sri Lanka.
 */
export const SUPPORTED_GATEWAY_PROVIDERS = ["payhere", "webxpay", "ipg", "custom"] as const;
export type GatewayProvider = (typeof SUPPORTED_GATEWAY_PROVIDERS)[number];

export const GATEWAY_PROVIDER_LABELS: Record<GatewayProvider, string> = {
  payhere: "PayHere Sri Lanka (Central Bank Approved)",
  webxpay: "WebXPay Sri Lanka",
  ipg: "Bank Internet Payment Gateway (Commercial / Sampath / HNB)",
  custom: "Custom Gateway Integration",
};

/**
 * Seller Payment Gateway Configuration Schema
 */
export const paymentGatewaySchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier."),
  gatewayProvider: z.enum(SUPPORTED_GATEWAY_PROVIDERS, {
    message: "Please select a supported payment gateway provider.",
  }),
  merchantId: z
    .string()
    .trim()
    .min(3, "Merchant ID must be at least 3 characters.")
    .max(100, "Merchant ID cannot exceed 100 characters."),
  merchantSecret: z
    .string()
    .trim()
    .min(6, "Merchant Secret / Key must be at least 6 characters.")
    .max(255, "Merchant Secret cannot exceed 255 characters."),
  isSandbox: z.boolean().default(true),
  isEnabled: z.boolean().default(false),
  codEnabled: z.boolean().default(true),
  webhookSecret: z.string().trim().max(255).optional(),
});

export type PaymentGatewayInput = z.input<typeof paymentGatewaySchema>;

/**
 * Commission Rate Bounds: Exactly 1.00% to 5.00% (100 to 500 basis points).
 */
export const MIN_COMMISSION_BPS = 100; // 1.00%
export const MAX_COMMISSION_BPS = 500; // 5.00%
export const BASELINE_COMMISSION_BPS = 300; // 3.00%

export function validateCommissionRateBps(bps: number): { valid: boolean; error?: string } {
  if (isNaN(bps) || !Number.isInteger(bps)) {
    return { valid: false, error: "Commission rate must be a valid whole number in basis points." };
  }
  if (bps < MIN_COMMISSION_BPS || bps > MAX_COMMISSION_BPS) {
    return {
      valid: false,
      error: `Commission rate must be between ${MIN_COMMISSION_BPS} bps (1.00%) and ${MAX_COMMISSION_BPS} bps (5.00%).`,
    };
  }
  return { valid: true };
}

/**
 * Admin Commission Rule Creation / Proposal Schema
 */
export const commissionRuleProposalSchema = z.object({
  name: z.string().trim().min(3).max(100),
  ruleType: z.enum(["platform_default", "category_override", "shop_override"]),
  rateBasisPoints: z
    .number()
    .int()
    .min(MIN_COMMISSION_BPS, "Commission rate cannot be less than 1.00% (100 bps).")
    .max(MAX_COMMISSION_BPS, "Commission rate cannot exceed 5.00% (500 bps)."),
  categoryId: z.string().uuid().optional().nullable(),
  shopId: z.string().uuid().optional().nullable(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional().nullable(),
});

/**
 * Monthly Statement Due Date Calculations:
 * Due: 10th day of the following month
 * Grace Period: 7 calendar days after due date (17th)
 */
export function calculateStatementDeadlines(year: number, month: number): {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  gracePeriodEnd: string;
} {
  // Calendar month dates:
  // e.g. year=2026, month=10 -> Oct 1 to Oct 31
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0)); // last day of month

  // Following month 10th
  const due = new Date(Date.UTC(year, month, 10));

  // Following month 17th (7 calendar days after 10th)
  const grace = new Date(Date.UTC(year, month, 17));

  return {
    periodStart: start.toISOString().split("T")[0],
    periodEnd: end.toISOString().split("T")[0],
    dueDate: due.toISOString().split("T")[0],
    gracePeriodEnd: grace.toISOString().split("T")[0],
  };
}

/**
 * Manual Commission Payment Recording Schema (Admin only)
 */
export const recordCommissionPaymentSchema = z.object({
  statementId: z.string().uuid("Invalid statement identifier."),
  shopId: z.string().uuid("Invalid shop identifier."),
  amountMinor: z.number().int().positive("Payment amount must be greater than zero."),
  paymentMethod: z.enum(["bank_transfer", "online_gateway", "credit_adjustment", "other"]).default("bank_transfer"),
  paymentReference: z
    .string()
    .trim()
    .min(3, "Bank transaction reference must be at least 3 characters.")
    .max(100, "Reference too long."),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Payment date must be in YYYY-MM-DD format."),
  verificationNotes: z.string().trim().max(500).optional(),
});

export type RecordCommissionPaymentInput = z.input<typeof recordCommissionPaymentSchema>;

/**
 * Commission Dispute Submission Schema (Seller)
 */
export const submitCommissionDisputeSchema = z.object({
  statementId: z.string().uuid().optional().nullable(),
  shopId: z.string().uuid("Invalid shop identifier."),
  sellerOrderId: z.string().uuid().optional().nullable(),
  disputedAmountMinor: z.number().int().positive("Disputed amount must be greater than zero."),
  reason: z.string().trim().min(10, "Please provide a detailed dispute reason (at least 10 characters).").max(2000),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

export type SubmitCommissionDisputeInput = z.input<typeof submitCommissionDisputeSchema>;

/**
 * Customer Return Request Schema
 */
export const orderReturnRequestSchema = z.object({
  customerOrderId: z.string().uuid("Invalid order identifier."),
  sellerOrderId: z.string().uuid("Invalid sub-order identifier."),
  orderItemId: z.string().uuid().optional().nullable(),
  shopId: z.string().uuid("Invalid shop identifier."),
  reasonCategory: z.enum([
    "wrong_item",
    "damaged_item",
    "defective_item",
    "incompatible_item",
    "customer_error",
    "other",
  ]),
  reason: z.string().trim().min(10, "Please describe the reason for return (at least 10 characters).").max(1000),
  requestedRefundMinor: z.number().int().positive("Refund amount must be positive."),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

export type OrderReturnRequestInput = z.input<typeof orderReturnRequestSchema>;

/**
 * Seller Policy Acceptance Schema
 */
export const policyAcceptanceSchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier."),
  policyType: z.enum([
    "seller_agreement",
    "terms_and_conditions",
    "privacy_policy",
    "returns_and_refunds",
    "warranty_policy",
    "prohibited_products_conduct",
  ]),
  policyVersion: z.string().min(1, "Policy version required."),
  commissionRateBps: z.number().int().min(MIN_COMMISSION_BPS).max(MAX_COMMISSION_BPS).optional(),
  termsAccepted: z.literal(true, {
    message: "You must accept the terms to proceed.",
  }),
});

export type PolicyAcceptanceInput = z.input<typeof policyAcceptanceSchema>;
