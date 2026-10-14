-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 002 - User Profiles, Seller Profiles & Shops
-- Description: Multi-vendor identity, onboarding, shop status, and verification vault.
-- =============================================================================

-- 1. USER PROFILES
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email citext NOT NULL UNIQUE,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'seller', 'platform_admin', 'support_agent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_profiles_role ON public.user_profiles(role);
CREATE INDEX idx_user_profiles_email ON public.user_profiles(email);

CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger to prevent non-admins from self-escalating role
CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.role <> OLD.role AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can modify user roles.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_role_escalation
  BEFORE UPDATE OF role ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();


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

-- Prevent sellers from modifying their own verification_status
CREATE OR REPLACE FUNCTION public.prevent_self_verification_override()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NEW.verification_status <> OLD.verification_status AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can change verification status.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_verification_override
  BEFORE UPDATE OF verification_status ON public.seller_profiles
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

-- Prevent sellers from directly approving their own shop
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF (NEW.status IN ('approved', 'suspended')) AND (OLD.status <> NEW.status) AND NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve or suspend a shop.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_shop_approval
  BEFORE UPDATE OF status ON public.shops
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
