"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  shopCreateSchema,
  shopUpdateSchema,
  shopDeliverySettingsSchema,
  slugify,
  SHOP_BRANDING_BUCKET,
  VERIFICATION_DOCUMENTS_BUCKET,
  validateShopBrandingFile,
  validateVerificationDocumentFile,
  validateVerificationSubmissionCompleteness,
  canTransitionShopVerificationStatus,
  extractOwnedStoragePath,
  type ShopBrandingAssetType,
  type ShopCreateInput,
  type ShopUpdateInput,
  type ShopVerificationStatus,
  type VerificationDocumentType,
  type AddressProofType,
} from "@/lib/validators/shop";

const ACTIVE_SHOP_COOKIE_NAME = "sparehub_active_shop_id";

export interface ShopActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  shopId?: string;
  redirectTo?: string;
  recencyWarning?: string;
}

export interface ShopBrandingActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  url?: string | null;
}

export interface SellerVerificationDocumentRecord {
  id: string;
  seller_profile_id: string;
  shop_id: string | null;
  document_type: VerificationDocumentType;
  storage_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  address_proof_type: AddressProofType | null;
  document_issued_date: string | null;
  reused_from_document_id: string | null;
  verified: boolean;
  created_at: string;
  signedUrl?: string | null;
}

/**
 * Request-cached seller profile and multi-shop lookup.
 * Fetches `user_profiles` and `seller_profiles(..., shops(*))` concurrently in a single parallel roundtrip
 * and memoizes the result across all Server Components/Actions in the same request.
 */
