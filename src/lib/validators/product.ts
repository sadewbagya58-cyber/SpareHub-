import { z } from "zod";

/**
 * Converts part title and optional part number into a clean, URL-safe slug.
 */
export function productSlugify(title: string, partNumber?: string): string {
  const combined = partNumber ? `${title} ${partNumber}` : title;
  return combined
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove non-word chars
    .replace(/\-\-+/g, "-") // Collapse multiple hyphens
    .replace(/^-+/, "") // Trim leading hyphen
    .replace(/-+$/, ""); // Trim trailing hyphen
}

/**
 * Currency conversion helpers: 100 minor units = 1.00 LKR
 */
export function lkrToMinorUnits(lkr: number): number {
  if (isNaN(lkr) || lkr < 0) return 0;
  return Math.round(lkr * 100);
}

export function minorUnitsToLKR(minor: number): number {
  if (isNaN(minor) || minor < 0) return 0;
  return minor / 100;
}

export const PART_CONDITIONS = ["brand_new", "reconditioned", "used"] as const;
export type PartCondition = (typeof PART_CONDITIONS)[number];

export const PRODUCT_STATUSES = ["active", "out_of_stock", "archived"] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const uuidSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid UUID identifier"
  );

export const productImageItemSchema = z.object({
  id: uuidSchema.optional(),
  image_url: z.string().trim().url("Must be a valid image URL"),
  alt_text: z.string().trim().max(150, "Alt text too long").optional().nullable().or(z.literal("")),
  display_order: z.number().int().min(0).default(0),
  is_primary: z.boolean().default(false),
});

export const productCompatibilityItemSchema = z
  .object({
    id: uuidSchema.optional(),
    vehicle_type_id: z.string().trim().min(1).optional().nullable(),
    vehicle_type_name: z.string().trim().optional().nullable(),
    make_id: uuidSchema.optional().nullable(),
    make_name: z.string().trim().optional().nullable(),
    vehicle_model_id: uuidSchema.optional().nullable(),
    model_name: z.string().trim().optional().nullable(),
    vehicle_variant_id: uuidSchema.optional().nullable(),
    variant_label: z.string().trim().optional().nullable(),
    generation_chassis: z.string().trim().optional().nullable(),
    year_start: z.number().int().min(1950).max(2100).optional().nullable(),
    year_end: z.number().int().min(1950).max(2100).optional().nullable(),
    engine_code: z.string().trim().optional().nullable(),
    transmission: z.string().trim().optional().nullable(),
    fuel_type: z.string().trim().optional().nullable(),
    notes: z
      .string()
      .trim()
      .max(200, "Notes cannot exceed 200 characters")
      .optional()
      .nullable()
      .or(z.literal("")),
    is_exact_fit: z.boolean().default(true),
  })
  .refine(
    (item) => Boolean(item.vehicle_model_id || item.vehicle_variant_id),
    {
      message:
        "Each vehicle compatibility entry must specify a valid vehicle model or variant.",
    }
  );

