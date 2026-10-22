import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectUrl } from "@/lib/validators/auth";

/**
 * Handles Supabase session refresh and enforces role-based route boundaries.
 * Optimized to eliminate redundant remote Auth / DB roundtrips on:
 * - Server Action POST requests (`next-action` header) & `/api/*` routes (which authenticate internally)
 * - Unauthenticated requests with no `sb-*` cookies (0ms fast-path)
 * - Public routes where middleware route guards do not apply
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // If environment variables are missing, allow request to proceed so public pages render
    return supabaseResponse;
  }

  const pathname = request.nextUrl.pathname;

  // Fast-path 1: Server Actions and API route handlers authenticate internally via `createServerSupabaseClient()`.
  // Skipping middleware remote auth here eliminates duplicate `/auth/v1/user` + DB queries on every button action.
  if (request.headers.get("next-action") || pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  const isAuthPage = pathname === "/login" || pathname === "/register";
  const isAccountRoute = pathname.startsWith("/account");
  const isSellerRoute = pathname.startsWith("/seller");
  const isAdminRoute = pathname.startsWith("/admin");
  const isProtectedRoute = isAccountRoute || isSellerRoute || isAdminRoute;

  const hasAuthCookie = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));

  // Fast-path 2: No Supabase session cookie present (0ms, 0 network calls)
  if (!hasAuthCookie) {
    if (isProtectedRoute) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Fast-path 3: Public marketplace routes (`/`, `/search`, `/products/*`, `/shop/*`, `/sell`, `/cart`, `/wishlist`, `/checkout`)
  // do not require middleware role redirects; let the route render immediately without blocking on edge Auth roundtrips.
  if (!isAuthPage && !isProtectedRoute) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // Validate session with Supabase Auth for auth/protected routes
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Unauthenticated-only routes (/login, /register)
  if (user && isAuthPage) {
    const rawRedirect = request.nextUrl.searchParams.get("redirect");
    const target = safeRedirectUrl(rawRedirect, "/account");
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Customer protected routes (/account/*)
  if (!user && isAccountRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 3. Seller portal routes (/seller/*)
  if (isSellerRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Verify seller profile or role in database concurrently (1 parallel roundtrip instead of 2 sequential)
    const [{ data: profile }, { data: sellerProfile }] = await Promise.all([
      supabase
        .from("user_profiles")
        .select("role, roles")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const isSeller =
      Boolean(sellerProfile) ||
      profile?.role === "seller" ||
      profile?.roles?.includes("seller") ||
      profile?.role === "platform_admin" ||
      profile?.roles?.includes("platform_admin");

    if (!isSeller && pathname !== "/seller/shop/new") {
      // Redirect to seller registration / onboarding page
      const url = request.nextUrl.clone();
      url.pathname = "/sell";
      return NextResponse.redirect(url);
    }
  }

  // 4. Admin portal routes (/admin/*)
  if (isAdminRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, roles")
      .eq("id", user.id)
      .maybeSingle();

    const isAdmin =
      profile?.role === "platform_admin" ||
      profile?.roles?.includes("platform_admin");

    if (!isAdmin) {
      // Non-admins are blocked from the admin portal
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
