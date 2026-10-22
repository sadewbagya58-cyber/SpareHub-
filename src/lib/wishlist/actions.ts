"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { WishlistItem } from "@/lib/types";

/**
 * Fetch all saved wishlist items for the authenticated user.
 */
export async function getWishlistAction(): Promise<{
  items: WishlistItem[];
  success: boolean;
  message?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { items: [], success: false, message: "Please sign in to view your wishlist." };
  }

  const { data, error } = await supabase
    .from("wishlist_items")
    .select(`
      id,
      user_id,
      product_id,
      created_at,
      product:products (
        id,
        title,
        slug,
        brand_name,
        part_number,
        price_minor_units,
        stock_quantity,
        is_published,
        status,
        product_images (
          image_url,
          is_primary,
          display_order
        ),
        shop:shops (
          id,
          name,
          slug
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching wishlist:", error);
    return { items: [], success: false, message: "Failed to load wishlist." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: WishlistItem[] = (data || []).map((row: any) => {
    const p = row.product;
    let imageUrl: string | null = null;

    if (p && Array.isArray(p.product_images) && p.product_images.length > 0) {
      const sorted = [...p.product_images].sort(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any, b: any) =>
          (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
          (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      const rawUrl = sorted[0]?.image_url?.trim();
      if (rawUrl) {
        if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
          imageUrl = rawUrl;
        } else if (rawUrl.startsWith("/storage/")) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
          imageUrl = `${supabaseUrl.replace(/\/$/, "")}${rawUrl}`;
        } else {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
          imageUrl = `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/${rawUrl.replace(/^\//, "")}`;
        }
      }
    }

    return {
      id: row.id,
      userId: row.user_id,
      productId: row.product_id,
      createdAt: row.created_at,
      product: p
        ? {
            id: p.id,
            title: p.title,
            slug: p.slug,
            brandName: p.brand_name,
            partNumber: p.part_number,
            priceMinorUnits: Number(p.price_minor_units) || 0,
            stockQuantity: Number(p.stock_quantity) || 0,
            isPublished: Boolean(p.is_published),
            status: p.status,
            imageUrl,
            shopName: p.shop?.name || "Verified Vendor",
            shopSlug: p.shop?.slug || "",
          }
        : undefined,
    };
  });

  return { items, success: true };
}

/**
 * Fetch list of product IDs saved in the authenticated user's wishlist.
 * Used for quick client-side heart icon status lookup.
 */
export async function getWishlistProductIdsAction(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("user_id", user.id);

  if (error || !data) return [];
  return data.map((row) => row.product_id);
}

/**
 * Toggle a product in/out of the user's wishlist atomically.
 */
export async function toggleWishlistItemAction(productId: string): Promise<{
  success: boolean;
  inWishlist: boolean;
  message: string;
}> {
  if (!productId || typeof productId !== "string") {
    return { success: false, inWishlist: false, message: "Invalid product identifier." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      inWishlist: false,
      message: "Please sign in to save parts to your wishlist.",
    };
  }

  // Check if item already exists
  const { data: existing, error: checkErr } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (checkErr) {
    console.error("Error checking wishlist item:", checkErr);
  }

  if (existing) {
    // Remove from wishlist
    const { error: delErr } = await supabase
      .from("wishlist_items")
      .delete()
      .eq("id", existing.id);

    if (delErr) {
      return { success: false, inWishlist: true, message: "Could not remove item from wishlist." };
    }

    return { success: true, inWishlist: false, message: "Removed from your saved items." };
  } else {
    // Add to wishlist
    const { error: insErr } = await supabase.from("wishlist_items").insert({
      user_id: user.id,
      product_id: productId,
    });

    if (insErr) {
      return { success: false, inWishlist: false, message: "Could not add item to wishlist." };
    }

    return { success: true, inWishlist: true, message: "Saved to your wishlist!" };
  }
}

/**
 * Remove an item from the wishlist directly by product ID.
 */
export async function removeWishlistItemAction(productId: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (!productId) return { success: false, message: "Invalid product identifier." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("user_id", user.id)
    .eq("product_id", productId);

  if (error) {
    return { success: false, message: "Failed to remove item." };
  }

  return { success: true, message: "Item removed from wishlist." };
}