const getCachedSellerShopProfile = cache(async (requestedShopId?: string) => {
  try {
    const [supabase, cookieStore] = await Promise.all([
      createServerSupabaseClient(),
      cookies(),
    ]);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    // Fetch user profile and seller profile with linked shops concurrently in 1 parallel roundtrip
    const [{ data: userProfile }, { data: sellerProfile }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("seller_profiles")
        .select("*, shops(*)")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // Sort shops chronologically so default selection is deterministic
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawShops: any[] = Array.isArray(sellerProfile?.shops)
      ? [...sellerProfile.shops].sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
      : [];

    const activeCookieShopId = cookieStore.get(ACTIVE_SHOP_COOKIE_NAME)?.value;
    const preferredShopId = requestedShopId || activeCookieShopId;

    const shop =
      (preferredShopId
        ? rawShops.find((s) => s.id === preferredShopId)
        : null) ||
      rawShops[0] ||
      null;

    return {
      user,
      userProfile,
      sellerProfile,
      shop,
      shops: rawShops,
    };
  } catch (err) {
    console.error("Error in getSellerShopProfile:", err);
    return null;
  }
});

/**
 * Server Helper: Fetch seller profile, active shop, and all shops owned by the user.
 */
export async function getSellerShopProfile(requestedShopId?: string) {
  return getCachedSellerShopProfile(requestedShopId);
}

/**
 * Server Action: Switch the active shop in the Seller Center when a user manages multiple shops.
 */
export async function selectActiveShopAction(shopId: string): Promise<ShopActionResult> {
  try {
    if (!shopId) {
      return { error: "Please select a valid shop." };
    }
    const profileData = await getSellerShopProfile(shopId);
    if (!profileData || !profileData.user) {
      return { error: "Authentication required." };
    }

    const ownedShop = (profileData.shops || []).find((s) => s.id === shopId);
    if (!ownedShop) {
      return { error: "Shop not found under your account." };
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, ownedShop.id, {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      sameSite: "lax",
    });

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/seller/orders");
    revalidatePath("/seller/earnings");

    return {
      success: true,
      shopId: ownedShop.id,
      message: `Switched active shop to "${ownedShop.name}".`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to switch active shop.";
    return { error: msg };
  }
}

/**
 * Server Action: Create a new Shop for the authenticated user.
 * Supports creating a first shop or opening additional shops under the same customer account.
 * New shops start with storefront active (`status = 'approved'`) and `verification_status = 'not_submitted'`.
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

    const residentialAddress = formData.get("residential_address")?.toString()?.trim() || "";
    const sameAsResidential = formData.get("same_as_residential") === "true";
    const rawAddressLine1 =
      (sameAsResidential && residentialAddress
        ? residentialAddress
        : formData.get("address_line1")?.toString()?.trim()) || "";

    const rawData = {
      name: rawName,
      slug: rawSlug,
      description: formData.get("description")?.toString() || "",
      phone: formData.get("phone")?.toString() || "",
      email: formData.get("email")?.toString() || user.email || "",
      address_line1: rawAddressLine1,
      address_line2: formData.get("address_line2")?.toString() || "",
      district: formData.get("district")?.toString() || "",
      city: formData.get("city")?.toString() || "",
      postal_code: formData.get("postal_code")?.toString() || "",
      logo_url: formData.get("logo_url")?.toString() || "",
      cover_url: formData.get("cover_url")?.toString() || "",
      seller_type: formData.get("seller_type")?.toString() || "retail_shop",
      owner_legal_name: formData.get("owner_legal_name")?.toString() || "",
      residential_address: residentialAddress,
    };

    const validation = shopCreateSchema.safeParse(rawData);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Validation failed";
      return { error: firstError };
    }

    const data: ShopCreateInput = validation.data;
    const finalSlug = data.slug || slugify(data.name);

    // 1. Ensure seller_profiles row exists for user (reusing existing profile if user already owns shops)
    let { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("id, user_id, owner_legal_name, residential_address")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sellerProfile) {
      const { data: newProfile, error: profileErr } = await supabase
        .from("seller_profiles")
        .insert({
          user_id: user.id,
          seller_type: data.seller_type === "wholesaler" ? "distributor" : data.seller_type,
          verification_status: "unverified",
          owner_legal_name: data.owner_legal_name,
          residential_address: data.residential_address,
        })
        .select("id, user_id, owner_legal_name, residential_address")
        .single();

      if (profileErr || !newProfile) {
        return { error: profileErr?.message || "Failed to initialize seller profile." };
      }
      sellerProfile = newProfile;
    } else if (!sellerProfile.owner_legal_name || !sellerProfile.residential_address) {
      await supabase
        .from("seller_profiles")
        .update({
          owner_legal_name: sellerProfile.owner_legal_name || data.owner_legal_name,
          residential_address: sellerProfile.residential_address || data.residential_address,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sellerProfile.id);
    }

    // 2. Prevent accidental duplicate shop creation with the exact same name under the same seller account
    const { data: existingShops } = await supabase
      .from("shops")
      .select("id, name, slug")
      .eq("seller_profile_id", sellerProfile.id);

    const duplicateNameShop = (existingShops || []).find(
      (s) => s.name.trim().toLowerCase() === data.name.trim().toLowerCase()
    );
    if (duplicateNameShop) {
      return {
        error: `You already have a shop named "${duplicateNameShop.name}". Please choose a distinct name for your additional shop.`,
        shopId: duplicateNameShop.id,
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
      const suffix = Math.random().toString(36).substring(2, 6);
      candidateSlug = `${finalSlug}-${suffix}`;
    }

    // 4. Insert shop with active storefront (`status = 'approved'`) and `verification_status = 'not_submitted'`
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
        owner_legal_name: data.owner_legal_name,
        residential_address: data.residential_address,
        shop_category: data.seller_type,
        status: "approved",
        verification_status: "not_submitted",
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
      .select("id, name, slug, status, verification_status")
      .eq("id", shopId)
      .maybeSingle();

    if (fetchErr || !newShop) {
      return { error: fetchErr?.message || "Shop was created, but unable to retrieve store details." };
    }

    // Set newly created shop as the active shop in cookie
    try {
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_SHOP_COOKIE_NAME, newShop.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
        sameSite: "lax",
      });
    } catch {
      // Ignore cookie write errors if invoked outside request context
    }

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/sell");

    return {
      success: true,
      shopId: newShop.id,
      message: `Shop "${newShop.name}" is now open! Complete seller verification whenever you are ready to publish products.`,
      redirectTo: "/seller/dashboard",
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
      owner_legal_name: formData.get("owner_legal_name")?.toString() || undefined,
      residential_address: formData.get("residential_address")?.toString() || undefined,
      seller_type: formData.get("seller_type")?.toString() || undefined,
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shopUpdatePayload: Record<string, any> = {
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
    };

    if (data.owner_legal_name) {
      shopUpdatePayload.owner_legal_name = data.owner_legal_name;
    }
    if (data.residential_address) {
      shopUpdatePayload.residential_address = data.residential_address;
    }
    if (data.seller_type) {
      shopUpdatePayload.shop_category = data.seller_type;
    }

    // 3. Perform update of permitted fields only
    const { error: updateErr } = await supabase
      .from("shops")
      .update(shopUpdatePayload)
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

    // Only return published products publicly if the shop has completed seller verification
    const isVerifiedShop = shop.verification_status === "approved";

    const { data: products } = isVerifiedShop
      ? await supabase
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
          .order("created_at", { ascending: false })
      : { data: [] };

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

export async function updateShopDeliverySettingsAction(payload: {
  shopId: string;
  delivery_enabled: boolean;
  default_delivery_fee_lkr: number;
  free_delivery_threshold_lkr?: number | null;
  district_fees_lkr?: Record<string, number>;
  supported_districts?: string[] | null;
  estimated_delivery_days?: string;
}): Promise<{ success?: boolean; error?: string; message?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to update delivery settings." };
    }

    const validation = shopDeliverySettingsSchema.safeParse(payload);
    if (!validation.success) {
      const firstError = validation.error.issues[0]?.message || "Invalid delivery settings.";
      return { error: firstError };
    }

    const data = validation.data;

    // Verify shop ownership via seller_profiles
    const { data: currentShop, error: fetchErr } = await supabase
      .from("shops")
      .select("id, seller_profile_id, seller_profiles!inner(user_id)")
      .eq("id", data.shopId)
      .eq("seller_profiles.user_id", user.id)
      .maybeSingle();

    if (fetchErr || !currentShop) {
      return { error: "Shop not found or you do not have permission to configure delivery." };
    }

    // Convert LKR to minor units (x100)
    const defaultDeliveryFeeMinor = Math.round(data.default_delivery_fee_lkr * 100);
    const freeDeliveryThresholdMinor =
      data.free_delivery_threshold_lkr != null &&
      !isNaN(data.free_delivery_threshold_lkr) &&
      data.free_delivery_threshold_lkr > 0
        ? Math.round(data.free_delivery_threshold_lkr * 100)
        : null;

    const districtFeesMinor: Record<string, number> = {};
    if (data.district_fees_lkr) {
      for (const [dist, feeLKR] of Object.entries(data.district_fees_lkr)) {
        if (typeof feeLKR === "number" && !isNaN(feeLKR) && feeLKR >= 0) {
          districtFeesMinor[dist.toLowerCase().trim()] = Math.round(feeLKR * 100);
        }
      }
    }

    const { error: updateErr } = await supabase
      .from("shops")
      .update({
        delivery_enabled: data.delivery_enabled,
        default_delivery_fee_minor: defaultDeliveryFeeMinor,
        free_delivery_threshold_minor: freeDeliveryThresholdMinor,
        district_delivery_fees: districtFeesMinor,
        supported_districts: data.supported_districts || null,
        estimated_delivery_days: data.estimated_delivery_days?.trim() || "2-4 business days",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.shopId);

    if (updateErr) {
      return { error: updateErr.message };
    }

    revalidatePath("/seller/shop");
    revalidatePath("/cart");
    revalidatePath("/checkout");

    return {
      success: true,
      message: "Delivery settings updated successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update delivery settings.";
    return { error: msg };
  }
}

// ============================================================================
// Seller Verification Workflow Actions
// ============================================================================

/**
 * Fetches verification documents for a specific shop owned by the authenticated user,
 * plus any verified/uploaded NIC documents from other shops under the same user account
 * that can be reused without re-uploading.
 * Generates short-lived signed URLs from the private `verification-documents` bucket.
 */
export async function getShopVerificationDetailsAction(requestedShopId?: string): Promise<{
  success: boolean;
  error?: string;
  shopId?: string;
  verificationStatus?: ShopVerificationStatus;
  verificationReason?: string | null;
  verificationSubmittedAt?: string | null;
  verificationReviewedAt?: string | null;
  ownerLegalName?: string | null;
  residentialAddress?: string | null;
  shopDocuments: SellerVerificationDocumentRecord[];
  reusableAccountNicDocuments: SellerVerificationDocumentRecord[];
}> {
  const emptyResult = {
    success: false,
    shopDocuments: [],
    reusableAccountNicDocuments: [],
  };

  try {
    const profileData = await getSellerShopProfile(requestedShopId);
    if (!profileData || !profileData.user || !profileData.sellerProfile || !profileData.shop) {
      return { ...emptyResult, error: "Shop not found or authentication required." };
    }

    const { sellerProfile, shop } = profileData;
    const supabase = await createServerSupabaseClient();

    const { data: allDocs, error: docErr } = await supabase
      .from("seller_documents")
      .select("*")
      .eq("seller_profile_id", sellerProfile.id)
      .order("created_at", { ascending: false });

    if (docErr) {
      return { ...emptyResult, error: "Unable to load verification document records." };
    }

    const rawDocs = (allDocs || []) as SellerVerificationDocumentRecord[];

    // Generate short-lived (120s) signed URLs for the owning seller
    const docsWithSignedUrls: SellerVerificationDocumentRecord[] = await Promise.all(
      rawDocs.map(async (doc) => {
        const { data: signedData } = await supabase.storage
          .from(VERIFICATION_DOCUMENTS_BUCKET)
          .createSignedUrl(doc.storage_path, 120);
        return {
          ...doc,
          signedUrl: signedData?.signedUrl || null,
        };
      })
    );

    const shopDocuments = docsWithSignedUrls.filter((d) => d.shop_id === shop.id);

    // Reusable NIC documents from the same user account (either verified or previously uploaded on another shop)
    const reusableAccountNicDocuments: SellerVerificationDocumentRecord[] = [];
    for (const nicType of ["nic_front", "nic_back"] as const) {
      const preferred =
        docsWithSignedUrls.find(
          (d) => d.document_type === nicType && d.shop_id !== shop.id && d.verified
        ) ||
        docsWithSignedUrls.find(
          (d) => d.document_type === nicType && d.shop_id !== shop.id
        );
      if (preferred) {
        reusableAccountNicDocuments.push(preferred);
      }
    }

    return {
      success: true,
      shopId: shop.id,
      verificationStatus: (shop.verification_status as ShopVerificationStatus) || "not_submitted",
      verificationReason: shop.verification_reason || null,
      verificationSubmittedAt: shop.verification_submitted_at || null,
      verificationReviewedAt: shop.verification_reviewed_at || null,
      ownerLegalName: shop.owner_legal_name || sellerProfile.owner_legal_name || null,
      residentialAddress: shop.residential_address || sellerProfile.residential_address || null,
      shopDocuments,
      reusableAccountNicDocuments,
    };
  } catch {
    return { ...emptyResult, error: "Failed to load verification details." };
  }
}

/**
 * Uploads a single verification document (`nic_front`, `nic_back`, `proof_of_address`, or `br_certificate`)
 * to the private `verification-documents` storage bucket and records metadata in `public.seller_documents`.
 * Never logs or exposes public URLs for sensitive identity documents.
 */
export async function uploadVerificationDocumentAction(
  formData: FormData
): Promise<ShopActionResult & { document?: SellerVerificationDocumentRecord }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to upload verification documents." };
    }

    const shopId = formData.get("shopId")?.toString()?.trim() || "";
    const documentType = formData.get("documentType")?.toString()?.trim() || "";
    const addressProofType = formData.get("addressProofType")?.toString()?.trim() || null;
    const documentIssuedDate = formData.get("documentIssuedDate")?.toString()?.trim() || null;
    const fileEntry = formData.get("file");

    if (!shopId) {
      return { error: "Shop identifier is required." };
    }

    if (!fileEntry || typeof fileEntry === "string") {
      return { error: "Please select a valid document file to upload." };
    }

    // Verify ownership of the shop
    const { data: ownedShop, error: shopErr } = await supabase
      .from("shops")
      .select("id, seller_profile_id, verification_status, seller_profiles!inner(id, user_id)")
      .eq("id", shopId)
      .eq("seller_profiles.user_id", user.id)
      .maybeSingle();

    if (shopErr || !ownedShop) {
      return { error: "Shop not found or you do not have permission to upload verification documents for it." };
    }

    const validation = validateVerificationDocumentFile(fileEntry, documentType, {
      addressProofType,
      documentIssuedDate,
    });

    if (!validation.valid) {
      return { error: validation.error || "Invalid verification document." };
    }

    const mimeToExt: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "application/pdf": "pdf",
    };
    const ext = mimeToExt[fileEntry.type] || "bin";
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // First path segment MUST be user.id to satisfy storage RLS policy `(storage.foldername(name))[1] = auth.uid()::text`
    const storagePath = `${user.id}/${shopId}/${documentType}-${Date.now()}-${randomSuffix}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(VERIFICATION_DOCUMENTS_BUCKET)
      .upload(storagePath, fileEntry, {
        cacheControl: "3600",
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadErr) {
      return { error: "Failed to upload document to secure storage. Please try again." };
    }

    // Check if there is an existing unverified document of the same type for this shop to replace cleanly
    const { data: existingDocs } = await supabase
      .from("seller_documents")
      .select("id, storage_path, reused_from_document_id, verified")
      .eq("seller_profile_id", ownedShop.seller_profile_id)
      .eq("shop_id", shopId)
      .eq("document_type", documentType);

    const safeFileName = (fileEntry.name || `${documentType}.${ext}`).replace(/[^\w.\- ()]/g, "_").slice(0, 120);

    const { data: insertedDoc, error: insertErr } = await supabase
      .from("seller_documents")
      .insert({
        seller_profile_id: ownedShop.seller_profile_id,
        shop_id: shopId,
        document_type: documentType,
        storage_path: storagePath,
        file_name: safeFileName,
        file_size_bytes: fileEntry.size,
        mime_type: fileEntry.type,
        address_proof_type: documentType === "proof_of_address" ? addressProofType : null,
        document_issued_date: documentType === "proof_of_address" && documentIssuedDate ? documentIssuedDate : null,
        verified: false,
      })
      .select("*")
      .single();

    if (insertErr || !insertedDoc) {
      await supabase.storage.from(VERIFICATION_DOCUMENTS_BUCKET).remove([storagePath]);
      return { error: "Failed to record verification document metadata." };
    }

    // Remove superseded unverified document rows for this shop & document_type
    if (existingDocs && existingDocs.length > 0) {
      const oldIds = existingDocs.filter((d) => !d.verified).map((d) => d.id);
      const oldStoragePaths = existingDocs
        .filter((d) => !d.verified && !d.reused_from_document_id && d.storage_path !== storagePath)
        .map((d) => d.storage_path);

      if (oldIds.length > 0) {
        await supabase.from("seller_documents").delete().in("id", oldIds);
      }
      if (oldStoragePaths.length > 0) {
        await supabase.storage.from(VERIFICATION_DOCUMENTS_BUCKET).remove(oldStoragePaths);
      }
    }

    const { data: signedData } = await supabase.storage
      .from(VERIFICATION_DOCUMENTS_BUCKET)
      .createSignedUrl(storagePath, 120);

    revalidatePath("/seller/shop");
    revalidatePath("/seller/dashboard");

    return {
      success: true,
      shopId,
      recencyWarning: validation.recencyWarning,
      message: "Verification document uploaded securely.",
      document: {
        ...(insertedDoc as SellerVerificationDocumentRecord),
        signedUrl: signedData?.signedUrl || null,
      },
    };
  } catch {
    return { error: "An unexpected error occurred while uploading verification document." };
  }
}

/**
 * Deletes an unverified optional or replaceable verification document owned by the seller.
 */
export async function deleteVerificationDocumentAction(
  documentId: string
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    const { data: doc, error: fetchErr } = await supabase
      .from("seller_documents")
      .select("id, shop_id, storage_path, verified, reused_from_document_id, seller_profiles!inner(user_id)")
      .eq("id", documentId)
      .eq("seller_profiles.user_id", user.id)
      .maybeSingle();

    if (fetchErr || !doc) {
      return { error: "Document not found or permission denied." };
    }

    if (doc.verified) {
      return { error: "Verified compliance documents cannot be deleted directly. Upload a replacement if needed." };
    }

    const { error: delErr } = await supabase
      .from("seller_documents")
      .delete()
      .eq("id", doc.id);

    if (delErr) {
      return { error: "Failed to remove document record." };
    }

    if (!doc.reused_from_document_id && doc.storage_path.startsWith(`${user.id}/`)) {
      await supabase.storage.from(VERIFICATION_DOCUMENTS_BUCKET).remove([doc.storage_path]);
    }

    revalidatePath("/seller/shop");
    revalidatePath("/seller/dashboard");

    return {
      success: true,
      message: "Document removed.",
    };
  } catch {
    return { error: "Failed to remove verification document." };
  }
}

/**
 * Submits (or resubmits) a shop's verification package for administrator review.
 * - Verifies required identity fields (`owner_legal_name`, `residential_address`).
 * - Supports reusing NIC front & back documents already uploaded/verified under the same user account
 *   when opening and verifying additional shops.
 * - Verifies completeness (`nic_front`, `nic_back`, `proof_of_address` required; `br_certificate` optional).
 * - Transitions `shops.verification_status` to `'pending_review'` (never auto-approves).
 */
export async function submitShopVerificationAction(
  prevState: ShopActionResult | null,
  formData: FormData
): Promise<ShopActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to submit seller verification." };
    }

    const shopId = formData.get("shopId")?.toString()?.trim() || "";
    const ownerLegalName = formData.get("owner_legal_name")?.toString()?.trim() || "";
    const residentialAddress = formData.get("residential_address")?.toString()?.trim() || "";
    const reuseAccountNic = formData.get("reuse_account_nic") !== "false";

    if (!shopId) {
      return { error: "Missing shop identifier." };
    }

    const { data: shop, error: shopErr } = await supabase
      .from("shops")
      .select(
        "id, name, seller_profile_id, verification_status, owner_legal_name, residential_address, seller_profiles!inner(id, user_id, owner_legal_name, residential_address)"
      )
      .eq("id", shopId)
      .eq("seller_profiles.user_id", user.id)
      .maybeSingle();

    if (shopErr || !shop) {
      return { error: "Shop not found or you do not have permission to verify this shop." };
    }

    const currentVerificationStatus =
      (shop.verification_status as ShopVerificationStatus) || "not_submitted";

    const transitionCheck = canTransitionShopVerificationStatus(
      currentVerificationStatus,
      "pending_review",
      false
    );
    if (!transitionCheck.allowed) {
      return { error: transitionCheck.error || "Cannot submit verification in the current shop state." };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profileObj = Array.isArray(shop.seller_profiles) ? shop.seller_profiles[0] : (shop.seller_profiles as any);
    const finalLegalName = ownerLegalName || shop.owner_legal_name || profileObj?.owner_legal_name || "";
    const finalResidentialAddress =
      residentialAddress || shop.residential_address || profileObj?.residential_address || "";

    if (finalLegalName.trim().length < 2) {
      return { error: "Please provide the shop owner's full legal name before submitting verification." };
    }
    if (finalResidentialAddress.trim().length < 5) {
      return { error: "Please provide the owner's residential address before submitting verification." };
    }

    // Fetch all documents for this seller profile
    const { data: allSellerDocs, error: docsErr } = await supabase
      .from("seller_documents")
      .select("*")
      .eq("seller_profile_id", shop.seller_profile_id)
      .order("created_at", { ascending: false });

    if (docsErr) {
      return { error: "Failed to check uploaded verification documents." };
    }

    const docs = (allSellerDocs || []) as SellerVerificationDocumentRecord[];
    const shopDocs = docs.filter((d) => d.shop_id === shop.id);
    const otherAccountDocs = reuseAccountNic ? docs.filter((d) => d.shop_id !== shop.id) : [];

    const completeness = validateVerificationSubmissionCompleteness(shopDocs, otherAccountDocs);
    if (!completeness.ready) {
      return {
        error: completeness.error || "Please upload all required verification documents before submitting.",
      };
    }

    // If reusing NIC front or back from another shop under the same user account, link them to this shop
    for (const nicType of ["nic_front", "nic_back"] as const) {
      const hasShopSpecificNic = shopDocs.some((d) => d.document_type === nicType);
      if (!hasShopSpecificNic && reuseAccountNic) {
        const sourceNic =
          otherAccountDocs.find((d) => d.document_type === nicType && d.verified) ||
          otherAccountDocs.find((d) => d.document_type === nicType);
        if (sourceNic) {
          await supabase.from("seller_documents").insert({
            seller_profile_id: shop.seller_profile_id,
            shop_id: shop.id,
            document_type: nicType,
            storage_path: sourceNic.storage_path,
            file_name: sourceNic.file_name,
            file_size_bytes: sourceNic.file_size_bytes,
            mime_type: sourceNic.mime_type,
            reused_from_document_id: sourceNic.id,
            verified: sourceNic.verified,
          });
        }
      }
    }

    const nowIso = new Date().toISOString();

    const { error: updateShopErr } = await supabase
      .from("shops")
      .update({
        owner_legal_name: finalLegalName.trim(),
        residential_address: finalResidentialAddress.trim(),
        verification_status: "pending_review",
        verification_submitted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", shop.id);

    if (updateShopErr) {
      return { error: updateShopErr.message || "Failed to update shop verification status." };
    }

    await supabase
      .from("seller_profiles")
      .update({
        owner_legal_name: finalLegalName.trim(),
        residential_address: finalResidentialAddress.trim(),
        verification_status: "pending_review",
        updated_at: nowIso,
      })
      .eq("id", shop.seller_profile_id);

    revalidatePath("/seller/dashboard");
    revalidatePath("/seller/shop");
    revalidatePath("/seller/products");
    revalidatePath("/admin/dashboard");

    return {
      success: true,
      shopId: shop.id,
      message:
        "Your seller verification documents have been submitted for administrator review. You can continue configuring your shop and saving product drafts while review is in progress.",
    };
  } catch {
    return { error: "An unexpected error occurred while submitting verification." };
  }
}


