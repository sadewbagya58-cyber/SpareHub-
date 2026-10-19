"use client";
 
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Store, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { getCartCountAction } from "@/lib/cart/actions";

export function MobileNav() {
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [cartCount, setCartCount] = useState<number>(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsLoggedIn(!!session);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function loadCount() {
      try {
        const c = await getCartCountAction();
        if (isMounted) setCartCount(c);
      } catch {
        // fallback
      }
    }
    loadCount();

    const handleCartUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ count?: number }>;
      if (typeof customEvent.detail?.count === "number") {
        setCartCount(customEvent.detail.count);
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

  const navItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Search", href: "/search", icon: Search },
    { label: "Sell", href: "/sell", icon: Store },
    {
      label: "Cart",
      href: "/cart",
      icon: ShoppingCart,
      badge: cartCount > 0 ? (cartCount > 99 ? "99+" : String(cartCount)) : undefined,
    },
    {
      label: isLoggedIn ? "Account" : "Sign In",
      href: isLoggedIn ? "/account" : "/login",
      icon: User,
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-sparehub-border shadow-lg py-1 px-2"
    >
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive =
            item.href === "/account"
              ? pathname === "/account" ||
                pathname.startsWith("/account/") ||
                pathname.startsWith("/seller") ||
                pathname.startsWith("/admin")
              : pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center py-1.5 px-3 rounded-lg text-[11px] font-medium transition-colors relative min-w-[56px] min-h-[48px]",
                isActive
                  ? "text-sparehub-orange"
                  : "text-gray-500 hover:text-sparehub-dark"
              )}
            >
              <div className="relative">
                <Icon className={cn("w-5 h-5 mb-0.5", isActive && "stroke-[2.5]")} />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 bg-sparehub-orange text-white text-[9px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
