import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock, Zap } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getCartAction, type CartResponse } from "@/lib/cart/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Secure Checkout | SpareHub",
  description: "Complete your multi-vendor automotive spare parts purchase.",
};

interface CheckoutPageProps {
  searchParams: Promise<{ buyNow?: string; qty?: string }>;
}

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { buyNow, qty } = await searchParams;
  const authData = await getCurrentUserProfile();

  const buyNowParam = buyNow
    ? `?buyNow=${encodeURIComponent(buyNow)}${qty ? `&qty=${encodeURIComponent(qty)}` : ""}`
    : "";

  if (!authData || !authData.user) {
    redirect(`/login?redirect=${encodeURIComponent(`/checkout${buyNowParam}`)}`);
  }

  let cart: CartResponse;
  let isBuyNow = false;
  let buyNowProductId: string | undefined;
  let buyNowQuantity: number | undefined;

  if (buyNow) {
    const supabase = await createServerSupabaseClient();
    const { data: p, error } = await supabase
      .from("products")
      .select(`
        id,
        title,
        slug,
        part_number,
        brand_name,
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
          slug,
          district,
          status,
          delivery_enabled,
          default_delivery_fee_minor,
          district_delivery_fees,
          free_delivery_threshold_minor,
          supported_districts,
          estimated_delivery_days
        )
      `)
      .eq("id", buyNow)
      .maybeSingle();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s: any = p?.shop;
    if (
      error ||
      !p ||
      !p.is_published ||
      p.status !== "active" ||
      s?.status === "suspended" ||
      p.stock_quantity < 1
    ) {
      redirect("/cart");
    }

    const buyQty = Math.max(1, Math.min(Math.floor(Number(qty) || 1), p.stock_quantity));

    const sortedImages = Array.isArray(p.product_images)
      ? [...p.product_images].sort(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (a: any, b: any) =>
            (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
            (a.display_order ?? 0) - (b.display_order ?? 0)
        )
      : [];
    const firstImg = sortedImages[0]?.image_url;

    const singleItem = {
      id: `buynow-${p.id}`,
      productId: p.id,
      productTitle: p.title,
      productSlug: p.slug,
      partNumber: p.part_number,
      brandName: p.brand_name,
      imageUrl: firstImg,
      priceMinorUnits: Number(p.price_minor_units) || 0,
      stockQuantity: Number(p.stock_quantity) || 0,
      isPublished: true,
      shopId: s?.id || "",
      shopName: s?.name || "Verified Vendor",
      shopSlug: s?.slug,
      shopDistrict: s?.district,
      quantity: buyQty,
    };

    const singleGroup = {
      shopId: s?.id || "",
      shopName: s?.name || "Verified Vendor",
      shopSlug: s?.slug,
      shopDistrict: s?.district,
      deliveryEnabled: s?.delivery_enabled ?? true,
      defaultDeliveryFeeMinor: Number(s?.default_delivery_fee_minor) || 0,
      districtDeliveryFees: s?.district_delivery_fees || null,
      freeDeliveryThresholdMinor: s?.free_delivery_threshold_minor ? Number(s.free_delivery_threshold_minor) : null,
      supportedDistricts: s?.supported_districts || null,
      estimatedDeliveryDays: s?.estimated_delivery_days || "2-4 business days",
      items: [singleItem],
      subtotalMinorUnits: singleItem.priceMinorUnits * buyQty,
    };

    cart = {
      items: [singleItem],
      groups: [singleGroup],
      totalGrandMinor: singleGroup.subtotalMinorUnits,
      totalItemCount: buyQty,
      isAuthenticated: true,
    };

    isBuyNow = true;
    buyNowProductId = p.id;
    buyNowQuantity = buyQty;
  } else {
    cart = await getCartAction();

    // If regular cart is empty, redirect back to cart page
    if (cart.items.length === 0) {
      redirect("/cart");
    }
  }

  const profile = authData.profile;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={isBuyNow ? "/search" : "/cart"}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {isBuyNow ? "Back to Marketplace" : "Back to Shopping Cart"}
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-bold text-sparehub-success bg-green-50 px-3 py-1 rounded-full border border-green-200">
          <Lock className="w-3.5 h-3.5" />
          Bank-Grade 256-Bit SSL Checkout
        </div>
      </div>

      <div className="pb-4 border-b border-sparehub-border">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
            {isBuyNow ? "Instant Express Checkout" : "Secure Order Checkout"}
          </h1>
          {isBuyNow && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <Zap className="w-3.5 h-3.5 text-sparehub-orange fill-sparehub-orange" />
              Buy Now Flow
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {isBuyNow
            ? "Purchasing this single part directly. Your existing shopping cart items remain safe and unaffected."
            : "Review your items, enter delivery details, and place your multi-vendor order."}
        </p>
      </div>

      <CheckoutForm
        cart={cart}
        initialProfile={{
          fullName: profile?.full_name || "",
          phone: profile?.phone || "",
          email: authData.user.email || "",
        }}
        isBuyNow={isBuyNow}
        buyNowProductId={buyNowProductId}
        buyNowQuantity={buyNowQuantity}
      />
    </div>
  );
}
