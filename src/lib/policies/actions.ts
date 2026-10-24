"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { policyAcceptanceSchema, type PolicyAcceptanceInput } from "@/lib/validators/business-rules";
import { revalidatePath } from "next/cache";

export interface PolicyDocumentView {
  id: string;
  policyType: string;
  version: string;
  title: string;
  summary?: string | null;
  contentMarkdown: string;
  isPublished: boolean;
  effectiveDate: string;
  updatedAt: string;
}

/**
 * Server Action: Get the latest published version of a policy document (Public).
 */
export async function getPublishedPolicyAction(
  policyType: string
): Promise<{ success: boolean; policy?: PolicyDocumentView; error?: string }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("policy_documents")
    .select("*")
    .eq("policy_type", policyType)
    .eq("is_published", true)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return { success: false, error: "Policy document not found." };
  }

  return {
    success: true,
    policy: {
      id: data.id,
      policyType: data.policy_type,
      version: data.version,
      title: data.title,
      summary: data.summary,
      contentMarkdown: data.content_markdown,
      isPublished: data.is_published,
      effectiveDate: data.effective_date,
      updatedAt: data.updated_at,
    },
  };
}

/**
 * Server Action: Get all accepted policies for a vendor shop.
 */
export async function getSellerPolicyAcceptancesAction(
  shopId: string
): Promise<{ success: boolean; acceptances: Record<string, string>; error?: string }> {
  if (!shopId) return { success: false, acceptances: {}, error: "Shop ID required." };

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("seller_policy_acceptances")
    .select("policy_type, policy_version, accepted_at")
    .eq("shop_id", shopId);

  if (error || !data) {
    return { success: false, acceptances: {}, error: "Failed to load policy acceptances." };
  }

  const acceptances: Record<string, string> = {};
  for (const row of data) {
    acceptances[row.policy_type] = row.policy_version;
  }

  return { success: true, acceptances };
}

/**
 * Server Action: Seller records formal acceptance of a policy or agreement.
 */
export async function recordSellerPolicyAcceptanceAction(
  payload: PolicyAcceptanceInput
): Promise<{ success: boolean; message: string }> {
  const parsed = policyAcceptanceSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message || "Acceptance required." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: isOwner } = await supabase.rpc("owns_shop", { target_shop_id: parsed.data.shopId });
  if (!isOwner) return { success: false, message: "Unauthorized. You do not own this shop." };

  const adminClient = createAdminClient();
  const { error } = await adminClient.from("seller_policy_acceptances").upsert(
    {
      user_id: user.id,
      shop_id: parsed.data.shopId,
      policy_type: parsed.data.policyType,
      policy_version: parsed.data.policyVersion,
      commission_rate_bps: parsed.data.commissionRateBps || null,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,policy_type,policy_version" }
  );

  if (error) {
    return { success: false, message: "Failed to record acceptance: " + error.message };
  }

  revalidatePath("/seller/dashboard");
  revalidatePath("/seller/shop");
  return { success: true, message: "Terms and policy acceptance recorded." };
}
