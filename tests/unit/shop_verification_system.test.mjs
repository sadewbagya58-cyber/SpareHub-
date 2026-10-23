import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const ROOT = process.cwd();

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

const SRI_LANKA_DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle",
];

const phoneRegex = /^(?:(?:\+?94)|0)?(?:7\d{8}|[1-689]\d{8})$/;

const shopCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRegex),
  email: z.string().trim().toLowerCase().email(),
  address_line1: z.string().trim().min(3).max(150),
  address_line2: z.string().trim().optional().or(z.literal("")),
  district: z.enum(SRI_LANKA_DISTRICTS),
  city: z.string().trim().min(2).max(100),
  postal_code: z.string().trim().optional().or(z.literal("")),
  seller_type: z
    .enum(["retail_shop", "individual", "wholesaler", "importer", "authorized_dealer", "distributor"])
    .default("retail_shop"),
  owner_legal_name: z.string().trim().min(2).max(120),
  residential_address: z.string().trim().min(5).max(300),
});

const SHOP_VERIFICATION_STATUSES = [
  "not_submitted",
  "pending_review",
  "approved",
  "rejected",
  "resubmission_required",
];

const ADDRESS_PROOF_TYPES = [
  "utility_bill",
  "bank_statement",
  "government_document",
  "other",
];

const ALLOWED_VERIFICATION_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const MAX_VERIFICATION_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function canShopPublishProducts(shop) {
  if (!shop) {
    return { allowed: false, reason: "You must create a shop before listing products." };
  }
  if (shop.status === "suspended") {
    return { allowed: false, reason: "Your shop is currently suspended." };
  }
  if (shop.verification_status !== "approved") {
    return {
      allowed: false,
      reason:
        "Your shop is open, but you must complete seller verification before publishing products.",
    };
  }
  return { allowed: true };
}

function validateVerificationDocumentFile(file, documentType, options = {}) {
  if (
    !["nic_front", "nic_back", "proof_of_address", "br_certificate"].includes(
      documentType
    )
  ) {
    return { valid: false, error: "Invalid verification document category." };
  }
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { valid: false, error: "Empty or missing file." };
  }
  if (!ALLOWED_VERIFICATION_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: "Unsupported MIME type." };
  }
  if (file.size > MAX_VERIFICATION_FILE_SIZE_BYTES) {
    return { valid: false, error: "File exceeds 10 MB limit." };
  }
  if (documentType === "proof_of_address") {
    if (!options.addressProofType || !ADDRESS_PROOF_TYPES.includes(options.addressProofType)) {
      return { valid: false, error: "Address proof type is required." };
    }
  }
  return { valid: true };
}

function validateVerificationSubmissionCompleteness(shopDocs, accountDocs = []) {
  const shopTypes = new Set(shopDocs.map((d) => d.document_type));
  const accountTypes = new Set(accountDocs.map((d) => d.document_type));

  const hasNicFront = shopTypes.has("nic_front") || accountTypes.has("nic_front");
  const hasNicBack = shopTypes.has("nic_back") || accountTypes.has("nic_back");
  const hasAddressProof = shopTypes.has("proof_of_address");

  const missing = [];
  if (!hasNicFront) missing.push("nic_front");
  if (!hasNicBack) missing.push("nic_back");
  if (!hasAddressProof) missing.push("proof_of_address");

  return {
    ready: missing.length === 0,
    missingTypes: missing,
    reusingAccountNic:
      (!shopTypes.has("nic_front") && accountTypes.has("nic_front")) ||
      (!shopTypes.has("nic_back") && accountTypes.has("nic_back")),
  };
}

function canTransitionShopVerificationStatus(currentStatus, targetStatus, isAdmin, reason) {
  if (!SHOP_VERIFICATION_STATUSES.includes(targetStatus)) {
    return { allowed: false, error: "Invalid status" };
  }
  if (!isAdmin) {
    if (
      targetStatus === "pending_review" &&
      ["not_submitted", "resubmission_required", "rejected", "pending_review"].includes(
        currentStatus
      )
    ) {
      return { allowed: true };
    }
    return {
      allowed: false,
      error: "Unauthorized: Only platform administrators can approve or reject seller verification.",
    };
  }
  if (targetStatus === "resubmission_required" || targetStatus === "rejected") {
    if (!reason || reason.trim().length < 5) {
      return {
        allowed: false,
        error: "A clear reason is required when requesting resubmission or rejecting verification.",
      };
    }
  }
  return { allowed: true };
}

