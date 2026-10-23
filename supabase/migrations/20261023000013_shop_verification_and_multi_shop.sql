-- ============================================================================
-- Migration: 20261023000013_shop_verification_and_multi_shop.sql
-- Purpose:
--   1. Add per-shop seller verification workflow fields and multi-shop owner
--      identity fields on public.shops and public.seller_profiles.
--   2. Extend public.seller_documents with address proof classification,
--      document issue date, MIME type, and cross-shop NIC document reuse link.
--   3. Enforce that unverified shops cannot publish products (is_published = true)
--      at the database trigger and RLS policy layers while still allowing drafts.
--   4. Prevent sellers from self-approving shop verification status.
--   5. Update private verification-documents bucket MIME types and policies.
--
-- Safety & Idempotency:
--   - Fully safe to execute from scratch or resume after partial execution.
--   - Uses existing public.set_updated_at() trigger function and defines
--     public.handle_updated_at() compatibility alias.
-- ============================================================================

-- 0. Ensure handle_updated_at() compatibility alias exists for any external calls
CREATE OR REPLACE FUNCTION public.handle_updated_at()
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

REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_updated_at() TO authenticated, service_role;

-- 1. Extend public.seller_profiles with reusable owner identity fields
ALTER TABLE public.seller_profiles
  ADD COLUMN IF NOT EXISTS owner_legal_name text,
  ADD COLUMN IF NOT EXISTS residential_address text;

DO $$
DECLARE
  v_con record;
BEGIN
  FOR v_con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.seller_profiles'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%verification_status%'
  LOOP
    EXECUTE 'ALTER TABLE public.seller_profiles DROP CONSTRAINT IF EXISTS ' || quote_ident(v_con.conname);
  END LOOP;
END;
$$;

ALTER TABLE public.seller_profiles
  ADD CONSTRAINT seller_profiles_verification_status_check
  CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected', 'resubmission_required'));

