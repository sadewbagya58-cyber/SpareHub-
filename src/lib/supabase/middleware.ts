import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { safeRedirectUrl } from "@/lib/validators/auth";

/**
 * Handles Supabase session refresh and enforces role-based route boundaries.
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

  // IMPORTANT: DO NOT write code between createServerClient and getUser().
  // getUser() sends a request to the Supabase Auth server and validates the JWT.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Unauthenticated-only routes (/login, /register)
  if (user && (pathname === "/login" || pathname === "/register")) {
    const rawRedirect = request.nextUrl.searchParams.get("redirect");
    const target = safeRedirectUrl(rawRedirect, "/account");
    const url = request.nextUrl.clone();
    url.pathname = target;
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 2. Customer protected routes (/account/*)
  if (!user && pathname.startsWith("/account")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 3. Seller portal routes (/seller/*)
  if (pathname.startsWith("/seller")) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }

    // Verify seller profile or role in database
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role, roles")
      .eq("id", user.id)
      .maybeSingle();

    let isSeller =
      profile?.role === "seller" ||
      profile?.roles?.includes("seller") ||
      profile?.role === "platform_admin" ||
      profile?.roles?.includes("platform_admin");

    if (!isSeller) {
      const { data: sellerProfile } = await supabase
        .from("seller_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (sellerProfile) {
        isSeller = true;
      }
    }

    if (!isSeller && pathname !== "/seller/shop/new") {
      // Redirect to seller registration / onboarding page
      const url = request.nextUrl.clone();
      url.pathname = "/sell";
      return NextResponse.redirect(url);
    }
  }

  // 4. Admin portal routes (/admin/*)
  if (pathname.startsWith("/admin")) {
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
