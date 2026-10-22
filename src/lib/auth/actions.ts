"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  registerSchema,
  loginSchema,
  profileUpdateSchema,
  safeRedirectUrl,
} from "@/lib/validators/auth";

export interface AuthActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  requiresEmailVerification?: boolean;
  redirectTo?: string;
}

/**
 * Server Action: Register a new customer account
 */
export async function registerAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    fullName: formData.get("fullName")?.toString() || "",
    email: formData.get("email")?.toString() || "",
    phone: formData.get("phone")?.toString() || "",
    password: formData.get("password")?.toString() || "",
    confirmPassword: formData.get("confirmPassword")?.toString() || "",
  };

  const validation = registerSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message || "Invalid input";
    return { error: firstError };
  }

  const { fullName, email, phone, password } = validation.data;

  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone || null,
        },
      },
    });

    if (error) {
      if (
        error.message.toLowerCase().includes("already registered") ||
        error.message.toLowerCase().includes("user already exists")
      ) {
        return {
          error: "An account with this email address already exists. Please sign in instead.",
        };
      }
      return { error: error.message };
    }

    // In Supabase, if email confirmation is enabled and the user already exists,
    // identities array will be empty to prevent account enumeration.
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return {
        error: "An account with this email address already exists. Please sign in instead.",
      };
    }

    // Ensure user_profiles row exists idempotently
    if (data.user) {
      await supabase
        .from("user_profiles")
        .upsert(
          {
            id: data.user.id,
            email: data.user.email ?? email,
            full_name: fullName,
            phone: phone || null,
            role: "customer",
            roles: ["customer"],
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
    }

    const requiresEmailVerification = !data.session;

    return {
      success: true,
      requiresEmailVerification,
      message: requiresEmailVerification
        ? "Registration successful! Please check your email to verify your account before logging in."
        : "Account created successfully! Welcome to SpareHub.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected registration error occurred.";
    return { error: msg };
  }
}

/**
 * Server Action: Authenticate an existing user
 */
export async function loginAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    email: formData.get("email")?.toString() || "",
    password: formData.get("password")?.toString() || "",
  };
  const redirectTarget = formData.get("redirect")?.toString();

  const validation = loginSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message || "Invalid credentials format";
    return { error: firstError };
  }

  const { email, password } = validation.data;

  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.toLowerCase().includes("invalid login credentials")) {
        return { error: "Invalid email or password. Please try again." };
      }
      if (error.message.toLowerCase().includes("email not confirmed")) {
        return {
          error: "Your email address has not been verified yet. Please check your inbox for the confirmation link.",
        };
      }
      return { error: error.message };
    }

    if (!data.user) {
      return { error: "Authentication failed. Please try again." };
    }

    // If an explicit internal redirect was requested, validate and honor it immediately without an extra DB roundtrip
    if (redirectTarget) {
      const safe = safeRedirectUrl(redirectTarget);
      return { success: true, redirectTo: safe };
    }

    // Fetch user profile to determine default portal landing
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, roles")
      .eq("id", data.user.id)
      .maybeSingle();

    // Default redirection based on authoritative database role
    if (profile?.role === "platform_admin" || profile?.roles?.includes("platform_admin")) {
      return { success: true, redirectTo: "/admin/dashboard" };
    }

    if (profile?.role === "seller" || profile?.roles?.includes("seller")) {
      return { success: true, redirectTo: "/seller/dashboard" };
    }

    return { success: true, redirectTo: "/account" };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected login error occurred.";
    return { error: msg };
  }
}

/**
 * Server Action: Sign out the current user
 */
export async function logoutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Server Action: Update profile details for the authenticated user
 */
export async function updateProfileAction(
  prevState: AuthActionResult | null,
  formData: FormData
): Promise<AuthActionResult> {
  const rawData = {
    fullName: formData.get("fullName")?.toString() || "",
    phone: formData.get("phone")?.toString() || "",
  };

  const validation = profileUpdateSchema.safeParse(rawData);
  if (!validation.success) {
    const firstError = validation.error.issues[0]?.message || "Invalid profile data";
    return { error: firstError };
  }

  const { fullName, phone } = validation.data;

  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to update profile." };
    }

    // Strictly update non-privileged fields only
    const { error } = await supabase
      .from("user_profiles")
      .update({
        full_name: fullName,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/account");
    revalidatePath("/account/profile");

    return {
      success: true,
      message: "Your profile has been updated successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while updating profile.";
    return { error: msg };
  }
}

/**
 * Server Helper: Fetch the current authenticated user and their profile.
 * Request-memoized via React `cache()` to prevent duplicate `user_profiles` queries within the same render.
 */
const getCachedCurrentUserProfile = cache(async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    return {
      user,
      profile,
    };
  } catch {
    return null;
  }
});

export async function getCurrentUserProfile() {
  return getCachedCurrentUserProfile();
}
