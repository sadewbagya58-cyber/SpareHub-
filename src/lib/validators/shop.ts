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
    .enum(["retail_shop", "individual", "wholesaler", "importer"])
    .default("retail_shop"),
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
});

export type ShopCreateInput = z.infer<typeof shopCreateSchema>;
export type ShopUpdateInput = z.infer<typeof shopUpdateSchema>;
