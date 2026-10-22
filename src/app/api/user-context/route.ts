import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Unified, non-blocking GET endpoint for client navigation chrome
 * (AuthNav, CartNavBadge, MobileNav, NotificationNavBadge).
 *
 * Why a GET Route Handler instead of mount-time Server Actions:
 * Next.js App Router serializes all Server Action POST invocations in a single client-side
 * FIFO `actionQueue` that also gates router transitions and button mutations.
 * Fetching navigation state via a single parallelized GET request:
 * 1. Never enters or blocks Next.js's `actionQueue`.
 * 2. Replaces 7 separate client/server roundtrips with 1 parallelized server query batch.
 * 3. Returns in 0ms with 0 DB queries when no `sb-*` auth cookie is present.
 */
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          authenticated: false,
          user: null,
          profile: null,
          hasSellerProfile: false,
          cartCount: 0,
          unreadNotificationCount: 0,
        },
        {
          headers: {
            "Cache-Control": "private, no-store, max-age=0",
          },
        }
      );
    }

    const [profileRes, sellerRes, cartRes, notifRes] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("role, roles, full_name")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("cart_items")
        .select("quantity")
        .eq("user_id", user.id),
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false),
    ]);

    const cartCount = (cartRes.data || []).reduce(
      (acc, row) => acc + (Number(row.quantity) || 0),
      0
    );
    const unreadNotificationCount =
      !notifRes.error && typeof notifRes.count === "number" ? notifRes.count : 0;

    return NextResponse.json(
      {
        authenticated: true,
        user: {
          id: user.id,
          email: user.email ?? "",
        },
        profile: profileRes.data ?? null,
        hasSellerProfile: Boolean(sellerRes.data),
        cartCount,
        unreadNotificationCount,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        profile: null,
        hasSellerProfile: false,
        cartCount: 0,
        unreadNotificationCount: 0,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  }
}
