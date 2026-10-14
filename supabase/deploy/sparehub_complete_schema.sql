-- =============================================================================
-- SPAREHUB PRODUCTION DATABASE SCHEMA (CONSOLIDATED AUDITED MIGRATION SUITE)
-- Brand: SpareHub | Tagline: Every Part. One Marketplace.
-- Target: Supabase PostgreSQL (Project ref: lbwviifpgkykwtmaqpbe)
-- Generated: 2026-10-14T03:00:24.905Z
-- =============================================================================

-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000001_core_extensions_and_helpers.sql
-- -----------------------------------------------------------------------------

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


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000002_user_and_seller_profiles.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 002 - User Profiles, Seller Profiles & Shops
-- Description: Multi-vendor identity, onboarding, shop status, and verification vault.
-- Hardened against INSERT/UPDATE role escalation and unauthorized self-approval.
-- =============================================================================

-- 1. USER PROFILES
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'platform_admin', 'support_agent')),
  roles text[] NOT NULL DEFAULT ARRAY['customer']::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_roles ON public.user_profiles USING gin (roles);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to prevent non-admins from self-escalating roles on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- If not platform administrator:
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- Guarantee initial role on insert is customer only
      NEW.role = 'customer';
      NEW.roles = ARRAY['customer']::text[];
    ELSIF TG_OP = 'UPDATE' THEN
      -- Block modification of role or roles array
      IF NEW.role <> OLD.role OR NEW.roles <> OLD.roles THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_escalation
  BEFORE INSERT OR UPDATE OF role, roles ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

-- Automated profile provisioning trigger when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

