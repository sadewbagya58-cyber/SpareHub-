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

