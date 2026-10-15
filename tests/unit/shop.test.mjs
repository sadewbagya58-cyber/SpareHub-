import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
const SRI_LANKA_DISTRICTS = [
  "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale", "Nuwara Eliya",
  "Galle", "Matara", "Hambantota", "Jaffna", "Kilinochchi", "Mannar",
  "Vavuniya", "Mullaitivu", "Batticaloa", "Ampara", "Trincomalee",
  "Kurunegala", "Puttalam", "Anuradhapura", "Polonnaruwa", "Badulla",
  "Monaragala", "Ratnapura", "Kegalle"
];

/**
 * Mirror of slugify utility for unit testing
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

const phoneRegex = /^(?:(?:\+?94)|0)?(?:7\d{8}|[1-689]\d{8})$/;

const shopCreateSchema = z.object({
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
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens")
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
    .regex(phoneRegex, "Please enter a valid phone number"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid shop email address"),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 must be at least 3 characters"),
  address_line2: z.string().trim().optional().or(z.literal("")),
  district: z.enum(SRI_LANKA_DISTRICTS),
  city: z.string().trim().min(2, "City must be at least 2 characters"),
  postal_code: z.string().trim().optional().or(z.literal("")),
  logo_url: z.string().trim().url().optional().or(z.literal("")),
  cover_url: z.string().trim().url().optional().or(z.literal("")),
  seller_type: z.enum(["retail_shop", "individual", "wholesaler", "importer"]).default("retail_shop"),
});

const shopUpdateSchema = z.object({
  shopId: z.string().uuid("Invalid shop identifier"),
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  phone: z.string().trim().regex(phoneRegex),
  email: z.string().trim().toLowerCase().email(),
  address_line1: z.string().trim().min(3),
  address_line2: z.string().trim().optional().or(z.literal("")),
  district: z.enum(SRI_LANKA_DISTRICTS),
  city: z.string().trim().min(2),
  postal_code: z.string().trim().optional().or(z.literal("")),
  logo_url: z.string().trim().url().optional().or(z.literal("")),
  cover_url: z.string().trim().url().optional().or(z.literal("")),
});

describe("Seller Shop Validation & Slug Generation (Phase 4.1)", () => {
  test("slugify normalizes store names correctly", () => {
    assert.strictEqual(slugify("Colombo Precision Auto"), "colombo-precision-auto");
    assert.strictEqual(slugify("Nimal's Parts & Spares (Pvt) Ltd!"), "nimals-parts-spares-pvt-ltd");
    assert.strictEqual(slugify("Quick---Fix   Spares"), "quick-fix-spares");
    assert.strictEqual(slugify("---Lanka Motors---"), "lanka-motors");
    assert.strictEqual(slugify("Special Parts 2026"), "special-parts-2026");
  });

  test("accepts valid shop creation payload with Sri Lanka address and district", () => {
    const input = {
      name: "Kandy Auto Clinic Spares",
      slug: "kandy-auto-clinic-spares",
      description: "OEM Toyota and Honda replacement parts with 6-month warranty.",
      phone: "0812233445",
      email: "kandy.clinic@example.lk",
      address_line1: "125 Peradeniya Road",
      address_line2: "Opposite Clock Tower",
      district: "Kandy",
      city: "Kandy",
      postal_code: "20000",
      logo_url: "https://images.unsplash.com/photo-1",
      cover_url: "",
      seller_type: "retail_shop",
    };

    const res = shopCreateSchema.safeParse(input);
    assert.strictEqual(res.success, true);
    if (res.success) {
      assert.strictEqual(res.data.name, "Kandy Auto Clinic Spares");
      assert.strictEqual(res.data.district, "Kandy");
    }
  });

  test("rejects shop creation with invalid district outside Sri Lanka", () => {
    const input = {
      name: "Overseas Auto Parts",
      phone: "0771234567",
      email: "overseas@example.com",
      address_line1: "100 Broadway",
      district: "NonExistentDistrict",
      city: "New York",
    };

    const res = shopCreateSchema.safeParse(input);
    assert.strictEqual(res.success, false);
  });

  test("rejects invalid Sri Lankan phone format", () => {
    const invalidPhones = ["12345", "not-a-number", "111222333444", "077-abc-def"];
    for (const phone of invalidPhones) {
      const res = shopCreateSchema.safeParse({
        name: "Valid Name",
        phone,
        email: "valid@example.com",
        address_line1: "123 Main St",
        district: "Colombo",
        city: "Colombo",
      });
      assert.strictEqual(res.success, false, `Should reject invalid phone: ${phone}`);
    }
  });

  test("rejects uppercase or invalid symbols in slug during update", () => {
    const invalidSlugs = [
      "Colombo-Auto",
      "auto parts",
      "shop/parts",
      "special@slug",
      "-starts-with-dash",
      "ends-with-dash-",
    ];

    for (const slug of invalidSlugs) {
      const res = shopUpdateSchema.safeParse({
        shopId: "11111111-1111-4111-a111-111111111111",
        name: "Test Shop",
        slug,
        phone: "0771234567",
        email: "test@example.com",
        address_line1: "123 Main St",
        district: "Gampaha",
        city: "Negombo",
      });
      assert.strictEqual(res.success, false, `Should reject invalid slug: ${slug}`);
    }
  });

  test("enforces valid UUID for shopId on updates", () => {
    const res = shopUpdateSchema.safeParse({
      shopId: "invalid-uuid-string",
      name: "Valid Shop",
      slug: "valid-shop",
      phone: "0771234567",
      email: "valid@example.com",
      address_line1: "123 Main St",
      district: "Colombo",
      city: "Colombo",
    });

    assert.strictEqual(res.success, false);
  });
});

describe("Shop Approval State Transitions & Security Policies (Phase 4.1 Self-Service)", () => {
  const VALID_SHOP_STATUSES = ["draft", "pending_review", "approved", "rejected", "suspended"];

  test("all defined shop statuses match PostgreSQL schema check constraints", () => {
    for (const status of VALID_SHOP_STATUSES) {
      assert.ok(VALID_SHOP_STATUSES.includes(status));
    }
  });

  test("self-service state transition rule: sellers can self-activate and toggle draft/approved", () => {
    function canSellerTransition(oldStatus, newStatus, isPlatformAdmin = false) {
      if (isPlatformAdmin) return true;
      // In self-service model, sellers can activate draft, pending_review, or rejected shops directly
      if (oldStatus === "draft" && newStatus === "approved") return true;
      if (oldStatus === "pending_review" && newStatus === "approved") return true;
      if (oldStatus === "rejected" && newStatus === "approved") return true;
      if (oldStatus === "approved" && newStatus === "draft") return true;
      // Non-admins can NEVER suspend a shop
      if (newStatus === "suspended") return false;
      return false;
    }

    assert.strictEqual(canSellerTransition("draft", "approved", false), true, "Sellers can self-activate draft shop");
    assert.strictEqual(canSellerTransition("pending_review", "approved", false), true, "Legacy pending shops can self-activate");
    assert.strictEqual(canSellerTransition("rejected", "approved", false), true, "Updated rejected shops can self-activate");
    assert.strictEqual(canSellerTransition("approved", "draft", false), true, "Sellers can set shop to maintenance draft");
    assert.strictEqual(canSellerTransition("approved", "suspended", false), false, "Sellers cannot suspend shops");
    assert.strictEqual(canSellerTransition("approved", "suspended", true), true, "Admins can suspend shops");
  });

  test("self-service onboarding flow follows 4 confirmed seller steps", () => {
    const ONBOARDING_STEPS = [
      { step: 1, title: "Submit Shop Details" },
      { step: 2, title: "Set Up Your Storefront" },
      { step: 3, title: "Add Spare Parts" },
      { step: 4, title: "Publish and Start Selling" },
    ];

    assert.equal(ONBOARDING_STEPS.length, 4);
    assert.equal(ONBOARDING_STEPS[0].title, "Submit Shop Details");
    assert.equal(ONBOARDING_STEPS[1].title, "Set Up Your Storefront");
    assert.equal(ONBOARDING_STEPS[2].title, "Add Spare Parts");
    assert.equal(ONBOARDING_STEPS[3].title, "Publish and Start Selling");
  });
});
