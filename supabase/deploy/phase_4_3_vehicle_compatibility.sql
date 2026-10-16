-- =============================================================================
-- SPAREHUB INCREMENTAL MIGRATION: Phase 4.3 — Vehicle Compatibility & Taxonomy Seed
-- Target: Supabase PostgreSQL (Production / Staging SQL Editor)
-- Description:
--   1. Idempotently seeds Sri Lankan vehicle types, makes, models, and variants
--      across all 8 vehicle categories so foreign keys on product_compatibility
--      resolve cleanly in production.
--   2. Adds BEFORE INSERT OR UPDATE trigger validate_product_compatibility_hierarchy()
--      on public.product_compatibility to enforce that vehicle_variant_id always
--      belongs to vehicle_model_id (and auto-populates vehicle_model_id if omitted).
--   3. Strengthens RLS policy "Sellers can manage compatibility of own products"
--      with an explicit WITH CHECK clause.
-- All statements are idempotent and safe to re-run.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. SEED SRI LANKAN VEHICLE TAXONOMY (Idempotent ON CONFLICT DO NOTHING)
-- -----------------------------------------------------------------------------

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

INSERT INTO public.vehicle_makes (id, vehicle_type_id, name, slug, is_popular) VALUES
  ('b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'toyota', true),
  ('b1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'honda', true),
  ('b1000000-0000-0000-0000-000000000003', 'car', 'Nissan', 'nissan', true),
  ('b1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'suzuki', true),
  ('b1000000-0000-0000-0000-000000000005', 'car', 'Mitsubishi', 'mitsubishi', true),
  ('b1000000-0000-0000-0000-000000000006', 'three_wheeler', 'Bajaj', 'bajaj-three-wheeler', true),
  ('b1000000-0000-0000-0000-000000000007', 'three_wheeler', 'TVS', 'tvs-three-wheeler', true),
  ('b1000000-0000-0000-0000-000000000008', 'three_wheeler', 'Piaggio', 'piaggio', false),
  ('b1000000-0000-0000-0000-000000000009', 'motorcycle', 'Bajaj', 'bajaj-moto', true),
  ('b1000000-0000-0000-0000-000000000010', 'motorcycle', 'Yamaha', 'yamaha', true),
  ('b1000000-0000-0000-0000-000000000011', 'motorcycle', 'Honda', 'honda-moto', true),
  ('b1000000-0000-0000-0000-000000000012', 'motorcycle', 'TVS', 'tvs-moto', true),
  ('b1000000-0000-0000-0000-000000000013', 'van', 'Toyota', 'toyota-van', true),
  ('b1000000-0000-0000-0000-000000000014', 'van', 'Nissan', 'nissan-van', true),
  ('b1000000-0000-0000-0000-000000000015', 'truck', 'Isuzu', 'isuzu', true),
  ('b1000000-0000-0000-0000-000000000016', 'truck', 'Mitsubishi Fuso', 'fuso', true),
  ('b1000000-0000-0000-0000-000000000017', 'truck', 'Tata', 'tata', true),
  ('b1000000-0000-0000-0000-000000000018', 'bus', 'Ashok Leyland', 'ashok-leyland', true),
  ('b1000000-0000-0000-0000-000000000019', 'tractor', 'Massey Ferguson', 'massey-ferguson', true),
  ('b1000000-0000-0000-0000-000000000020', 'heavy_machinery', 'Caterpillar', 'caterpillar', true),
  ('b1000000-0000-0000-0000-000000000021', 'heavy_machinery', 'Komatsu', 'komatsu', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.vehicle_models (id, make_id, name, slug)
SELECT
  v.id::uuid,
  m.id,
  v.name,
  v.slug
FROM (
  VALUES
    ('d1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Corolla', 'corolla'),
    ('d1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Prius', 'prius'),
    ('d1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Aqua', 'aqua'),
    ('d1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Vitz', 'vitz'),
    ('d1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Axio', 'axio'),
    ('d1000000-0000-0000-0000-000000000006', 'b1000000-0000-0000-0000-000000000001', 'car', 'Toyota', 'Premio', 'premio'),
    ('d1000000-0000-0000-0000-000000000007', 'b1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'Civic', 'civic'),
    ('d1000000-0000-0000-0000-000000000008', 'b1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'Fit / Jazz', 'fit'),
    ('d1000000-0000-0000-0000-000000000009', 'b1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'Vezel', 'vezel'),
    ('d1000000-0000-0000-0000-000000000010', 'b1000000-0000-0000-0000-000000000002', 'car', 'Honda', 'Grace', 'grace'),
    ('d1000000-0000-0000-0000-000000000011', 'b1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'Alto', 'alto'),
    ('d1000000-0000-0000-0000-000000000012', 'b1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'WagonR', 'wagonr'),
    ('d1000000-0000-0000-0000-000000000013', 'b1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'Swift', 'swift'),
    ('d1000000-0000-0000-0000-000000000014', 'b1000000-0000-0000-0000-000000000004', 'car', 'Suzuki', 'Spacia', 'spacia'),
    ('d1000000-0000-0000-0000-000000000015', 'b1000000-0000-0000-0000-000000000006', 'three_wheeler', 'Bajaj', 'RE 205 (2-Stroke)', 're-205-2s'),
    ('d1000000-0000-0000-0000-000000000016', 'b1000000-0000-0000-0000-000000000006', 'three_wheeler', 'Bajaj', 'RE 205 (4-Stroke)', 're-205-4s'),
    ('d1000000-0000-0000-0000-000000000017', 'b1000000-0000-0000-0000-000000000006', 'three_wheeler', 'Bajaj', 'Compact 4S', 'compact-4s'),
    ('d1000000-0000-0000-0000-000000000018', 'b1000000-0000-0000-0000-000000000007', 'three_wheeler', 'TVS', 'King Deluxe', 'king-deluxe'),
    ('d1000000-0000-0000-0000-000000000019', 'b1000000-0000-0000-0000-000000000007', 'three_wheeler', 'TVS', 'King Duramax', 'king-duramax'),
    ('d1000000-0000-0000-0000-000000000020', 'b1000000-0000-0000-0000-000000000009', 'motorcycle', 'Bajaj', 'Pulsar 150', 'pulsar-150'),
    ('d1000000-0000-0000-0000-000000000021', 'b1000000-0000-0000-0000-000000000009', 'motorcycle', 'Bajaj', 'Discover 125', 'discover-125'),
    ('d1000000-0000-0000-0000-000000000022', 'b1000000-0000-0000-0000-000000000010', 'motorcycle', 'Yamaha', 'FZ-S', 'fz-s'),
    ('d1000000-0000-0000-0000-000000000023', 'b1000000-0000-0000-0000-000000000011', 'motorcycle', 'Honda', 'Dio', 'dio'),
    ('d1000000-0000-0000-0000-000000000024', 'b1000000-0000-0000-0000-000000000013', 'van', 'Toyota', 'HiAce KDH / GDH', 'hiace'),
    ('d1000000-0000-0000-0000-000000000025', 'b1000000-0000-0000-0000-000000000014', 'van', 'Nissan', 'Caravan E25 / NV350', 'caravan'),
    ('d1000000-0000-0000-0000-000000000026', 'b1000000-0000-0000-0000-000000000015', 'truck', 'Isuzu', 'Elf NKR / NPR', 'isuzu-elf'),
    ('d1000000-0000-0000-0000-000000000027', 'b1000000-0000-0000-0000-000000000016', 'truck', 'Mitsubishi Fuso', 'Canter FE / FG', 'canter'),
    ('d1000000-0000-0000-0000-000000000028', 'b1000000-0000-0000-0000-000000000017', 'truck', 'Tata', 'Ace Dimo Batta', 'tata-ace'),
    ('d1000000-0000-0000-0000-000000000029', 'b1000000-0000-0000-0000-000000000018', 'bus', 'Ashok Leyland', 'Viking Chassis', 'leyland-viking'),
    ('d1000000-0000-0000-0000-000000000030', 'b1000000-0000-0000-0000-000000000019', 'tractor', 'Massey Ferguson', 'MF 240', 'mf-240'),
    ('d1000000-0000-0000-0000-000000000020', 'heavy_machinery', 'Caterpillar', '320D Excavator', 'cat-320d'),
    ('d1000000-0000-0000-0000-000000000003', 'car', 'Nissan', 'Sunny', 'sunny'),
    ('d1000000-0000-0000-0000-000000000003', 'car', 'Nissan', 'Leaf', 'leaf'),
    ('d1000000-0000-0000-0000-000000000003', 'car', 'Nissan', 'X-Trail', 'x-trail'),
    ('d1000000-0000-0000-0000-000000000005', 'car', 'Mitsubishi', 'Lancer', 'lancer'),
    ('d1000000-0000-0000-0000-000000000005', 'car', 'Mitsubishi', 'Montero / Pajero', 'montero'),
    ('d1000000-0000-0000-0000-000000000008', 'three_wheeler', 'Piaggio', 'Ape City / Xtra LDX', 'ape-city'),
    ('d1000000-0000-0000-0000-000000000012', 'motorcycle', 'TVS', 'Apache RTR 160', 'apache-rtr-160'),
    ('d1000000-0000-0000-0000-000000000012', 'motorcycle', 'TVS', 'NTorq 125', 'ntorq-125'),
    ('d1000000-0000-0000-0000-000000000021', 'heavy_machinery', 'Komatsu', 'PC200-8 Excavator', 'pc200-8')
) AS v(id, make_id, vehicle_type_id, make_name, name, slug)
JOIN public.vehicle_makes m
  ON m.id = v.make_id::uuid
  OR (
    m.vehicle_type_id = v.vehicle_type_id
    AND m.name = v.make_name
    AND NOT EXISTS (SELECT 1 FROM public.vehicle_makes m2 WHERE m2.id = v.make_id::uuid)
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.vehicle_variants (id, model_id, generation_chassis, year_start, year_end, engine_code, transmission, fuel_type)
SELECT
  v.id::uuid,
  md.id,
  v.generation_chassis,
  v.year_start,
  v.year_end,
  v.engine_code,
  v.transmission,
  v.fuel_type
FROM (
  VALUES
    ('e1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'Corolla', 'AE110 (5A-FE 1.5L)', 1995, 2000, '5A-FE', 'Automatic / Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'Corolla', 'NZE121 (1NZ-FE 1.5L)', 2000, 2006, '1NZ-FE', 'Automatic / Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000003', 'd1000000-0000-0000-0000-000000000001', 'Corolla', 'ZRE142 / NZE141', 2007, 2013, '1NZ-FE / 1ZR-FE', 'Automatic / CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000004', 'd1000000-0000-0000-0000-000000000002', 'Prius', 'ZVW30 (3rd Gen Hybrid)', 2009, 2015, '2ZR-FXE 1.8L', 'e-CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000005', 'd1000000-0000-0000-0000-000000000002', 'Prius', 'ZVW50 (4th Gen Hybrid)', 2015, 2022, '2ZR-FXE 1.8L', 'e-CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000006', 'd1000000-0000-0000-0000-000000000003', 'Aqua', 'NHP10 (1NZ-FXE Hybrid)', 2011, 2021, '1NZ-FXE 1.5L', 'e-CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000007', 'd1000000-0000-0000-0000-000000000004', 'Vitz', 'KSP90 / SCP90', 2005, 2010, '1KR-FE / 2SZ-FE', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000008', 'd1000000-0000-0000-0000-000000000004', 'Vitz', 'KSP130 / NSP130', 2011, 2020, '1KR-FE / 1NR-FE', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000009', 'd1000000-0000-0000-0000-000000000005', 'Axio', 'NZE141 (1.5L Petrol)', 2006, 2012, '1NZ-FE', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000010', 'd1000000-0000-0000-0000-000000000005', 'Axio', 'NKE165 (Hybrid) / NZE161', 2012, 2023, '1NZ-FXE / 1NZ-FE', 'e-CVT / CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000011', 'd1000000-0000-0000-0000-000000000006', 'Premio', 'NZT260 / ZRT260 (260 Series)', 2007, 2021, '1NZ-FE / 2ZR-FAE', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000012', 'd1000000-0000-0000-0000-000000000007', 'Civic', 'FD1 / FD4 (8th Gen)', 2006, 2011, 'R18A / R16A', 'Automatic / Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000013', 'd1000000-0000-0000-0000-000000000007', 'Civic', 'FC1 / FK7 (10th Gen Turbo)', 2016, 2021, 'L15B7 / P10A2', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000014', 'd1000000-0000-0000-0000-000000000008', 'Fit / Jazz', 'GP1 (IMA Hybrid)', 2010, 2013, 'LDA 1.3L', 'CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000015', 'd1000000-0000-0000-0000-000000000008', 'Fit / Jazz', 'GP5 (i-DCD Hybrid)', 2013, 2020, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000016', 'd1000000-0000-0000-0000-000000000009', 'Vezel', 'RU3 / RU4 (Hybrid Z / RS)', 2013, 2021, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000017', 'd1000000-0000-0000-0000-000000000010', 'Grace', 'GM4 / GM5 (i-DCD Hybrid)', 2014, 2020, 'LEB 1.5L', '7-Speed DCT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000018', 'd1000000-0000-0000-0000-000000000011', 'Alto', 'Alto 800 (F8D Indian)', 2012, 2022, 'F8D 796cc', '5-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000019', 'd1000000-0000-0000-0000-000000000011', 'Alto', 'HA36S / HA36V (Japanese 660cc)', 2014, 2021, 'R06A 660cc', 'CVT / AGS', 'petrol'),
    ('e1000000-0000-0000-0000-000000000020', 'd1000000-0000-0000-0000-000000000012', 'WagonR', 'MH34S / MH44S (FZ / Stingray)', 2012, 2017, 'R06A 660cc', 'CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000021', 'd1000000-0000-0000-0000-000000000012', 'WagonR', 'MH35S / MH55S (FX / FZ / Stingray)', 2017, 2023, 'R06A 660cc', 'CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000022', 'd1000000-0000-0000-0000-000000000013', 'Swift', 'ZC11S / ZC72S (1.2L / 1.3L)', 2004, 2016, 'M13A / K12B', 'Automatic / CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000023', 'd1000000-0000-0000-0000-000000000013', 'Swift', 'ZC13S / ZC83S (RS Turbo / Hybrid)', 2017, 2023, 'K10C / K12C', '6AT / CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000024', 'd1000000-0000-0000-0000-000000000014', 'Spacia', 'MK42S / MK53S (Custom Z / XS)', 2015, 2023, 'R06A 660cc', 'CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000025', 'd1000000-0000-0000-0000-000000000015', 'RE 205 (2-Stroke)', 'RE 2S 145cc (2-Stroke)', 1998, 2008, 'RE145-2S', '4-Speed Hand Shift', 'petrol'),
    ('e1000000-0000-0000-0000-000000000026', 'd1000000-0000-0000-0000-000000000016', 'RE 205 (4-Stroke)', 'RE 4S 175cc / 205cc', 2007, 2016, 'RE205-4S', '4-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000027', 'd1000000-0000-0000-0000-000000000017', 'Compact 4S', 'RE Compact 4S FL / BS6', 2014, NULL, 'DTS-i 198cc', '4-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000028', 'd1000000-0000-0000-0000-000000000018', 'King Deluxe', 'King 4S 200cc Deluxe', 2010, NULL, 'TVS-200-4S', '4-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000029', 'd1000000-0000-0000-0000-000000000019', 'King Duramax', 'King Duramax 225cc LC', 2018, NULL, 'TVS-225-LC', '4-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000030', 'd1000000-0000-0000-0000-000000000020', 'Pulsar 150', 'UG4.5 / Twin Disc BS4/BS6', 2010, NULL, 'DTS-i 149cc', '5-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000031', 'd1000000-0000-0000-0000-000000000021', 'Discover 125', 'Discover 125M / DRL Disc', 2011, 2021, 'DTS-i 124.5cc', '5-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000032', 'd1000000-0000-0000-0000-000000000022', 'FZ-S', 'FZ-S V2.0 / V3.0 FI', 2014, NULL, 'BlueCore 149cc FI', '5-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000033', 'd1000000-0000-0000-0000-000000000023', 'Dio', 'HET 110cc / DLX LED', 2012, NULL, 'HET 109.2cc', 'V-Matic CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000034', 'd1000000-0000-0000-0000-000000000024', 'HiAce KDH / GDH', 'KDH200 / KDH201 / KDH222', 2004, 2020, '1KD-FTV 3.0L / 2KD-FTV 2.5L', 'Automatic / Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000035', 'd1000000-0000-0000-0000-000000000025', 'Caravan E25 / NV350', 'E25 (ZD30) / NV350 E26 (YD25)', 2001, 2021, 'ZD30DDTi / YD25DDTi', 'Automatic / Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000036', 'd1000000-0000-0000-0000-000000000026', 'Elf NKR / NPR', 'NKR66 / NPR75 (10.5ft / 14.5ft)', 1999, 2020, '4HF1 4.3L / 4HK1 5.2L', '5/6-Speed Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000037', 'd1000000-0000-0000-0000-000000000027', 'Canter FE / FG', 'FE70 / FE85 / FBA', 2002, 2020, '4D33 / 4M50', '5-Speed Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000038', 'd1000000-0000-0000-0000-000000000028', 'Ace Dimo Batta', 'Ace HT / EX2 (Dimo Batta)', 2006, 2020, '275 IDI 702cc', '4/5-Speed Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000039', 'd1000000-0000-0000-0000-000000000029', 'Viking Chassis', 'Viking 210 / 222 WB (H-Series)', 2005, NULL, 'HA6ETI 5.7L', '5/6-Speed Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000040', 'd1000000-0000-0000-0000-000000000030', 'MF 240', 'MF 240 2WD (50 HP)', 1985, NULL, 'Perkins AD3.152', '8F / 2R Sliding Spur', 'diesel'),
    ('e1000000-0000-0000-0000-000000000041', 'd1000000-0000-0000-0000-000000000031', '320D Excavator', '320D / 320D2 Hydraulic Excavator', 2006, 2020, 'CAT C6.4 ACERT', 'Hydrostatic', 'diesel'),
    ('e1000000-0000-0000-0000-000000000042', 'd1000000-0000-0000-0000-000000000032', 'Sunny', 'FB15 / N16 (Super Saloon / Ex Saloon)', 1998, 2006, 'QG15DE 1.5L', 'Automatic / Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000043', 'd1000000-0000-0000-0000-000000000033', 'Leaf', 'ZE0 / AZE0 (24kWh / 30kWh) & ZE1 (40kWh)', 2011, 2022, 'EM57 / EM61', 'Single-Speed Reduction', 'electric'),
    ('e1000000-0000-0000-0000-000000000044', 'd1000000-0000-0000-0000-000000000034', 'X-Trail', 'NT32 / HT32 (20X Hybrid)', 2014, 2021, 'MR20DD 2.0L', 'Xtronic CVT', 'hybrid'),
    ('e1000000-0000-0000-0000-000000000045', 'd1000000-0000-0000-0000-000000000035', 'Lancer', 'CS2A / CS3A (GLX) & CY2A (EX)', 2001, 2016, '4G15 / 4A91', 'INVECS-III CVT / Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000046', 'd1000000-0000-0000-0000-000000000036', 'Montero / Pajero', 'V73 / V78 / V93 / V98 (3.2 DI-D)', 2000, 2019, '4M41 3.2L / 6G72', 'Automatic / Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000047', 'd1000000-0000-0000-0000-000000000037', 'Ape City / Xtra LDX', 'Ape City Diesel / Xtra LDX 435cc', 2008, NULL, 'Greaves G435', '4-Speed Manual', 'diesel'),
    ('e1000000-0000-0000-0000-000000000048', 'd1000000-0000-0000-0000-000000000038', 'Apache RTR 160', 'RTR 160 2V / 4V', 2012, NULL, 'RT-Fi 159.7cc', '5-Speed Manual', 'petrol'),
    ('e1000000-0000-0000-0000-000000000049', 'd1000000-0000-0000-0000-000000000039', 'NTorq 125', 'NTorq 125 Race Edition / Disc', 2018, NULL, 'CVTi-REVV 124.8cc', 'CVT', 'petrol'),
    ('e1000000-0000-0000-0000-000000000050', 'd1000000-0000-0000-0000-000000000040', 'PC200-8 Excavator', 'PC200-8 / PC200LC-8', 2006, 2020, 'SAA6D107E-1', 'HydrauMind', 'diesel')
) AS v(id, model_id, model_name, generation_chassis, year_start, year_end, engine_code, transmission, fuel_type)
JOIN public.vehicle_models md
  ON md.id = v.model_id::uuid
  OR (
    md.name = v.model_name
    AND NOT EXISTS (SELECT 1 FROM public.vehicle_models md2 WHERE md2.id = v.model_id::uuid)
  )
WHERE NOT EXISTS (
  SELECT 1
  FROM public.vehicle_variants existing_v
  WHERE existing_v.id = v.id::uuid
     OR (
       existing_v.model_id = md.id
       AND COALESCE(existing_v.generation_chassis, '') = COALESCE(v.generation_chassis, '')
       AND COALESCE(existing_v.year_start, -1) = COALESCE(v.year_start, -1)
     )
)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. HIERARCHY CONSISTENCY TRIGGER ON product_compatibility
-- -----------------------------------------------------------------------------
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
-- 3. RLS POLICY HARDENING FOR product_compatibility
-- -----------------------------------------------------------------------------
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
-- 4. TAXONOMY VERIFICATION QUERY
-- -----------------------------------------------------------------------------
SELECT
  (SELECT COUNT(*) FROM public.vehicle_types) AS vehicle_types_count,
  (SELECT COUNT(*) FROM public.vehicle_makes) AS vehicle_makes_count,
  (SELECT COUNT(*) FROM public.vehicle_models) AS vehicle_models_count,
  (SELECT COUNT(*) FROM public.vehicle_variants) AS vehicle_variants_count;

-- =============================================================================
-- ROLLBACK NOTES (Only if manual rollback is required):
-- DROP TRIGGER IF EXISTS trg_validate_product_compatibility_hierarchy ON public.product_compatibility;
-- DROP FUNCTION IF EXISTS public.validate_product_compatibility_hierarchy();
-- =============================================================================
