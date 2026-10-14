-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 001 - Core Extensions & Helper Functions
-- Description: Enables required extensions, automated timestamps, and secure RLS helpers.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Automated updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- RLS Helper: Multi-Role Authorization Check
-- Supports users who possess multiple roles (e.g., both 'customer' and 'seller', or 'platform_admin')
CREATE OR REPLACE FUNCTION public.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (role = target_role OR target_role = ANY(roles))
  );
$$;

-- RLS Helper: Check if current authenticated user is a Platform Admin
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.has_role('platform_admin');
$$;

-- RLS Helper: Check if current authenticated user owns a specific shop
CREATE OR REPLACE FUNCTION public.owns_shop(target_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.seller_profiles sp ON s.seller_profile_id = sp.id
    WHERE s.id = target_shop_id AND sp.user_id = auth.uid()
  );
$$;

-- RLS Helper: Check if current authenticated user owns a specific seller profile
CREATE OR REPLACE FUNCTION public.owns_seller_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seller_profiles
    WHERE id = target_profile_id AND user_id = auth.uid()
  );
$$;

-- Explicit Least-Privilege Execution Permissions
REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon, service_role;

REVOKE ALL ON FUNCTION public.owns_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.owns_seller_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_seller_profile(uuid) TO authenticated, service_role;
