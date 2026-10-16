-- =============================================================================
-- SPAREHUB PRODUCTION DATABASE SCHEMA (CONSOLIDATED AUDITED MIGRATION SUITE)
-- Brand: SpareHub | Tagline: Every Part. One Marketplace.
-- Target: Supabase PostgreSQL (Project ref: lbwviifpgkykwtmaqpbe)
-- All statements are 100% idempotent and rerun-safe (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- Rebuilt: 2026-10-14T04:26:36.540Z
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000001_core_extensions_and_helpers.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000002_user_and_seller_profiles.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 002 - User Profiles, Seller Profiles & Shops
-- Description: Multi-vendor identity, onboarding, shop status, and verification vault.
-- Defines table-dependent authorization helper functions immediately after tables are created.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. USER PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'platform_admin', 'support_agent')),
  roles text[] NOT NULL DEFAULT ARRAY['customer']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_user_profiles_roles ON public.user_profiles USING gin (roles);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Table-Dependent Helper: Multi-Role Authorization Check
CREATE OR REPLACE FUNCTION public.has_role(target_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND (role = target_role OR target_role = ANY(roles))
  );
$$;

-- Table-Dependent Helper: Platform Admin Check
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.has_role('platform_admin');
$$;

REVOKE ALL ON FUNCTION public.has_role(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, anon, service_role;

-- Updated_at trigger for user_profiles
DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to prevent non-admins from self-escalating roles on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.role = 'customer';
      NEW.roles = ARRAY['customer']::text[];
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.role IS DISTINCT FROM OLD.role OR NEW.roles IS DISTINCT FROM OLD.roles THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_role_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_role_escalation
  BEFORE INSERT OR UPDATE OF role, roles ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Automated profile provisioning trigger when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, roles)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'customer',
    ARRAY['customer']::text[]
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- -----------------------------------------------------------------------------
-- 2. SELLER PROFILES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_type text NOT NULL CHECK (seller_type IN ('retail_shop', 'individual', 'wholesaler', 'importer')),
  id_number text,
  id_type text CHECK (id_type IN ('nic', 'passport', 'business_reg')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected')),
  rejection_reason text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_seller_profiles_status ON public.seller_profiles(verification_status);

-- Table-Dependent Helper: Seller Profile Ownership Check
CREATE OR REPLACE FUNCTION public.owns_seller_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.seller_profiles
    WHERE id = target_profile_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_seller_profile(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_seller_profile(uuid) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_seller_profiles_updated_at ON public.seller_profiles;
CREATE TRIGGER trg_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent sellers from modifying their own verification_status on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_verification_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verification_status = 'unverified';
      NEW.verified_at = NULL;
      NEW.rejection_reason = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.';
      END IF;
      IF NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify verification audit timestamp.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_verification_override ON public.seller_profiles;
CREATE TRIGGER trg_prevent_verification_override
  BEFORE INSERT OR UPDATE OF verification_status, verified_at, rejection_reason ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification_override();


-- -----------------------------------------------------------------------------
-- 3. SHOPS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  logo_url text,
  cover_url text,
  phone text NOT NULL,
  email citext NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  district text NOT NULL,
  city text NOT NULL,
  postal_code text,
  status text NOT NULL DEFAULT 'approved' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  status_reason text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shops_seller_profile_id ON public.shops(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_shops_status ON public.shops(status);
CREATE INDEX IF NOT EXISTS idx_shops_district ON public.shops(district);
CREATE INDEX IF NOT EXISTS idx_shops_slug ON public.shops(slug);

-- Table-Dependent Helper: Shop Ownership Check
CREATE OR REPLACE FUNCTION public.owns_shop(target_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.seller_profiles sp ON s.seller_profile_id = sp.id
    WHERE s.id = target_shop_id AND sp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid) TO authenticated, service_role;

DROP TRIGGER IF EXISTS trg_shops_updated_at ON public.shops;
CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Self-Service Marketplace: Prevent non-admins from suspending shops or tampering with admin audit fields
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- Self-service shops activate immediately unless seller explicitly chooses draft
      IF NEW.status IS NULL OR NEW.status NOT IN ('draft', 'approved') THEN
        NEW.status = 'approved';
      END IF;
      NEW.approved_by = NULL;
      NEW.approved_at = now();
    ELSIF TG_OP = 'UPDATE' THEN
      -- Non-admins cannot suspend shops; only platform administrators retain suspension rights
      IF (NEW.status = 'suspended') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can suspend a shop.';
      END IF;
      IF (NEW.approved_by IS DISTINCT FROM OLD.approved_by) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify shop approval audit fields.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_shop_approval ON public.shops;
CREATE TRIGGER trg_prevent_shop_approval
  BEFORE INSERT OR UPDATE OF status, approved_by, approved_at ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_shop_approval();


-- -----------------------------------------------------------------------------
-- 4. SELLER DOCUMENTS (Secure Private Verification Vault)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_profile_id uuid NOT NULL REFERENCES public.seller_profiles(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('nic_front', 'nic_back', 'br_certificate', 'tax_document', 'proof_of_address', 'importer_license')),
  storage_path text NOT NULL,
  file_name text NOT NULL,
  file_size_bytes bigint,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_documents_profile ON public.seller_documents(seller_profile_id);
CREATE INDEX IF NOT EXISTS idx_seller_documents_shop ON public.seller_documents(shop_id);


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

-- user_profiles RLS
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Users can insert own initial profile" ON public.user_profiles;
CREATE POLICY "Users can insert own initial profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins full management on user_profiles" ON public.user_profiles;
CREATE POLICY "Admins full management on user_profiles"
  ON public.user_profiles FOR ALL
  USING (public.is_platform_admin());

-- seller_profiles RLS
DROP POLICY IF EXISTS "Sellers can view own seller profile" ON public.seller_profiles;
CREATE POLICY "Sellers can view own seller profile"
  ON public.seller_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can create own seller profile" ON public.seller_profiles;
CREATE POLICY "Sellers can create own seller profile"
  ON public.seller_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can update own seller profile" ON public.seller_profiles;
CREATE POLICY "Sellers can update own seller profile"
  ON public.seller_profiles FOR UPDATE
  USING (user_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins full management on seller_profiles" ON public.seller_profiles;
CREATE POLICY "Admins full management on seller_profiles"
  ON public.seller_profiles FOR ALL
  USING (public.is_platform_admin());

-- shops RLS
DROP POLICY IF EXISTS "Public can view approved shops" ON public.shops;
DROP POLICY IF EXISTS "Public can view active shops" ON public.shops;
CREATE POLICY "Public can view active shops"
  ON public.shops FOR SELECT
  USING (status != 'suspended');

DROP POLICY IF EXISTS "Sellers can view own shop in any state" ON public.shops;
CREATE POLICY "Sellers can view own shop in any state"
  ON public.shops FOR SELECT
  USING (
    public.owns_seller_profile(seller_profile_id)
    OR public.owns_shop(id)
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Sellers can create shop for their verified profile" ON public.shops;
DROP POLICY IF EXISTS "Sellers can create own shop" ON public.shops;
CREATE POLICY "Sellers can create own shop"
  ON public.shops FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

DROP POLICY IF EXISTS "Sellers can update own shop details" ON public.shops;
CREATE POLICY "Sellers can update own shop details"
  ON public.shops FOR UPDATE
  USING (
    public.owns_seller_profile(seller_profile_id)
    OR public.owns_shop(id)
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admins full management on shops" ON public.shops;
CREATE POLICY "Admins full management on shops"
  ON public.shops FOR ALL
  USING (public.is_platform_admin());

-- seller_documents RLS (Strictly Protected - ZERO public access)
DROP POLICY IF EXISTS "Sellers can view own documents" ON public.seller_documents;
CREATE POLICY "Sellers can view own documents"
  ON public.seller_documents FOR SELECT
  USING (public.owns_seller_profile(seller_profile_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can upload own verification documents" ON public.seller_documents;
CREATE POLICY "Sellers can upload own verification documents"
  ON public.seller_documents FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

DROP POLICY IF EXISTS "Admins full management on seller_documents" ON public.seller_documents;
CREATE POLICY "Admins full management on seller_documents"
  ON public.seller_documents FOR ALL
  USING (public.is_platform_admin());


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000003_vehicle_taxonomy.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 003 - Hierarchical Vehicle Taxonomy
-- Description: Vehicle types, makes, models, and variants supporting all categories.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. VEHICLE TYPES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_types (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed initial vehicle types (Idempotent ON CONFLICT)
INSERT INTO public.vehicle_types (id, name, display_order) VALUES
  ('car', 'Cars & SUVs', 1),
  ('three_wheeler', 'Three-Wheelers', 2),
  ('motorcycle', 'Motorcycles', 3),
  ('van', 'Vans', 4),
  ('bus', 'Buses', 5),
  ('truck', 'Lorries & Trucks', 6),
  ('tractor', 'Tractors', 7),
  ('heavy_machinery', 'Heavy Machinery', 8)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. VEHICLE MAKES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_makes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id text NOT NULL REFERENCES public.vehicle_types(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_type_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_makes_type ON public.vehicle_makes(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_makes_name ON public.vehicle_makes(name);


-- -----------------------------------------------------------------------------
-- 3. VEHICLE MODELS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id uuid NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make_id, name)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_models_make ON public.vehicle_models(make_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_models_name ON public.vehicle_models(name);


-- -----------------------------------------------------------------------------
-- 4. VEHICLE VARIANTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id uuid NOT NULL REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  generation_chassis text,
  year_start int NOT NULL CHECK (year_start >= 1950 AND year_start <= 2035),
  year_end int CHECK (year_end IS NULL OR year_end >= year_start),
  engine_code text,
  transmission text,
  fuel_type text CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid', 'cng')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_variants_model ON public.vehicle_variants(model_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_variants_years ON public.vehicle_variants(year_start, year_end);
CREATE INDEX IF NOT EXISTS idx_vehicle_variants_chassis ON public.vehicle_variants(generation_chassis);


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_variants ENABLE ROW LEVEL SECURITY;

-- Public read policies
DROP POLICY IF EXISTS "Public read active vehicle_types" ON public.vehicle_types;
CREATE POLICY "Public read active vehicle_types"
  ON public.vehicle_types FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Public read vehicle_makes" ON public.vehicle_makes;
CREATE POLICY "Public read vehicle_makes"
  ON public.vehicle_makes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read vehicle_models" ON public.vehicle_models;
CREATE POLICY "Public read vehicle_models"
  ON public.vehicle_models FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public read vehicle_variants" ON public.vehicle_variants;
CREATE POLICY "Public read vehicle_variants"
  ON public.vehicle_variants FOR SELECT
  USING (true);

-- Admin management policies
DROP POLICY IF EXISTS "Admin full management vehicle_types" ON public.vehicle_types;
CREATE POLICY "Admin full management vehicle_types"
  ON public.vehicle_types FOR ALL
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management vehicle_makes" ON public.vehicle_makes;
CREATE POLICY "Admin full management vehicle_makes"
  ON public.vehicle_makes FOR ALL
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management vehicle_models" ON public.vehicle_models;
CREATE POLICY "Admin full management vehicle_models"
  ON public.vehicle_models FOR ALL
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management vehicle_variants" ON public.vehicle_variants;
CREATE POLICY "Admin full management vehicle_variants"
  ON public.vehicle_variants FOR ALL
  USING (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 5. SEED SRI LANKAN VEHICLE TAXONOMY (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

INSERT INTO public.vehicle_makes (id, vehicle_type_id, name, slug, is_popular) VALUES
  ('m1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'toyota', true),
  ('m1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'honda', true),
  ('m1000000-0000-0000-0000-000000000003', 'car', 'Nissan', 'nissan', true),
  ('m1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'suzuki', true),
  ('m1000000-0000-0000-0000-000000000005', 'car', 'Mitsubishi', 'mitsubishi', true),
  ('m1000000-0000-0000-0000-000000000006', 'three_wheeler', 'Bajaj', 'bajaj-three-wheeler', true),
  ('m1000000-0000-0000-0000-000000000007', 'three_wheeler', 'TVS', 'tvs-three-wheeler', true),
  ('m1000000-0000-0000-0000-000000000008', 'three_wheeler', 'Piaggio', 'piaggio', false),
  ('m1000000-0000-0000-0000-000000000009', 'motorcycle', 'Bajaj', 'bajaj-moto', true),
  ('m1000000-0000-0000-0000-000000000010', 'motorcycle', 'Yamaha', 'yamaha', true),
  ('m1000000-0000-0000-0000-000000000011', 'motorcycle', 'Honda', 'honda-moto', true),
  ('m1000000-0000-0000-0000-000000000012', 'motorcycle', 'TVS', 'tvs-moto', true),
  ('m1000000-0000-0000-0000-000000000013', 'van', 'Toyota', 'toyota-van', true),
  ('m1000000-0000-0000-0000-000000000014', 'van', 'Nissan', 'nissan-van', true),
  ('m1000000-0000-0000-0000-000000000015', 'truck', 'Isuzu', 'isuzu', true),
  ('m1000000-0000-0000-0000-000000000016', 'truck', 'Mitsubishi Fuso', 'fuso', true),
  ('m1000000-0000-0000-0000-000000000017', 'truck', 'Tata', 'tata', true),
  ('m1000000-0000-0000-0000-000000000018', 'bus', 'Ashok Leyland', 'ashok-leyland', true),
  ('m1000000-0000-0000-0000-000000000019', 'tractor', 'Massey Ferguson', 'massey-ferguson', true),
  ('m1000000-0000-0000-0000-000000000020', 'heavy_machinery', 'Caterpillar', 'caterpillar', true),
  ('m1000000-0000-0000-0000-000000000021', 'heavy_machinery', 'Komatsu', 'komatsu', true)
ON CONFLICT (vehicle_type_id, name) DO NOTHING;

INSERT INTO public.vehicle_models (id, make_id, name, slug) VALUES
  ('d1000000-0000-0000-0000-000000000001', 'm1000000-0000-0000-0000-000000000001', 'Corolla', 'corolla'),
  ('d1000000-0000-0000-0000-000000000002', 'm1000000-0000-0000-0000-000000000001', 'Prius', 'prius'),
  ('d1000000-0000-0000-0000-000000000003', 'm1000000-0000-0000-0000-000000000001', 'Aqua', 'aqua'),
  ('d1000000-0000-0000-0000-000000000004', 'm1000000-0000-0000-0000-000000000001', 'Vitz', 'vitz'),
  ('d1000000-0000-0000-0000-000000000005', 'm1000000-0000-0000-0000-000000000001', 'Axio', 'axio'),
  ('d1000000-0000-0000-0000-000000000006', 'm1000000-0000-0000-0000-000000000001', 'Premio', 'premio'),
  ('d1000000-0000-0000-0000-000000000007', 'm1000000-0000-0000-0000-000000000002', 'Civic', 'civic'),
  ('d1000000-0000-0000-0000-000000000008', 'm1000000-0000-0000-0000-000000000002', 'Fit / Jazz', 'fit'),
  ('d1000000-0000-0000-0000-000000000009', 'm1000000-0000-0000-0000-000000000002', 'Vezel', 'vezel'),
  ('d1000000-0000-0000-0000-000000000010', 'm1000000-0000-0000-0000-000000000002', 'Grace', 'grace'),
  ('d1000000-0000-0000-0000-000000000011', 'm1000000-0000-0000-0000-000000000004', 'Alto', 'alto'),
  ('d1000000-0000-0000-0000-000000000012', 'm1000000-0000-0000-0000-000000000004', 'WagonR', 'wagonr'),
  ('d1000000-0000-0000-0000-000000000013', 'm1000000-0000-0000-0000-000000000004', 'Swift', 'swift'),
  ('d1000000-0000-0000-0000-000000000014', 'm1000000-0000-0000-0000-000000000004', 'Spacia', 'spacia'),
  ('d1000000-0000-0000-0000-000000000015', 'm1000000-0000-0000-0000-000000000006', 'RE 205 (2-Stroke)', 're-205-2s'),
  ('d1000000-0000-0000-0000-000000000016', 'm1000000-0000-0000-0000-000000000006', 'RE 205 (4-Stroke)', 're-205-4s'),
  ('d1000000-0000-0000-0000-000000000017', 'm1000000-0000-0000-0000-000000000006', 'Compact 4S', 'compact-4s'),
  ('d1000000-0000-0000-0000-000000000018', 'm1000000-0000-0000-0000-000000000007', 'King Deluxe', 'king-deluxe'),
  ('d1000000-0000-0000-0000-000000000019', 'm1000000-0000-0000-0000-000000000007', 'King Duramax', 'king-duramax'),
  ('d1000000-0000-0000-0000-000000000020', 'm1000000-0000-0000-0000-000000000009', 'Pulsar 150', 'pulsar-150'),
  ('d1000000-0000-0000-0000-000000000021', 'm1000000-0000-0000-0000-000000000009', 'Discover 125', 'discover-125'),
  ('d1000000-0000-0000-0000-000000000022', 'm1000000-0000-0000-0000-000000000010', 'FZ-S', 'fz-s'),
  ('d1000000-0000-0000-0000-000000000023', 'm1000000-0000-0000-0000-000000000011', 'Dio', 'dio'),
  ('d1000000-0000-0000-0000-000000000024', 'm1000000-0000-0000-0000-000000000013', 'HiAce KDH / GDH', 'hiace'),
  ('d1000000-0000-0000-0000-000000000025', 'm1000000-0000-0000-0000-000000000014', 'Caravan E25 / NV350', 'caravan'),
  ('d1000000-0000-0000-0000-000000000026', 'm1000000-0000-0000-0000-000000000015', 'Elf NKR / NPR', 'isuzu-elf'),
  ('d1000000-0000-0000-0000-000000000027', 'm1000000-0000-0000-0000-000000000016', 'Canter FE / FG', 'canter'),
  ('d1000000-0000-0000-0000-000000000028', 'm1000000-0000-0000-0000-000000000017', 'Ace Dimo Batta', 'tata-ace'),
  ('d1000000-0000-0000-0000-000000000029', 'm1000000-0000-0000-0000-000000000018', 'Viking Chassis', 'leyland-viking'),
  ('d1000000-0000-0000-0000-000000000030', 'm1000000-0000-0000-0000-000000000019', 'MF 240', 'mf-240'),
  ('d1000000-0000-0000-0000-000000000031', 'm1000000-0000-0000-0000-000000000020', '320D Excavator', 'cat-320d'),
  ('d1000000-0000-0000-0000-000000000032', 'm1000000-0000-0000-0000-000000000003', 'Sunny', 'sunny'),
  ('d1000000-0000-0000-0000-000000000033', 'm1000000-0000-0000-0000-000000000003', 'Leaf', 'leaf'),
  ('d1000000-0000-0000-0000-000000000034', 'm1000000-0000-0000-0000-000000000003', 'X-Trail', 'x-trail'),
  ('d1000000-0000-0000-0000-000000000035', 'm1000000-0000-0000-0000-000000000005', 'Lancer', 'lancer'),
  ('d1000000-0000-0000-0000-000000000036', 'm1000000-0000-0000-0000-000000000005', 'Montero / Pajero', 'montero'),
  ('d1000000-0000-0000-0000-000000000037', 'm1000000-0000-0000-0000-000000000008', 'Ape City / Xtra LDX', 'ape-city'),
  ('d1000000-0000-0000-0000-000000000038', 'm1000000-0000-0000-0000-000000000012', 'Apache RTR 160', 'apache-rtr-160'),
  ('d1000000-0000-0000-0000-000000000039', 'm1000000-0000-0000-0000-000000000012', 'NTorq 125', 'ntorq-125'),
  ('d1000000-0000-0000-0000-000000000040', 'm1000000-0000-0000-0000-000000000021', 'PC200-8 Excavator', 'pc200-8')
ON CONFLICT (make_id, name) DO NOTHING;

INSERT INTO public.vehicle_variants (id, model_id, generation_chassis, year_start, year_end, engine_code, transmission, fuel_type) VALUES
  ('v1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'AE110 (5A-FE 1.5L)', 1995, 2000, '5A-FE', 'Automatic / Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'NZE121 (1NZ-FE 1.5L)', 2000, 2006, '1NZ-FE', 'Automatic / Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'ZRE142 / NZE141', 2007, 2013, '1NZ-FE / 1ZR-FE', 'Automatic / CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'ZVW30 (3rd Gen Hybrid)', 2009, 2015, '2ZR-FXE 1.8L', 'e-CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 'ZVW50 (4th Gen Hybrid)', 2015, 2022, '2ZR-FXE 1.8L', 'e-CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000003', 'NHP10 (1NZ-FXE Hybrid)', 2011, 2021, '1NZ-FXE 1.5L', 'e-CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000004', 'KSP90 / SCP90', 2005, 2010, '1KR-FE / 2SZ-FE', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000004', 'KSP130 / NSP130', 2011, 2020, '1KR-FE / 1NR-FE', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000005', 'NZE141 (1.5L Petrol)', 2006, 2012, '1NZ-FE', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000005', 'NKE165 (Hybrid) / NZE161', 2012, 2023, '1NZ-FXE / 1NZ-FE', 'e-CVT / CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000006', 'NZT260 / ZRT260 (260 Series)', 2007, 2021, '1NZ-FE / 2ZR-FAE', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000007', 'FD1 / FD4 (8th Gen)', 2006, 2011, 'R18A / R16A', 'Automatic / Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000007', 'FC1 / FK7 (10th Gen Turbo)', 2016, 2021, 'L15B7 / P10A2', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000008', 'GP1 (IMA Hybrid)', 2010, 2013, 'LDA 1.3L', 'CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000015', 'd1000000-0000-0000-0000-000000000008', 'GP5 (i-DCD Hybrid)', 2013, 2020, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000016', 'd1000000-0000-0000-0000-000000000009', 'RU3 / RU4 (Hybrid Z / RS)', 2013, 2021, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000017', 'd1000000-0000-0000-0000-000000000010', 'GM4 / GM5 (i-DCD Hybrid)', 2014, 2020, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000018', 'd1000000-0000-0000-0000-000000000011', 'Alto 800 (F8D Indian)', 2012, 2022, 'F8D 796cc', '5-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000019', 'd1000000-0000-0000-0000-000000000011', 'HA36S / HA36V (Japanese 660cc)', 2014, 2021, 'R06A 660cc', 'CVT / AGS', 'petrol'),
  ('v1000000-0000-0000-0000-000000000020', 'd1000000-0000-0000-0000-000000000012', 'MH34S / MH44S (FZ / Stingray)', 2012, 2017, 'R06A 660cc', 'CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000021', 'd1000000-0000-0000-0000-000000000012', 'MH35S / MH55S (FX / FZ / Stingray)', 2017, 2023, 'R06A 660cc', 'CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000022', 'd1000000-0000-0000-0000-000000000013', 'ZC11S / ZC72S (1.2L / 1.3L)', 2004, 2016, 'M13A / K12B', 'Automatic / CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000023', 'd1000000-0000-0000-0000-000000000013', 'ZC13S / ZC83S (RS Turbo / Hybrid)', 2017, 2023, 'K10C / K12C', '6AT / CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000024', 'd1000000-0000-0000-0000-000000000014', 'MK42S / MK53S (Custom Z / XS)', 2015, 2023, 'R06A 660cc', 'CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000025', 'd1000000-0000-0000-0000-000000000015', 'RE 2S 145cc (2-Stroke)', 1998, 2008, 'RE145-2S', '4-Speed Hand Shift', 'petrol'),
  ('v1000000-0000-0000-0000-000000000026', 'd1000000-0000-0000-0000-000000000016', 'RE 4S 175cc / 205cc', 2007, 2016, 'RE205-4S', '4-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000027', 'd1000000-0000-0000-0000-000000000017', 'RE Compact 4S FL / BS6', 2014, NULL, 'DTS-i 198cc', '4-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000028', 'd1000000-0000-0000-0000-000000000018', 'King 4S 200cc Deluxe', 2010, NULL, 'TVS-200-4S', '4-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000029', 'd1000000-0000-0000-0000-000000000019', 'King Duramax 225cc LC', 2018, NULL, 'TVS-225-LC', '4-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000030', 'd1000000-0000-0000-0000-000000000020', 'UG4.5 / Twin Disc BS4/BS6', 2010, NULL, 'DTS-i 149cc', '5-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000031', 'd1000000-0000-0000-0000-000000000021', 'Discover 125M / DRL Disc', 2011, 2021, 'DTS-i 124.5cc', '5-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000032', 'd1000000-0000-0000-0000-000000000022', 'FZ-S V2.0 / V3.0 FI', 2014, NULL, 'BlueCore 149cc FI', '5-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000033', 'd1000000-0000-0000-0000-000000000023', 'HET 110cc / DLX LED', 2012, NULL, 'HET 109.2cc', 'V-Matic CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000034', 'd1000000-0000-0000-0000-000000000024', 'KDH200 / KDH201 / KDH222', 2004, 2020, '1KD-FTV 3.0L / 2KD-FTV 2.5L', 'Automatic / Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000035', 'd1000000-0000-0000-0000-000000000025', 'E25 (ZD30) / NV350 E26 (YD25)', 2001, 2021, 'ZD30DDTi / YD25DDTi', 'Automatic / Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000036', 'd1000000-0000-0000-0000-000000000026', 'NKR66 / NPR75 (10.5ft / 14.5ft)', 1999, 2020, '4HF1 4.3L / 4HK1 5.2L', '5/6-Speed Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000037', 'd1000000-0000-0000-0000-000000000027', 'FE70 / FE85 / FBA', 2002, 2020, '4D33 / 4M50', '5-Speed Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000038', 'd1000000-0000-0000-0000-000000000028', 'Ace HT / EX2 (Dimo Batta)', 2006, 2020, '275 IDI 702cc', '4/5-Speed Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000039', 'd1000000-0000-0000-0000-000000000029', 'Viking 210 / 222 WB (H-Series)', 2005, NULL, 'HA6ETI 5.7L', '5/6-Speed Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000040', 'd1000000-0000-0000-0000-000000000030', 'MF 240 2WD (50 HP)', 1985, NULL, 'Perkins AD3.152', '8F / 2R Sliding Spur', 'diesel'),
  ('v1000000-0000-0000-0000-000000000041', 'd1000000-0000-0000-0000-000000000031', '320D / 320D2 Hydraulic Excavator', 2006, 2020, 'CAT C6.4 ACERT', 'Hydrostatic', 'diesel'),
  ('v1000000-0000-0000-0000-000000000042', 'd1000000-0000-0000-0000-000000000032', 'FB15 / N16 (Super Saloon / Ex Saloon)', 1998, 2006, 'QG15DE 1.5L', 'Automatic / Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000043', 'd1000000-0000-0000-0000-000000000033', 'ZE0 / AZE0 (24kWh / 30kWh) & ZE1 (40kWh)', 2011, 2022, 'EM57 / EM61', 'Single-Speed Reduction', 'electric'),
  ('v1000000-0000-0000-0000-000000000044', 'd1000000-0000-0000-0000-000000000034', 'NT32 / HT32 (20X Hybrid)', 2014, 2021, 'MR20DD 2.0L', 'Xtronic CVT', 'hybrid'),
  ('v1000000-0000-0000-0000-000000000045', 'd1000000-0000-0000-0000-000000000035', 'CS2A / CS3A (GLX) & CY2A (EX)', 2001, 2016, '4G15 / 4A91', 'INVECS-III CVT / Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000046', 'd1000000-0000-0000-0000-000000000036', 'V73 / V78 / V93 / V98 (3.2 DI-D)', 2000, 2019, '4M41 3.2L / 6G72', 'Automatic / Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000047', 'd1000000-0000-0000-0000-000000000037', 'Ape City Diesel / Xtra LDX 435cc', 2008, NULL, 'Greaves G435', '4-Speed Manual', 'diesel'),
  ('v1000000-0000-0000-0000-000000000048', 'd1000000-0000-0000-0000-000000000038', 'RTR 160 2V / 4V', 2012, NULL, 'RT-Fi 159.7cc', '5-Speed Manual', 'petrol'),
  ('v1000000-0000-0000-0000-000000000049', 'd1000000-0000-0000-0000-000000000039', 'NTorq 125 Race Edition / Disc', 2018, NULL, 'CVTi-REVV 124.8cc', 'CVT', 'petrol'),
  ('v1000000-0000-0000-0000-000000000050', 'd1000000-0000-0000-0000-000000000040', 'PC200-8 / PC200LC-8', 2006, 2020, 'SAA6D107E-1', 'HydrauMind', 'diesel')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000004_catalog_and_compatibility.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 004 - Product Catalog & Vehicle Compatibility
-- Description: Multi-vendor catalog, images, full-text indexes, and structured compatibility.
-- Fix: Robust partial unique indexes resolving nullable column edge-cases.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. CATEGORIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon_name text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

DROP TRIGGER IF EXISTS trg_categories_updated_at ON public.categories;
CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  title text NOT NULL,
  slug text NOT NULL,
  description text NOT NULL,
  part_number text,
  oem_part_number text,
  brand_name text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('brand_new', 'reconditioned', 'used')),
  -- Exact integer minor currency units: 100 minor units = 1.00 LKR
  price_minor_units bigint NOT NULL CHECK (price_minor_units >= 0),
  compare_at_price_minor_units bigint CHECK (compare_at_price_minor_units IS NULL OR compare_at_price_minor_units >= price_minor_units),
  -- Non-negative stock constraint strictly enforced
  stock_quantity int NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  warranty_period_months int DEFAULT 0 CHECK (warranty_period_months >= 0),
  warranty_details text,
  is_universal boolean NOT NULL DEFAULT false,
  is_published boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'out_of_stock', 'archived', 'banned')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(status);
CREATE INDEX IF NOT EXISTS idx_products_published ON public.products(is_published);
CREATE INDEX IF NOT EXISTS idx_products_price ON public.products(price_minor_units);

-- Trigram indexes for resilient partial search across part numbers and titles
CREATE INDEX IF NOT EXISTS idx_products_part_number_trgm ON public.products USING gin (part_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_oem_trgm ON public.products USING gin (oem_part_number gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_products_title_trgm ON public.products USING gin (title gin_trgm_ops);

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. PRODUCT IMAGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  display_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);


-- -----------------------------------------------------------------------------
-- 4. PRODUCT VEHICLE COMPATIBILITY
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vehicle_variant_id uuid REFERENCES public.vehicle_variants(id) ON DELETE CASCADE,
  vehicle_model_id uuid REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  notes text,
  is_exact_fit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_variant_or_model CHECK (vehicle_variant_id IS NOT NULL OR vehicle_model_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_compatibility_product ON public.product_compatibility(product_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_variant ON public.product_compatibility(vehicle_variant_id);
CREATE INDEX IF NOT EXISTS idx_compatibility_model ON public.product_compatibility(vehicle_model_id);

-- Robust partial unique indexes: handles nullable variant/model cleanly without SQL NULL duplicate quirks
CREATE UNIQUE INDEX IF NOT EXISTS idx_compat_product_variant_unique
  ON public.product_compatibility (product_id, vehicle_variant_id)
  WHERE vehicle_variant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_compat_product_model_unique
  ON public.product_compatibility (product_id, vehicle_model_id)
  WHERE vehicle_variant_id IS NULL;

-- Enforce hierarchy consistency: if vehicle_variant_id is specified, it must belong to vehicle_model_id
CREATE OR REPLACE FUNCTION public.validate_product_compatibility_hierarchy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_variant_model_id uuid;
BEGIN
  IF NEW.vehicle_variant_id IS NOT NULL THEN
    SELECT model_id INTO v_variant_model_id
    FROM public.vehicle_variants
    WHERE id = NEW.vehicle_variant_id;

    IF v_variant_model_id IS NULL THEN
      RAISE EXCEPTION 'Invalid vehicle_variant_id: %', NEW.vehicle_variant_id;
    END IF;

    IF NEW.vehicle_model_id IS NULL THEN
      NEW.vehicle_model_id := v_variant_model_id;
    ELSIF NEW.vehicle_model_id <> v_variant_model_id THEN
      RAISE EXCEPTION 'vehicle_variant_id (%) does not belong to vehicle_model_id (%)', NEW.vehicle_variant_id, NEW.vehicle_model_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_product_compatibility_hierarchy ON public.product_compatibility;
CREATE TRIGGER trg_validate_product_compatibility_hierarchy
  BEFORE INSERT OR UPDATE ON public.product_compatibility
  FOR EACH ROW EXECUTE FUNCTION public.validate_product_compatibility_hierarchy();


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_compatibility ENABLE ROW LEVEL SECURITY;

-- categories RLS
DROP POLICY IF EXISTS "Public read active categories" ON public.categories;
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin full management categories" ON public.categories;
CREATE POLICY "Admin full management categories"
  ON public.categories FOR ALL
  USING (public.is_platform_admin());

-- Seed Core Automotive Categories (Idempotent ON CONFLICT)
INSERT INTO public.categories (id, name, slug, icon_name, display_order) VALUES
  ('c1000000-0000-0000-0000-000000000001', 'Engine & Drivetrain', 'engine-drivetrain', 'Wrench', 1),
  ('c1000000-0000-0000-0000-000000000002', 'Braking Systems', 'braking-systems', 'Disc', 2),
  ('c1000000-0000-0000-0000-000000000003', 'Suspension & Steering', 'suspension-steering', 'Activity', 3),
  ('c1000000-0000-0000-0000-000000000004', 'Electrical & Lighting', 'electrical-lighting', 'Zap', 4),
  ('c1000000-0000-0000-0000-000000000005', 'Cooling & Heating', 'cooling-heating', 'Thermometer', 5),
  ('c1000000-0000-0000-0000-000000000006', 'Body & Panel Parts', 'body-panel-parts', 'Shield', 6),
  ('c1000000-0000-0000-0000-000000000007', 'Filters & Maintenance', 'filters-maintenance', 'Filter', 7),
  ('c1000000-0000-0000-0000-000000000008', 'Clutch & Transmission', 'clutch-transmission', 'Cog', 8),
  ('c1000000-0000-0000-0000-000000000009', 'Tires & Wheels', 'tires-wheels', 'Circle', 9),
  ('c1000000-0000-0000-0000-000000000010', 'Interior & Accessories', 'interior-accessories', 'Sliders', 10)
ON CONFLICT (slug) DO NOTHING;

-- products RLS
DROP POLICY IF EXISTS "Public read published products from approved shops" ON public.products;
DROP POLICY IF EXISTS "Public read published products from active shops" ON public.products;
CREATE POLICY "Public read published products from active shops"
  ON public.products FOR SELECT
  USING (
    is_published = true
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = products.shop_id AND s.status != 'suspended'
    )
  );

DROP POLICY IF EXISTS "Sellers can view own shop products in any status" ON public.products;
CREATE POLICY "Sellers can view own shop products in any status"
  ON public.products FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can create products for own approved shop" ON public.products;
DROP POLICY IF EXISTS "Sellers can create products for own shop" ON public.products;
CREATE POLICY "Sellers can create products for own shop"
  ON public.products FOR INSERT
  WITH CHECK (
    public.owns_shop(shop_id)
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.status != 'suspended'
    )
  );

DROP POLICY IF EXISTS "Sellers can update own shop products" ON public.products;
CREATE POLICY "Sellers can update own shop products"
  ON public.products FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can delete own shop products" ON public.products;
CREATE POLICY "Sellers can delete own shop products"
  ON public.products FOR DELETE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management products" ON public.products;
CREATE POLICY "Admin full management products"
  ON public.products FOR ALL
  USING (public.is_platform_admin());

-- product_images RLS
DROP POLICY IF EXISTS "Public read images of visible products" ON public.product_images;
CREATE POLICY "Public read images of visible products"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_images.product_id
        AND p.is_published = true
        AND s.status != 'suspended'
    )
  );

DROP POLICY IF EXISTS "Sellers can manage images of own products" ON public.product_images;
CREATE POLICY "Sellers can manage images of own products"
  ON public.product_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_images.product_id AND public.owns_shop(p.shop_id)
    )
    OR public.is_platform_admin()
  );

-- product_compatibility RLS
DROP POLICY IF EXISTS "Public read compatibility of visible products" ON public.product_compatibility;
CREATE POLICY "Public read compatibility of visible products"
  ON public.product_compatibility FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_compatibility.product_id
        AND p.is_published = true
        AND s.status != 'suspended'
    )
  );

DROP POLICY IF EXISTS "Sellers can manage compatibility of own products" ON public.product_compatibility;
CREATE POLICY "Sellers can manage compatibility of own products"
  ON public.product_compatibility FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_compatibility.product_id AND public.owns_shop(p.shop_id)
    )
    OR public.is_platform_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_compatibility.product_id AND public.owns_shop(p.shop_id)
    )
    OR public.is_platform_admin()
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000005_cart_and_multi_vendor_orders.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 005 - Multi-Vendor Cart & Partitioned Orders
-- Description: Shopping cart, customer orders, shop-partitioned suborders, item snapshots,
-- and an atomic, transactional checkout function resistant to race conditions & price tampering.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. SHOPPING CART ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON public.cart_items(product_id);

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. CUSTOMER ORDERS (Aggregated Customer Invoice)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'partially_dispatched', 'completed', 'cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('online', 'cod')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'cod_pending', 'failed', 'refunded')),
  shipping_full_name text NOT NULL,
  shipping_phone text NOT NULL,
  shipping_address_line1 text NOT NULL,
  shipping_address_line2 text,
  shipping_district text NOT NULL,
  shipping_city text NOT NULL,
  shipping_postal_code text,
  customer_notes text,
  total_items_subtotal_minor bigint NOT NULL CHECK (total_items_subtotal_minor >= 0),
  total_delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (total_delivery_fee_minor >= 0),
  total_discount_minor bigint NOT NULL DEFAULT 0 CHECK (total_discount_minor >= 0),
  total_grand_minor bigint NOT NULL CHECK (total_grand_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON public.customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created ON public.customer_orders(created_at DESC);

DROP TRIGGER IF EXISTS trg_customer_orders_updated_at ON public.customer_orders;
CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. SELLER ORDERS (Sub-orders Partitioned by Shop)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  sub_order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned')),
  fulfillment_type text NOT NULL DEFAULT 'seller_courier',
  courier_name text,
  tracking_number text,
  tracking_url text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_orders_customer_order ON public.seller_orders(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_shop ON public.seller_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_status ON public.seller_orders(status);

DROP TRIGGER IF EXISTS trg_seller_orders_updated_at ON public.seller_orders;
CREATE TRIGGER trg_seller_orders_updated_at
  BEFORE UPDATE ON public.seller_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. ORDER ITEMS (Immutable Snapshots at Checkout)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_title_snapshot text NOT NULL,
  product_part_number_snapshot text,
  product_brand_snapshot text,
  unit_price_minor_units bigint NOT NULL CHECK (unit_price_minor_units >= 0),
  quantity int NOT NULL CHECK (quantity > 0),
  total_price_minor_units bigint NOT NULL CHECK (total_price_minor_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_seller_order ON public.order_items(seller_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);


-- -----------------------------------------------------------------------------
-- 5. ORDER STATUS HISTORY (Audit Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(seller_order_id);


-- =============================================================================
-- ATOMIC TRANSACTIONAL CHECKOUT FUNCTION (Anti-Price-Tampering & Anti-Overselling)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_shipping_full_name text,
  p_shipping_phone text,
  p_shipping_address_line1 text,
  p_shipping_address_line2 text,
  p_shipping_district text,
  p_shipping_city text,
  p_shipping_postal_code text,
  p_payment_method text,
  p_customer_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_order_id uuid;
  v_order_number text;
  v_grand_total bigint := 0;
  v_cart_count int;
  v_shop_record RECORD;
  v_item_record RECORD;
  v_seller_order_id uuid;
  v_sub_order_number text;
  v_shop_subtotal bigint;
  v_sub_index int := 1;
BEGIN
  -- 1. Authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to place an order.';
  END IF;

  -- 2. Validate payment method
  IF p_payment_method NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- 3. Verify cart has items and acquire row-level locks on products to prevent concurrent overselling
  SELECT COUNT(*) INTO v_cart_count
  FROM public.cart_items
  WHERE user_id = v_user_id;

  IF v_cart_count = 0 THEN
    RAISE EXCEPTION 'Cannot checkout: Shopping cart is empty.';
  END IF;

  -- 4. Validate stock, active status, and compute grand total with row-level locks
  FOR v_item_record IN
    SELECT 
      ci.id as cart_item_id,
      ci.quantity,
      p.id as product_id,
      p.title,
      p.price_minor_units,
      p.stock_quantity,
      p.is_published,
      p.status as product_status,
      s.id as shop_id,
      s.status as shop_status
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    JOIN public.shops s ON p.shop_id = s.id
    WHERE ci.user_id = v_user_id
    ORDER BY p.id ASC
    FOR UPDATE OF p
  LOOP
    IF NOT v_item_record.is_published OR v_item_record.product_status <> 'active' THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable.', v_item_record.title;
    END IF;

    IF v_item_record.shop_status <> 'approved' THEN
      RAISE EXCEPTION 'Shop for product "%" is not active.', v_item_record.title;
    END IF;

    IF v_item_record.stock_quantity < v_item_record.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product "%": requested %, available %.',
        v_item_record.title, v_item_record.quantity, v_item_record.stock_quantity;
    END IF;

    v_grand_total := v_grand_total + (v_item_record.price_minor_units * v_item_record.quantity);
  END LOOP;

  -- 5. Generate unique order number (e.g. SH-YYYYMMDD-HEX)
  v_order_number := 'SH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  -- 6. Insert parent customer order
  INSERT INTO public.customer_orders (
    order_number,
    customer_id,
    status,
    payment_method,
    payment_status,
    shipping_full_name,
    shipping_phone,
    shipping_address_line1,
    shipping_address_line2,
    shipping_district,
    shipping_city,
    shipping_postal_code,
    customer_notes,
    total_items_subtotal_minor,
    total_delivery_fee_minor,
    total_discount_minor,
    total_grand_minor
  ) VALUES (
    v_order_number,
    v_user_id,
    'pending',
    p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'cod_pending' ELSE 'unpaid' END,
    p_shipping_full_name,
    p_shipping_phone,
    p_shipping_address_line1,
    p_shipping_address_line2,
    p_shipping_district,
    p_shipping_city,
    p_shipping_postal_code,
    p_customer_notes,
    v_grand_total,
    0, -- Delivery fee unfinalized (Phase 7 commercial sign-off)
    0,
    v_grand_total
  )
  RETURNING id INTO v_customer_order_id;

  -- 7. Partition items by shop into seller suborders
  FOR v_shop_record IN
    SELECT DISTINCT p.shop_id
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = v_user_id
  LOOP
    v_sub_order_number := v_order_number || '-S' || v_sub_index;
    v_sub_index := v_sub_index + 1;

    -- Calculate subtotal for this shop
    SELECT SUM(p.price_minor_units * ci.quantity)
    INTO v_shop_subtotal
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id;

    -- Create seller suborder
    INSERT INTO public.seller_orders (
      customer_order_id,
      shop_id,
      sub_order_number,
      status,
      subtotal_minor,
      delivery_fee_minor,
      total_amount_minor
    ) VALUES (
      v_customer_order_id,
      v_shop_record.shop_id,
      v_sub_order_number,
      'placed',
      v_shop_subtotal,
      0,
      v_shop_subtotal
    )
    RETURNING id INTO v_seller_order_id;

    -- Insert order items and decrement stock
    FOR v_item_record IN
      SELECT 
        ci.quantity,
        p.id as product_id,
        p.title,
        p.part_number,
        p.brand_name,
        p.price_minor_units
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id
    LOOP
      INSERT INTO public.order_items (
        seller_order_id,
        product_id,
        product_title_snapshot,
        product_part_number_snapshot,
        product_brand_snapshot,
        unit_price_minor_units,
        quantity,
        total_price_minor_units
      ) VALUES (
        v_seller_order_id,
        v_item_record.product_id,
        v_item_record.title,
        v_item_record.part_number,
        v_item_record.brand_name,
        v_item_record.price_minor_units,
        v_item_record.quantity,
        v_item_record.price_minor_units * v_item_record.quantity
      );

      -- Atomically decrement stock
      UPDATE public.products
      SET stock_quantity = stock_quantity - v_item_record.quantity
      WHERE id = v_item_record.product_id;
    END LOOP;

    -- Record status history
    INSERT INTO public.order_status_history (
      seller_order_id,
      from_status,
      to_status,
      changed_by,
      notes
    ) VALUES (
      v_seller_order_id,
      NULL,
      'placed',
      v_user_id,
      'Order placed via checkout'
    );
  END LOOP;

  -- 8. Clear user cart
  DELETE FROM public.cart_items WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'customer_order_id', v_customer_order_id,
    'order_number', v_order_number,
    'total_grand_minor', v_grand_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_order TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- cart_items RLS
DROP POLICY IF EXISTS "Users can manage own cart" ON public.cart_items;
CREATE POLICY "Users can manage own cart"
  ON public.cart_items FOR ALL
  USING (user_id = auth.uid());

-- customer_orders RLS: Read-only for customers; all mutations go through process_checkout_order() or Admin
DROP POLICY IF EXISTS "Customers can view own orders" ON public.customer_orders;
CREATE POLICY "Customers can view own orders"
  ON public.customer_orders FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management customer_orders" ON public.customer_orders;
CREATE POLICY "Admin full management customer_orders"
  ON public.customer_orders FOR ALL
  USING (public.is_platform_admin());

-- seller_orders RLS (Strict Multi-Tenant Separation)
DROP POLICY IF EXISTS "Customers can view sub-orders for their own customer order" ON public.seller_orders;
CREATE POLICY "Customers can view sub-orders for their own customer order"
  ON public.seller_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = seller_orders.customer_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view own shop sub-orders" ON public.seller_orders;
CREATE POLICY "Sellers can view own shop sub-orders"
  ON public.seller_orders FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can update fulfillment on own sub-orders" ON public.seller_orders;
CREATE POLICY "Sellers can update fulfillment on own sub-orders"
  ON public.seller_orders FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management seller_orders" ON public.seller_orders;
CREATE POLICY "Admin full management seller_orders"
  ON public.seller_orders FOR ALL
  USING (public.is_platform_admin());

-- order_items RLS
DROP POLICY IF EXISTS "Customers can view items in own customer orders" ON public.order_items;
CREATE POLICY "Customers can view items in own customer orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_items.seller_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view items in own shop sub-orders" ON public.order_items;
CREATE POLICY "Sellers can view items in own shop sub-orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_items.seller_order_id AND public.owns_shop(so.shop_id)
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admin full management order_items" ON public.order_items;
CREATE POLICY "Admin full management order_items"
  ON public.order_items FOR ALL
  USING (public.is_platform_admin());

-- order_status_history RLS
DROP POLICY IF EXISTS "Authorized parties can view order history" ON public.order_status_history;
CREATE POLICY "Authorized parties can view order history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_status_history.seller_order_id
        AND (public.owns_shop(so.shop_id) OR public.is_platform_admin())
    )
    OR EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_status_history.seller_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin and Sellers can append status history" ON public.order_status_history;
CREATE POLICY "Admin and Sellers can append status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_status_history.seller_order_id
        AND (public.owns_shop(so.shop_id) OR public.is_platform_admin())
    )
  );


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000006_commission_and_financial_ledger.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 006 - Configurable Commission, Ledger & Audit Logs
-- Description: Extensible commission rules, immutable financial ledger, payment records, and audit logs.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. COMMISSION RULES (Configurable Platform, Category & Shop Rates)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('platform_default', 'category_override', 'shop_override')),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  -- Stored in basis points: 100 bps = 1.00%, 200 bps = 2.00%, 500 bps = 5.00%
  rate_basis_points int NOT NULL CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_lookup ON public.commission_rules(rule_type, is_active);
CREATE INDEX IF NOT EXISTS idx_commission_rules_category ON public.commission_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_shop ON public.commission_rules(shop_id);


-- -----------------------------------------------------------------------------
-- 2. COMMISSION LEDGER (Immutable Financial Record)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  applied_rule_id uuid REFERENCES public.commission_rules(id),
  item_subtotal_minor bigint NOT NULL CHECK (item_subtotal_minor >= 0),
  commission_rate_bps int NOT NULL CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  commission_amount_minor bigint NOT NULL CHECK (commission_amount_minor >= 0),
  seller_net_earning_minor bigint NOT NULL CHECK (seller_net_earning_minor >= 0),
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'earned', 'cancelled', 'refunded', 'settled')),
  payout_reference text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_shop ON public.commission_ledger(shop_id);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_status ON public.commission_ledger(status);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_order ON public.commission_ledger(seller_order_id);


-- -----------------------------------------------------------------------------
-- 3. PAYMENT RECORDS (Idempotent Webhook Transactions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  gateway_provider text NOT NULL,
  gateway_reference text,
  -- Unique idempotency key prevents duplicate callback/replay attacks
  idempotency_key text NOT NULL UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'LKR',
  status text NOT NULL CHECK (status IN ('initiated', 'pending', 'successful', 'failed', 'refunded')),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_records_order ON public.payment_records(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_idempotency ON public.payment_records(idempotency_key);

DROP TRIGGER IF EXISTS trg_payment_records_updated_at ON public.payment_records;
CREATE TRIGGER trg_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. ADMINISTRATIVE AUDIT LOGS (Immutable Activity Log)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- commission_rules RLS (Admin Only)
DROP POLICY IF EXISTS "Admin full management commission_rules" ON public.commission_rules;
CREATE POLICY "Admin full management commission_rules"
  ON public.commission_rules FOR ALL
  USING (public.is_platform_admin());

-- commission_ledger RLS
DROP POLICY IF EXISTS "Sellers can view own shop earnings ledger" ON public.commission_ledger;
CREATE POLICY "Sellers can view own shop earnings ledger"
  ON public.commission_ledger FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management commission_ledger" ON public.commission_ledger;
CREATE POLICY "Admin full management commission_ledger"
  ON public.commission_ledger FOR ALL
  USING (public.is_platform_admin());

-- payment_records RLS
DROP POLICY IF EXISTS "Customers can view payment status of own order" ON public.payment_records;
CREATE POLICY "Customers can view payment status of own order"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = payment_records.customer_order_id AND co.customer_id = auth.uid()
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admin full management payment_records" ON public.payment_records;
CREATE POLICY "Admin full management payment_records"
  ON public.payment_records FOR ALL
  USING (public.is_platform_admin());

-- admin_audit_logs RLS (Admin View Only, Append-Only)
DROP POLICY IF EXISTS "Admin view audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admin view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Admin append audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admin append audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_platform_admin());


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000007_storage_buckets_and_policies.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 007 - Storage Buckets & Access Control Policies
-- Description: Configures public product-images and strictly private verification-documents buckets.
-- Enforces storage RLS so private seller verification documents are protected.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. PROVISION STORAGE BUCKETS (Idempotent ON CONFLICT)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  (
    'product-images',
    'product-images',
    true,
    5242880, -- 5 MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'verification-documents',
    'verification-documents',
    false, -- STRICTLY PRIVATE BUCKET: ZERO PUBLIC ACCESS
    10485760, -- 10 MB limit
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
  )
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- 2. STORAGE OBJECTS ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

-- Product Images: Public can view
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Product Images: Authenticated sellers can upload
DROP POLICY IF EXISTS "Authenticated sellers upload product images" ON storage.objects;
CREATE POLICY "Authenticated sellers upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Product Images: Sellers can update/delete own uploaded images
DROP POLICY IF EXISTS "Sellers manage own product images" ON storage.objects;
CREATE POLICY "Sellers manage own product images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification Documents: ZERO PUBLIC ACCESS
-- Sellers can view only their own uploaded verification documents
DROP POLICY IF EXISTS "Sellers read own verification documents" ON storage.objects;
CREATE POLICY "Sellers read own verification documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_platform_admin()
    )
  );

-- Verification Documents: Sellers can upload to their own user-scoped directory
DROP POLICY IF EXISTS "Sellers upload own verification documents" ON storage.objects;
CREATE POLICY "Sellers upload own verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification Documents: Platform Administrators have full management
DROP POLICY IF EXISTS "Admin manage all verification documents" ON storage.objects;
CREATE POLICY "Admin manage all verification documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND public.is_platform_admin()
  );


