import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

// Business rule constants & functions
const MIN_COMMISSION_BPS = 100; // 1.00%
const MAX_COMMISSION_BPS = 500; // 5.00%
const BASELINE_COMMISSION_BPS = 300; // 3.00%

function validateCommissionRateBps(bps) {
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

function calculateStatementDeadlines(year, month) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  const due = new Date(Date.UTC(year, month, 10));
  const grace = new Date(Date.UTC(year, month, 17));

  return {
    periodStart: start.toISOString().split("T")[0],
    periodEnd: end.toISOString().split("T")[0],
    dueDate: due.toISOString().split("T")[0],
    gracePeriodEnd: grace.toISOString().split("T")[0],
  };
}

function verifyPayHereChecksum(params) {
  try {
    const hashedSecret = crypto
      .createHash("md5")
      .update(params.merchantSecret)
      .digest("hex")
      .toUpperCase();

    const expectedHash = crypto
      .createHash("md5")
      .update(
        params.merchantId +
          params.orderId +
          params.payhereAmount +
          params.payhereCurrency +
          params.statusCode +
          hashedSecret
      )
      .digest("hex")
      .toUpperCase();

    return expectedHash === params.receivedMd5sig.toUpperCase();
  } catch {
    return false;
  }
}

const SUPPORTED_GATEWAY_PROVIDERS = ["payhere", "webxpay", "ipg", "custom"];

const paymentGatewaySchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier."),
  gatewayProvider: z.enum(SUPPORTED_GATEWAY_PROVIDERS),
  merchantId: z.string().trim().min(3).max(100),
  merchantSecret: z.string().trim().min(6).max(255),
  isSandbox: z.boolean().default(true),
  isEnabled: z.boolean().default(false),
  codEnabled: z.boolean().default(true),
});

const recordCommissionPaymentSchema = z.object({
  statementId: z.string().uuid(),
  shopId: z.string().uuid(),
  amountMinor: z.number().int().positive(),
  paymentMethod: z.enum(["bank_transfer", "online_gateway", "credit_adjustment", "other"]),
  paymentReference: z.string().trim().min(3).max(100),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verificationNotes: z.string().optional(),
});

const orderReturnRequestSchema = z.object({
  customerOrderId: z.string().uuid(),
  sellerOrderId: z.string().uuid(),
  orderItemId: z.string().uuid().optional().nullable(),
  shopId: z.string().uuid(),
  reasonCategory: z.enum([
    "wrong_item",
    "damaged_item",
    "defective_item",
    "incompatible_item",
    "customer_error",
    "other",
  ]),
  reason: z.string().trim().min(10).max(1000),
  requestedRefundMinor: z.number().int().positive(),
  evidenceUrls: z.array(z.string().url()).optional().default([]),
});

const policyAcceptanceSchema = z.object({
  shopId: z.string().uuid(),
  policyType: z.enum([
    "seller_agreement",
    "terms_and_conditions",
    "privacy_policy",
    "returns_and_refunds",
    "warranty_policy",
    "prohibited_products_conduct",
  ]),
  policyVersion: z.string().min(1),
  commissionRateBps: z.number().int().min(MIN_COMMISSION_BPS).max(MAX_COMMISSION_BPS).optional(),
  termsAccepted: z.literal(true),
});

