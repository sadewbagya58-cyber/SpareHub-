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
      IF NEW.role <> OLD.role OR NEW.roles <> OLD.roles THEN
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
      IF NEW.verification_status <> OLD.verification_status THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_verification_override ON public.seller_profiles;
CREATE TRIGGER trg_prevent_verification_override
  BEFORE INSERT OR UPDATE OF verification_status ON public.seller_profiles
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
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended')),
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

-- Prevent sellers from directly approving their own shop on INSERT or UPDATE
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
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

DROP TRIGGER IF EXISTS trg_prevent_shop_approval ON public.shops;
CREATE TRIGGER trg_prevent_shop_approval
  BEFORE INSERT OR UPDATE OF status ON public.shops
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
CREATE POLICY "Public can view approved shops"
  ON public.shops FOR SELECT
  USING (status = 'approved');

DROP POLICY IF EXISTS "Sellers can view own shop in any state" ON public.shops;
CREATE POLICY "Sellers can view own shop in any state"
  ON public.shops FOR SELECT
  USING (public.owns_shop(id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can create shop for their verified profile" ON public.shops;
CREATE POLICY "Sellers can create shop for their verified profile"
  ON public.shops FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

DROP POLICY IF EXISTS "Sellers can update own shop details" ON public.shops;
CREATE POLICY "Sellers can update own shop details"
  ON public.shops FOR UPDATE
  USING (public.owns_shop(id) OR public.is_platform_admin());

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
