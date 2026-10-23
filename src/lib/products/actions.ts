"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSellerShopProfile } from "@/lib/seller/actions";
import { canShopPublishProducts } from "@/lib/validators/shop";
import {
  productCreateSchema,
  productUpdateSchema,
  productSlugify,
  lkrToMinorUnits,
  minorUnitsToLKR,
  validateCompatibilityEntries,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@/lib/validators/product";
import {
  FALLBACK_VEHICLE_TYPES,
  FALLBACK_VEHICLE_MAKES,
  FALLBACK_VEHICLE_MODELS,
  FALLBACK_VEHICLE_VARIANTS,
  formatVariantLabel,
  formatVariantYearRange,
  getVehicleTaxonomyHierarchy,
  evaluateProductFitment,
} from "@/lib/products/taxonomy";

export interface ProductActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  productId?: string;
  slug?: string;
}

export interface EnrichedCompatibilityItem {
  id?: string;
  vehicle_type_id?: string | null;
  vehicle_type_name?: string | null;
  make_id?: string | null;
  make_name: string;
  vehicle_model_id?: string | null;
  model_name: string;
  vehicle_variant_id?: string | null;
  variant_label?: string | null;
  generation_chassis?: string | null;
  year_start?: number | null;
  year_end?: number | null;
  engine_code?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
  notes?: string | null;
  is_exact_fit: boolean;
}

export interface SellerProductListItem {
  id: string;
  shop_id: string;
  category_id: string;
  category_name?: string;
  title: string;
  slug: string;
  part_number: string | null;
  oem_part_number: string | null;
  brand_name: string;
  condition: "brand_new" | "reconditioned" | "used";
  price_lkr: number;
  price_minor_units: number;
  compare_at_price_lkr?: number | null;
  stock_quantity: number;
  is_published: boolean;
  status: "active" | "out_of_stock" | "archived" | "banned";
  primary_image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerProductDetail extends SellerProductListItem {
  description: string;
  warranty_period_months: number;
  warranty_details: string | null;
  is_universal: boolean;
  images: Array<{
    id?: string;
    image_url: string;
    alt_text?: string | null;
    display_order: number;
    is_primary: boolean;
  }>;
  compatibilities: EnrichedCompatibilityItem[];
}

interface DBImageRow {
  id?: string;
  image_url: string;
  alt_text?: string | null;
  display_order: number;
  is_primary: boolean;
}

interface DBCompatibilityJoinRow {
  id: string;
  vehicle_model_id?: string | null;
  vehicle_variant_id?: string | null;
  notes?: string | null;
  is_exact_fit: boolean;
  vehicle_models?: {
    id: string;
    name: string;
    make_id?: string;
    vehicle_makes?: {
      id: string;
      name: string;
      vehicle_type_id?: string;
      vehicle_types?: {
        id: string;
        name: string;
      } | null;
    } | null;
  } | null;
  vehicle_variants?: {
    id: string;
    model_id: string;
    generation_chassis: string;
    year_start: number;
    year_end?: number | null;
    engine_code?: string | null;
    transmission?: string | null;
    fuel_type?: string | null;
  } | null;
}

function enrichCompatibilityRow(c: DBCompatibilityJoinRow): EnrichedCompatibilityItem {
  const fallbackVariant = c.vehicle_variant_id
    ? FALLBACK_VEHICLE_VARIANTS.find((v) => v.id === c.vehicle_variant_id)
    : undefined;
  const variantData = c.vehicle_variants || fallbackVariant;

  const resolvedModelId =
    c.vehicle_model_id || variantData?.model_id || c.vehicle_models?.id || null;
  const fallbackModel = resolvedModelId
    ? FALLBACK_VEHICLE_MODELS.find((m) => m.id === resolvedModelId)
    : undefined;

  const resolvedMakeId =
    c.vehicle_models?.make_id ||
    c.vehicle_models?.vehicle_makes?.id ||
    fallbackModel?.make_id ||
    null;
  const fallbackMake = resolvedMakeId
    ? FALLBACK_VEHICLE_MAKES.find((mk) => mk.id === resolvedMakeId)
    : undefined;

  const resolvedTypeId =
    c.vehicle_models?.vehicle_makes?.vehicle_type_id ||
    c.vehicle_models?.vehicle_makes?.vehicle_types?.id ||
    fallbackMake?.vehicle_type_id ||
    null;
  const fallbackType = resolvedTypeId
    ? FALLBACK_VEHICLE_TYPES.find((t) => t.id === resolvedTypeId)
    : undefined;

  const makeName =
    c.vehicle_models?.vehicle_makes?.name || fallbackMake?.name || "";
  const modelName =
    c.vehicle_models?.name || fallbackModel?.name || "All Models";
  const typeName =
    c.vehicle_models?.vehicle_makes?.vehicle_types?.name ||
    fallbackType?.name ||
    null;

  return {
    id: c.id,
    vehicle_type_id: resolvedTypeId,
    vehicle_type_name: typeName,
    make_id: resolvedMakeId,
    make_name: makeName,
    vehicle_model_id: resolvedModelId,
    model_name: modelName,
    vehicle_variant_id: c.vehicle_variant_id || null,
    variant_label: variantData ? formatVariantLabel(variantData) : null,
    generation_chassis: variantData?.generation_chassis || null,
    year_start: variantData?.year_start ?? null,
    year_end: variantData?.year_end ?? null,
    engine_code: variantData?.engine_code ?? null,
    transmission: variantData?.transmission ?? null,
    fuel_type: variantData?.fuel_type ?? null,
    notes: c.notes ?? null,
    is_exact_fit: c.is_exact_fit ?? true,
  };
}

interface DBProductQueryRow {
  id: string;
  shop_id: string;
  category_id: string;
  title: string;
  slug: string;
  part_number: string | null;
  oem_part_number: string | null;
  brand_name: string;
  condition: "brand_new" | "reconditioned" | "used";
  price_minor_units: number;
  compare_at_price_minor_units: number | null;
  stock_quantity: number;
  is_published: boolean;
  status: "active" | "out_of_stock" | "archived" | "banned";
  created_at: string;
  updated_at: string;
  categories?: { name: string } | null;
  product_images?: DBImageRow[] | null;
}

interface DBProductDetailRow extends DBProductQueryRow {
  description: string;
  warranty_period_months: number | null;
  warranty_details: string | null;
  is_universal: boolean;
  product_compatibility?: DBCompatibilityJoinRow[] | null;
  shops?: {
    id: string;
    seller_profiles?: {
      user_id: string;
    } | null;
  } | null;
}

interface DBPublicProductRow {
  id: string;
  title: string;
  slug: string;
  part_number: string | null;
  oem_part_number: string | null;
  brand_name: string;
  condition: "brand_new" | "reconditioned" | "used";
  price_minor_units: number;
  compare_at_price_minor_units: number | null;
  stock_quantity: number;
  is_universal: boolean;
  categories?: { name: string; slug: string } | null;
  shops?: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    district: string | null;
    logo_url?: string | null;
    cover_url?: string | null;
    status: string;
    verification_status?: string;
  } | null;
  product_images?: DBImageRow[] | null;
  product_compatibility?: DBCompatibilityJoinRow[] | null;
}

