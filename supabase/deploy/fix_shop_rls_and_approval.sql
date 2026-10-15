-- =============================================================================
-- SpareHub Fix: Shop Creation RLS Failure & Self-Service Activation
-- File: supabase/deploy/fix_shop_rls_and_approval.sql
-- Description:
--   1. Replaces the shop approval trigger to enable immediate storefront activation
--      for eligible sellers without requiring administrator pre-approval.
--   2. Updates RLS policies on public.shops to evaluate ownership via
--      public.owns_seller_profile(seller_profile_id), resolving PostgreSQL
--      self-referential evaluation conflicts during INSERT / RETURNING.
--   3. Preserves strict administrative isolation: only platform admins can suspend shops.
-- =============================================================================

BEGIN;

-- 1. Update the shop trigger function for self-service activation
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    IF TG_OP = 'INSERT' THEN
      -- In a self-service marketplace, shops activate immediately upon creation
      -- unless the seller explicitly requests draft status.
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

-- 2. Update Row Level Security Policies on public.shops
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

-- 2a. Public read policy: Anyone can browse active (non-suspended) storefronts
DROP POLICY IF EXISTS "Public can view approved shops" ON public.shops;
DROP POLICY IF EXISTS "Public can view active shops" ON public.shops;
CREATE POLICY "Public can view active shops"
  ON public.shops FOR SELECT
  USING (status != 'suspended');

-- 2b. Seller read policy: Sellers can view their own shop in any state (draft, approved, etc.)
-- Directly checks owns_seller_profile(seller_profile_id) to avoid recursive self-referencing
DROP POLICY IF EXISTS "Sellers can view own shop in any state" ON public.shops;
CREATE POLICY "Sellers can view own shop in any state"
  ON public.shops FOR SELECT
  USING (
    public.owns_seller_profile(seller_profile_id)
    OR public.owns_shop(id)
    OR public.is_platform_admin()
  );

-- 2c. Seller insert policy: Sellers can create a shop for their verified or unverified seller profile
DROP POLICY IF EXISTS "Sellers can create shop for their verified profile" ON public.shops;
DROP POLICY IF EXISTS "Sellers can create own shop" ON public.shops;
CREATE POLICY "Sellers can create own shop"
  ON public.shops FOR INSERT
  WITH CHECK (public.owns_seller_profile(seller_profile_id));

-- 2d. Seller update policy: Sellers can update their own shop details
DROP POLICY IF EXISTS "Sellers can update own shop details" ON public.shops;
CREATE POLICY "Sellers can update own shop details"
  ON public.shops FOR UPDATE
  USING (
    public.owns_seller_profile(seller_profile_id)
    OR public.owns_shop(id)
    OR public.is_platform_admin()
  );

-- 2e. Admin management policy
DROP POLICY IF EXISTS "Admins full management on shops" ON public.shops;
CREATE POLICY "Admins full management on shops"
  ON public.shops FOR ALL
  USING (public.is_platform_admin());

-- 3. Execution grants
REVOKE ALL ON FUNCTION public.prevent_self_shop_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_self_shop_approval() TO authenticated, service_role;

-- 4. Activate any existing draft shops that were created during the transition
UPDATE public.shops
SET status = 'approved', approved_at = now()
WHERE status = 'draft';

COMMIT;
