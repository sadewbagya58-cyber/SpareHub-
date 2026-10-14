"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  productCreateSchema,
  productUpdateSchema,
  productSlugify,
  lkrToMinorUnits,
  minorUnitsToLKR,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "@/lib/validators/product";

export interface ProductActionResult {
  success?: boolean;
  error?: string;
  message?: string;
  productId?: string;
  slug?: string;
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
  compatibilities: Array<{
    id?: string;
    vehicle_model_id?: string | null;
    vehicle_variant_id?: string | null;
    make_name?: string;
    model_name?: string;
    notes?: string | null;
    is_exact_fit: boolean;
  }>;
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
    vehicle_makes?: {
      id: string;
      name: string;
    } | null;
  } | null;
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
    status: string;
  } | null;
  product_images?: DBImageRow[] | null;
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
    status: string;
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
}): Promise<{ products: SellerProductListItem[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { products: [], error: "Authentication required" };
    }

    // Get user's shop
    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("id, shops(id, name, status)")
      .eq("user_id", user.id)
      .maybeSingle();

    const shop = sellerProfile?.shops?.[0];
    if (!shop) {
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
      .eq("shop_id", shop.id)
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
            vehicle_makes (id, name)
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

    const compatibilities = (row.product_compatibility || []).map((c) => ({
      id: c.id,
      vehicle_model_id: c.vehicle_model_id,
      vehicle_variant_id: c.vehicle_variant_id,
      make_name: c.vehicle_models?.vehicle_makes?.name || "",
      model_name: c.vehicle_models?.name || "",
      notes: c.notes,
      is_exact_fit: c.is_exact_fit,
    }));

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

    // Verify user has an active shop
    const { data: sellerProfile } = await supabase
      .from("seller_profiles")
      .select("id, shops(id, name, status)")
      .eq("user_id", user.id)
      .maybeSingle();

    const shop = sellerProfile?.shops?.[0];
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
    const validated = productCreateSchema.parse(input);

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
        is_published: validated.is_published ?? true,
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
    if (
      !validated.is_universal &&
      validated.compatibilities &&
      validated.compatibilities.length > 0
    ) {
      const validCompats = validated.compatibilities.filter(
        (c) => c.vehicle_model_id || c.vehicle_variant_id
      );

      if (validCompats.length > 0) {
        const compatRows = validCompats.map((c) => ({
          product_id: productId,
          vehicle_model_id: c.vehicle_model_id || null,
          vehicle_variant_id: c.vehicle_variant_id || null,
          notes: c.notes || null,
          is_exact_fit: c.is_exact_fit ?? true,
        }));

        const { error: compatError } = await supabase
          .from("product_compatibility")
          .insert(compatRows);

        if (compatError) {
          console.error("Error inserting compatibility entries:", compatError);
        }
      }
    }

    revalidatePath("/seller/products");
    revalidatePath("/seller/dashboard");
    revalidatePath("/search");
    revalidatePath(`/products/${finalSlug}`);

    return {
      success: true,
      message: "Product created and published successfully!",
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

    const validated = productUpdateSchema.parse(input);

    // Verify ownership
    const { data: currentProduct, error: fetchErr } = await supabase
      .from("products")
      .select("id, shop_id, slug, shops!inner(seller_profiles!inner(user_id))")
      .eq("id", validated.productId)
      .maybeSingle();

    if (fetchErr || !currentProduct) {
      return { error: "Product not found or access denied." };
    }

    const typedProd = currentProduct as unknown as {
      shops?: { seller_profiles?: { user_id: string } };
    };
    const ownerUserId = typedProd.shops?.seller_profiles?.user_id;
    if (ownerUserId !== user.id) {
      return { error: "Unauthorized: You do not own this product listing." };
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

    if (!validated.is_universal && validated.compatibilities && validated.compatibilities.length > 0) {
      const validCompats = validated.compatibilities.filter(
        (c) => c.vehicle_model_id || c.vehicle_variant_id
      );

      if (validCompats.length > 0) {
        const compatRows = validCompats.map((c) => ({
          product_id: validated.productId,
          vehicle_model_id: c.vehicle_model_id || null,
          vehicle_variant_id: c.vehicle_variant_id || null,
          notes: c.notes || null,
          is_exact_fit: c.is_exact_fit ?? true,
        }));

        await supabase.from("product_compatibility").insert(compatRows);
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
export async function getPublicProducts(options?: {
  search?: string;
  category?: string;
  condition?: string;
  vehicleModelId?: string;
  limit?: number;
}) {
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
        shops!inner (id, name, slug, city, district, status),
        product_images (image_url, is_primary, display_order)
      `
      )
      .eq("is_published", true)
      .eq("status", "active")
      .neq("shops.status", "suspended")
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    if (options?.search && options.search.trim()) {
      const term = options.search.trim();
      query = query.or(
        `title.ilike.%${term}%,part_number.ilike.%${term}%,brand_name.ilike.%${term}%`
      );
    }

    if (options?.category && options.category !== "all") {
      query = query.eq("categories.slug", options.category);
    }

    if (options?.condition && options.condition !== "all") {
      query = query.eq("condition", options.condition);
    }

    const { data, error } = await query;

    if (error || !data) {
      console.warn("Public products query returned empty or error:", error);
      return [];
    }

    const items = data as unknown as DBPublicProductRow[];
    return items.map((item) => {
      const images = (item.product_images || []).sort(
        (a, b) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          a.display_order - b.display_order
      );
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
        shopLocation: item.shops?.city
          ? `${item.shops.city}, ${item.shops.district || "Sri Lanka"}`
          : "Sri Lanka",
        vehicleCompatibilitySummary: item.is_universal
          ? "Universal Fit"
          : "Verified Fitment Available",
        category: item.categories?.name || "Spare Parts",
        imageUrl: images[0]?.image_url || "/images/placeholders/brake-pads.png",
        isDemo: false,
      };
    });
  } catch (err) {
    console.error("Failed to query public products:", err);
    return [];
  }
}

/**
 * Server Helper: Fetch public product by slug for product detail page.
 */
export async function getPublicProductBySlug(slug: string) {
  try {
    const supabase = await createServerSupabaseClient();

    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        categories (name, slug),
        shops!inner (
          id,
          name,
          slug,
          description,
          phone,
          email,
          city,
          district,
          address_line1,
          status,
          created_at
        ),
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
            vehicle_makes (id, name)
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

    const images = (row.product_images || []).sort(
      (a: DBImageRow, b: DBImageRow) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
        a.display_order - b.display_order
    );

    const compatibilities = (row.product_compatibility || []).map((c: DBCompatibilityJoinRow) => ({
      id: c.id,
      notes: c.notes,
      is_exact_fit: c.is_exact_fit,
      make_name: c.vehicle_models?.vehicle_makes?.name || "Universal",
      model_name: c.vehicle_models?.name || "All Models",
    }));

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
}