interface DBPublicProductDetailRow extends DBPublicProductRow {
  description: string;
  warranty_period_months: number | null;
  warranty_details: string | null;
  shops?: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    city: string | null;
    district: string | null;
    address_line1: string | null;
    logo_url?: string | null;
    cover_url?: string | null;
    status: string;
    verification_status?: string;
    created_at: string;
  } | null;
  product_compatibility?: DBCompatibilityJoinRow[] | null;
}

/**
 * Server Action: Fetch products owned by the active seller's shop.
 */
export async function getSellerProducts(options?: {
  search?: string;
  status?: string;
  categoryId?: string;
  shopId?: string;
}): Promise<{ products: SellerProductListItem[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { products: [], error: "Authentication required" };
    }

    let resolvedShopId = options?.shopId;
    if (!resolvedShopId) {
      const sellerData = await getSellerShopProfile();
      resolvedShopId = sellerData?.shop?.id;
    }

    if (!resolvedShopId) {
      return { products: [] };
    }

    let query = supabase
      .from("products")
      .select(
        `
        id,
        shop_id,
        category_id,
        title,
        slug,
        part_number,
        oem_part_number,
        brand_name,
        condition,
        price_minor_units,
        compare_at_price_minor_units,
        stock_quantity,
        is_published,
        status,
        created_at,
        updated_at,
        categories (name),
        product_images (image_url, is_primary, display_order)
      `
      )
      .eq("shop_id", resolvedShopId)
      .order("created_at", { ascending: false });

    if (options?.status && options.status !== "all") {
      if (options.status === "published") {
        query = query.eq("is_published", true);
      } else if (options.status === "draft") {
        query = query.eq("is_published", false);
      } else {
        query = query.eq("status", options.status);
      }
    }

    if (options?.categoryId && options.categoryId !== "all") {
      query = query.eq("category_id", options.categoryId);
    }

    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      query = query.or(
        `title.ilike.%${term}%,part_number.ilike.%${term}%,brand_name.ilike.%${term}%,oem_part_number.ilike.%${term}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching seller products:", error);
      return { products: [], error: error.message };
    }

    const rows = (data || []) as unknown as DBProductQueryRow[];
    const products: SellerProductListItem[] = rows.map((row) => {
      const images = (row.product_images || []).sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          a.display_order - b.display_order
      );
      const primaryImg = images[0]?.image_url || null;

      return {
        id: row.id,
        shop_id: row.shop_id,
        category_id: row.category_id,
        category_name: row.categories?.name,
        title: row.title,
        slug: row.slug,
        part_number: row.part_number,
        oem_part_number: row.oem_part_number,
        brand_name: row.brand_name,
        condition: row.condition,
        price_lkr: minorUnitsToLKR(row.price_minor_units),
        price_minor_units: row.price_minor_units,
        compare_at_price_lkr: row.compare_at_price_minor_units
          ? minorUnitsToLKR(row.compare_at_price_minor_units)
          : null,
        stock_quantity: row.stock_quantity,
        is_published: row.is_published,
        status: row.status,
        primary_image_url: primaryImg,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return { products };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load products";
    console.error("Failed to load seller products:", err);
    return { products: [], error: message };
  }
}

/**
 * Server Action: Fetch full product details for editing (verifying seller ownership).
 */
export async function getSellerProductById(
  productId: string
): Promise<{ product: SellerProductDetail | null; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { product: null, error: "Authentication required" };
    }

    const { data: rawRow, error } = await supabase
      .from("products")
      .select(
        `
        *,
        categories (name),
        product_images (id, image_url, alt_text, display_order, is_primary),
        product_compatibility (
          id,
          vehicle_model_id,
          vehicle_variant_id,
          notes,
          is_exact_fit,
          vehicle_models (
            id,
            name,
            make_id,
            vehicle_makes (
              id,
              name,
              vehicle_type_id,
              vehicle_types (id, name)
            )
          ),
          vehicle_variants (
            id,
            model_id,
            generation_chassis,
            year_start,
            year_end,
            engine_code,
            transmission,
            fuel_type
          )
        ),
        shops!inner (
          id,
          seller_profiles!inner (user_id)
        )
      `
      )
      .eq("id", productId)
      .maybeSingle();

    if (error || !rawRow) {
      return { product: null, error: "Product not found or access denied" };
    }

    const row = rawRow as unknown as DBProductDetailRow;

    // Ownership verification
    const ownerUserId = row.shops?.seller_profiles?.user_id;
    if (ownerUserId !== user.id) {
      return { product: null, error: "Unauthorized access to this product" };
    }

    const images = (row.product_images || []).sort(
      (a, b) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
        a.display_order - b.display_order
    );

    const compatibilities = (row.product_compatibility || []).map((c) =>
      enrichCompatibilityRow(c)
    );

    const product: SellerProductDetail = {
      id: row.id,
      shop_id: row.shop_id,
      category_id: row.category_id,
      category_name: row.categories?.name,
      title: row.title,
      slug: row.slug,
      description: row.description,
      part_number: row.part_number,
      oem_part_number: row.oem_part_number,
      brand_name: row.brand_name,
      condition: row.condition,
      price_lkr: minorUnitsToLKR(row.price_minor_units),
      price_minor_units: row.price_minor_units,
      compare_at_price_lkr: row.compare_at_price_minor_units
        ? minorUnitsToLKR(row.compare_at_price_minor_units)
        : null,
      stock_quantity: row.stock_quantity,
      warranty_period_months: row.warranty_period_months || 0,
      warranty_details: row.warranty_details,
      is_universal: Boolean(row.is_universal),
      is_published: row.is_published,
      status: row.status,
      primary_image_url: images[0]?.image_url || null,
      images,
      compatibilities,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    return { product };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load product";
    console.error("Failed to load product detail:", err);
    return { product: null, error: message };
  }
}

/**
 * Helper: Persist normalized compatibility records for a product, with graceful fallback
 * if a remote DB has not yet seeded a specific `vehicle_variants` row.
 */
async function persistProductCompatibilities(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  productId: string,
  normalized: Array<{
    vehicle_model_id: string;
    vehicle_variant_id: string | null;
    notes: string | null;
    is_exact_fit: boolean;
  }>
): Promise<{ error?: string }> {
  if (normalized.length === 0) {
    return {};
  }

  const compatRows = normalized.map((c) => ({
    product_id: productId,
    vehicle_model_id: c.vehicle_model_id,
    vehicle_variant_id: c.vehicle_variant_id,
    notes: c.notes,
    is_exact_fit: c.is_exact_fit,
  }));

  const { error: compatError } = await supabase
    .from("product_compatibility")
    .insert(compatRows);

  if (!compatError) {
    return {};
  }

  // If the remote database has not yet seeded `vehicle_variants`, retry storing model-level compatibility
  // while preserving variant metadata in fitment notes so no compatibility data is lost.
  if (
    compatError.message.includes("vehicle_variant_id") &&
    compatError.message.includes("foreign key")
  ) {
    const fallbackRows = normalized.map((c) => {
      const variantMeta = c.vehicle_variant_id
        ? FALLBACK_VEHICLE_VARIANTS.find((v) => v.id === c.vehicle_variant_id)
        : undefined;
      const variantNote = variantMeta ? formatVariantLabel(variantMeta) : "";
      const combinedNotes = [variantNote, c.notes]
        .filter(Boolean)
        .join(" — ")
        .slice(0, 200);

      return {
        product_id: productId,
        vehicle_model_id: c.vehicle_model_id,
        vehicle_variant_id: null,
        notes: combinedNotes || null,
        is_exact_fit: c.is_exact_fit,
      };
    });

    const { error: retryErr } = await supabase
      .from("product_compatibility")
      .insert(fallbackRows);

    if (retryErr) {
      return { error: retryErr.message };
    }
    return {};
  }

  return { error: compatError.message };
}

/**
 * Server Action: Create a new product listing (Self-service, instant publication).
 */
export async function createProductAction(
  input: ProductCreateInput
): Promise<ProductActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to create product listings." };
    }

    // Verify user has an active shop (uses active selected shop for multi-shop accounts)
    const sellerData = await getSellerShopProfile();
    const shop = sellerData?.shop;
    if (!shop) {
      return {
        error: "You must create a shop before adding products. Please set up your shop first.",
      };
    }

    if (shop.status === "suspended") {
      return {
        error: "Your shop is currently suspended by platform administration.",
      };
    }

    // Validate payload with Zod
    const parseRes = productCreateSchema.safeParse(input);
    if (!parseRes.success) {
      return {
        error:
          parseRes.error.issues[0]?.message ||
          "Invalid product data submitted.",
      };
    }
    const validated = parseRes.data;

    // Critical Business Rule: Unverified shops can create and save drafts (is_published = false),
    // but cannot publish products (is_published = true) until shop.verification_status === 'approved'.
    const targetIsPublished = validated.is_published ?? false;
    if (targetIsPublished) {
      const publishCheck = canShopPublishProducts(shop);
      if (!publishCheck.allowed) {
        return {
          error:
            publishCheck.reason ||
            "Shop verification is required before publishing products. Please save this item as a draft or complete seller verification.",
        };
      }
    }

    // Validate 4-level vehicle compatibility hierarchy & duplicates before DB write
    const taxonomy = await getVehicleTaxonomyHierarchy();
    const compatValidation = validateCompatibilityEntries(
      validated.compatibilities || [],
      Boolean(validated.is_universal),
      taxonomy
    );
    if (!compatValidation.valid) {
      return {
        error:
          compatValidation.error ||
          "Invalid vehicle compatibility configuration.",
      };
    }

    // Build URL-safe unique slug
    let candidateSlug =
      validated.slug && validated.slug.trim().length > 0
        ? validated.slug.trim().toLowerCase()
        : productSlugify(validated.title, validated.part_number || undefined);

    if (!candidateSlug) {
      candidateSlug = `part-${Date.now()}`;
    }

    // Check slug collision within the same shop
    const { data: existingSlug } = await supabase
      .from("products")
      .select("id")
      .eq("shop_id", shop.id)
      .eq("slug", candidateSlug)
      .maybeSingle();

    let finalSlug = candidateSlug;
    if (existingSlug) {
      finalSlug = `${candidateSlug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const priceMinorUnits = lkrToMinorUnits(validated.price);
    const compareAtPriceMinorUnits = validated.compare_at_price
      ? lkrToMinorUnits(validated.compare_at_price)
      : null;

    // Self-service: products are published immediately if is_published=true
    const initialStatus = validated.stock_quantity === 0 ? "out_of_stock" : "active";

    // Insert product
    const { data: insertedProduct, error: insertError } = await supabase
      .from("products")
      .insert({
        shop_id: shop.id,
        category_id: validated.category_id,
        title: validated.title,
        slug: finalSlug,
        description: validated.description,
        part_number: validated.part_number || null,
        oem_part_number: validated.oem_part_number || null,
        brand_name: validated.brand_name,
        condition: validated.condition,
        price_minor_units: priceMinorUnits,
        compare_at_price_minor_units: compareAtPriceMinorUnits,
        stock_quantity: validated.stock_quantity,
        warranty_period_months: validated.warranty_period_months ?? 0,
        warranty_details: validated.warranty_details || null,
        is_universal: Boolean(validated.is_universal),
        is_published: targetIsPublished,
        status: initialStatus,
      })
      .select("id, slug")
      .single();

    if (insertError || !insertedProduct) {
      console.error("Failed to insert product:", insertError);
      return {
        error: insertError?.message || "Failed to create product listing.",
      };
    }

    const productId = insertedProduct.id;

    // Insert images if provided
    if (validated.images && validated.images.length > 0) {
      const imageRows = validated.images.map((img, idx) => ({
        product_id: productId,
        image_url: img.image_url,
        alt_text: img.alt_text || null,
        display_order: img.display_order ?? idx,
        is_primary: img.is_primary ?? idx === 0,
      }));

      const { error: imgError } = await supabase
        .from("product_images")
        .insert(imageRows);

      if (imgError) {
        console.error("Error inserting product images:", imgError);
      }
    }

    // Insert structured vehicle compatibilities if provided
    if (!validated.is_universal && compatValidation.normalized.length > 0) {
      const { error: compatError } = await persistProductCompatibilities(
        supabase,
        productId,
        compatValidation.normalized
      );
      if (compatError) {
        console.error("Error inserting compatibility entries:", compatError);
        return {
          error: `Product was created, but saving vehicle compatibility failed: ${compatError}`,
        };
      }
    }

    revalidatePath("/seller/products");
    revalidatePath("/seller/dashboard");
    revalidatePath("/search");
    revalidatePath(`/products/${finalSlug}`);

    return {
      success: true,
      message: targetIsPublished
        ? "Product created and published successfully!"
        : "Product saved as a draft!",
      productId,
      slug: finalSlug,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save product";
    console.error("Create product error:", err);
    return { error: message };
  }
}

/**
 * Server Action: Update existing product listing.
 */
export async function updateProductAction(
  input: ProductUpdateInput
): Promise<ProductActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required to update products." };
    }

    const parseRes = productUpdateSchema.safeParse(input);
    if (!parseRes.success) {
      return {
        error:
          parseRes.error.issues[0]?.message ||
          "Invalid product data submitted.",
      };
    }
    const validated = parseRes.data;

    // Verify ownership & fetch shop verification status
    const { data: currentProduct, error: fetchErr } = await supabase
      .from("products")
      .select("id, shop_id, slug, shops!inner(*, seller_profiles!inner(user_id))")
      .eq("id", validated.productId)
      .maybeSingle();

    if (fetchErr || !currentProduct) {
      return { error: "Product not found or access denied." };
    }

    const typedProd = currentProduct as unknown as {
      shops?: {
        id: string;
        status?: string;
        verification_status?: string;
        seller_profiles?: { user_id: string };
      };
    };
    const ownerUserId = typedProd.shops?.seller_profiles?.user_id;
    if (ownerUserId !== user.id) {
      return { error: "Unauthorized: You do not own this product listing." };
    }

    if (validated.is_published) {
      const publishCheck = canShopPublishProducts(typedProd.shops);
      if (!publishCheck.allowed) {
        return {
          error:
            publishCheck.reason ||
            "Shop verification is required before publishing products. Please save this product as a draft or complete seller verification.",
        };
      }
    }

    // Validate 4-level vehicle compatibility hierarchy & duplicates before DB write
    const taxonomy = await getVehicleTaxonomyHierarchy();
    const compatValidation = validateCompatibilityEntries(
      validated.compatibilities || [],
      Boolean(validated.is_universal),
      taxonomy
    );
    if (!compatValidation.valid) {
      return {
        error:
          compatValidation.error ||
          "Invalid vehicle compatibility configuration.",
      };
    }

    const priceMinorUnits = lkrToMinorUnits(validated.price);
    const compareAtPriceMinorUnits = validated.compare_at_price
      ? lkrToMinorUnits(validated.compare_at_price)
      : null;

    let targetStatus = validated.status;
    if (validated.stock_quantity === 0 && targetStatus === "active") {
      targetStatus = "out_of_stock";
    }

    // Update product
    const { error: updateError } = await supabase
      .from("products")
      .update({
        category_id: validated.category_id,
        title: validated.title,
        slug: validated.slug,
        description: validated.description,
        part_number: validated.part_number || null,
        oem_part_number: validated.oem_part_number || null,
        brand_name: validated.brand_name,
        condition: validated.condition,
        price_minor_units: priceMinorUnits,
        compare_at_price_minor_units: compareAtPriceMinorUnits,
        stock_quantity: validated.stock_quantity,
        warranty_period_months: validated.warranty_period_months ?? 0,
        warranty_details: validated.warranty_details || null,
        is_universal: Boolean(validated.is_universal),
        is_published: validated.is_published,
        status: targetStatus,
      })
      .eq("id", validated.productId);

    if (updateError) {
      console.error("Failed to update product:", updateError);
      return { error: updateError.message || "Failed to update product." };
    }

    // Replace images
    await supabase
      .from("product_images")
      .delete()
      .eq("product_id", validated.productId);

    if (validated.images && validated.images.length > 0) {
      const imageRows = validated.images.map((img, idx) => ({
        product_id: validated.productId,
        image_url: img.image_url,
        alt_text: img.alt_text || null,
        display_order: img.display_order ?? idx,
        is_primary: img.is_primary ?? idx === 0,
      }));

      await supabase.from("product_images").insert(imageRows);
    }

    // Replace compatibilities
    await supabase
      .from("product_compatibility")
      .delete()
      .eq("product_id", validated.productId);

    if (!validated.is_universal && compatValidation.normalized.length > 0) {
      const { error: compatError } = await persistProductCompatibilities(
        supabase,
        validated.productId,
        compatValidation.normalized
      );
      if (compatError) {
        console.error("Error updating compatibility entries:", compatError);
        return {
          error: `Product details were updated, but saving vehicle compatibility failed: ${compatError}`,
        };
      }
    }

    revalidatePath("/seller/products");
    revalidatePath(`/seller/products/${validated.productId}/edit`);
    revalidatePath("/seller/dashboard");
    revalidatePath("/search");
    revalidatePath(`/products/${validated.slug}`);

    return {
      success: true,
      message: "Product updated successfully!",
      productId: validated.productId,
      slug: validated.slug,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update product";
    console.error("Update product error:", err);
    return { error: message };
  }
}