-- 2. Extend public.shops with per-shop verification and compliance columns
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS owner_legal_name text,
  ADD COLUMN IF NOT EXISTS residential_address text,
  ADD COLUMN IF NOT EXISTS shop_category text NOT NULL DEFAULT 'retail_shop',
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'not_submitted',
  ADD COLUMN IF NOT EXISTS verification_reason text,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS fraud_escalated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fraud_escalation_notes text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.shops'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%verification_status%'
  ) THEN
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_verification_status_check
      CHECK (verification_status IN ('not_submitted', 'pending_review', 'approved', 'rejected', 'resubmission_required'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_shops_verification_status ON public.shops(verification_status);

-- Backfill existing live shops that already have published products or prior approval
-- so existing production/QA catalog items remain purchasable without disruption.
UPDATE public.shops s
SET
  verification_status = 'approved',
  verification_reviewed_at = COALESCE(s.approved_at, s.created_at),
  verification_reviewed_by = s.approved_by
WHERE s.verification_status = 'not_submitted'
  AND (
    s.approved_at IS NOT NULL
    OR EXISTS (
      SELECT 1
      FROM public.products p
      WHERE p.shop_id = s.id
        AND p.is_published = true
    )
  );

-- 3. Extend public.seller_documents for address proof categories, recency, and NIC reuse
ALTER TABLE public.seller_documents
  ADD COLUMN IF NOT EXISTS address_proof_type text,
  ADD COLUMN IF NOT EXISTS document_issued_date date,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS reused_from_document_id uuid REFERENCES public.seller_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.seller_documents'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%address_proof_type%'
  ) THEN
    ALTER TABLE public.seller_documents
      ADD CONSTRAINT seller_documents_address_proof_type_check
      CHECK (address_proof_type IS NULL OR address_proof_type IN ('utility_bill', 'bank_statement', 'government_document', 'other'));
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_seller_documents_type ON public.seller_documents(seller_profile_id, document_type);

DROP TRIGGER IF EXISTS set_seller_documents_updated_at ON public.seller_documents;
DROP TRIGGER IF EXISTS trg_seller_documents_updated_at ON public.seller_documents;
CREATE TRIGGER trg_seller_documents_updated_at
  BEFORE UPDATE ON public.seller_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Allow sellers to update or delete their own unverified documents during submission/resubmission
DROP POLICY IF EXISTS "Sellers can update own documents" ON public.seller_documents;
CREATE POLICY "Sellers can update own documents"
  ON public.seller_documents FOR UPDATE
  TO authenticated
  USING (
    public.owns_seller_profile(seller_profile_id)
    AND verified = false
  )
  WITH CHECK (
    public.owns_seller_profile(seller_profile_id)
  );

DROP POLICY IF EXISTS "Sellers can delete own documents" ON public.seller_documents;
CREATE POLICY "Sellers can delete own documents"
  ON public.seller_documents FOR DELETE
  TO authenticated
  USING (
    public.owns_seller_profile(seller_profile_id)
    AND verified = false
  );

-- 4. Update prevent_self_shop_approval() to guard verification_status transitions
CREATE OR REPLACE FUNCTION public.prevent_self_shop_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  -- Allow platform admins, service_role, and database superusers
  IF current_user IN ('postgres', 'supabase_admin')
     OR auth.role() = 'service_role'
     OR public.is_platform_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status IN ('rejected', 'suspended') THEN
      NEW.status := 'approved';
    END IF;
    NEW.approved_by := NULL;
    NEW.approved_at := NULL;
    -- Newly opened shops always start with verification_status = 'not_submitted'
    NEW.verification_status := 'not_submitted';
    NEW.verification_reviewed_by := NULL;
    NEW.verification_reviewed_at := NULL;
    NEW.fraud_escalated := false;
    NEW.fraud_escalation_notes := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Storefront operational status guard
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF OLD.status = 'suspended' THEN
        RAISE EXCEPTION 'Unauthorized: Suspended shops can only be reinstated by a platform administrator.';
      END IF;
      IF NEW.status IN ('rejected', 'suspended') THEN
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can reject or suspend shops.';
      END IF;
    END IF;
    NEW.approved_by := OLD.approved_by;
    NEW.approved_at := OLD.approved_at;

    -- Verification status guard: sellers can only transition to 'pending_review'
    NEW.verification_reviewed_by := OLD.verification_reviewed_by;
    NEW.verification_reviewed_at := OLD.verification_reviewed_at;
    NEW.fraud_escalated := OLD.fraud_escalated;
    NEW.fraud_escalation_notes := OLD.fraud_escalation_notes;

    IF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
      IF NEW.verification_status = 'pending_review'
         AND OLD.verification_status IN ('not_submitted', 'resubmission_required', 'rejected', 'pending_review') THEN
        NEW.verification_submitted_at := now();
      ELSE
        RAISE EXCEPTION 'Unauthorized: Only platform administrators can approve or reject shop verification.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_self_shop_approval() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prevent_self_shop_approval() TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS trg_prevent_shop_approval ON public.shops;
CREATE TRIGGER trg_prevent_shop_approval
  BEFORE INSERT OR UPDATE OF status, approved_by, approved_at, verification_status, verification_reviewed_by, verification_reviewed_at, fraud_escalated, fraud_escalation_notes ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_shop_approval();

-- 5. Enforce shop verification before product publishing (is_published = true)
CREATE OR REPLACE FUNCTION public.enforce_shop_verification_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_shop_status text;
  v_verification_status text;
BEGIN
  IF NEW.is_published = true THEN
    SELECT status, verification_status
    INTO v_shop_status, v_verification_status
    FROM public.shops
    WHERE id = NEW.shop_id;

    IF v_shop_status IS NULL THEN
      RAISE EXCEPTION 'Cannot publish product: Associated shop does not exist.';
    END IF;

    IF v_shop_status = 'suspended' THEN
      RAISE EXCEPTION 'Cannot publish product: Your shop is currently suspended.';
    END IF;

    IF v_verification_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Shop verification required: You must complete seller verification before publishing products.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_shop_verification_on_publish() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_shop_verification_on_publish() TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS trg_enforce_shop_verification_on_publish ON public.products;
CREATE TRIGGER trg_enforce_shop_verification_on_publish
  BEFORE INSERT OR UPDATE OF is_published, shop_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_shop_verification_on_publish();

-- Update public product read policy to require shop verification_status = 'approved'
DROP POLICY IF EXISTS "Public read published products from active shops" ON public.products;
CREATE POLICY "Public read published products from active shops"
  ON public.products FOR SELECT
  USING (
    is_published = true
    AND status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id = products.shop_id
        AND s.status != 'suspended'
        AND s.verification_status = 'approved'
    )
  );

-- 6. Update private verification-documents bucket to allow WEBP alongside JPG, PNG, PDF
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'verification-documents';

DROP POLICY IF EXISTS "Sellers update own verification documents" ON storage.objects;
CREATE POLICY "Sellers update own verification documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Sellers delete own verification documents" ON storage.objects;
CREATE POLICY "Sellers delete own verification documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'verification-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