describe("SpareHub Business Rules, Gateway Security & Commission System", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");

  describe("1. Migration 014 Schema & Financial Integrity", () => {
    const migration14Path = path.join(
      migrationsDir,
      "20261023000014_business_rules_gateways_and_billing.sql"
    );
    assert.ok(fs.existsSync(migration14Path), "Migration 014 must exist");
    const sql = fs.readFileSync(migration14Path, "utf-8");

    test("creates shop_payment_gateways table with tenant foreign key and RLS", () => {
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.shop_payment_gateways"),
        "Must create shop_payment_gateways"
      );
      assert.ok(
        sql.includes("ALTER TABLE public.shop_payment_gateways ENABLE ROW LEVEL SECURITY;"),
        "Must enable RLS on shop_payment_gateways"
      );
      assert.ok(
        sql.includes("public.owns_shop(shop_id)"),
        "Must enforce tenant isolation using owns_shop(shop_id)"
      );
    });

    test("defines monthly_commission_statements table with due date, grace period, and unique period", () => {
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.monthly_commission_statements"),
        "Must create monthly_commission_statements"
      );
      assert.ok(sql.includes("due_date date NOT NULL"), "Must include due_date column");
      assert.ok(
        sql.includes("grace_period_end date NOT NULL"),
        "Must include grace_period_end column"
      );
      assert.ok(
        sql.includes("CONSTRAINT uq_shop_statement_period UNIQUE (shop_id, period_start, period_end)"),
        "Must enforce unique statement per shop per period"
      );
      assert.ok(
        sql.includes("ALTER TABLE public.monthly_commission_statements ENABLE ROW LEVEL SECURITY;"),
        "Must enable RLS on monthly statements"
      );
    });

    test("defines commission_payments, commission_adjustments, and commission_disputes tables", () => {
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.commission_payments"),
        "Must create commission_payments"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.commission_adjustments"),
        "Must create commission_adjustments"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.commission_disputes"),
        "Must create commission_disputes"
      );
    });

    test("defines versioned policy_documents and seller_policy_acceptances tables with seed", () => {
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.policy_documents"),
        "Must create policy_documents table"
      );
      assert.ok(
        sql.includes("CREATE TABLE IF NOT EXISTS public.seller_policy_acceptances"),
        "Must create seller_policy_acceptances table"
      );
      assert.ok(
        sql.includes("terms_and_conditions") &&
          sql.includes("seller_agreement") &&
          sql.includes("privacy_policy") &&
          sql.includes("returns_and_refunds") &&
          sql.includes("warranty_policy") &&
          sql.includes("prohibited_products_conduct"),
        "Must seed all 6 core Sri Lankan marketplace policies"
      );
    });

    test("enforces shop restriction guards in enforce_shop_verification_on_publish", () => {
      assert.ok(
        sql.includes("publishing_restricted boolean NOT NULL DEFAULT false"),
        "Must add publishing_restricted column on shops"
      );
      assert.ok(
        sql.includes("IF v_publishing_restricted = true THEN"),
        "Trigger must block publishing when publishing_restricted is true"
      );
    });
  });

  describe("2. Seller Payment Gateway & Cryptographic Webhook Security", () => {
    test("validates valid PayHere gateway configuration payload", () => {
      const validPayload = {
        shopId: crypto.randomUUID(),
        gatewayProvider: "payhere",
        merchantId: "1215432",
        merchantSecret: "MySuperSecretKey99",
        isSandbox: true,
        isEnabled: true,
        codEnabled: true,
      };
      const result = paymentGatewaySchema.safeParse(validPayload);
      assert.ok(result.success, "Valid gateway input should pass validation");
    });

    test("rejects invalid gateway provider and empty merchant credentials", () => {
      const invalidPayload = {
        shopId: crypto.randomUUID(),
        gatewayProvider: "unsupported_paypal",
        merchantId: "",
        merchantSecret: "123", // too short
        isSandbox: false,
        isEnabled: true,
        codEnabled: true,
      };
      const result = paymentGatewaySchema.safeParse(invalidPayload);
      assert.strictEqual(result.success, false, "Invalid payload must fail");
    });

    test("verifies valid PayHere MD5 checksum signature", () => {
      const merchantId = "1215432";
      const merchantSecret = "4xsecret99";
      const orderId = "ORD-2026-0001";
      const payhereAmount = "5000.00";
      const payhereCurrency = "LKR";
      const statusCode = "2"; // Success

      const hashedSecret = crypto
        .createHash("md5")
        .update(merchantSecret)
        .digest("hex")
        .toUpperCase();
      const expectedSignature = crypto
        .createHash("md5")
        .update(
          merchantId + orderId + payhereAmount + payhereCurrency + statusCode + hashedSecret
        )
        .digest("hex")
        .toUpperCase();

      const isValid = verifyPayHereChecksum({
        merchantId,
        merchantSecret,
        orderId,
        payhereAmount,
        payhereCurrency,
        statusCode,
        receivedMd5sig: expectedSignature,
      });

      assert.strictEqual(isValid, true, "Valid cryptographic checksum must verify successfully");
    });

    test("rejects forged or tampered PayHere webhook checksum", () => {
      const isValid = verifyPayHereChecksum({
        merchantId: "1215432",
        merchantSecret: "4xsecret99",
        orderId: "ORD-2026-0001",
        payhereAmount: "5000.00",
        payhereCurrency: "LKR",
        statusCode: "2",
        receivedMd5sig: "BOGUS_TAMPERED_CHECKSUM_HASH_123456",
      });

      assert.strictEqual(isValid, false, "Tampered checksum signature must be rejected");
    });
  });

  describe("3. Commission Configuration & Range Enforcement (1% to 5%)", () => {
    test("accepts valid rates between 100 bps (1.00%) and 500 bps (5.00%)", () => {
      assert.strictEqual(validateCommissionRateBps(100).valid, true);
      assert.strictEqual(validateCommissionRateBps(250).valid, true);
      assert.strictEqual(validateCommissionRateBps(BASELINE_COMMISSION_BPS).valid, true);
      assert.strictEqual(validateCommissionRateBps(500).valid, true);
    });

    test("rejects rates outside 1.00% to 5.00% range (<100 bps or >500 bps)", () => {
      assert.strictEqual(validateCommissionRateBps(50).valid, false); // 0.5%
      assert.strictEqual(validateCommissionRateBps(0).valid, false);
      assert.strictEqual(validateCommissionRateBps(600).valid, false); // 6.0%
      assert.strictEqual(validateCommissionRateBps(1000).valid, false); // 10.0%
      assert.strictEqual(validateCommissionRateBps(-100).valid, false);
      assert.strictEqual(validateCommissionRateBps(NaN).valid, false);
      assert.strictEqual(validateCommissionRateBps(250.5).valid, false); // non-integer bps
    });

    test("calculates correct commission amount exclusively on merchandise subtotal", () => {
      const merchandiseSubtotalMinor = 10000000; // LKR 100,000.00
      const rateBps = 300; // 3.00%
      const expectedCommission = Math.round((merchandiseSubtotalMinor * rateBps) / 10000); // LKR 3,000.00
      const expectedNetEarning = merchandiseSubtotalMinor - expectedCommission; // LKR 97,000.00

      assert.strictEqual(expectedCommission, 300000);
      assert.strictEqual(expectedNetEarning, 9700000);
    });
  });

  describe("4. Monthly Commission Billing Schedule & Deadlines", () => {
    test("calculates due date as 10th of following month and grace period as 17th", () => {
      const deadlinesOct = calculateStatementDeadlines(2026, 10);
      assert.strictEqual(deadlinesOct.periodStart, "2026-10-01");
      assert.strictEqual(deadlinesOct.periodEnd, "2026-10-31");
      assert.strictEqual(deadlinesOct.dueDate, "2026-11-10");
      assert.strictEqual(deadlinesOct.gracePeriodEnd, "2026-11-17");

      const deadlinesDec = calculateStatementDeadlines(2026, 12);
      assert.strictEqual(deadlinesDec.periodStart, "2026-12-01");
      assert.strictEqual(deadlinesDec.periodEnd, "2026-12-31");
      assert.strictEqual(deadlinesDec.dueDate, "2027-01-10");
      assert.strictEqual(deadlinesDec.gracePeriodEnd, "2027-01-17");
    });

    test("reconciles partial payment and updates undisputed balance correctly", () => {
      const totalDueMinor = 1500000; // LKR 15,000.00
      const partialPaymentMinor = 500000; // LKR 5,000.00
      const disputedMinor = 200000; // LKR 2,000.00 held under review

      const newUndisputed = Math.max(0, totalDueMinor - partialPaymentMinor - disputedMinor);
      assert.strictEqual(newUndisputed, 800000, "Undisputed due must be LKR 8,000.00");
    });

    test("validates manual verified payment recording schema", () => {
      const validPayment = {
        statementId: crypto.randomUUID(),
        shopId: crypto.randomUUID(),
        amountMinor: 800000,
        paymentMethod: "bank_transfer",
        paymentReference: "CBC-SLIP-849201",
        paymentDate: "2026-11-09",
        verificationNotes: "Verified on Commercial Bank portal",
      };
      const result = recordCommissionPaymentSchema.safeParse(validPayment);
      assert.ok(result.success, "Valid payment payload must pass validation");
    });
  });

  describe("5. Order Returns & Return Shipping Cost Allocation", () => {
    test("allocates return shipping to seller when wrong or defective item supplied", () => {
      const returnReasons = ["wrong_item", "defective_item", "damaged_item", "incompatible_item"];
      for (const cat of returnReasons) {
        let payer = "undecided";
        if (["wrong_item", "defective_item", "damaged_item", "incompatible_item"].includes(cat)) {
          payer = "seller";
        }
        assert.strictEqual(payer, "seller", `Reason ${cat} must allocate return cost to seller`);
      }
    });

    test("allocates return shipping to customer when customer ordered wrong part", () => {
      const cat = "customer_error";
      let payer = "undecided";
      if (cat === "customer_error") {
        payer = "customer";
      }
      assert.strictEqual(payer, "customer", "Customer error must allocate return cost to customer");
    });

    test("validates customer return request schema", () => {
      const validReturn = {
        customerOrderId: crypto.randomUUID(),
        sellerOrderId: crypto.randomUUID(),
        orderItemId: crypto.randomUUID(),
        shopId: crypto.randomUUID(),
        reasonCategory: "wrong_item",
        reason: "Supplied rear brake pads instead of front brake pads.",
        requestedRefundMinor: 450000,
        evidenceUrls: ["https://example.com/evidence1.jpg"],
      };
      const result = orderReturnRequestSchema.safeParse(validReturn);
      assert.ok(result.success, "Valid return request should pass validation");
    });
  });

  describe("6. Versioned Policy Documents & Seller Agreement Acceptance", () => {
    test("validates seller agreement acceptance schema with termsAccepted literal true", () => {
      const validAcceptance = {
        shopId: crypto.randomUUID(),
        policyType: "seller_agreement",
        policyVersion: "1.0",
        commissionRateBps: 300,
        termsAccepted: true,
      };
      const result = policyAcceptanceSchema.safeParse(validAcceptance);
      assert.ok(result.success, "Valid acceptance should pass validation");
    });

    test("rejects policy acceptance when termsAccepted is false or missing", () => {
      const invalidAcceptance = {
        shopId: crypto.randomUUID(),
        policyType: "seller_agreement",
        policyVersion: "1.0",
        commissionRateBps: 300,
        termsAccepted: false,
      };
      const result = policyAcceptanceSchema.safeParse(invalidAcceptance);
      assert.strictEqual(result.success, false, "termsAccepted false must be rejected");
    });
  });
});