/**
 * Server Action: Instant publish / unpublish toggle (No admin approval required).
 */
export async function toggleProductPublishAction(
  productId: string,
  isPublished: boolean
): Promise<ProductActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    // Verify ownership & fetch shop verification status
    const { data: prod, error: fetchErr } = await supabase
      .from("products")
      .select("id, slug, shops!inner(*, seller_profiles!inner(user_id))")
      .eq("id", productId)
      .maybeSingle();

    if (fetchErr || !prod) {
      return { error: "Product not found or access denied." };
    }

    const typedProd = prod as unknown as {
      shops?: {
        id: string;
        status?: string;
        verification_status?: string;
        seller_profiles?: { user_id: string };
      };
    };
    const ownerUserId = typedProd.shops?.seller_profiles?.user_id;
    if (ownerUserId !== user.id) {
      return { error: "Unauthorized: You do not own this product." };
    }

    if (isPublished) {
      const publishCheck = canShopPublishProducts(typedProd.shops);
      if (!publishCheck.allowed) {
        return {
          error:
            publishCheck.reason ||
            "Shop verification is required before publishing products. Please complete seller verification first.",
        };
      }
    }

    const { error } = await supabase
      .from("products")
      .update({ is_published: isPublished })
      .eq("id", productId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/seller/products");
    revalidatePath("/seller/dashboard");
    revalidatePath("/search");
    revalidatePath(`/products/${prod.slug}`);

    return {
      success: true,
      message: isPublished ? "Listing published to marketplace." : "Listing hidden as draft.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to toggle status";
    return { error: message };
  }
}

