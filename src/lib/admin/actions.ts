"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  VERIFICATION_DOCUMENTS_BUCKET,
  canTransitionShopVerificationStatus,
  type ShopVerificationStatus,
} from "@/lib/validators/shop";
import type { SellerVerificationDocumentRecord } from "@/lib/seller/actions";

export interface AdminActionResult {
  success?: boolean;
  error?: string;
  message?: string;
}

async function verifyPlatformAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, isAdmin: false, error: "Authentication required." };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, roles")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin =
    profile?.role === "platform_admin" ||
    Boolean(profile?.roles?.includes("platform_admin"));

  if (!isAdmin) {
    return {
      supabase,
      user,
      isAdmin: false,
      error: "Unauthorized: Platform administrator privileges required.",
    };
  }

  return { supabase, user, isAdmin: true, error: null };
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

/**
 * Server Action: Platform Administrator suspends a vendor storefront for policy violations.
 */
export async function suspendShopAction(
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
      return { error: "Please provide a suspension reason (at least 5 characters)." };
    }

    const { error } = await supabase
      .from("shops")
      .update({
        status: "suspended",
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
    revalidatePath("/search");

    return {
      success: true,
      message: "Vendor shop suspended successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to suspend shop.";
    return { error: msg };
  }
}

/**
 * Server Action: Platform Administrator reinstates a previously suspended shop.
 */
export async function reinstateShopAction(
  shopId: string
): Promise<AdminActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

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
    revalidatePath("/search");

    return {
      success: true,
      message: "Vendor shop reinstated to active status.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reinstate shop.";
    return { error: msg };
  }
}

// ============================================================================
// Admin Seller & Shop Verification Actions
// ============================================================================

/**
 * Server Action: Platform Administrator fetches uploaded verification documents
 * for a specific shop with short-lived (300s) signed URLs from the private
 * `verification-documents` bucket.
 */
export async function getShopVerificationDocumentsAdminAction(
  shopId: string
): Promise<{
  success: boolean;
  error?: string;
  documents: SellerVerificationDocumentRecord[];
}> {
  try {
    const { supabase, isAdmin, error: authErr } = await verifyPlatformAdmin();
    if (!isAdmin) {
      return { success: false, error: authErr || "Unauthorized.", documents: [] };
    }

    if (!shopId) {
      return { success: false, error: "Shop identifier is required.", documents: [] };
    }

    const { data: shop } = await supabase
      .from("shops")
      .select("id, seller_profile_id")
      .eq("id", shopId)
      .maybeSingle();

    if (!shop) {
      return { success: false, error: "Shop not found.", documents: [] };
    }

    const { data: rawDocs, error: docsErr } = await supabase
      .from("seller_documents")
      .select("*")
      .eq("seller_profile_id", shop.seller_profile_id)
      .order("created_at", { ascending: false });

    if (docsErr) {
      return {
        success: false,
        error: "Failed to load verification documents.",
        documents: [],
      };
    }

    // Prefer documents explicitly attached to this shopId, falling back to account-level NIC documents
    const allSellerDocs = (rawDocs || []) as SellerVerificationDocumentRecord[];
    const shopSpecificDocs = allSellerDocs.filter((d) => d.shop_id === shopId);
    const hasShopNicFront = shopSpecificDocs.some((d) => d.document_type === "nic_front");
    const hasShopNicBack = shopSpecificDocs.some((d) => d.document_type === "nic_back");

    const effectiveDocs = [...shopSpecificDocs];
    if (!hasShopNicFront) {
      const fallbackFront = allSellerDocs.find((d) => d.document_type === "nic_front");
      if (fallbackFront) effectiveDocs.push(fallbackFront);
    }
    if (!hasShopNicBack) {
      const fallbackBack = allSellerDocs.find((d) => d.document_type === "nic_back");
      if (fallbackBack) effectiveDocs.push(fallbackBack);
    }

    const docsWithSignedUrls: SellerVerificationDocumentRecord[] = await Promise.all(
      effectiveDocs.map(async (doc) => {
        const { data: signedData } = await supabase.storage
          .from(VERIFICATION_DOCUMENTS_BUCKET)
          .createSignedUrl(doc.storage_path, 300);
        return {
          ...doc,
          signedUrl: signedData?.signedUrl || null,
        };
      })
    );

    return {
      success: true,
      documents: docsWithSignedUrls,
    };
  } catch {
    return {
      success: false,
      error: "Failed to retrieve verification documents.",
      documents: [],
    };
  }
}

/**
 * Server Action: Platform Administrator approves seller verification for a specific shop.
 * Unlocks product publishing (`is_published = true`) for that shop and records an audit log.
 */
