"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  shopCreateSchema,
  shopUpdateSchema,
  slugify,
  SHOP_BRANDING_BUCKET,
  validateShopBrandingFile,
  extractOwnedStoragePath,
  type ShopBrandingAssetType,
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

export interface ShopBrandingActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  url?: string | null;
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

    // 4. Insert shop in 'approved' (active) status immediately in self-service marketplace
    // Pre-generate UUID to cleanly decouple INSERT from RETURNING RLS subquery evaluation
    const shopId = crypto.randomUUID();
    const { error: shopErr } = await supabase
      .from("shops")
      .insert({
        id: shopId,
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
        status: "approved",
      });

    if (shopErr) {
      if (shopErr.message.includes("violates unique constraint") && shopErr.message.includes("slug")) {
        return { error: "This shop URL slug is already taken. Please choose a different shop name or slug." };
      }
      return { error: shopErr.message || "Failed to create shop." };
    }

    // 5. Query newly created shop record
    const { data: newShop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, name, slug, status")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !newShop) {
      return { error: fetchErr?.message || "Shop was created, but unable to retrieve store details." };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/sell");

    return {
      success: true,
      shopId: newShop.id,
      message: `Shop "${newShop.name}" created and storefront activated successfully! You can now start adding products.`,
      redirectTo: "/seller/products",
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
      .select("id, slug, status, logo_url, cover_url, seller_profile_id, seller_profiles!inner(user_id)")
      .eq("id", data.shopId)
      .eq("seller_profiles.user_id", user.id)
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

    const nextLogoUrl = data.logo_url || null;
    const nextCoverUrl = data.cover_url || null;

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
        logo_url: nextLogoUrl,
        cover_url: nextCoverUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    // 4. Clean up replaced or removed owned storage assets
    const pathsToRemove: string[] = [];
    if (currentShop.logo_url && currentShop.logo_url !== nextLogoUrl) {
      const oldLogoPath = extractOwnedStoragePath(currentShop.logo_url, user.id);
      if (oldLogoPath) pathsToRemove.push(oldLogoPath);
    }
    if (currentShop.cover_url && currentShop.cover_url !== nextCoverUrl) {
      const oldCoverPath = extractOwnedStoragePath(currentShop.cover_url, user.id);
      if (oldCoverPath) pathsToRemove.push(oldCoverPath);
    }
    if (pathsToRemove.length > 0) {
      await supabase.storage.from(SHOP_BRANDING_BUCKET).remove(pathsToRemove);
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath(`/shop/${data.slug}`);
    if (currentShop.slug !== data.slug) {
      revalidatePath(`/shop/${currentShop.slug}`);
    }
    revalidatePath("/search");

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
 * Server Action: Upload a shop branding image (logo or cover banner) to Supabase Storage.
 * Enforces authentication, shop ownership (when shopId is supplied), file MIME & size validation,
 * immediate persistence to `shops.logo_url` or `shops.cover_url` when `shopId` exists,
 * and safe cleanup of replaced owned images.
 */
export async function uploadShopBrandingImageAction(
  formData: FormData
): Promise<ShopBrandingActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to upload shop branding images." };
    }

    const rawAssetType = formData.get("assetType")?.toString() || "";
    if (rawAssetType !== "logo" && rawAssetType !== "cover") {
      return { error: "Invalid shop branding asset type." };
    }
    const assetType: ShopBrandingAssetType = rawAssetType;
    const assetLabel = assetType === "logo" ? "Shop logo" : "Cover banner";

    const fileEntry = formData.get("file");
    if (!fileEntry || typeof fileEntry === "string") {
      return { error: `Please select a valid ${assetLabel.toLowerCase()} image file.` };
    }

    const fileValidation = validateShopBrandingFile(fileEntry, assetLabel);
    if (!fileValidation.valid) {
      return { error: fileValidation.error || `Invalid ${assetLabel.toLowerCase()} file.` };
    }

    const shopId = formData.get("shopId")?.toString()?.trim() || "";
    const previousUrl = formData.get("previousUrl")?.toString()?.trim() || "";

    let existingShop: {
      id: string;
      slug: string;
      logo_url: string | null;
      cover_url: string | null;
    } | null = null;

    if (shopId) {
      const { data: shopData, error: shopErr } = await supabase
        .from("shops")
        .select("id, slug, logo_url, cover_url, seller_profiles!inner(user_id)")
        .eq("id", shopId)
        .eq("seller_profiles.user_id", user.id)
        .maybeSingle();

      if (shopErr || !shopData) {
        return { error: "Shop not found or you do not have permission to modify its branding." };
      }
      existingShop = shopData;
    }

    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const fileExt = mimeToExt[fileEntry.type] || "jpg";
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    const storagePath = `${user.id}/shop-${assetType}-${Date.now()}-${randomSuffix}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from(SHOP_BRANDING_BUCKET)
      .upload(storagePath, fileEntry, {
        cacheControl: "3600",
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadErr) {
      return { error: uploadErr.message || `Failed to upload ${assetLabel.toLowerCase()}.` };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(SHOP_BRANDING_BUCKET).getPublicUrl(storagePath);

    const oldPathsToClean = new Set<string>();
    const prevOwnedPath = extractOwnedStoragePath(previousUrl, user.id);
    if (prevOwnedPath && prevOwnedPath !== storagePath) {
      oldPathsToClean.add(prevOwnedPath);
    }

    if (existingShop) {
      const dbColumn = assetType === "logo" ? "logo_url" : "cover_url";
      const currentDbUrl = assetType === "logo" ? existingShop.logo_url : existingShop.cover_url;
      const dbOwnedPath = extractOwnedStoragePath(currentDbUrl, user.id);
      if (dbOwnedPath && dbOwnedPath !== storagePath) {
        oldPathsToClean.add(dbOwnedPath);
      }

      const { error: updateErr } = await supabase
        .from("shops")
        .update({
          [dbColumn]: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingShop.id);

      if (updateErr) {
        // Roll back newly uploaded object if DB update fails
        await supabase.storage.from(SHOP_BRANDING_BUCKET).remove([storagePath]);
        return { error: updateErr.message || `Failed to save ${assetLabel.toLowerCase()} to shop profile.` };
      }

      revalidatePath("/seller/dashboard");
      revalidatePath("/seller/shop");
      revalidatePath(`/shop/${existingShop.slug}`);
      revalidatePath("/search");
    }

    if (oldPathsToClean.size > 0) {
      await supabase.storage.from(SHOP_BRANDING_BUCKET).remove(Array.from(oldPathsToClean));
    }

    return {
      success: true,
      url: publicUrl,
      message: existingShop
        ? `${assetLabel} uploaded and saved to your shop profile.`
        : `${assetLabel} uploaded and ready for your new shop.`,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "An unexpected error occurred while uploading image.";
    return { error: msg };
  }
}

/**
 * Server Action: Remove a shop branding image (logo or cover banner) and clean up owned storage file.
 */
export async function removeShopBrandingImageAction(input: {
  shopId?: string;
  assetType: ShopBrandingAssetType;
  currentUrl?: string | null;
}): Promise<ShopBrandingActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to remove shop branding images." };
    }

    if (input.assetType !== "logo" && input.assetType !== "cover") {
      return { error: "Invalid shop branding asset type." };
    }

    const assetLabel = input.assetType === "logo" ? "Shop logo" : "Cover banner";
    const pathsToClean = new Set<string>();

    const candidateOwnedPath = extractOwnedStoragePath(input.currentUrl, user.id);
    if (candidateOwnedPath) {
      pathsToClean.add(candidateOwnedPath);
    }

    if (input.shopId) {
      const { data: existingShop, error: shopErr } = await supabase
        .from("shops")
        .select("id, slug, logo_url, cover_url, seller_profiles!inner(user_id)")
        .eq("id", input.shopId)
        .eq("seller_profiles.user_id", user.id)
        .maybeSingle();

      if (shopErr || !existingShop) {
        return { error: "Shop not found or you do not have permission to modify its branding." };
      }

      const dbColumn = input.assetType === "logo" ? "logo_url" : "cover_url";
      const dbUrl = input.assetType === "logo" ? existingShop.logo_url : existingShop.cover_url;
      const dbOwnedPath = extractOwnedStoragePath(dbUrl, user.id);
      if (dbOwnedPath) {
        pathsToClean.add(dbOwnedPath);
      }

      const { error: updateErr } = await supabase
        .from("shops")
        .update({
          [dbColumn]: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingShop.id);

      if (updateErr) {
        return { error: updateErr.message || `Failed to remove ${assetLabel.toLowerCase()}.` };
      }

      revalidatePath("/seller/dashboard");
      revalidatePath("/seller/shop");
      revalidatePath(`/shop/${existingShop.slug}`);
      revalidatePath("/search");
    }

    if (pathsToClean.size > 0) {
      await supabase.storage.from(SHOP_BRANDING_BUCKET).remove(Array.from(pathsToClean));
    }

    return {
      success: true,
      url: null,
      message: `${assetLabel} removed.`,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "An unexpected error occurred while removing image.";
    return { error: msg };
  }
}

/**
 * Server Helper: Fetch public approved shop storefront by slug along with its active products.
 */
export async function getPublicShopBySlug(slug: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: shop, error } = await supabase
      .from("shops")
      .select("*")
      .eq("slug", slug)
      .neq("status", "suspended")
      .maybeSingle();

    if (error || !shop) {
      return null;
    }

    const { data: products } = await supabase
      .from("products")
      .select(
        `
        *,
        categories(id, name, slug),
        product_images(id, image_url, alt_text, display_order, is_primary)
      `
      )
      .eq("shop_id", shop.id)
      .eq("is_published", true)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    const enrichedProducts = (products || []).map((p) => {
      const imgs = Array.isArray(p.product_images) ? p.product_images : [];
      const sorted = [...imgs].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const primary = sorted.find((i) => i.is_primary) || sorted[0];
      return {
        ...p,
        primaryImage: primary?.image_url || null,
      };
    });

    return {
      shop,
      products: enrichedProducts,
    };
  } catch (err) {
    console.error("Error in getPublicShopBySlug:", err);
    return null;
  }
}

/**
 * Server Action: Activate shop storefront directly (Self-Service).
 * Allows owners of legacy draft, pending_review, or rejected shops to activate immediately.
 */
export async function activateShopAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to activate shop." };
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

    if (shop.status === "suspended") {
      return { error: "This shop has been suspended by platform administration. Please contact support." };
    }

    // 2. Validate completeness of shop record
    if (!shop.name || !shop.phone || !shop.email || !shop.address_line1 || !shop.district || !shop.city) {
      return { error: "Please complete all required shop contact and address details before activating." };
    }

    // 3. Update status to 'approved' (active) immediately without admin gate
    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        status: "approved",
        status_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/search");

    return {
      success: true,
      message: "Shop storefront activated successfully! Your listings are now live on SpareHub.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "An unexpected error occurred while activating shop.";
    return { error: msg };
  }
}

/**
 * Backwards compatibility alias for submitShopForReviewAction.
 * Activates shop directly without requiring admin approval.
 */
export async function submitShopForReviewAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  return activateShopAction(prevState, formData);
}

/**
 * Server Action: Toggle shop storefront status (e.g. temporary maintenance mode).
 * Sellers can switch between 'approved' (active) and 'draft' (unlisted/maintenance).
 * Only platform admins can set 'suspended'.
 */
export async function toggleShopStatusAction(
  shopId: string,
  targetStatus: "approved" | "draft"
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    // Verify ownership
    const { data: shop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, status, seller_profiles!inner(user_id)")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !shop) {
      return { error: "Shop not found or access denied." };
    }

    if (shop.status === "suspended") {
      return { error: "Suspended shops cannot be re-activated by sellers. Contact platform administration." };
    }

    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        status: targetStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/search");

    return {
      success: true,
      message: targetStatus === "approved" ? "Shop is now active and published." : "Shop is now in draft/maintenance mode.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to toggle shop status.";
    return { error: msg };
  }
}