/**
 * Server Action: Delete a product listing and associated records.
 */
export async function deleteProductAction(
  productId: string
): Promise<ProductActionResult> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Authentication required." };
    }

    // Verify ownership
    const { data: prod, error: fetchErr } = await supabase
      .from("products")
      .select("id, slug, shops!inner(seller_profiles!inner(user_id))")
      .eq("id", productId)
      .maybeSingle();

    if (fetchErr || !prod) {
      return { error: "Product not found or access denied." };
    }

    const typedProd = prod as unknown as {
      shops?: { seller_profiles?: { user_id: string } };
    };
    const ownerUserId = typedProd.shops?.seller_profiles?.user_id;
    if (ownerUserId !== user.id) {
      return { error: "Unauthorized: You do not own this product." };
    }

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/seller/products");
    revalidatePath("/seller/dashboard");
    revalidatePath("/search");

    return {
      success: true,
      message: "Product listing deleted successfully.",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete product";
    return { error: message };
  }
}

/**
 * Server Helper: Fetch public marketplace products.
 * Includes only published, active products from non-suspended shops.
 */
export interface PublicProductsQueryOptions {
  search?: string;
  category?: string;
  condition?: string;
  brand?: string;
  minPriceMinorUnits?: number;
  maxPriceMinorUnits?: number;
  vehicleTypeId?: string;
  vehicleMakeId?: string;
  vehicleModelId?: string;
  vehicleVariantId?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  page?: number;
  pageSize?: number;
  limit?: number;
}