export async function approveShopVerificationAction(
  shopId: string,
  notes?: string
): Promise<AdminActionResult> {
  try {
    const { supabase, user, isAdmin, error: authErr } = await verifyPlatformAdmin();
    if (!isAdmin || !user) {
      return { error: authErr || "Unauthorized." };
    }

    const { data: shop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, name, seller_profile_id, verification_status")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !shop) {
      return { error: "Shop not found." };
    }

    const currentStatus =
      (shop.verification_status as ShopVerificationStatus) || "not_submitted";
    const check = canTransitionShopVerificationStatus(currentStatus, "approved", true);
    if (!check.allowed) {
      return { error: check.error };
    }

    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        status: "approved",
        verification_status: "approved",
        verification_reason: notes?.trim() || null,
        verification_reviewed_by: user.id,
        verification_reviewed_at: nowIso,
        approved_by: user.id,
        approved_at: nowIso,
        fraud_escalated: false,
        updated_at: nowIso,
      })
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    // Mark associated seller documents and profile as verified
    await Promise.all([
      supabase
        .from("seller_documents")
        .update({ verified: true })
        .eq("seller_profile_id", shop.seller_profile_id)
        .or(`shop_id.eq.${shopId},document_type.in.(nic_front,nic_back)`),
      supabase
        .from("seller_profiles")
        .update({
          verification_status: "verified",
          verified_at: nowIso,
          rejection_reason: null,
          updated_at: nowIso,
        })
        .eq("id", shop.seller_profile_id),
      supabase.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "SHOP_VERIFICATION_APPROVED",
        target_entity_type: "shop",
        target_entity_id: shopId,
        previous_state: { verification_status: currentStatus },
        new_state: { verification_status: "approved" },
        reason: notes?.trim() || "Seller verification documents reviewed and approved.",
      }),
    ]);

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/search");

    return {
      success: true,
      message: `Seller verification approved for "${shop.name}". Product publishing is now unlocked.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to approve shop verification.";
    return { error: msg };
  }
}

/**
 * Server Action: Platform Administrator requests document resubmission for a shop.
 * Requires a clear reason so the seller can see why resubmission is needed and upload corrected documents.
 */
export async function requestShopResubmissionAction(
  shopId: string,
  reason: string
): Promise<AdminActionResult> {
  try {
    const { supabase, user, isAdmin, error: authErr } = await verifyPlatformAdmin();
    if (!isAdmin || !user) {
      return { error: authErr || "Unauthorized." };
    }

    const { data: shop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, name, seller_profile_id, verification_status")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !shop) {
      return { error: "Shop not found." };
    }

    const currentStatus =
      (shop.verification_status as ShopVerificationStatus) || "not_submitted";
    const check = canTransitionShopVerificationStatus(
      currentStatus,
      "resubmission_required",
      true,
      reason
    );
    if (!check.allowed) {
      return { error: check.error };
    }

    const trimmedReason = reason.trim();
    const nowIso = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        verification_status: "resubmission_required",
        verification_reason: trimmedReason,
        verification_reviewed_by: user.id,
        verification_reviewed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    // Unpublish any published products if the shop was previously approved
    await Promise.all([
      supabase
        .from("products")
        .update({ is_published: false })
        .eq("shop_id", shopId)
        .eq("is_published", true),
      supabase.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: "SHOP_VERIFICATION_RESUBMISSION_REQUIRED",
        target_entity_type: "shop",
        target_entity_id: shopId,
        previous_state: { verification_status: currentStatus },
        new_state: { verification_status: "resubmission_required" },
        reason: trimmedReason,
      }),
    ]);

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/search");

    return {
      success: true,
      message: `Resubmission requested for "${shop.name}". The seller has been notified with your reason.`,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to request document resubmission.";
    return { error: msg };
  }
}

/**
 * Server Action: Platform Administrator rejects a shop's verification (with optional fraud/forged document escalation).
 */
export async function rejectShopVerificationAction(
  shopId: string,
  reason: string,
  options?: {
    escalateFraud?: boolean;
    escalationNotes?: string;
    suspendShop?: boolean;
  }
): Promise<AdminActionResult> {
  try {
    const { supabase, user, isAdmin, error: authErr } = await verifyPlatformAdmin();
    if (!isAdmin || !user) {
      return { error: authErr || "Unauthorized." };
    }

    const { data: shop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, name, status, seller_profile_id, verification_status")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !shop) {
      return { error: "Shop not found." };
    }

    const currentStatus =
      (shop.verification_status as ShopVerificationStatus) || "not_submitted";
    const check = canTransitionShopVerificationStatus(
      currentStatus,
      "rejected",
      true,
      reason
    );
    if (!check.allowed) {
      return { error: check.error };
    }

    const trimmedReason = reason.trim();
    const escalateFraud = Boolean(options?.escalateFraud);
    const shouldSuspend = Boolean(options?.suspendShop || escalateFraud);
    const nowIso = new Date().toISOString();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shopUpdatePayload: Record<string, any> = {
      verification_status: "rejected",
      verification_reason: trimmedReason,
      verification_reviewed_by: user.id,
      verification_reviewed_at: nowIso,
      fraud_escalated: escalateFraud,
      fraud_escalation_notes: options?.escalationNotes?.trim() || (escalateFraud ? trimmedReason : null),
      updated_at: nowIso,
    };

    if (shouldSuspend) {
      shopUpdatePayload.status = "suspended";
      shopUpdatePayload.status_reason = trimmedReason;
    }

    const { error: updateErr } = await supabase
      .from("shops")
      .update(shopUpdatePayload)
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    await Promise.all([
      supabase
        .from("products")
        .update({ is_published: false })
        .eq("shop_id", shopId)
        .eq("is_published", true),
      supabase.from("admin_audit_logs").insert({
        admin_id: user.id,
        action_type: escalateFraud
          ? "SHOP_VERIFICATION_FRAUD_ESCALATED"
          : "SHOP_VERIFICATION_REJECTED",
        target_entity_type: "shop",
        target_entity_id: shopId,
        previous_state: {
          status: shop.status,
          verification_status: currentStatus,
        },
        new_state: {
          status: shouldSuspend ? "suspended" : shop.status,
          verification_status: "rejected",
          fraud_escalated: escalateFraud,
        },
        reason: trimmedReason,
      }),
    ]);

    revalidatePath("/admin/dashboard");
    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/search");

    return {
      success: true,
      message: escalateFraud
        ? `Verification rejected and escalated for fraud investigation for "${shop.name}".`
        : `Verification rejected for "${shop.name}".`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reject shop verification.";
    return { error: msg };
  }
}

