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
