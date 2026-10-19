"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { CartItem, MultiVendorCartGroup } from "@/lib/types";

export interface CartResponse {
  items: CartItem[];
  groups: MultiVendorCartGroup[];
  totalGrandMinor: number;
  totalItemCount: number;
  isAuthenticated: boolean;
}

/**
 * Fetch persistent cart items for the authenticated user, partitioned by seller shop.
 */
export async function getCartAction(): Promise<CartResponse> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      items: [],
      groups: [],
      totalGrandMinor: 0,
      totalItemCount: 0,
      isAuthenticated: false,
    };
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(`
      id,
      quantity,
      product:products (
        id,
        title,
        slug,
        part_number,
        brand_name,
        price_minor_units,
        stock_quantity,
        is_published,
        status,
        images,
        shop:shops (
          id,
          name,
          slug,
          district,
          status
        )
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error || !data) {
    console.error("Error fetching cart items:", error);
    return {
      items: [],
      groups: [],
      totalGrandMinor: 0,
      totalItemCount: 0,
      isAuthenticated: true,
    };
  }

  const items: CartItem[] = [];

  for (const row of data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p: any = row.product;
    if (!p) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = p.shop;
    const firstImg = Array.isArray(p.images) && p.images.length > 0 ? p.images[0] : undefined;

    items.push({
      id: row.id,
      productId: p.id,
      quantity: row.quantity,
      productTitle: p.title,
      productSlug: p.slug,
      partNumber: p.part_number,
      brandName: p.brand_name,
      imageUrl: firstImg,
      priceMinorUnits: Number(p.price_minor_units) || 0,
      stockQuantity: Number(p.stock_quantity) || 0,
      isPublished: Boolean(p.is_published && p.status === "active" && s?.status === "approved"),
      shopId: s?.id || "",
      shopName: s?.name || "Verified Vendor",
      shopSlug: s?.slug,
      shopDistrict: s?.district,
    });
  }

  // Partition by Shop
  const groupMap = new Map<string, MultiVendorCartGroup>();
  let totalGrandMinor = 0;
  let totalItemCount = 0;

  for (const item of items) {
    const itemSubtotal = item.priceMinorUnits * item.quantity;
    totalGrandMinor += itemSubtotal;
    totalItemCount += item.quantity;

    if (!groupMap.has(item.shopId)) {
      groupMap.set(item.shopId, {
        shopId: item.shopId,
        shopName: item.shopName,
        shopSlug: item.shopSlug,
        shopDistrict: item.shopDistrict,
        items: [],
        subtotalMinorUnits: 0,
      });
    }

    const group = groupMap.get(item.shopId)!;
    group.items.push(item);
    group.subtotalMinorUnits += itemSubtotal;
  }

  return {
    items,
    groups: Array.from(groupMap.values()),
    totalGrandMinor,
    totalItemCount,
    isAuthenticated: true,
  };
}

/**
 * Add a product to the user's persistent cart or increment quantity.
 */
export async function addToCartAction(productId: string, quantity: number = 1): Promise<{
  success: boolean;
  message?: string;
  cartCount?: number;
}> {
  if (!productId || typeof productId !== "string") {
    return { success: false, message: "Invalid product ID." };
  }

  const qty = Math.floor(Number(quantity));
  if (!qty || qty <= 0) {
    return { success: false, message: "Quantity must be a positive integer." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      message: "Please sign in to add parts to your persistent shopping cart.",
    };
  }

  // Check product existence, status & stock
  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, title, is_published, status, stock_quantity, shop:shops(status)")
    .eq("id", productId)
    .single();

  if (prodErr || !product) {
    return { success: false, message: "Product not found." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopStatus = (product.shop as any)?.status;
  if (!product.is_published || product.status !== "active" || shopStatus !== "approved") {
    return { success: false, message: "This product is currently unavailable for purchase." };
  }

  // Check existing item in cart
  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const newTotalQty = (existing?.quantity ?? 0) + qty;

  if (newTotalQty > product.stock_quantity) {
    return {
      success: false,
      message: `Cannot add ${qty} more. Only ${product.stock_quantity} available in stock.`,
    };
  }

  if (existing) {
    const { error: updErr } = await supabase
      .from("cart_items")
      .update({ quantity: newTotalQty, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (updErr) {
      return { success: false, message: "Failed to update cart quantity." };
    }
  } else {
    const { error: insErr } = await supabase.from("cart_items").insert({
      user_id: user.id,
      product_id: productId,
      quantity: qty,
    });

    if (insErr) {
      return { success: false, message: "Failed to add item to cart." };
    }
  }

  revalidatePath("/cart");
  return { success: true, message: "Part added to shopping cart." };
}

/**
 * Update quantity for an existing cart item.
 */
export async function updateCartQuantityAction(cartItemId: string, quantity: number): Promise<{
  success: boolean;
  message?: string;
}> {
  const qty = Math.floor(Number(quantity));
  if (!qty || qty <= 0) {
    return { success: false, message: "Quantity must be at least 1." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Authentication required." };
  }

  // Fetch cart item with product stock
  const { data: item, error: fetchErr } = await supabase
    .from("cart_items")
    .select("id, quantity, product:products(stock_quantity, title)")
    .eq("id", cartItemId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !item) {
    return { success: false, message: "Cart item not found." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const availableStock = (item.product as any)?.stock_quantity ?? 0;
  if (qty > availableStock) {
    return {
      success: false,
      message: `Only ${availableStock} units available for this part.`,
    };
  }

  const { error: updErr } = await supabase
    .from("cart_items")
    .update({ quantity: qty, updated_at: new Date().toISOString() })
    .eq("id", cartItemId)
    .eq("user_id", user.id);

  if (updErr) {
    return { success: false, message: "Failed to update item quantity." };
  }

  revalidatePath("/cart");
  return { success: true };
}

/**
 * Remove an item from the cart.
 */
export async function removeCartItemAction(cartItemId: string): Promise<{
  success: boolean;
  message?: string;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Authentication required." };
  }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("id", cartItemId)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, message: "Failed to remove item from cart." };
  }

  revalidatePath("/cart");
  return { success: true };
}

/**
 * Clear the entire cart for the current user.
 */
export async function clearCartAction(): Promise<{ success: boolean; message?: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "Authentication required." };
  }

  const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);

  if (error) {
    return { success: false, message: "Failed to clear cart." };
  }

  revalidatePath("/cart");
  return { success: true };
}

/**
 * Fast item count lookup for header navbar badge.
 */
export async function getCartCountAction(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return 0;

  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id);

  if (error || !data) return 0;

  return data.reduce((acc, row) => acc + (row.quantity || 0), 0);
}