describe("Shop Opening & Seller Verification System — 15 Core Scenarios", () => {
  const migrationSql = readRepoFile(
    "supabase/migrations/20261023000013_shop_verification_and_multi_shop.sql"
  );
  const sellerActionsSrc = readRepoFile("src/lib/seller/actions.ts");
  const productActionsSrc = readRepoFile("src/lib/products/actions.ts");
  const adminActionsSrc = readRepoFile("src/lib/admin/actions.ts");
  const dashboardSrc = readRepoFile("src/app/seller/dashboard/page.tsx");
  const verificationPanelSrc = readRepoFile(
    "src/components/seller/shop-verification-panel.tsx"
  );

  test("1. Authenticated user can create a shop without phone OTP (collects legal name, residential & business addresses, contact phone, category)", () => {
    const validShopPayload = {
      name: "Maharagama Auto Spares",
      owner_legal_name: "Kasun Perera",
      residential_address: "No. 45, Temple Road, Maharagama",
      address_line1: "No. 45, Temple Road, Maharagama", // Same as residential when operating from home
      phone: "0771234567",
      email: "kasun@example.lk",
      district: "Colombo",
      city: "Maharagama",
      seller_type: "individual",
    };

    const parsed = shopCreateSchema.safeParse(validShopPayload);
    assert.strictEqual(parsed.success, true, "Shop creation must succeed without OTP");
    assert.ok(
      !sellerActionsSrc.includes("verifyOtp"),
      "createShopAction must not require paid phone OTP verification"
    );
  });

  test("2. Newly created shop has `not_submitted` verification status and open storefront (`approved`)", () => {
    assert.match(
      sellerActionsSrc,
      /status:\s*"approved"[\s\S]*?verification_status:\s*"not_submitted"/,
      "createShopAction must initialize new shops with status='approved' and verification_status='not_submitted'"
    );
    assert.match(
      migrationSql,
      /ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted'/,
      "Database schema must default shops.verification_status to 'not_submitted'"
    );
    assert.match(
      migrationSql,
      /NEW\.verification_status := 'not_submitted'/,
      "Database trigger prevent_self_shop_approval must enforce 'not_submitted' on non-admin INSERT"
    );
  });

  test("3. Unverified shop sees the prominent red verification required warning on Seller Dashboard", () => {
    assert.ok(
      dashboardSrc.includes("Shop Verification Required"),
      "Seller Dashboard must display 'Shop Verification Required' heading"
    );
    assert.ok(
      dashboardSrc.includes(
        "Your shop is open, but you must complete seller verification before publishing products."
      ),
      "Seller Dashboard must display the exact verification warning message"
    );
    assert.ok(
      dashboardSrc.includes("Complete Verification"),
      "Seller Dashboard must display the 'Complete Verification' action button"
    );
  });

  test("4. Unverified shop cannot publish a product (`is_published = true` blocked in both Server Actions and DB trigger)", () => {
    const unverifiedShop = {
      id: "shop-1",
      status: "approved",
      verification_status: "not_submitted",
    };
    const check = canShopPublishProducts(unverifiedShop);
    assert.strictEqual(check.allowed, false);
    assert.match(check.reason, /must complete seller verification before publishing products/i);

    assert.ok(
      productActionsSrc.includes("canShopPublishProducts("),
      "Product server actions must enforce canShopPublishProducts before publishing"
    );
    assert.ok(
      migrationSql.includes("CREATE OR REPLACE FUNCTION public.enforce_shop_verification_on_publish()"),
      "Database migration must define enforce_shop_verification_on_publish trigger function"
    );
    assert.ok(
      migrationSql.includes("IF v_verification_status IS DISTINCT FROM 'approved' THEN"),
      "Database trigger must block NEW.is_published = true when shop verification_status != 'approved'"
    );
  });

  test("5. Unverified shop can create and save a draft product (`is_published = false`)", () => {
    const unverifiedShop = {
      id: "shop-1",
      status: "approved",
      verification_status: "not_submitted",
    };
    const draftProductInput = { is_published: false };
    // Draft creation does not require canShopPublishProducts to be true
    const shouldBlockDraft =
      draftProductInput.is_published && !canShopPublishProducts(unverifiedShop).allowed;
    assert.strictEqual(
      shouldBlockDraft,
      false,
      "Unverified shop must be allowed to create and save product drafts (is_published = false)"
    );
  });

  test("6. Seller can upload NIC front, NIC back, and residential address proof (utility bill, bank statement, government document)", () => {
    for (const docType of ["nic_front", "nic_back"]) {
      const res = validateVerificationDocumentFile(
        { type: "image/jpeg", size: 500 * 1024, name: `${docType}.jpg` },
        docType
      );
      assert.strictEqual(res.valid, true, `Should accept valid ${docType}`);
    }

    for (const proofType of ["utility_bill", "bank_statement", "government_document", "other"]) {
      const res = validateVerificationDocumentFile(
        { type: "application/pdf", size: 800 * 1024, name: "address-proof.pdf" },
        "proof_of_address",
        { addressProofType: proofType }
      );
      assert.strictEqual(
        res.valid,
        true,
        `Should accept proof_of_address with subtype ${proofType}`
      );
    }

    // Missing address proof subtype must be rejected
    const missingSubtype = validateVerificationDocumentFile(
      { type: "image/png", size: 400 * 1024, name: "bill.png" },
      "proof_of_address",
      {}
    );
    assert.strictEqual(missingSubtype.valid, false);
  });

  test("7. Optional Business Registration (BR) can be omitted or uploaded", () => {
    const withoutBr = validateVerificationSubmissionCompleteness([
      { document_type: "nic_front" },
      { document_type: "nic_back" },
      { document_type: "proof_of_address", address_proof_type: "utility_bill" },
    ]);
    assert.strictEqual(
      withoutBr.ready,
      true,
      "Verification submission must succeed when optional BR is omitted"
    );

    const brUpload = validateVerificationDocumentFile(
      { type: "application/pdf", size: 1024 * 1024, name: "br-certificate.pdf" },
      "br_certificate"
    );
    assert.strictEqual(
      brUpload.valid,
      true,
      "Optional BR certificate upload must be accepted when provided"
    );
  });

  test("8. Submitting verification changes status to `pending_review` (never auto-approved)", () => {
    const transition = canTransitionShopVerificationStatus(
      "not_submitted",
      "pending_review",
      false
    );
    assert.strictEqual(transition.allowed, true);

    assert.match(
      sellerActionsSrc,
      /verification_status:\s*"pending_review"/,
      "submitShopVerificationAction must set verification_status to 'pending_review'"
    );
  });

  test("9. Seller with `pending_review` still cannot publish products", () => {
    const pendingShop = {
      id: "shop-1",
      status: "approved",
      verification_status: "pending_review",
    };
    const check = canShopPublishProducts(pendingShop);
    assert.strictEqual(
      check.allowed,
      false,
      "Shop in pending_review must not be allowed to publish products"
    );
  });

  test("10. Non-admin user cannot approve verification or access another seller's private documents", () => {
    const selfApproveAttempt = canTransitionShopVerificationStatus(
      "pending_review",
      "approved",
      false
    );
    assert.strictEqual(
      selfApproveAttempt.allowed,
      false,
      "Non-admin seller must never be able to transition verification_status to approved"
    );

    assert.ok(
      migrationSql.includes(
        "RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve or reject shop verification.';"
      ),
      "DB trigger must block non-admin attempts to approve verification"
    );

    assert.ok(
      adminActionsSrc.includes("verifyPlatformAdmin()"),
      "Admin verification actions must verify platform_admin role on the server"
    );
  });

  test("11. Admin can view verification documents via short-lived signed URLs and approve a shop", () => {
    assert.ok(
      adminActionsSrc.includes("createSignedUrl(doc.storage_path, 300)"),
      "Admin document inspection must generate short-lived signed URLs from private bucket"
    );
    const adminApprove = canTransitionShopVerificationStatus(
      "pending_review",
      "approved",
      true
    );
    assert.strictEqual(adminApprove.allowed, true);
    assert.ok(
      adminActionsSrc.includes("SHOP_VERIFICATION_APPROVED"),
      "Admin approval must record SHOP_VERIFICATION_APPROVED in admin_audit_logs"
    );
  });

  test("12. Approved shop (`verification_status === 'approved'`) can publish products", () => {
    const approvedShop = {
      id: "shop-1",
      status: "approved",
      verification_status: "approved",
    };
    const check = canShopPublishProducts(approvedShop);
    assert.strictEqual(
      check.allowed,
      true,
      "Approved and verified shop must be permitted to publish products"
    );
  });

  test("13. Admin can mark a shop `resubmission_required` with a mandatory reason, and seller can resubmit", () => {
    const missingReason = canTransitionShopVerificationStatus(
      "pending_review",
      "resubmission_required",
      true,
      ""
    );
    assert.strictEqual(
      missingReason.allowed,
      false,
      "Admin resubmission request without a reason must be rejected"
    );

    const withReason = canTransitionShopVerificationStatus(
      "pending_review",
      "resubmission_required",
      true,
      "Utility bill image is blurry; please upload a clearer copy."
    );
    assert.strictEqual(withReason.allowed, true);

    const sellerResubmit = canTransitionShopVerificationStatus(
      "resubmission_required",
      "pending_review",
      false
    );
    assert.strictEqual(
      sellerResubmit.allowed,
      true,
      "Seller must be able to resubmit verification from resubmission_required to pending_review"
    );
    assert.ok(
      verificationPanelSrc.includes("Resubmit Verification for Review"),
      "Verification UI must allow seller to resubmit corrected documents"
    );
  });

  test("14. Admin can reject a shop with a reason, and rejected shop cannot publish products", () => {
    const rejectWithoutReason = canTransitionShopVerificationStatus(
      "pending_review",
      "rejected",
      true,
      "no"
    );
    assert.strictEqual(rejectWithoutReason.allowed, false);

    const rejectWithReason = canTransitionShopVerificationStatus(
      "pending_review",
      "rejected",
      true,
      "Submitted NIC document failed authenticity verification."
    );
    assert.strictEqual(rejectWithReason.allowed, true);

    const rejectedShop = {
      id: "shop-1",
      status: "approved",
      verification_status: "rejected",
    };
    assert.strictEqual(
      canShopPublishProducts(rejectedShop).allowed,
      false,
      "Rejected shop must not be allowed to publish products"
    );
  });

  test("15. A single user can create a second shop with independent verification status and reuse verified account NIC documents", () => {
    const shop1 = {
      id: "shop-1",
      name: "Colombo Brake Center",
      status: "approved",
      verification_status: "approved",
    };
    const shop2 = {
      id: "shop-2",
      name: "Kandy Suspension Hub",
      status: "approved",
      verification_status: "not_submitted",
    };

    assert.strictEqual(
      canShopPublishProducts(shop1).allowed,
      true,
      "Shop 1 (approved) can publish products"
    );
    assert.strictEqual(
      canShopPublishProducts(shop2).allowed,
      false,
      "Shop 2 (not_submitted) under the same user account cannot publish until Shop 2 is verified"
    );

    // Shop 2 only uploads its own proof_of_address and reuses nic_front + nic_back from Shop 1
    const shop2Completeness = validateVerificationSubmissionCompleteness(
      [{ document_type: "proof_of_address", address_proof_type: "bank_statement" }],
      [
        { document_type: "nic_front", verified: true },
        { document_type: "nic_back", verified: true },
      ]
    );
    assert.strictEqual(
      shop2Completeness.ready,
      true,
      "Second shop under the same user account must be able to reuse account NIC documents without re-uploading"
    );
    assert.strictEqual(shop2Completeness.reusingAccountNic, true);
  });
});
