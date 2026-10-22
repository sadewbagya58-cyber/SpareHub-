import dns from "node:dns";
import net from "node:net";
import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Prioritize IPv4 DNS resolution and disable Node 20+ Happy Eyeballs 250ms connection race
// to prevent 4-35s UND_ERR_CONNECT_TIMEOUT stalls on *.supabase.co cold sockets.
if (typeof dns?.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
if (typeof net?.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}
if (typeof net?.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
  net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
}

/**
 * Request-scoped Supabase client factory.
 * - Uses React `cache()` so multiple Server Components / helpers in the same render pass share one client.
 * - Short-circuits `auth.getUser()` in 0ms when no `sb-*` auth cookies exist on the request.
 * - Deduplicates concurrent `auth.getUser()` calls within the same server request.
 */
const getRequestScopedSupabaseClient = cache(async () => {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase environment variables for server client"
    );
  }

  let authMutatedInRequest = false;

  const client = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
  });

  const origGetUser = client.auth.getUser.bind(client.auth);
  const origSignIn = client.auth.signInWithPassword.bind(client.auth);
  const origSignUp = client.auth.signUp.bind(client.auth);
  const origSignOut = client.auth.signOut.bind(client.auth);

  let inflightGetUserPromise: ReturnType<typeof origGetUser> | null = null;

  client.auth.getUser = ((jwt?: string) => {
    if (jwt) {
      return origGetUser(jwt);
    }

    if (!authMutatedInRequest) {
      const hasAuthCookie = cookieStore
        .getAll()
        .some((c) => c.name.startsWith("sb-"));
      if (!hasAuthCookie) {
        // Fast-path: anonymous request with no Supabase auth cookies (0ms, 0 network calls)
        return Promise.resolve({
          data: { user: null },
          error: null,
        }) as unknown as ReturnType<typeof origGetUser>;
      }
    }

    if (!inflightGetUserPromise) {
      inflightGetUserPromise = origGetUser();
    }
    return inflightGetUserPromise;
  }) as typeof client.auth.getUser;

  client.auth.signInWithPassword = (async (credentials) => {
    authMutatedInRequest = true;
    inflightGetUserPromise = null;
    return origSignIn(credentials);
  }) as typeof client.auth.signInWithPassword;

  client.auth.signUp = (async (credentials) => {
    authMutatedInRequest = true;
    inflightGetUserPromise = null;
    return origSignUp(credentials);
  }) as typeof client.auth.signUp;

  client.auth.signOut = (async (options) => {
    authMutatedInRequest = true;
    inflightGetUserPromise = null;
    return origSignOut(options);
  }) as typeof client.auth.signOut;

  return client;
});

/**
 * Creates a Supabase client for Server Components, Server Actions, and Route Handlers.
 * Manages authentication cookies securely with HttpOnly and SameSite flags.
 */
export async function createServerSupabaseClient() {
  return getRequestScopedSupabaseClient();
}
