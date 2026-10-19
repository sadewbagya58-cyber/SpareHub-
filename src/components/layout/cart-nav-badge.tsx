"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { getCartCountAction } from "@/lib/cart/actions";

export function CartNavBadge() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    async function loadCount() {
      try {
        const c = await getCartCountAction();
        if (isMounted) setCount(c);
      } catch {
        // graceful fallback to 0
      }
    }
    loadCount();

    const handleCartUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (typeof customEvent.detail?.count === "number") {
        setCount(customEvent.detail.count);
      } else {
        loadCount();
      }
    };

    window.addEventListener("sparehub:cart-updated", handleCartUpdated);
    return () => {
      isMounted = false;
      window.removeEventListener("sparehub:cart-updated", handleCartUpdated);
    };
  }, []);

  return (
    <Link
      href="/cart"
      aria-label={`Shopping Cart (${count} items)`}
      className="relative p-2 rounded-lg text-sparehub-dark hover:bg-sparehub-light transition-colors"
    >
      <ShoppingCart className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-1 right-1 bg-sparehub-orange text-white text-[10px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center animate-in zoom-in-75">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
