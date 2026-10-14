import { createClient } from "@supabase/supabase-js";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase administrative environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SECRET_KEY)"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