/**
 * Server Helper: Fetch public marketplace products.
 * Includes only published, active products from non-suspended shops.
 * Filters by 4-level vehicle taxonomy compatibility, category, brand, condition, and keyword.
 */
export async function getPublicProducts(options?: PublicProductsQueryOptions) {
  try {
    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("products")
      .select(
        `
        id,
        title,
        slug,
        part_number,
        oem_part_number,
        brand_name,
        condition,
        price_minor_units,
        compare_at_price_minor_units,
        stock_quantity,
        is_universal,
        categories (name, slug),
        shops!inner (*),
        product_images (image_url, is_primary, display_order),
        product_compatibility (
          id,
          vehicle_model_id,
          vehicle_variant_id,
          notes,
          is_exact_fit,
          vehicle_models (
            id,
            name,
            make_id,
            vehicle_makes (
              id,
              name,
              vehicle_type_id
            )
          ),
          vehicle_variants (
            id,
            model_id,
            generation_chassis,
            year_start,
            year_end
          )
        )
      `
      )
      .eq("is_published", true)
      .eq("status", "active")
      .neq("shops.status", "suspended");

    // Dynamic sorting
    if (options?.sort === "price_asc") {
      query = query.order("price_minor_units", { ascending: true });
    } else if (options?.sort === "price_desc") {
      query = query.order("price_minor_units", { ascending: false });
    } else if (options?.sort === "name_asc") {
      query = query.order("title", { ascending: true });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      query = query.or(
        `title.ilike.%${term}%,part_number.ilike.%${term}%,brand_name.ilike.%${term}%,oem_part_number.ilike.%${term}%`
      );
    }

    if (options?.category && options.category !== "all") {
      query = query.eq("categories.slug", options.category);
    }

    if (options?.condition && options.condition !== "all") {
      query = query.eq("condition", options.condition);
    }

    if (options?.brand && options.brand !== "all") {
      query = query.ilike("brand_name", `%${options.brand.trim()}%`);
    }

    if (options?.minPriceMinorUnits !== undefined) {
      query = query.gte("price_minor_units", options.minPriceMinorUnits);
    }

    if (options?.maxPriceMinorUnits !== undefined) {
      query = query.lte("price_minor_units", options.maxPriceMinorUnits);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn("Public products query returned empty or error:", error);
      return [];
    }

    const rawItems = data as unknown as DBPublicProductRow[];

    const vehicleFilter = {
      vehicleTypeId: options?.vehicleTypeId,
      vehicleMakeId: options?.vehicleMakeId,
      vehicleModelId: options?.vehicleModelId,
      vehicleVariantId: options?.vehicleVariantId,
    };

    // Evaluate compatibility fitment against 4-level taxonomy
    const matchedProducts: Array<{
      item: DBPublicProductRow;
      fitment: ReturnType<typeof evaluateProductFitment>;
      enrichedCompats: EnrichedCompatibilityItem[];
    }> = [];

    for (const item of rawItems) {
      if (
        item.shops?.verification_status &&
        item.shops.verification_status !== "approved"
      ) {
        continue;
      }

      const enrichedCompats = (item.product_compatibility || []).map((c) =>
        enrichCompatibilityRow(c)
      );

      const fitment = evaluateProductFitment(
        {
          is_universal: item.is_universal,
          product_compatibility: enrichedCompats,
        },
        vehicleFilter
      );

      if (fitment.isMatch) {
        matchedProducts.push({
          item,
          fitment,
          enrichedCompats,
        });
      }
    }

    // Apply pagination if specified
    let finalSlice = matchedProducts;
    if (options?.page && options?.pageSize) {
      const start = (options.page - 1) * options.pageSize;
      finalSlice = matchedProducts.slice(start, start + options.pageSize);
    } else if (options?.limit) {
      finalSlice = matchedProducts.slice(0, options.limit);
    }

    return finalSlice.map(({ item, fitment, enrichedCompats }) => {
      const images = (item.product_images || []).sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          a.display_order - b.display_order
      );

      let compatSummary = fitment.fitmentDetails;
      if (!compatSummary || compatSummary === "Verified Compatibility") {
        if (item.is_universal) {
          compatSummary = "Universal Fit (All Vehicles)";
        } else if (enrichedCompats.length > 0) {
          const first = enrichedCompats[0];
          const years = formatVariantYearRange(first.year_start, first.year_end);
          const firstLabel = [
            first.make_name,
            first.model_name,
            first.generation_chassis
              ? `(${first.generation_chassis})`
              : years
              ? `(${years})`
              : "",
          ]
            .filter(Boolean)
            .join(" ");
          compatSummary =
            enrichedCompats.length > 1
              ? `Fits ${firstLabel} +${enrichedCompats.length - 1} more`
              : `Fits ${firstLabel}`;
        } else {
          compatSummary = "Fitment verified by seller";
        }
      }

      return {
        id: item.id,
        title: item.title,
        slug: item.slug,
        partNumber: item.part_number || "N/A",
        oemNumber: item.oem_part_number || undefined,
        brand: item.brand_name,
        condition: item.condition,
        priceMinorUnits: item.price_minor_units,
        compareAtPriceMinorUnits: item.compare_at_price_minor_units || undefined,
        stockQuantity: item.stock_quantity,
        shopName: item.shops?.name || "Verified Seller",
        shopLogoUrl: item.shops?.logo_url || null,
        shopLocation: item.shops?.city
          ? `${item.shops.city}, ${item.shops.district || "Sri Lanka"}`
          : "Sri Lanka",
        vehicleCompatibilitySummary: compatSummary,
        category: item.categories?.name || "Spare Parts",
        imageUrl: images[0]?.image_url || "/images/placeholders/brake-pads.png",
        isDemo: false,
        fitmentBadge: fitment.fitmentBadge,
        fitmentType: fitment.fitmentType,
        isExactFit: fitment.isExactFit,
      };
    });
  } catch (err) {
    console.error("Failed to query public products:", err);
    return [];
  }
}

