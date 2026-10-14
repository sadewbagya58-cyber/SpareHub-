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

export const productCompatibilityItemSchema = z.object({
  id: uuidSchema.optional(),
  vehicle_model_id: uuidSchema.optional().nullable(),
  vehicle_variant_id: uuidSchema.optional().nullable(),
  make_name: z.string().optional(),
  model_name: z.string().optional(),
  notes: z.string().trim().max(200, "Notes cannot exceed 200 characters").optional().nullable().or(z.literal("")),
  is_exact_fit: z.boolean().default(true),
});

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
