-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 001 - Core Extensions & Helper Functions
-- Description: Enables required extensions and automated updated_at trigger function.
-- Note: Table-dependent helper functions (has_role, owns_shop, etc.) are defined in
-- 002_user_and_seller_profiles.sql after their underlying relations are created.
-- =============================================================================

-- Ensure search path includes public and extensions
SET search_path = public, extensions;

-- 1. ENABLE REQUIRED EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. AUTOMATED UPDATED_AT TRIGGER FUNCTION
-- Generic function with zero table dependencies; usable by all domain tables
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Explicit Least-Privilege Execution Permissions
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_updated_at() TO authenticated, service_role;