export const productCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(2, "Product title must be at least 2 characters")
    .max(200, "Product title cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(250, "Slug cannot exceed 250 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional()
    .or(z.literal("")),
  brand_name: z
    .string()
    .trim()
    .min(1, "Brand name is required")
    .max(100, "Brand name cannot exceed 100 characters"),
  part_number: z
    .string()
    .trim()
    .max(100, "Part number cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  oem_part_number: z
    .string()
    .trim()
    .max(100, "OEM part number cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  category_id: uuidSchema,
  description: z
    .string()
    .trim()
    .min(5, "Product description must be at least 5 characters")
    .max(5000, "Product description cannot exceed 5,000 characters"),
  condition: z.enum(PART_CONDITIONS, {
    error: "Condition must be brand_new, reconditioned, or used",
  }),
  price: z.coerce
    .number()
    .min(0, "Price cannot be negative")
    .max(100000000, "Price exceeds maximum threshold"),
  compare_at_price: z.coerce
    .number()
    .min(0, "Compare price cannot be negative")
    .max(100000000, "Compare price exceeds maximum threshold")
    .optional()
    .nullable(),
  stock_quantity: z.coerce
    .number()
    .int("Stock quantity must be a whole number")
    .min(0, "Stock cannot be negative"),
  warranty_period_months: z.coerce
    .number()
    .int("Warranty period must be whole number")
    .min(0, "Warranty cannot be negative")
    .default(0),
  warranty_details: z
    .string()
    .trim()
    .max(500, "Warranty details cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
  is_universal: z.boolean().default(false),
  is_published: z.boolean().default(true),
  images: z.array(productImageItemSchema).max(8, "Maximum 8 images allowed").default([]),
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

export const productUpdateSchema = z.object({
  productId: uuidSchema,
  title: z
    .string()
    .trim()
    .min(2, "Product title must be at least 2 characters")
    .max(200, "Product title cannot exceed 200 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .max(250, "Slug cannot exceed 250 characters")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  brand_name: z
    .string()
    .trim()
    .min(1, "Brand name is required")
    .max(100, "Brand name cannot exceed 100 characters"),
  part_number: z
    .string()
    .trim()
    .max(100, "Part number cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  oem_part_number: z
    .string()
    .trim()
    .max(100, "OEM part number cannot exceed 100 characters")
    .optional()
    .or(z.literal("")),
  category_id: uuidSchema,
  description: z
    .string()
    .trim()
    .min(5, "Product description must be at least 5 characters")
    .max(5000, "Product description cannot exceed 5,000 characters"),
  condition: z.enum(PART_CONDITIONS),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  compare_at_price: z.coerce.number().min(0).optional().nullable(),
  stock_quantity: z.coerce.number().int().min(0, "Stock cannot be negative"),
  warranty_period_months: z.coerce.number().int().min(0).default(0),
  warranty_details: z.string().trim().max(500).optional().or(z.literal("")),
  is_universal: z.boolean().default(false),
  is_published: z.boolean().default(true),
  status: z.enum(PRODUCT_STATUSES).default("active"),
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

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
export type ProductImageItem = z.infer<typeof productImageItemSchema>;
export type ProductCompatibilityItem = z.infer<typeof productCompatibilityItemSchema>;

export interface TaxonomyValidationLookup {
  vehicleTypes?: Array<{ id: string; name: string }>;
  vehicleMakes: Array<{ id: string; vehicle_type_id: string; name: string }>;
  vehicleModels: Array<{ id: string; make_id: string; name: string }>;
  vehicleVariants: Array<{
    id: string;
    model_id: string;
    generation_chassis: string;
    year_start: number;
    year_end?: number | null;
    engine_code?: string | null;
    transmission?: string | null;
    fuel_type?: string | null;
  }>;
}

export interface NormalizedCompatibilityRecord {
  vehicle_model_id: string;
  vehicle_variant_id: string | null;
  notes: string | null;
  is_exact_fit: boolean;
}

export interface CompatibilityValidationResult {
  valid: boolean;
  error?: string;
  normalized: NormalizedCompatibilityRecord[];
}

/**
 * Validates an array of vehicle compatibility items against the 4-level vehicle taxonomy
 * (`Vehicle Type -> Make -> Model -> Variant`), rejecting invalid hierarchy combinations,
 * missing identifiers, and duplicate entries for the same product.
 */
export function validateCompatibilityEntries(
  compatibilities: ProductCompatibilityItem[],
  isUniversal: boolean,
  taxonomy: TaxonomyValidationLookup
): CompatibilityValidationResult {
  if (isUniversal) {
    return { valid: true, normalized: [] };
  }

  const seenKeys = new Set<string>();
  const normalized: NormalizedCompatibilityRecord[] = [];

  for (const item of compatibilities) {
    let modelId = item.vehicle_model_id || null;
    const variantId = item.vehicle_variant_id || null;

    if (!modelId && !variantId) {
      return {
        valid: false,
        error:
          "Each vehicle compatibility entry must specify a valid vehicle model or variant.",
        normalized: [],
      };
    }

    if (variantId) {
      const variant = taxonomy.vehicleVariants.find((v) => v.id === variantId);
      if (!variant) {
        return {
          valid: false,
          error: "Selected vehicle variant does not exist.",
          normalized: [],
        };
      }

      if (modelId && variant.model_id !== modelId) {
        return {
          valid: false,
          error:
            "Selected vehicle variant does not belong to the selected vehicle model.",
          normalized: [],
        };
      }

      modelId = variant.model_id;
    }

    if (!modelId) {
      return {
        valid: false,
        error: "Selected vehicle model does not exist.",
        normalized: [],
      };
    }

    const model = taxonomy.vehicleModels.find((m) => m.id === modelId);
    if (!model) {
      return {
        valid: false,
        error: "Selected vehicle model does not exist.",
        normalized: [],
      };
    }

    if (item.make_id && model.make_id !== item.make_id) {
      return {
        valid: false,
        error:
          "Selected vehicle model does not belong to the selected vehicle make.",
        normalized: [],
      };
    }

    const make = taxonomy.vehicleMakes.find((mk) => mk.id === model.make_id);
    if (!make) {
      return {
        valid: false,
        error: "Selected vehicle make does not exist.",
        normalized: [],
      };
    }

    if (item.vehicle_type_id && make.vehicle_type_id !== item.vehicle_type_id) {
      return {
        valid: false,
        error:
          "Selected vehicle make does not belong to the selected vehicle type.",
        normalized: [],
      };
    }

    const dedupeKey = variantId ? `variant:${variantId}` : `model:${modelId}`;
    if (seenKeys.has(dedupeKey)) {
      return {
        valid: false,
        error:
          "Duplicate vehicle compatibility entry detected for the same vehicle model/variant.",
        normalized: [],
      };
    }
    seenKeys.add(dedupeKey);

    normalized.push({
      vehicle_model_id: modelId,
      vehicle_variant_id: variantId,
      notes: item.notes?.trim() ? item.notes.trim() : null,
      is_exact_fit: item.is_exact_fit ?? true,
    });
  }

  return {
    valid: true,
    normalized,
  };
}

/**
 * Formats a vehicle variant year range for UI display (e.g., "2009–2015" or "2018–Present").
 */
export function formatVariantYearRange(
  yearStart?: number | null,
  yearEnd?: number | null
): string {
  if (!yearStart) return "";
  return yearEnd ? `${yearStart}–${yearEnd}` : `${yearStart}–Present`;
}

/**
 * Formats a concise human-readable label for a vehicle variant option.
 */
export function formatVariantLabel(variant: {
  generation_chassis?: string | null;
  year_start: number;
  year_end?: number | null;
  engine_code?: string | null;
  fuel_type?: string | null;
}): string {
  const yearRange = formatVariantYearRange(variant.year_start, variant.year_end);
  const parts: string[] = [];
  if (variant.generation_chassis) {
    parts.push(variant.generation_chassis);
  }
  if (yearRange) {
    parts.push(`(${yearRange})`);
  }
  if (variant.engine_code && !variant.generation_chassis?.includes(variant.engine_code)) {
    parts.push(`• ${variant.engine_code}`);
  }
  return parts.join(" ") || `Model Year ${yearRange}`;
}


