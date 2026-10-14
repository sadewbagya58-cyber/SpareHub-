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
