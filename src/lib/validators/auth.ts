import { z } from "zod";

/**
 * Validates password strength:
 * - At least 8 characters
 * - At least 1 uppercase letter
 * - At least 1 lowercase letter
 * - At least 1 number
 */
const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password cannot exceed 72 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

/**
 * Phone number validation for Sri Lankan (+94 / 0) and international formats.
 */
const phoneValidation = z
  .string()
  .trim()
  .regex(
    /^(?:(?:\+?94)|0)?(?:7\d{8}|[1-689]\d{8})$|^$/,
    "Please enter a valid phone number (e.g., 0771234567 or +94771234567)"
  )
  .optional()
  .or(z.literal(""));

/**
 * Customer Registration Schema
 */
export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name cannot exceed 100 characters")
      .regex(/^[\p{L}\s.'-]+$/u, "Full name contains invalid characters"),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Please enter a valid email address")
      .max(255, "Email address is too long"),
    phone: phoneValidation,
    password: passwordValidation,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * User Login Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * User Profile Update Schema
 */
export const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters")
    .regex(/^[\p{L}\s.'-]+$/u, "Full name contains invalid characters"),
  phone: phoneValidation,
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Sanitizes and validates internal redirect paths to prevent Open-Redirect vulnerabilities.
 * Guarantees the redirect remains strictly within the same application origin.
 */
export function safeRedirectUrl(
  url: string | null | undefined,
  defaultUrl: string = "/"
): string {
  if (!url || typeof url !== "string") {
    return defaultUrl;
  }

  const trimmed = url.trim();

  // Must begin with a single slash, not a double slash (protocol-relative)
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return defaultUrl;
  }

  // Reject URLs containing backslashes (often used to bypass origin checks)
  if (trimmed.includes("\\")) {
    return defaultUrl;
  }

  // Reject URLs with encoded control characters, null bytes, or protocol schemes
  if (/[\r\n\0]|javascript:|data:|vbscript:/i.test(trimmed)) {
    return defaultUrl;
  }

  // Reject external URI schemes
  try {
    const dummyBase = "http://localhost";
    const parsed = new URL(trimmed, dummyBase);
    if (parsed.origin !== dummyBase) {
      return defaultUrl;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return defaultUrl;
  }
}
