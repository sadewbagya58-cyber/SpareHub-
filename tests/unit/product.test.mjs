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

  describe("4. Phase 4.3: 4-Level Vehicle Compatibility & Hierarchy Validation", () => {
    const sampleTaxonomy = {
      types: [
        { id: "car", name: "Cars & SUVs", display_order: 1 },
        { id: "three_wheeler", name: "Three-Wheelers", display_order: 2 },
      ],
      makes: [
        { id: "b1000000-0000-0000-0000-000000000001", vehicle_type_id: "car", name: "Toyota", slug: "toyota", is_popular: true },
        { id: "b1000000-0000-0000-0000-000000000002", vehicle_type_id: "car", name: "Honda", slug: "honda", is_popular: true },
        { id: "b1000000-0000-0000-0000-000000000006", vehicle_type_id: "three_wheeler", name: "Bajaj", slug: "bajaj-three-wheeler", is_popular: true },
      ],
      models: [
        { id: "d1000000-0000-0000-0000-000000000001", make_id: "b1000000-0000-0000-0000-000000000001", name: "Corolla", slug: "corolla" },
        { id: "d1000000-0000-0000-0000-000000000002", make_id: "b1000000-0000-0000-0000-000000000001", name: "Prius", slug: "prius" },
        { id: "d1000000-0000-0000-0000-000000000007", make_id: "b1000000-0000-0000-0000-000000000002", name: "Civic", slug: "civic" },
        { id: "d1000000-0000-0000-0000-000000000016", make_id: "b1000000-0000-0000-0000-000000000006", name: "RE 205 (4-Stroke)", slug: "re-205-4s" },
      ],
      variants: [
        {
          id: "e1000000-0000-0000-0000-000000000002",
          model_id: "d1000000-0000-0000-0000-000000000001",
          generation_chassis: "NZE121 (1NZ-FE 1.5L)",
          year_start: 2000,
          year_end: 2006,
          engine_code: "1NZ-FE",
          transmission: "Automatic / Manual",
          fuel_type: "petrol",
        },
        {
          id: "e1000000-0000-0000-0000-000000000004",
          model_id: "d1000000-0000-0000-0000-000000000002",
          generation_chassis: "ZVW30 (3rd Gen Hybrid)",
          year_start: 2009,
          year_end: 2015,
          engine_code: "2ZR-FXE 1.8L",
          transmission: "e-CVT",
          fuel_type: "hybrid",
        },
        {
          id: "e1000000-0000-0000-0000-000000000027",
          model_id: "d1000000-0000-0000-0000-000000000016",
          generation_chassis: "RE Compact 4S FL / BS6",
          year_start: 2014,
          year_end: null,
          engine_code: "DTS-i 198cc",
          transmission: "4-Speed Manual",
          fuel_type: "petrol",
        },
      ],
    };

    function formatVariantYearRange(yearStart, yearEnd) {
      return yearEnd ? `${yearStart}–${yearEnd}` : `${yearStart}–Present`;
    }

    function formatVariantLabel(v) {
      const yearStr = formatVariantYearRange(v.year_start, v.year_end);
      const chassis = v.generation_chassis || "Standard Variant";
      return `${chassis} (${yearStr})`;
    }

    function validateCompatibilityEntries(compatibilities, isUniversal, taxonomy) {
      if (isUniversal) {
        return { valid: true, normalized: [] };
      }

      const modelMap = new Map(taxonomy.models.map((m) => [m.id, m]));
      const makeMap = new Map(taxonomy.makes.map((m) => [m.id, m]));
      const variantMap = new Map(taxonomy.variants.map((v) => [v.id, v]));

      const seenKeys = new Set();
      const normalized = [];

      for (let i = 0; i < compatibilities.length; i++) {
        const entry = compatibilities[i];
        const modelId = entry.vehicle_model_id || null;
        const variantId = entry.vehicle_variant_id || null;

        if (!modelId && !variantId) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1} must specify at least a vehicle model or variant.`,
          };
        }

        let resolvedModelId = modelId;

        if (variantId) {
          const variant = variantMap.get(variantId);
          if (!variant) {
            return {
              valid: false,
              error: `Compatibility entry #${i + 1} references an invalid or unknown vehicle variant.`,
            };
          }
          if (resolvedModelId && variant.model_id !== resolvedModelId) {
            return {
              valid: false,
              error: `Compatibility entry #${i + 1}: Selected variant "${variant.generation_chassis}" does not belong to the selected vehicle model.`,
            };
          }
          resolvedModelId = variant.model_id;
        }

        if (!resolvedModelId) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1} is missing a valid vehicle model.`,
          };
        }

        const model = modelMap.get(resolvedModelId);
        if (!model) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1} references an invalid or unknown vehicle model.`,
          };
        }

        const make = makeMap.get(model.make_id);
        if (!make) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1} references a vehicle model with an invalid make.`,
          };
        }

        if (entry.make_id && entry.make_id !== make.id) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1}: Model "${model.name}" does not belong to the selected make.`,
          };
        }

        if (entry.vehicle_type_id && entry.vehicle_type_id !== make.vehicle_type_id) {
          return {
            valid: false,
            error: `Compatibility entry #${i + 1}: Make "${make.name}" does not belong to the selected vehicle type.`,
          };
        }

        const dedupeKey = variantId ? `variant:${variantId}` : `model:${resolvedModelId}`;
        if (seenKeys.has(dedupeKey)) {
          return {
            valid: false,
            error: `Duplicate vehicle compatibility entry detected for ${make.name} ${model.name}.`,
          };
        }
        seenKeys.add(dedupeKey);

        normalized.push({
          ...entry,
          vehicle_model_id: resolvedModelId,
          vehicle_variant_id: variantId,
        });
      }

      return { valid: true, normalized };
    }

    test("formats variant labels and year ranges accurately", () => {
      assert.strictEqual(
        formatVariantLabel(sampleTaxonomy.variants[0]),
        "NZE121 (1NZ-FE 1.5L) (2000–2006)"
      );
      assert.strictEqual(
        formatVariantLabel(sampleTaxonomy.variants[2]),
        "RE Compact 4S FL / BS6 (2014–Present)"
      );
    });

    test("cascading filter narrows makes by type, models by make, and variants by model", () => {
      const carMakes = sampleTaxonomy.makes.filter((m) => m.vehicle_type_id === "car");
      assert.strictEqual(carMakes.length, 2);

      const toyotaModels = sampleTaxonomy.models.filter(
        (m) => m.make_id === "b1000000-0000-0000-0000-000000000001"
      );
      assert.strictEqual(toyotaModels.length, 2);

      const corollaVariants = sampleTaxonomy.variants.filter(
        (v) => v.model_id === "d1000000-0000-0000-0000-000000000001"
      );
      assert.strictEqual(corollaVariants.length, 1);
      assert.strictEqual(corollaVariants[0].generation_chassis, "NZE121 (1NZ-FE 1.5L)");
    });

    test("accepts valid 4-level (Type -> Make -> Model -> Variant) and 3-level (All Variants) entries", () => {
      const res = validateCompatibilityEntries(
        [
          {
            vehicle_type_id: "car",
            make_id: "b1000000-0000-0000-0000-000000000001",
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
            vehicle_variant_id: "e1000000-0000-0000-0000-000000000002",
            notes: "Front disc brake pads only",
            is_exact_fit: true,
          },
          {
            vehicle_type_id: "car",
            make_id: "b1000000-0000-0000-0000-000000000002",
            vehicle_model_id: "d1000000-0000-0000-0000-000000000007",
            vehicle_variant_id: null,
            notes: "Fits all Honda Civic generations",
            is_exact_fit: false,
          },
        ],
        false,
        sampleTaxonomy
      );
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized.length, 2);
    });

    test("rejects mismatched variant that does not belong to selected model", () => {
      const res = validateCompatibilityEntries(
        [
          {
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001", // Corolla
            vehicle_variant_id: "e1000000-0000-0000-0000-000000000004", // Prius ZVW30 variant!
            is_exact_fit: true,
          },
        ],
        false,
        sampleTaxonomy
      );
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /does not belong to the selected vehicle model/i);
    });

    test("rejects mismatched model that does not belong to selected make", () => {
      const res = validateCompatibilityEntries(
        [
          {
            make_id: "b1000000-0000-0000-0000-000000000002", // Honda
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001", // Toyota Corolla!
            is_exact_fit: true,
          },
        ],
        false,
        sampleTaxonomy
      );
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /does not belong to the selected make/i);
    });

    test("rejects duplicate compatibility entries for the same product", () => {
      const res = validateCompatibilityEntries(
        [
          {
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
            vehicle_variant_id: "e1000000-0000-0000-0000-000000000002",
            is_exact_fit: true,
          },
          {
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
            vehicle_variant_id: "e1000000-0000-0000-0000-000000000002",
            is_exact_fit: false,
          },
        ],
        false,
        sampleTaxonomy
      );
      assert.strictEqual(res.valid, false);
      assert.match(res.error, /Duplicate vehicle compatibility entry/i);
    });

    test("clears compatibility entries when is_universal is true", () => {
      const res = validateCompatibilityEntries(
        [
          {
            vehicle_model_id: "d1000000-0000-0000-0000-000000000001",
            vehicle_variant_id: "e1000000-0000-0000-0000-000000000002",
            is_exact_fit: true,
          },
        ],
        true,
        sampleTaxonomy
      );
      assert.strictEqual(res.valid, true);
      assert.strictEqual(res.normalized.length, 0);
    });
  });

  describe("5. Vehicle Taxonomy Hex UUID Format & Foreign Key Integrity", () => {
    test("all fallback vehicle taxonomy records have valid hex UUIDs and intact hierarchy", async () => {
      const fs = await import("node:fs");
      const path = await import("node:path");

      const taxonomyFilePath = path.resolve(process.cwd(), "src/lib/products/taxonomy.ts");
      const fileContent = fs.readFileSync(taxonomyFilePath, "utf-8");

      const makesMatch = fileContent.match(/export const FALLBACK_VEHICLE_MAKES[^=]*=\s*(\[[^;]+\]);/);
      const modelsMatch = fileContent.match(/export const FALLBACK_VEHICLE_MODELS[^=]*=\s*(\[[^;]+\]);/);
      const variantsMatch = fileContent.match(/export const FALLBACK_VEHICLE_VARIANTS[^=]*=\s*(\[[^;]+\]);/);

      assert.ok(makesMatch, "Must extract FALLBACK_VEHICLE_MAKES");
      assert.ok(modelsMatch, "Must extract FALLBACK_VEHICLE_MODELS");
      assert.ok(variantsMatch, "Must extract FALLBACK_VEHICLE_VARIANTS");

      const makes = eval(makesMatch[1]);
      const models = eval(modelsMatch[1]);
      const variants = eval(variantsMatch[1]);

      const uuidHexRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

      // 1. Check makes
      assert.strictEqual(makes.length, 21, "Must contain exactly 21 Sri Lankan vehicle makes");
      const makeIds = new Set();
      for (const make of makes) {
        assert.ok(
          uuidHexRegex.test(make.id),
          `Make ID ${make.id} (${make.name}) must be a valid hex UUID (e.g. b1000000-...)`
        );
        assert.ok(!make.id.startsWith("m"), `Make ID ${make.id} must not start with non-hex 'm'`);
        makeIds.add(make.id);
      }

      // 2. Check models
      assert.strictEqual(models.length, 40, "Must contain exactly 40 popular vehicle models");
      const modelIds = new Set();
      for (const model of models) {
        assert.ok(
          uuidHexRegex.test(model.id),
          `Model ID ${model.id} (${model.name}) must be a valid hex UUID (e.g. d1000000-...)`
        );
        assert.ok(
          makeIds.has(model.make_id),
          `Model ${model.name} references unknown make_id: ${model.make_id}`
        );
        modelIds.add(model.id);
      }

      // 3. Check variants
      assert.strictEqual(variants.length, 50, "Must contain exactly 50 localized variants");
      for (const variant of variants) {
        assert.ok(
          uuidHexRegex.test(variant.id),
          `Variant ID ${variant.id} (${variant.generation_chassis}) must be a valid hex UUID (e.g. e1000000-...)`
        );
        assert.ok(!variant.id.startsWith("v"), `Variant ID ${variant.id} must not start with non-hex 'v'`);
        assert.ok(
          modelIds.has(variant.model_id),
          `Variant ${variant.generation_chassis} references unknown model_id: ${variant.model_id}`
        );
        assert.ok(
          ["petrol", "diesel", "electric", "hybrid", "cng"].includes(variant.fuel_type),
          `Variant ${variant.generation_chassis} has normalized lowercase fuel_type: ${variant.fuel_type}`
        );
      }
    });
  });
});

