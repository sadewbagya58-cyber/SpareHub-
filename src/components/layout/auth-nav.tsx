"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { User, LogOut, Store, ShieldCheck, ShoppingBag, ChevronDown, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";
import { logoutAction } from "@/lib/auth/actions";
import type { User as SupabaseUser } from "@supabase/supabase-js";

interface AuthNavProps {
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function AuthNav({ isMobile = false, onNavigate }: AuthNavProps) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<{ role: string; roles: string[]; full_name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasSellerProfile, setHasSellerProfile] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    // Check active session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        Promise.all([
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
        ]).then(([profileRes, sellerRes]) => {
          if (profileRes.data) setProfile(profileRes.data);
          if (sellerRes.data) setHasSellerProfile(true);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (login, logout)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          Promise.all([
            supabase
              .from("user_profiles")
              .select("role, roles, full_name")
              .eq("id", session.user.id)
              .maybeSingle(),
            supabase
              .from("seller_profiles")
              .select("id")
              .eq("user_id", session.user.id)
              .maybeSingle(),
          ]).then(([profileRes, sellerRes]) => {
            if (profileRes.data) setProfile(profileRes.data);
            if (sellerRes.data) setHasSellerProfile(true);
          });
        } else {
          setProfile(null);
          setHasSellerProfile(false);
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="h-8 w-20 rounded-lg bg-gray-100 animate-pulse hidden sm:inline-block" />
    );
  }

  const roles = profile?.roles || (profile?.role ? [profile.role] : ["customer"]);
  const isSeller = roles.includes("seller") || roles.includes("platform_admin") || hasSellerProfile;
  const isAdmin = roles.includes("platform_admin");

  if (!user) {
    if (isMobile) {
      return (
        <div className="pt-2 border-t border-sparehub-border space-y-2">
          <Link
            href="/login"
            onClick={onNavigate}
            className="flex items-center justify-center w-full py-2.5 rounded-lg bg-sparehub-dark text-white text-xs font-bold"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            onClick={onNavigate}
            className="flex items-center justify-center w-full py-2.5 rounded-lg border border-sparehub-border text-sparehub-dark text-xs font-bold hover:bg-sparehub-light"
          >
            Register Account
          </Link>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button variant="secondary" size="sm" className="hidden sm:inline-flex gap-1.5">
            <User className="w-4 h-4" />
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  // Mobile rendering when user is logged in
  if (isMobile) {
    return (
      <div className="pt-3 border-t border-sparehub-border space-y-2">
        <div className="px-3 py-2 bg-sparehub-light rounded-lg">
          <p className="text-xs font-bold text-sparehub-dark truncate">
            {profile?.full_name || user.email}
          </p>
          <div className="flex items-center gap-1 mt-1">
            {roles.map((r) => (
              <Badge key={r} variant="neutral" className="text-[9px] uppercase">
                {r.replace("_", " ")}
              </Badge>
            ))}
          </div>
        </div>

        <Link
          href="/account"
          onClick={onNavigate}
          className="px-3 py-2 rounded-md text-xs font-medium text-sparehub-dark hover:bg-sparehub-light flex items-center gap-2"
        >
          <User className="w-4 h-4 text-gray-400" />
          My Profile & Settings
        </Link>

        {isSeller && (
          <>
            <Link
              href="/seller/dashboard"
              onClick={onNavigate}
              className="px-3 py-2 rounded-md text-xs font-medium text-amber-900 hover:bg-amber-50 flex items-center gap-2"
            >
              <Store className="w-4 h-4 text-amber-600" />
              Seller Dashboard
            </Link>
            <Link
              href="/seller/shop"
              onClick={onNavigate}
              className="px-3 py-2 rounded-md text-xs font-medium text-amber-900 hover:bg-amber-50 flex items-center gap-2"
            >
              <Settings className="w-4 h-4 text-amber-600" />
              Shop Settings
            </Link>
          </>
        )}

        {!isSeller && (
          <Link
            href="/sell"
            onClick={onNavigate}
            className="px-3 py-2 rounded-md text-xs font-medium text-sparehub-orange hover:bg-sparehub-orange-light flex items-center gap-2"
          >
            <Store className="w-4 h-4" />
            Open a Seller Shop
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/admin/dashboard"
            onClick={onNavigate}
            className="px-3 py-2 rounded-md text-xs font-medium text-red-900 hover:bg-red-50 flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-red-600" />
            Admin Control Center
          </Link>
        )}

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 rounded-md text-xs font-semibold text-sparehub-error hover:bg-red-50 flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </form>
      </div>
    );
  }

  // Desktop Dropdown rendering
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 p-1.5 pl-2 pr-2.5 rounded-xl border border-sparehub-border hover:bg-sparehub-light transition-colors text-sparehub-dark"
        aria-expanded={dropdownOpen}
        aria-haspopup="true"
      >
        <div className="w-7 h-7 rounded-lg bg-sparehub-orange text-white flex items-center justify-center font-bold text-xs shadow-2xs">
          {(profile?.full_name || user.email || "U").charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-bold max-w-[100px] truncate hidden md:inline-block">
          {profile?.full_name?.split(" ")[0] || "Account"}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-sparehub-border bg-white shadow-lg p-2 space-y-1 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-sparehub-border/60">
            <p className="text-xs font-bold text-sparehub-dark truncate">
              {profile?.full_name || "Valued User"}
            </p>
            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {roles.map((r) => (
                <span
                  key={r}
                  className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-sparehub-light text-sparehub-dark border border-sparehub-border/60"
                >
                  {r.replace("_", " ")}
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/account"
            onClick={() => setDropdownOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sparehub-dark hover:bg-sparehub-light transition-colors"
          >
            <User className="w-4 h-4 text-gray-400" />
            My Profile & Settings
          </Link>

          <Link
            href="/cart"
            onClick={() => setDropdownOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sparehub-dark hover:bg-sparehub-light transition-colors"
          >
            <ShoppingBag className="w-4 h-4 text-gray-400" />
            Shopping Cart
          </Link>

          {isSeller && (
            <>
              <Link
                href="/seller/dashboard"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-amber-900 bg-amber-50/50 hover:bg-amber-50 transition-colors"
              >
                <Store className="w-4 h-4 text-amber-600" />
                Seller Dashboard
              </Link>
              <Link
                href="/seller/shop"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-amber-900 hover:bg-amber-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-amber-600" />
                Shop Profile & Settings
              </Link>
            </>
          )}

          {!isSeller && (
            <Link
              href="/sell"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sparehub-orange hover:bg-sparehub-orange-light/40 transition-colors"
            >
              <Store className="w-4 h-4" />
              Open a Seller Shop
            </Link>
          )}

          {isAdmin && (
            <Link
              href="/admin/dashboard"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-900 bg-red-50/50 hover:bg-red-50 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-red-600" />
              Admin Center
            </Link>
          )}

          <div className="pt-1 border-t border-sparehub-border/60">
            <form action={logoutAction}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-sparehub-error hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
