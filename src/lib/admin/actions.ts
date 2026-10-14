"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AdminActionResult {
  success?: boolean;
  error?: string;
  message?: string;
}

/**
 * Server Action: Platform Administrator approves a vendor shop.
 * Enforces admin role check and updates approval audit fields.
 */
export async function approveShopAction(shopId: string): Promise<AdminActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    // Verify platform_admin role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, roles")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "platform_admin" ||
      profile?.roles?.includes("platform_admin");

    if (!isAdmin) {
      return { error: "Unauthorized: Platform administrator privileges required." };
    }

    // Update shop status and audit ledger fields
    const { error } = await supabase
      .from("shops")
      .update({
        status: "approved",
        status_reason: null,
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");

    return {
      success: true,
      message: "Vendor shop approved successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve shop.";
    return { error: msg };
  }
}

/**
 * Server Action: Platform Administrator rejects a vendor shop application with reason.
 */
export async function rejectShopAction(
  shopId: string,
  reason: string
): Promise<AdminActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    // Verify platform_admin role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, roles")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "platform_admin" ||
      profile?.roles?.includes("platform_admin");

    if (!isAdmin) {
      return { error: "Unauthorized: Platform administrator privileges required." };
    }

    if (!reason || reason.trim().length < 5) {
      return { error: "Please provide a descriptive reason for rejecting the application (at least 5 characters)." };
    }

    // Update shop status with rejection reason
    const { error } = await supabase
      .from("shops")
      .update({
        status: "rejected",
        status_reason: reason.trim(),
        approved_by: user.id,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");

    return {
      success: true,
      message: "Vendor shop application rejected.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reject shop.";
    return { error: msg };
  }
}
