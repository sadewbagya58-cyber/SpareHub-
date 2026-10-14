import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";

/**
 * Mirror of password validation logic for unit testing
 */
const passwordValidation = z
  .string()
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password cannot exceed 72 characters")
  .regex(/[A-Z]/, "Password must include at least one uppercase letter")
  .regex(/[a-z]/, "Password must include at least one lowercase letter")
  .regex(/[0-9]/, "Password must include at least one number");

const phoneValidation = z
  .string()
  .trim()
  .regex(
    /^(?:(?:\+?94)|0)?(?:7\d{8}|[1-689]\d{8})$|^$/,
    "Please enter a valid phone number"
  )
  .optional()
  .or(z.literal(""));

const registerSchema = z
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

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

const profileUpdateSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name cannot exceed 100 characters")
    .regex(/^[\p{L}\s.'-]+$/u, "Full name contains invalid characters"),
  phone: phoneValidation,
});

/**
 * Open-redirect sanitizer matching src/lib/validators/auth.ts
 */
function safeRedirectUrl(url, defaultUrl = "/") {
  if (!url || typeof url !== "string") {
    return defaultUrl;
  }

  const trimmed = url.trim();

  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return defaultUrl;
  }

  if (trimmed.includes("\\")) {
    return defaultUrl;
  }

  if (/[\r\n\0]|javascript:|data:|vbscript:/i.test(trimmed)) {
    return defaultUrl;
  }

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

describe("Authentication & Registration Validation", () => {
  test("accepts valid registration input with Sri Lankan mobile phone", () => {
    const input = {
      fullName: "Kasun Perera",
      email: "Kasun.Perera@Example.COM",
      phone: "0771234567",
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.email, "kasun.perera@example.com");
      assert.strictEqual(result.data.fullName, "Kasun Perera");
    }
  });

  test("accepts valid registration without phone number (optional)", () => {
    const input = {
      fullName: "Nimal Silva",
      email: "nimal@example.com",
      password: "SecurePassword99",
      confirmPassword: "SecurePassword99",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, true);
  });

  test("rejects password shorter than 8 characters", () => {
    const input = {
      fullName: "Kasun Perera",
      email: "kasun@example.com",
      password: "Short1",
      confirmPassword: "Short1",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, false);
    const issues = result.error.issues.map((i) => i.message);
    assert.ok(issues.some((m) => m.includes("at least 8 characters")));
  });

  test("rejects password lacking uppercase character", () => {
    const input = {
      fullName: "Kasun Perera",
      email: "kasun@example.com",
      password: "password123",
      confirmPassword: "password123",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, false);
    const issues = result.error.issues.map((i) => i.message);
    assert.ok(issues.some((m) => m.includes("uppercase letter")));
  });

  test("rejects password lacking numeric character", () => {
    const input = {
      fullName: "Kasun Perera",
      email: "kasun@example.com",
      password: "PasswordWithoutNumber",
      confirmPassword: "PasswordWithoutNumber",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, false);
    const issues = result.error.issues.map((i) => i.message);
    assert.ok(issues.some((m) => m.includes("at least one number")));
  });

  test("rejects password confirmation mismatch", () => {
    const input = {
      fullName: "Kasun Perera",
      email: "kasun@example.com",
      password: "StrongPassword123",
      confirmPassword: "DifferentPassword123",
    };

    const result = registerSchema.safeParse(input);
    assert.strictEqual(result.success, false);
    const issues = result.error.issues.map((i) => i.message);
    assert.ok(issues.some((m) => m.includes("Passwords do not match")));
  });

  test("rejects invalid email formats", () => {
    const invalidEmails = [
      "not-an-email",
      "missing-at.com",
      "@nodomain.com",
      "spaces in@email.com",
    ];

    for (const email of invalidEmails) {
      const result = registerSchema.safeParse({
        fullName: "Test User",
        email,
        password: "ValidPassword123",
        confirmPassword: "ValidPassword123",
      });
      assert.strictEqual(result.success, false, `Failed to reject invalid email: ${email}`);
    }
  });

  test("rejects fullName with script injection or invalid symbols", () => {
    const invalidNames = [
      "<script>alert(1)</script>",
      "Kasun123",
      "A",
      "Robert); DROP TABLE users;--",
    ];

    for (const fullName of invalidNames) {
      const result = registerSchema.safeParse({
        fullName,
        email: "valid@example.com",
        password: "ValidPassword123",
        confirmPassword: "ValidPassword123",
      });
      assert.strictEqual(result.success, false, `Should reject unsafe name: ${fullName}`);
    }
  });
});

