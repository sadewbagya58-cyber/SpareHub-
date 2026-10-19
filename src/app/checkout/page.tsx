import React from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Lock } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/auth/actions";
import { getCartAction } from "@/lib/cart/actions";
import { CheckoutForm } from "./checkout-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Secure Checkout | SpareHub",
  description: "Complete your multi-vendor automotive spare parts purchase.",
};

export default async function CheckoutPage() {
  const authData = await getCurrentUserProfile();

  if (!authData || !authData.user) {
    redirect("/login?redirect=/checkout");
  }

  const cart = await getCartAction();

  // If cart is empty, redirect back to cart page
  if (cart.items.length === 0) {
    redirect("/cart");
  }

  const profile = authData.profile;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-6">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/cart"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-sparehub-orange transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Shopping Cart
        </Link>

        <div className="flex items-center gap-1.5 text-xs font-bold text-sparehub-success bg-green-50 px-3 py-1 rounded-full border border-green-200">
          <Lock className="w-3.5 h-3.5" />
          Bank-Grade 256-Bit SSL Checkout
        </div>
      </div>

      <div className="pb-4 border-b border-sparehub-border">
        <h1 className="text-2xl sm:text-3xl font-black text-sparehub-dark tracking-tight">
          Secure Order Checkout
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Review your items, enter delivery details, and place your order.
        </p>
      </div>

      <CheckoutForm
        cart={cart}
        initialProfile={{
          fullName: profile?.full_name || "",
          phone: profile?.phone || "",
          email: authData.user.email || "",
        }}
      />
    </div>
  );
}
