import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

/**
 * Product slug generation logic
 */
function productSlugify(title, partNumber) {
  const combined = partNumber ? `${title} ${partNumber}` : title;
  return combined
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
}

/**
 * Currency conversion helpers: 100 minor units = 1.00 LKR
 */
function lkrToMinorUnits(lkr) {
  if (isNaN(lkr) || lkr < 0) return 0;
  return Math.round(lkr * 100);
}

function minorUnitsToLKR(minor) {
  if (isNaN(minor) || minor < 0) return 0;
  return minor / 100;
}

const PART_CONDITIONS = ["brand_new", "reconditioned", "used"];

const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid UUID identifier"
  );

const productImageItemSchema = z.object({
  id: uuidSchema.optional(),
  image_url: z.string().trim().url("Must be a valid image URL"),
  alt_text: z.string().trim().max(150).optional().or(z.literal("")),
  display_order: z.number().int().min(0).default(0),
  is_primary: z.boolean().default(false),
});

const productCompatibilityItemSchema = z.object({
  id: uuidSchema.optional(),
  vehicle_model_id: uuidSchema.optional().nullable(),
  vehicle_variant_id: uuidSchema.optional().nullable(),
  make_name: z.string().optional(),
  model_name: z.string().optional(),
  notes: z.string().trim().max(200).optional().nullable().or(z.literal("")),
  is_exact_fit: z.boolean().default(true),
});

const productCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Product title must be at least 2 characters")
    .max(200, "Product title cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(250)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .optional()
    .or(z.literal("")),
  brand_name: z.string().trim().min(1).max(100),
  part_number: z.string().trim().max(100).optional().or(z.literal("")),
  oem_part_number: z.string().trim().max(100).optional().or(z.literal("")),
  category_id: uuidSchema,
  description: z.string().trim().min(5).max(5000),
  condition: z.enum(PART_CONDITIONS),
  price: z.coerce.number().min(0).max(100000000),
  compare_at_price: z.coerce.number().min(0).max(100000000).optional().nullable(),
  stock_quantity: z.coerce.number().int().min(0),
  warranty_period_months: z.coerce.number().int().min(0).default(0),
  warranty_details: z.string().trim().max(500).optional().or(z.literal("")),
  is_universal: z.boolean().default(false),
  is_published: z.boolean().default(true),
  images: z.array(productImageItemSchema).max(8).default([]),
  compatibilities: z.array(productCompatibilityItemSchema).default([]),
}).refine(
  (data) => {
    if (data.compare_at_price != null && data.compare_at_price > 0) {
      return data.compare_at_price >= data.price;
    }
    return true;
  },
  {
    message: "Original compare price must be greater than or equal to selling price",
    path: ["compare_at_price"],
  }
);