describe("Login Validation", () => {
  test("accepts valid login credentials and normalizes email", () => {
    const result = loginSchema.safeParse({
      email: "  User@SpareHub.LK  ",
      password: "SecretPassword123",
    });

    assert.strictEqual(result.success, true);
    if (result.success) {
      assert.strictEqual(result.data.email, "user@sparehub.lk");
    }
  });

  test("rejects empty password on login", () => {
    const result = loginSchema.safeParse({
      email: "user@sparehub.lk",
      password: "",
    });

    assert.strictEqual(result.success, false);
  });
});

describe("Profile Update Validation", () => {
  test("accepts valid full name and international format phone", () => {
    const result = profileUpdateSchema.safeParse({
      fullName: "Nimal Perera",
      phone: "+94771234567",
    });

    assert.strictEqual(result.success, true);
  });

  test("rejects malformed phone numbers", () => {
    const result = profileUpdateSchema.safeParse({
      fullName: "Nimal Perera",
      phone: "invalid-phone-string",
    });

    assert.strictEqual(result.success, false);
  });
});

describe("Open-Redirect Vulnerability Defense (safeRedirectUrl)", () => {
  test("allows legitimate relative application paths", () => {
    assert.strictEqual(safeRedirectUrl("/account"), "/account");
    assert.strictEqual(safeRedirectUrl("/seller/dashboard"), "/seller/dashboard");
    assert.strictEqual(safeRedirectUrl("/search?q=toyota+corolla#results"), "/search?q=toyota+corolla#results");
    assert.strictEqual(safeRedirectUrl("/cart"), "/cart");
  });

  test("blocks protocol-relative URL bypasses (//evil.com)", () => {
    assert.strictEqual(safeRedirectUrl("//evil.com"), "/");
    assert.strictEqual(safeRedirectUrl("//google.com/phish"), "/");
  });

  test("blocks backslash URL bypasses (/\\evil.com)", () => {
    assert.strictEqual(safeRedirectUrl("/\\evil.com"), "/");
    assert.strictEqual(safeRedirectUrl("\\\\evil.com"), "/");
  });

  test("blocks absolute external URLs", () => {
    assert.strictEqual(safeRedirectUrl("https://evil.com"), "/");
    assert.strictEqual(safeRedirectUrl("http://phishing.site/login"), "/");
    assert.strictEqual(safeRedirectUrl("ftp://files.org"), "/");
  });

  test("blocks javascript: and dangerous URI schemes", () => {
    assert.strictEqual(safeRedirectUrl("javascript:alert(document.cookie)"), "/");
    assert.strictEqual(safeRedirectUrl("/javascript:alert(1)"), "/");
    assert.strictEqual(safeRedirectUrl("data:text/html,<script>alert(1)</script>"), "/");
  });

  test("blocks carriage return, line feed, and null-byte injection", () => {
    assert.strictEqual(safeRedirectUrl("/account\r\nSet-Cookie:admin=true"), "/");
    assert.strictEqual(safeRedirectUrl("/account\0evil"), "/");
  });

  test("handles null, undefined, empty, and non-string inputs safely", () => {
    assert.strictEqual(safeRedirectUrl(null), "/");
    assert.strictEqual(safeRedirectUrl(undefined), "/");
    assert.strictEqual(safeRedirectUrl(""), "/");
    assert.strictEqual(safeRedirectUrl(123), "/");
    assert.strictEqual(safeRedirectUrl({}, "/fallback"), "/fallback");
  });
});
