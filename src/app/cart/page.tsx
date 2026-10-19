import React from "react";
import { getCartAction } from "@/lib/cart/actions";
import { CartView } from "./cart-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Shopping Cart | SpareHub",
  description: "View and manage your SpareHub multi-vendor shopping cart.",
};

export default async function CartPage() {
  const cart = await getCartAction();

  return <CartView initialCart={cart} />;
}