describe("Phase 4.2: Product Validation & Helpers Suite", () => {
  describe("1. Slug Generation", () => {
    test("generates standard lowercase slug from title", () => {
      const slug = productSlugify("Toyota Corolla Front Brake Pads");
      assert.equal(slug, "toyota-corolla-front-brake-pads");
    });

    test("appends part number when provided", () => {
      const slug = productSlugify("Ceramic Brake Pads", "04465-02220");
      assert.equal(slug, "ceramic-brake-pads-04465-02220");
    });

    test("handles special characters, punctuation and duplicate spaces", () => {
      const slug = productSlugify("Denso Spark Plug (Iridium) -- 100% Genuine!", "SK20R11");
      assert.equal(slug, "denso-spark-plug-iridium-100-genuine-sk20r11");
    });

    test("trims leading and trailing hyphens cleanly", () => {
      const slug = productSlugify(" - Rear Shock Absorber - ");
      assert.equal(slug, "rear-shock-absorber");
    });
  });

  describe("2. Currency and Minor Unit Calculations", () => {
    test("converts exact integer LKR to minor units (cents)", () => {
      assert.equal(lkrToMinorUnits(7500), 750000);
      assert.equal(lkrToMinorUnits(2850), 285000);
    });

    test("converts fractional decimal LKR with precision rounding", () => {
      assert.equal(lkrToMinorUnits(1249.99), 124999);
      assert.equal(lkrToMinorUnits(99.50), 9950);
    });

    test("handles 0 and negative amounts safely", () => {
      assert.equal(lkrToMinorUnits(0), 0);
      assert.equal(lkrToMinorUnits(-100), 0);
    });

    test("converts minor units back to LKR", () => {
      assert.equal(minorUnitsToLKR(750000), 7500);
      assert.equal(minorUnitsToLKR(124999), 1249.99);
      assert.equal(minorUnitsToLKR(0), 0);
    });
  });

  describe("3. Product Create Schema Validation", () => {
    const validProduct = {
      title: "Front Brake Pads Set (OEM Spec)",
      slug: "front-brake-pads-set-04465-02220",
      brand_name: "Akebono",
      part_number: "04465-02220",
      oem_part_number: "04465-YZZE1",
      category_id: "c1000000-0000-0000-0000-000000000002",
      description: "Premium ceramic brake pads for Japanese vehicles.",
      condition: "brand_new",
      price: 7500,
      compare_at_price: 8500,
      stock_quantity: 12,
      warranty_period_months: 6,
      warranty_details: "6 months seller replacement warranty",
      is_universal: false,
      is_published: true,
      images: [
        {
          image_url: "https://example.com/storage/product-images/pad1.jpg",
          alt_text: "Front view",
          display_order: 0,
          is_primary: true,
        },
      ],
      compatibilities: [
        {
          vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
          notes: "Front axle only",
          is_exact_fit: true,
        },
      ],
    };

    test("accepts completely valid product payload", () => {
      const result = productCreateSchema.safeParse(validProduct);
      assert.equal(result.success, true);
    });

    test("requires product title with at least 2 characters", () => {
      const result = productCreateSchema.safeParse({
        ...validProduct,
        title: "A",
      });
      assert.equal(result.success, false);
      assert.match(result.error.issues[0].message, /at least 2 characters/i);
    });

    test("rejects invalid condition enum values", () => {
      const result = productCreateSchema.safeParse({
        ...validProduct,
        condition: "salvaged_junk",
      });
      assert.equal(result.success, false);
    });

    test("accepts all three valid conditions: brand_new, reconditioned, used", () => {
      for (const cond of PART_CONDITIONS) {
        const result = productCreateSchema.safeParse({
          ...validProduct,
          condition: cond,
        });
        assert.equal(result.success, true);
      }
    });

    test("rejects negative price and negative stock", () => {
      const negPrice = productCreateSchema.safeParse({
        ...validProduct,
        price: -50,
      });
      assert.equal(negPrice.success, false);

      const negStock = productCreateSchema.safeParse({
        ...validProduct,
        stock_quantity: -1,
      });
      assert.equal(negStock.success, false);
    });

    test("rejects compare_at_price that is less than selling price", () => {
      const result = productCreateSchema.safeParse({
        ...validProduct,
        price: 10000,
        compare_at_price: 8000, // lower than price
      });
      assert.equal(result.success, false);
      assert.match(
        result.error.issues[0].message,
        /greater than or equal to selling price/i
      );
    });

    test("enforces maximum 8 images limit", () => {
      const tooManyImages = Array.from({ length: 9 }, (_, i) => ({
        image_url: `https://example.com/img${i}.jpg`,
        display_order: i,
        is_primary: i === 0,
      }));

      const result = productCreateSchema.safeParse({
        ...validProduct,
        images: tooManyImages,
      });
      assert.equal(result.success, false);
    });

    test("defaults is_published to true for self-service immediate publication", () => {
      const withoutPublish = { ...validProduct };
      delete withoutPublish.is_published;
      const parsed = productCreateSchema.parse(withoutPublish);
      assert.equal(parsed.is_published, true);
    });
  });
});
