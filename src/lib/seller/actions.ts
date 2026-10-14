"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  shopCreateSchema,
  shopUpdateSchema,
  slugify,
  type ShopCreateInput,
  type ShopUpdateInput,
} from "@/lib/validators/shop";

export interface ShopActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  shopId?: string;
  redirectTo?: string;
}

/**
 * Server Helper: Fetch seller profile and associated shop for the active user.
 */
export async function getSellerShopProfile() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch user profile
    const { data: userProfile } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    // Fetch seller profile with linked shops
    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("*, shops(*)")
      .eq("user_id", user.id)
      .maybeSingle();

    const shop = sellerProfile?.shops?.[0] || null;

    return {
      user,
      userProfile,
      sellerProfile,
      shop,
    };
  } catch (err) {
    console.error("Error in getSellerShopProfile:", err);
    return null;
  }
}

/**
 * Server Action: Create a new Shop for the authenticated seller.
 * Automatically provisions a seller_profile if one does not exist yet.
 */
export async function createShopAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to create a shop." };
    }

    const rawName = formData.get("name")?.toString() || "";
    let rawSlug = formData.get("slug")?.toString() || "";
    if (!rawSlug && rawName) {
      rawSlug = slugify(rawName);
    } else if (rawSlug) {
      rawSlug = slugify(rawSlug);
    }

    const rawData = {
      name: rawName,
      slug: rawSlug,
      description: formData.get("description")?.toString() || "",
      phone: formData.get("phone")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      address_line1: formData.get("address_line1")?.toString() || "",
      address_line2: formData.get("address_line2")?.toString() || "",
      district: formData.get("district")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      postal_code: formData.get("postal_code")?.toString() || "",
      logo_url: formData.get("logo_url")?.toString() || "",
      cover_url: formData.get("cover_url")?.toString() || "",
      seller_type: formData.get("seller_type")?.toString() || "retail_shop",
    };

    const validation = shopCreateSchema.safeParse(rawData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Validation failed";
      return { error: firstError };
    }

    const data: ShopCreateInput = validation.data;
    const finalSlug = data.slug || slugify(data.name);

    // 1. Ensure seller_profiles row exists for user
    let { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("id, user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sellerProfile) {
      const { data: newProfile, error: profileErr } = await supabase
        .from("seller_profiles")
        .insert({
          user_id: user.id,
          seller_type: data.seller_type,
          verification_status: "unverified",
        })
        .select("id, user_id")
        .single();

      if (profileErr || !newProfile) {
        return { error: profileErr?.message || "Failed to initialize seller profile." };
      }
      sellerProfile = newProfile;
    }

    // 2. Check if a shop already exists for this seller profile
    const { data: existingShop } = await supabase
      .from("shops")
      .select("id, slug")
      .eq("seller_profile_id", sellerProfile.id)
      .maybeSingle();

    if (existingShop) {
      return {
        error: "A shop already exists for your seller account. Please manage your existing shop.",
        shopId: existingShop.id,
      };
    }

    // 3. Check for slug collision
    const { data: slugConflict } = await supabase
      .from("shops")
      .select("id")
      .eq("slug", finalSlug)
      .maybeSingle();

    let candidateSlug = finalSlug;
    if (slugConflict) {
      // Auto-append short unique suffix to prevent fatal error
      const suffix = Math.random().toString(36).substring(2, 6);
      candidateSlug = `${finalSlug}-${suffix}`;
    }

    // 4. Insert shop in 'draft' status
    const { data: newShop, error: shopErr } = await supabase
      .from("shops")
      .insert({
        seller_profile_id: sellerProfile.id,
        name: data.name,
        slug: candidateSlug,
        description: data.description || null,
        phone: data.phone,
        email: data.email,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        district: data.district,
        city: data.city,
        postal_code: data.postal_code || null,
        logo_url: data.logo_url || null,
        cover_url: data.cover_url || null,
        status: "draft",
      })
      .select("id, name, slug, status")
      .single();

    if (shopErr || !newShop) {
      if (shopErr?.message.includes("violates unique constraint") && shopErr?.message.includes("slug")) {
        return { error: "This shop URL slug is already taken. Please choose a different shop name or slug." };
      }
      return { error: shopErr?.message || "Failed to create shop." };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/sell");

    return {
      success: true,
      shopId: newShop.id,
      message: `Shop "${newShop.name}" created successfully in draft mode.`,
      redirectTo: "/seller/shop",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while creating shop.";
    return { error: msg };
  }
}

/**
 * Server Action: Update permitted shop details.
 * Prevents modifying status or approval audit fields.
 */
export async function updateShopAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to update shop." };
    }

    const shopId = formData.get("shopId")?.toString() || "";
    const rawName = formData.get("name")?.toString() || "";
    let rawSlug = formData.get("slug")?.toString() || "";
    if (!rawSlug && rawName) {
      rawSlug = slugify(rawName);
    } else if (rawSlug) {
      rawSlug = slugify(rawSlug);
    }

    const rawData = {
      shopId,
      name: rawName,
      slug: rawSlug,
      description: formData.get("description")?.toString() || "",
      phone: formData.get("phone")?.toString() || "",
      email: formData.get("email")?.toString() || "",
      address_line1: formData.get("address_line1")?.toString() || "",
      address_line2: formData.get("address_line2")?.toString() || "",
      district: formData.get("district")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      postal_code: formData.get("postal_code")?.toString() || "",
      logo_url: formData.get("logo_url")?.toString() || "",
      cover_url: formData.get("cover_url")?.toString() || "",
    };

    const validation = shopUpdateSchema.safeParse(rawData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Validation failed";
      return { error: firstError };
    }

    const data: ShopUpdateInput = validation.data;

    // 1. Verify shop ownership via seller_profile
    const { data: currentShop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, slug, status, seller_profile_id, seller_profiles!inner(user_id)")
      .eq("id", data.shopId)
      .maybeSingle();

    if (fetchErr || !currentShop) {
      return { error: "Shop not found or you do not have permission to edit it." };
    }

    // 2. Check slug uniqueness if slug has changed
    if (data.slug !== currentShop.slug) {
      const { data: conflict } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", data.slug)
        .neq("id", data.shopId)
        .maybeSingle();

      if (conflict) {
        return { error: "The chosen slug is already in use by another shop. Please pick a different one." };
      }
    }

    // 3. Perform update of permitted fields only
    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        name: data.name,
        slug: data.slug,
        description: data.description || null,
        phone: data.phone,
        email: data.email,
        address_line1: data.address_line1,
        address_line2: data.address_line2 || null,
        district: data.district,
        city: data.city,
        postal_code: data.postal_code || null,
        logo_url: data.logo_url || null,
        cover_url: data.cover_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");

    return {
      success: true,
      message: "Shop profile details updated successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while updating shop.";
    return { error: msg };
  }
}

/**
 * Server Action: Submit shop for platform compliance review.
 * Transitions shop status from 'draft' or 'rejected' to 'pending_review'.
 */
export async function submitShopForReviewAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to submit shop for review." };
    }

    const shopId = formData.get("shopId")?.toString();
    if (!shopId) {
      return { error: "Missing shop identifier." };
    }

    // 1. Fetch current shop details and verify ownership
    const { data: shop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, name, phone, email, address_line1, district, city, status, seller_profiles!inner(user_id)")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !shop) {
      return { error: "Shop not found or access denied." };
    }

    if (shop.status === "approved") {
      return { error: "This shop is already approved and active on the marketplace." };
    }

    if (shop.status === "pending_review") {
      return { message: "Your shop application is already under active review by platform administrators." };
    }

    // 2. Validate completeness of shop record
    if (!shop.name || !shop.phone || !shop.email || !shop.address_line1 || !shop.district || !shop.city) {
      return { error: "Please complete all required shop contact and address details before submitting for review." };
    }

    // 3. Update status to 'pending_review'
    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        status: "pending_review",
        status_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      message: "Shop submitted for review! Our platform administration team will review your business credentials.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while submitting shop.";
    return { error: msg };
  }
}