/**
 * Server Helper: Fetch public product by slug for product detail page.
 * Request-memoized via React `cache()` so `generateMetadata` and `ProductDetailPage`
 * share a single Supabase query instead of executing the 6-table join twice per request.
 */
const getCachedPublicProductBySlug = cache(async (slug: string) => {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        categories (name, slug),
        shops!inner (*),
        product_images (id, image_url, alt_text, display_order, is_primary),
        product_compatibility (
          id,
          vehicle_model_id,
          vehicle_variant_id,
          notes,
          is_exact_fit,
          vehicle_models (
            id,
            name,
            make_id,
            vehicle_makes (
              id,
              name,
              vehicle_type_id,
              vehicle_types (id, name)
            )
          ),
          vehicle_variants (
            id,
            model_id,
            generation_chassis,
            year_start,
            year_end,
            engine_code,
            transmission,
            fuel_type
          )
        )
      `
      )
      .eq("slug", slug)
      .eq("is_published", true)
      .neq("shops.status", "suspended")
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const row = data as unknown as DBPublicProductDetailRow;
    if (
      row.shops?.verification_status &&
      row.shops.verification_status !== "approved"
    ) {
      return null;
    }

    const images = (row.product_images || []).sort(
      (a: DBImageRow, b: DBImageRow) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
        a.display_order - b.display_order
    );

    const compatibilities = (row.product_compatibility || []).map(
      (c: DBCompatibilityJoinRow) => enrichCompatibilityRow(c)
    );

    return {
      ...row,
      price_lkr: minorUnitsToLKR(row.price_minor_units),
      compare_at_price_lkr: row.compare_at_price_minor_units
        ? minorUnitsToLKR(row.compare_at_price_minor_units)
        : null,
      images,
      compatibilities,
    };
  } catch (err) {
    console.error("Error in getPublicProductBySlug:", err);
    return null;
  }
});

export async function getPublicProductBySlug(slug: string) {
  return getCachedPublicProductBySlug(slug);
}
