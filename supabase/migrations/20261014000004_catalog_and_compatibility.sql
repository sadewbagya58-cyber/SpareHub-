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
