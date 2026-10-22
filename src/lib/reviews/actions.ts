"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import type { ProductReviewItem, ProductRatingSummary } from "@/lib/types";

/**
 * Fetch published reviews and ratings summary for a given product.
 * Also checks whether the authenticated user is eligible to write a review.
 */
export async function getProductReviewsAction(productId: string): Promise<{
  reviews: ProductReviewItem[];
  summary: ProductRatingSummary;
  userCanReview: boolean;
  userReview?: ProductReviewItem | null;
  errorMessage?: string;
}> {
  const defaultSummary: ProductRatingSummary = {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  if (!productId || typeof productId !== "string") {
    return { reviews: [], summary: defaultSummary, userCanReview: false };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Fetch reviews for the product
  let reviewsQuery = supabase
    .from("product_reviews")
    .select(`
      id,
      product_id,
      customer_id,
      rating,
      title,
      comment,
      is_verified_purchase,
      status,
      created_at,
      updated_at
    `)
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  // If not platform admin, only see published reviews (or own review)
  if (!user) {
    reviewsQuery = reviewsQuery.eq("status", "published");
  } else {
    reviewsQuery = reviewsQuery.or(`status.eq.published,customer_id.eq.${user.id}`);
  }

  // Run reviews query and user review-eligibility check concurrently
  const [reviewsRes, eligibilityRes] = await Promise.all([
    reviewsQuery,
    user
      ? supabase.rpc("check_user_can_review_product", {
          p_user_id: user.id,
          p_product_id: productId,
        })
      : Promise.resolve({ data: false, error: null }),
  ]);

  const { data: rawReviews, error: revErr } = reviewsRes;

  if (revErr) {
    console.error("Error fetching product reviews:", revErr);
    return { reviews: [], summary: defaultSummary, userCanReview: false };
  }

  // 2. Fetch reviewer profile names in bulk
  const customerIds = Array.from(new Set((rawReviews || []).map((r) => r.customer_id)));
  const profileNameMap = new Map<string, string>();

  if (customerIds.length > 0) {
    const admin = createAdminClient();
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, full_name")
      .in("id", customerIds);

    if (profiles) {
      for (const p of profiles) {
        if (p.full_name) {
          // Format reviewer name (e.g. "Kasun P." for privacy)
          const parts = p.full_name.trim().split(" ");
          const formatted =
            parts.length > 1
              ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
              : parts[0];
          profileNameMap.set(p.id, formatted);
        }
      }
    }
  }

  // 3. Format review items and calculate rating distribution
  const distribution: { 5: number; 4: number; 3: number; 2: number; 1: number } = {
    5: 0,
    4: 0,
    3: 0,
    2: 0,
    1: 0,
  };
  let sumRating = 0;
  let publishedCount = 0;
  let userReview: ProductReviewItem | null = null;

  const reviews: ProductReviewItem[] = (rawReviews || []).map((r) => {
    const ratingVal = Math.min(5, Math.max(1, Number(r.rating) || 5)) as 1 | 2 | 3 | 4 | 5;
    if (r.status === "published") {
      sumRating += ratingVal;
      publishedCount += 1;
      distribution[ratingVal] = (distribution[ratingVal] || 0) + 1;
    }

    const item: ProductReviewItem = {
      id: r.id,
      productId: r.product_id,
      customerId: r.customer_id,
      customerName: profileNameMap.get(r.customer_id) || "Verified Buyer",
      rating: ratingVal,
      title: r.title,
      comment: r.comment,
      isVerifiedPurchase: Boolean(r.is_verified_purchase),
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };

    if (user && r.customer_id === user.id) {
      userReview = item;
    }

    return item;
  });

  const averageRating = publishedCount > 0 ? Number((sumRating / publishedCount).toFixed(1)) : 0;
  const summary: ProductRatingSummary = {
    averageRating,
    totalReviews: publishedCount,
    distribution,
  };

  // 4. Evaluate user review eligibility result
  let userCanReview = false;
  if (user) {
    if (!eligibilityRes.error && typeof eligibilityRes.data === "boolean") {
      userCanReview = eligibilityRes.data;
    } else {
      try {
        // Fallback: direct query through order items
        const admin = createAdminClient();
        const { data: ordersWithItem } = await admin
          .from("order_items")
          .select(`
            id,
            seller_orders!inner (
              status,
              customer_orders!inner (
                customer_id
              )
            )
          `)
          .eq("product_id", productId)
          .eq("seller_orders.customer_orders.customer_id", user.id)
          .in("seller_orders.status", ["delivered", "dispatched", "confirmed", "processing", "completed"])
          .limit(1);

        userCanReview = Boolean(ordersWithItem && ordersWithItem.length > 0);
      } catch (e) {
        console.error("Error evaluating user review eligibility:", e);
        userCanReview = false;
      }
    }
  }

  return {
    reviews,
    summary,
    userCanReview,
    userReview,
  };
}

/**
 * Submit or update a product review.
 * Enforces verified-purchase constraints and validates content length.
 */
export async function submitProductReviewAction(payload: {
  productId: string;
  rating: number;
  title?: string;
  comment: string;
}): Promise<{
  success: boolean;
  message: string;
  reviewId?: string;
}> {
  const { productId, rating, title, comment } = payload;

  if (!productId || typeof productId !== "string") {
    return { success: false, message: "Invalid product identifier." };
  }

  const numRating = Math.round(Number(rating));
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return { success: false, message: "Please select a rating between 1 and 5 stars." };
  }

  const cleanedComment = (comment || "").trim();
  if (cleanedComment.length < 5) {
    return { success: false, message: "Please provide a review comment with at least 5 characters." };
  }
  if (cleanedComment.length > 2000) {
    return { success: false, message: "Review comment cannot exceed 2000 characters." };
  }

  const cleanedTitle = (title || "").trim();
  if (cleanedTitle.length > 100) {
    return { success: false, message: "Review headline cannot exceed 100 characters." };
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, message: "You must be signed in to submit a review." };
  }

  // 1. Verify seller cannot review their own product
  const admin = createAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("id, slug, shop_id, shops(seller_profiles(user_id))")
    .eq("id", productId)
    .single();

  if (!product) {
    return { success: false, message: "Product not found." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const shopOwnerUserId = (product.shops as any)?.seller_profiles?.user_id;
  if (shopOwnerUserId === user.id) {
    return { success: false, message: "Sellers are not permitted to review their own products." };
  }

  // 2. Verified purchase validation
  let hasPurchased = false;
  let verifiedOrderItemId: string | null = null;

  try {
    const { data: canReviewRpc, error: rpcErr } = await supabase.rpc(
      "check_user_can_review_product",
      {
        p_user_id: user.id,
        p_product_id: productId,
      }
    );

    if (!rpcErr && typeof canReviewRpc === "boolean") {
      hasPurchased = canReviewRpc;
    } else {
      const { data: ordersWithItem } = await admin
        .from("order_items")
        .select(`
          id,
          seller_orders!inner (
            status,
            customer_orders!inner (
              customer_id
            )
          )
        `)
        .eq("product_id", productId)
        .eq("seller_orders.customer_orders.customer_id", user.id)
        .in("seller_orders.status", ["delivered", "dispatched", "confirmed", "processing", "completed"])
        .limit(1);

      if (ordersWithItem && ordersWithItem.length > 0) {
        hasPurchased = true;
        verifiedOrderItemId = ordersWithItem[0].id;
      }
    }
  } catch (err) {
    console.error("Error checking verified purchase:", err);
  }

  if (!hasPurchased) {
    return {
      success: false,
      message: "Only customers who have purchased and received this product can write a review.",
    };
  }

  // 3. Upsert product review
  const { data: savedReview, error: upsertErr } = await admin
    .from("product_reviews")
    .upsert(
      {
        product_id: productId,
        customer_id: user.id,
        order_item_id: verifiedOrderItemId,
        rating: numRating,
        title: cleanedTitle || null,
        comment: cleanedComment,
        is_verified_purchase: true,
        status: "published",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "customer_id,product_id",
      }
    )
    .select("id")
    .single();

  if (upsertErr) {
    console.error("Error saving review:", upsertErr);
    return { success: false, message: "Failed to save review. Please try again." };
  }

  if (product.slug) {
    revalidatePath(`/products/${product.slug}`);
  }
  revalidatePath(`/products`);

  return {
    success: true,
    message: "Thank you! Your verified review has been published.",
    reviewId: savedReview?.id,
  };
}

/**
 * Delete a product review (by author or platform admin).
 */
export async function deleteProductReviewAction(reviewId: string): Promise<{
  success: boolean;
  message: string;
}> {
  if (!reviewId) return { success: false, message: "Invalid review identifier." };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const admin = createAdminClient();
  const { data: rev } = await admin
    .from("product_reviews")
    .select("id, customer_id, product_id, products(slug)")
    .eq("id", reviewId)
    .single();

  if (!rev) return { success: false, message: "Review not found." };

  // Check permission: author or platform admin
  let canDelete = rev.customer_id === user.id;
  if (!canDelete) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("roles")
      .eq("id", user.id)
      .single();
    if (profile?.roles?.includes("platform_admin")) {
      canDelete = true;
    }
  }

  if (!canDelete) {
    return { success: false, message: "You are not authorized to delete this review." };
  }

  const { error } = await admin.from("product_reviews").delete().eq("id", reviewId);

  if (error) {
    return { success: false, message: "Failed to delete review." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (rev.products as any)?.slug;
  if (slug) {
    revalidatePath(`/products/${slug}`);
  }

  return { success: true, message: "Review deleted successfully." };
}

/**
 * Moderate a review (platform admin only).
 */
export async function moderateProductReviewAction(
  reviewId: string,
  status: "published" | "hidden" | "flagged"
): Promise<{ success: boolean; message: string }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, message: "Authentication required." };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .single();

  if (!profile?.roles?.includes("platform_admin")) {
    return { success: false, message: "Unauthorized. Platform admin access required." };
  }

  const admin = createAdminClient();
  const { data: rev, error } = await admin
    .from("product_reviews")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", reviewId)
    .select("products(slug)")
    .single();

  if (error) {
    return { success: false, message: "Failed to update review status." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const slug = (rev?.products as any)?.slug;
  if (slug) {
    revalidatePath(`/products/${slug}`);
  }

  return { success: true, message: `Review status changed to "${status}".` };
}