-- Trigger fired after an auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- 2. SELLER PROFILES
CREATE TABLE public.seller_profiles (
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

CREATE INDEX idx_seller_profiles_user_id ON public.seller_profiles(user_id);
CREATE INDEX idx_seller_profiles_status ON public.seller_profiles(verification_status);

CREATE TRIGGER trg_seller_profiles_updated_at
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent sellers from modifying their own verification_status on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_verification_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- Force unverified status on creation
      NEW.verification_status = 'unverified';
      NEW.verified_at = NULL;
      NEW.rejection_reason = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.verification_status <> OLD.verification_status THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_verification_override
  BEFORE INSERT OR UPDATE OF verification_status ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_verification_override();


-- 3. SHOPS
CREATE TABLE public.shops (
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
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
  status_reason text,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_shops_seller_profile_id ON public.shops(seller_profile_id);
CREATE INDEX idx_shops_status ON public.shops(status);
CREATE INDEX idx_shops_district ON public.shops(district);
CREATE INDEX idx_shops_slug ON public.shops(slug);

CREATE TRIGGER trg_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Prevent sellers from directly approving their own shop on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- Force draft status on shop registration
      NEW.status = 'draft';
      NEW.approved_by = NULL;
      NEW.approved_at = NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF (NEW.status IN ('approved', 'suspended')) AND (OLD.status <> NEW.status) THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve or suspend a shop.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_shop_approval
  BEFORE INSERT OR UPDATE OF status ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_shop_approval();


-- 4. SELLER DOCUMENTS (Secure Private Verification Vault)
CREATE TABLE public.seller_documents (
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

CREATE INDEX idx_seller_documents_profile ON public.seller_documents(seller_profile_id);
CREATE INDEX idx_seller_documents_shop ON public.seller_documents(shop_id);


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_documents ENABLE ROW LEVEL SECURITY;

-- user_profiles RLS
CREATE POLICY "Users can view own profile"
  ON public.user_profiles FOR SELECT
  USING (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users can insert own initial profile"
  ON public.user_profiles FOR INSERT
  WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  USING (id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Admins full management on user_profiles"
  ON public.user_profiles FOR ALL
  USING (public.is_platform_admin());

-- seller_profiles RLS
CREATE POLICY "Sellers can view own seller profile"
  ON public.seller_profiles FOR SELECT
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Sellers can create own seller profile"
  ON public.seller_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Sellers can update own seller profile"
  ON public.seller_profiles FOR UPDATE
  USING (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Admins full management on seller_profiles"
  ON public.seller_profiles FOR ALL
  USING (public.is_platform_admin());

-- shops RLS
CREATE POLICY "Public can view approved shops"
  ON public.shops FOR SELECT
  USING (status = 'approved');

CREATE POLICY "Sellers can view own shop in any state"
  ON public.shops FOR SELECT
  USING (public.owns_shop(id) OR public.is_platform_admin());

CREATE POLICY "Sellers can create shop for their verified profile"
  ON public.shops FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

CREATE POLICY "Sellers can update own shop details"
  ON public.shops FOR UPDATE
  USING (public.owns_shop(id) OR public.is_platform_admin());

CREATE POLICY "Admins full management on shops"
  ON public.shops FOR ALL
  USING (public.is_platform_admin());

-- seller_documents RLS (Strictly Protected - ZERO public access)
CREATE POLICY "Sellers can view own documents"
  ON public.seller_documents FOR SELECT
  USING (public.owns_seller_profile(seller_profile_id) OR public.is_platform_admin());

CREATE POLICY "Sellers can upload own verification documents"
  ON public.seller_documents FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

CREATE POLICY "Admins full management on seller_documents"
  ON public.seller_documents FOR ALL
  USING (public.is_platform_admin());


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000003_vehicle_taxonomy.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 003 - Hierarchical Vehicle Taxonomy
-- Description: Vehicle types, makes, models, and variants supporting all categories.
-- =============================================================================

-- 1. VEHICLE TYPES
CREATE TABLE public.vehicle_types (
  id text PRIMARY KEY,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed initial vehicle types
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


-- 2. VEHICLE MAKES
CREATE TABLE public.vehicle_makes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_type_id text NOT NULL REFERENCES public.vehicle_types(id) ON DELETE RESTRICT,
  name text NOT NULL,
  slug text NOT NULL,
  is_popular boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_type_id, name)
);

CREATE INDEX idx_vehicle_makes_type ON public.vehicle_makes(vehicle_type_id);
CREATE INDEX idx_vehicle_makes_name ON public.vehicle_makes(name);


-- 3. VEHICLE MODELS
CREATE TABLE public.vehicle_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  make_id uuid NOT NULL REFERENCES public.vehicle_makes(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (make_id, name)
);

CREATE INDEX idx_vehicle_models_make ON public.vehicle_models(make_id);
CREATE INDEX idx_vehicle_models_name ON public.vehicle_models(name);


-- 4. VEHICLE VARIANTS
CREATE TABLE public.vehicle_variants (
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

CREATE INDEX idx_vehicle_variants_model ON public.vehicle_variants(model_id);
CREATE INDEX idx_vehicle_variants_years ON public.vehicle_variants(year_start, year_end);
CREATE INDEX idx_vehicle_variants_chassis ON public.vehicle_variants(generation_chassis);


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.vehicle_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_makes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_variants ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read active vehicle_types"
  ON public.vehicle_types FOR SELECT
  USING (is_active = true);

CREATE POLICY "Public read vehicle_makes"
  ON public.vehicle_makes FOR SELECT
  USING (true);

CREATE POLICY "Public read vehicle_models"
  ON public.vehicle_models FOR SELECT
  USING (true);

CREATE POLICY "Public read vehicle_variants"
  ON public.vehicle_variants FOR SELECT
  USING (true);

-- Admin management policies
CREATE POLICY "Admin full management vehicle_types"
  ON public.vehicle_types FOR ALL
  USING (public.is_platform_admin());

CREATE POLICY "Admin full management vehicle_makes"
  ON public.vehicle_makes FOR ALL
  USING (public.is_platform_admin());

CREATE POLICY "Admin full management vehicle_models"
  ON public.vehicle_models FOR ALL
  USING (public.is_platform_admin());

CREATE POLICY "Admin full management vehicle_variants"
  ON public.vehicle_variants FOR ALL
  USING (public.is_platform_admin());


-- -----------------------------------------------------------------------------
-- MIGRATION: 20261014000004_catalog_and_compatibility.sql
-- -----------------------------------------------------------------------------

-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 004 - Product Catalog & Vehicle Compatibility
-- Description: Multi-vendor catalog, images, full-text indexes, and structured compatibility.
-- Fix: Robust partial unique indexes resolving nullable column edge-cases.
-- =============================================================================

-- 1. CATEGORIES
CREATE TABLE public.categories (
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

CREATE INDEX idx_categories_parent ON public.categories(parent_id);
CREATE INDEX idx_categories_slug ON public.categories(slug);

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. PRODUCTS
CREATE TABLE public.products (
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

CREATE INDEX idx_products_shop_id ON public.products(shop_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_products_status ON public.products(status);
CREATE INDEX idx_products_published ON public.products(is_published);
CREATE INDEX idx_products_price ON public.products(price_minor_units);

-- Trigram indexes for resilient partial search across part numbers and titles
CREATE INDEX idx_products_part_number_trgm ON public.products USING gin (part_number gin_trgm_ops);
CREATE INDEX idx_products_oem_trgm ON public.products USING gin (oem_part_number gin_trgm_ops);
CREATE INDEX idx_products_title_trgm ON public.products USING gin (title gin_trgm_ops);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. PRODUCT IMAGES
CREATE TABLE public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  display_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product ON public.product_images(product_id);


-- 4. PRODUCT VEHICLE COMPATIBILITY
CREATE TABLE public.product_compatibility (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  vehicle_variant_id uuid REFERENCES public.vehicle_variants(id) ON DELETE CASCADE,
  vehicle_model_id uuid REFERENCES public.vehicle_models(id) ON DELETE CASCADE,
  notes text,
  is_exact_fit boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_variant_or_model CHECK (vehicle_variant_id IS NOT NULL OR vehicle_model_id IS NOT NULL)
);

CREATE INDEX idx_compatibility_product ON public.product_compatibility(product_id);
CREATE INDEX idx_compatibility_variant ON public.product_compatibility(vehicle_variant_id);
CREATE INDEX idx_compatibility_model ON public.product_compatibility(vehicle_model_id);

-- Robust partial unique indexes: handles nullable variant/model cleanly without SQL NULL duplicate quirks
CREATE UNIQUE INDEX idx_compat_product_variant_unique
  ON public.product_compatibility (product_id, vehicle_variant_id)
  WHERE vehicle_variant_id IS NOT NULL;

CREATE UNIQUE INDEX idx_compat_product_model_unique
  ON public.product_compatibility (product_id, vehicle_model_id)
  WHERE vehicle_variant_id IS NULL;


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_compatibility ENABLE ROW LEVEL SECURITY;

-- categories RLS
CREATE POLICY "Public read active categories"
  ON public.categories FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin full management categories"
  ON public.categories FOR ALL
  USING (public.is_platform_admin());

-- products RLS
CREATE POLICY "Public read published products from approved shops"
  ON public.products FOR SELECT
  USING (
    is_published = true
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = products.shop_id AND s.status = 'approved'
    )
  );

CREATE POLICY "Sellers can view own shop products in any status"
  ON public.products FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Sellers can create products for own approved shop"
  ON public.products FOR INSERT
  WITH CHECK (
    public.owns_shop(shop_id)
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = shop_id AND s.status = 'approved'
    )
  );

CREATE POLICY "Sellers can update own shop products"
  ON public.products FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Sellers can delete own shop products"
  ON public.products FOR DELETE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Admin full management products"
  ON public.products FOR ALL
  USING (public.is_platform_admin());

-- product_images RLS
CREATE POLICY "Public read images of visible products"
  ON public.product_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_images.product_id
        AND p.is_published = true
        AND s.status = 'approved'
    )
  );

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
CREATE POLICY "Public read compatibility of visible products"
  ON public.product_compatibility FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.products p
      JOIN public.shops s ON p.shop_id = s.id
      WHERE p.id = product_compatibility.product_id
        AND p.is_published = true
        AND s.status = 'approved'
    )
  );

CREATE POLICY "Sellers can manage compatibility of own products"
  ON public.product_compatibility FOR ALL
  USING (
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
-- =============================================================================

-- 1. SHOPPING CART ITEMS
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX idx_cart_items_product ON public.cart_items(product_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. CUSTOMER ORDERS (Aggregated Customer Invoice)
CREATE TABLE public.customer_orders (
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

CREATE INDEX idx_customer_orders_customer ON public.customer_orders(customer_id);
CREATE INDEX idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX idx_customer_orders_created ON public.customer_orders(created_at DESC);

CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. SELLER ORDERS (Sub-orders Partitioned by Shop)
CREATE TABLE public.seller_orders (
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

CREATE INDEX idx_seller_orders_customer_order ON public.seller_orders(customer_order_id);
CREATE INDEX idx_seller_orders_shop ON public.seller_orders(shop_id);
CREATE INDEX idx_seller_orders_status ON public.seller_orders(status);

CREATE TRIGGER trg_seller_orders_updated_at
  BEFORE UPDATE ON public.seller_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. ORDER ITEMS (Immutable Snapshots at Checkout)
CREATE TABLE public.order_items (
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

CREATE INDEX idx_order_items_seller_order ON public.order_items(seller_order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);


-- 5. ORDER STATUS HISTORY (Audit Trail)
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON public.order_status_history(seller_order_id);


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
SET search_path = public, auth
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


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- cart_items RLS
CREATE POLICY "Users can manage own cart"
  ON public.cart_items FOR ALL
  USING (user_id = auth.uid());

-- customer_orders RLS: Read-only for customers; all mutations go through process_checkout_order() or Admin
CREATE POLICY "Customers can view own orders"
  ON public.customer_orders FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Admin full management customer_orders"
  ON public.customer_orders FOR ALL
  USING (public.is_platform_admin());

-- seller_orders RLS (Strict Multi-Tenant Separation)
CREATE POLICY "Customers can view sub-orders for their own customer order"
  ON public.seller_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = seller_orders.customer_order_id AND co.customer_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view own shop sub-orders"
  ON public.seller_orders FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Sellers can update fulfillment on own sub-orders"
  ON public.seller_orders FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Admin full management seller_orders"
  ON public.seller_orders FOR ALL
  USING (public.is_platform_admin());

-- order_items RLS
CREATE POLICY "Customers can view items in own customer orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_items.seller_order_id AND co.customer_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view items in own shop sub-orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_items.seller_order_id AND public.owns_shop(so.shop_id)
    )
    OR public.is_platform_admin()
  );

CREATE POLICY "Admin full management order_items"
  ON public.order_items FOR ALL
  USING (public.is_platform_admin());

-- order_status_history RLS
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
-- =============================================================================

-- 1. COMMISSION RULES (Configurable Platform, Category & Shop Rates)
CREATE TABLE public.commission_rules (
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

CREATE INDEX idx_commission_rules_lookup ON public.commission_rules(rule_type, is_active);
CREATE INDEX idx_commission_rules_category ON public.commission_rules(category_id);
CREATE INDEX idx_commission_rules_shop ON public.commission_rules(shop_id);


-- 2. COMMISSION LEDGER (Immutable Financial Record)
CREATE TABLE public.commission_ledger (
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

CREATE INDEX idx_commission_ledger_shop ON public.commission_ledger(shop_id);
CREATE INDEX idx_commission_ledger_status ON public.commission_ledger(status);
CREATE INDEX idx_commission_ledger_order ON public.commission_ledger(seller_order_id);


-- 3. PAYMENT RECORDS (Idempotent Webhook Transactions)
CREATE TABLE public.payment_records (
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

CREATE INDEX idx_payment_records_order ON public.payment_records(customer_order_id);
CREATE INDEX idx_payment_records_idempotency ON public.payment_records(idempotency_key);

CREATE TRIGGER trg_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. ADMINISTRATIVE AUDIT LOGS (Immutable Activity Log)
CREATE TABLE public.admin_audit_logs (
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

CREATE INDEX idx_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- commission_rules RLS (Admin Only)
CREATE POLICY "Admin full management commission_rules"
  ON public.commission_rules FOR ALL
  USING (public.is_platform_admin());

-- commission_ledger RLS
CREATE POLICY "Sellers can view own shop earnings ledger"
  ON public.commission_ledger FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Admin full management commission_ledger"
  ON public.commission_ledger FOR ALL
  USING (public.is_platform_admin());

-- payment_records RLS
CREATE POLICY "Customers can view payment status of own order"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = payment_records.customer_order_id AND co.customer_id = auth.uid()
    )
    OR public.is_platform_admin()
  );

CREATE POLICY "Admin full management payment_records"
  ON public.payment_records FOR ALL
  USING (public.is_platform_admin());

-- admin_audit_logs RLS (Admin View Only, Append-Only)
CREATE POLICY "Admin view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_platform_admin());

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
-- =============================================================================

-- 1. PROVISION STORAGE BUCKETS
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


-- 2. STORAGE OBJECTS ROW LEVEL SECURITY POLICIES

-- Product Images: Public can view
CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

-- Product Images: Authenticated sellers can upload
CREATE POLICY "Authenticated sellers upload product images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Product Images: Sellers can update/delete own uploaded images
CREATE POLICY "Sellers manage own product images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification Documents: ZERO PUBLIC ACCESS
-- Sellers can view only their own uploaded verification documents
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
CREATE POLICY "Sellers upload own verification documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Verification Documents: Platform Administrators have full management
CREATE POLICY "Admin manage all verification documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND public.is_platform_admin()
  );


