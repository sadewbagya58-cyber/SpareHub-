import dns from "node:dns";
import net from "node:net";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

if (typeof dns?.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
if (typeof net?.setDefaultAutoSelectFamily === "function") {
  net.setDefaultAutoSelectFamily(false);
}
if (typeof net?.setDefaultAutoSelectFamilyAttemptTimeout === "function") {
  net.setDefaultAutoSelectFamilyAttemptTimeout(5000);
}

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Creates an administrative Supabase client using the Secret / Service-Role key.
 *
 * CRITICAL SECURITY INVARIANT:
 * This client bypasses Row Level Security (RLS). It MUST NEVER be imported into
 * client components or browser bundles. It is reserved exclusively for secure,
 * server-side background tasks (e.g. idempotent payment webhook processing).
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "FATAL SECURITY VIOLATION: createAdminClient called in browser context."
    );
  }

  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase administrative environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)"
    );
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return cachedAdminClient;
}
