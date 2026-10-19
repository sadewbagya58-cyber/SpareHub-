export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  icon_name?: string | null;
}

export interface VehicleTypeOption {
  id: string;
  name: string;
  display_order?: number;
}

export interface VehicleMakeOption {
  id: string;
  vehicle_type_id: string;
  name: string;
  slug: string;
}

export interface VehicleModelOption {
  id: string;
  make_id: string;
  name: string;
  slug: string;
}

export interface VehicleVariantOption {
  id: string;
  model_id: string;
  generation_chassis: string;
  year_start: number;
  year_end?: number | null;
  engine_code?: string | null;
  transmission?: string | null;
  fuel_type?: string | null;
}

export interface VehicleTaxonomyHierarchy {
  vehicleTypes: VehicleTypeOption[];
  vehicleMakes: VehicleMakeOption[];
  vehicleModels: VehicleModelOption[];
  vehicleVariants: VehicleVariantOption[];
}

export const FALLBACK_CATEGORIES: CategoryOption[] = [
  { id: "c1000000-0000-0000-0000-000000000001", name: "Engine & Drivetrain", slug: "engine-drivetrain", icon_name: "Wrench" },
  { id: "c1000000-0000-0000-0000-000000000002", name: "Braking Systems", slug: "braking-systems", icon_name: "Disc" },
  { id: "c1000000-0000-0000-0000-000000000003", name: "Suspension & Steering", slug: "suspension-steering", icon_name: "Activity" },
  { id: "c1000000-0000-0000-0000-000000000004", name: "Electrical & Lighting", slug: "electrical-lighting", icon_name: "Zap" },
  { id: "c1000000-0000-0000-0000-000000000005", name: "Cooling & Heating", slug: "cooling-heating", icon_name: "Thermometer" },
  { id: "c1000000-0000-0000-0000-000000000006", name: "Body & Panel Parts", slug: "body-panel-parts", icon_name: "Shield" },
  { id: "c1000000-0000-0000-0000-000000000007", name: "Filters & Maintenance", slug: "filters-maintenance", icon_name: "Filter" },
  { id: "c1000000-0000-0000-0000-000000000008", name: "Clutch & Transmission", slug: "clutch-transmission", icon_name: "Cog" },
  { id: "c1000000-0000-0000-0000-000000000009", name: "Tires & Wheels", slug: "tires-wheels", icon_name: "Circle" },
  { id: "c1000000-0000-0000-0000-000000000010", name: "Interior & Accessories", slug: "interior-accessories", icon_name: "Sliders" },
];

export const FALLBACK_VEHICLE_TYPES: VehicleTypeOption[] = [
  { id: "car", name: "Cars & SUVs", display_order: 10 },
  { id: "three_wheeler", name: "Three-Wheelers", display_order: 20 },
  { id: "motorcycle", name: "Motorcycles", display_order: 30 },
  { id: "van", name: "Vans", display_order: 40 },
  { id: "bus", name: "Buses", display_order: 50 },
  { id: "truck", name: "Lorries & Trucks", display_order: 60 },
  { id: "tractor", name: "Tractors", display_order: 70 },
  { id: "heavy_machinery", name: "Heavy Machinery", display_order: 80 },
];

export const FALLBACK_VEHICLE_MAKES: VehicleMakeOption[] = [
  // Cars
  { id: "b1000000-0000-0000-0000-000000000001", vehicle_type_id: "car", name: "Toyota", slug: "toyota" },
  { id: "b1000000-0000-0000-0000-000000000002", vehicle_type_id: "car", name: "Honda", slug: "honda" },
  { id: "b1000000-0000-0000-0000-000000000003", vehicle_type_id: "car", name: "Nissan", slug: "nissan" },
  { id: "b1000000-0000-0000-0000-000000000004", vehicle_type_id: "car", name: "Suzuki", slug: "suzuki" },
  { id: "b1000000-0000-0000-0000-000000000005", vehicle_type_id: "car", name: "Mitsubishi", slug: "mitsubishi" },
  // Three-Wheelers
  { id: "b1000000-0000-0000-0000-000000000006", vehicle_type_id: "three_wheeler", name: "Bajaj", slug: "bajaj-three-wheeler" },
  { id: "b1000000-0000-0000-0000-000000000007", vehicle_type_id: "three_wheeler", name: "TVS", slug: "tvs-three-wheeler" },
  { id: "b1000000-0000-0000-0000-000000000008", vehicle_type_id: "three_wheeler", name: "Piaggio", slug: "piaggio" },
  // Motorcycles
  { id: "b1000000-0000-0000-0000-000000000009", vehicle_type_id: "motorcycle", name: "Bajaj", slug: "bajaj-moto" },
  { id: "b1000000-0000-0000-0000-000000000010", vehicle_type_id: "motorcycle", name: "Yamaha", slug: "yamaha" },
  { id: "b1000000-0000-0000-0000-000000000011", vehicle_type_id: "motorcycle", name: "Honda", slug: "honda-moto" },
  { id: "b1000000-0000-0000-0000-000000000012", vehicle_type_id: "motorcycle", name: "TVS", slug: "tvs-moto" },
  // Vans
  { id: "b1000000-0000-0000-0000-000000000013", vehicle_type_id: "van", name: "Toyota", slug: "toyota-van" },
  { id: "b1000000-0000-0000-0000-000000000014", vehicle_type_id: "van", name: "Nissan", slug: "nissan-van" },
  // Commercial & Trucks
  { id: "b1000000-0000-0000-0000-000000000015", vehicle_type_id: "truck", name: "Isuzu", slug: "isuzu" },
  { id: "b1000000-0000-0000-0000-000000000016", vehicle_type_id: "truck", name: "Mitsubishi Fuso", slug: "fuso" },
  { id: "b1000000-0000-0000-0000-000000000017", vehicle_type_id: "truck", name: "Tata", slug: "tata" },
  { id: "b1000000-0000-0000-0000-000000000018", vehicle_type_id: "bus", name: "Ashok Leyland", slug: "ashok-leyland" },
  // Tractors & Heavy Machinery
  { id: "b1000000-0000-0000-0000-000000000019", vehicle_type_id: "tractor", name: "Massey Ferguson", slug: "massey-ferguson" },
  { id: "b1000000-0000-0000-0000-000000000020", vehicle_type_id: "heavy_machinery", name: "Caterpillar", slug: "caterpillar" },
  { id: "b1000000-0000-0000-0000-000000000021", vehicle_type_id: "heavy_machinery", name: "Komatsu", slug: "komatsu" },
];

export const FALLBACK_VEHICLE_MODELS: VehicleModelOption[] = [
  // Toyota Cars
  { id: "d1000000-0000-0000-0000-000000000001", make_id: "b1000000-0000-0000-0000-000000000001", name: "Corolla", slug: "corolla" },
  { id: "d1000000-0000-0000-0000-000000000002", make_id: "b1000000-0000-0000-0000-000000000001", name: "Prius", slug: "prius" },
  { id: "d1000000-0000-0000-0000-000000000003", make_id: "b1000000-0000-0000-0000-000000000001", name: "Aqua", slug: "aqua" },
  { id: "d1000000-0000-0000-0000-000000000004", make_id: "b1000000-0000-0000-0000-000000000001", name: "Vitz", slug: "vitz" },
  { id: "d1000000-0000-0000-0000-000000000005", make_id: "b1000000-0000-0000-0000-000000000001", name: "Axio", slug: "axio" },
  { id: "d1000000-0000-0000-0000-000000000006", make_id: "b1000000-0000-0000-0000-000000000001", name: "Premio", slug: "premio" },
  // Honda Cars
  { id: "d1000000-0000-0000-0000-000000000007", make_id: "b1000000-0000-0000-0000-000000000002", name: "Civic", slug: "civic" },
  { id: "d1000000-0000-0000-0000-000000000008", make_id: "b1000000-0000-0000-0000-000000000002", name: "Fit / Jazz", slug: "fit" },
  { id: "d1000000-0000-0000-0000-000000000009", make_id: "b1000000-0000-0000-0000-000000000002", name: "Vezel", slug: "vezel" },
  { id: "d1000000-0000-0000-0000-000000000010", make_id: "b1000000-0000-0000-0000-000000000002", name: "Grace", slug: "grace" },
  // Suzuki Cars
  { id: "d1000000-0000-0000-0000-000000000011", make_id: "b1000000-0000-0000-0000-000000000004", name: "Alto", slug: "alto" },
  { id: "d1000000-0000-0000-0000-000000000012", make_id: "b1000000-0000-0000-0000-000000000004", name: "WagonR", slug: "wagonr" },
  { id: "d1000000-0000-0000-0000-000000000013", make_id: "b1000000-0000-0000-0000-000000000004", name: "Swift", slug: "swift" },
  { id: "d1000000-0000-0000-0000-000000000014", make_id: "b1000000-0000-0000-0000-000000000004", name: "Spacia", slug: "spacia" },
  // Bajaj Three-Wheelers
  { id: "d1000000-0000-0000-0000-000000000015", make_id: "b1000000-0000-0000-0000-000000000006", name: "RE 205 (2-Stroke)", slug: "re-205-2s" },
  { id: "d1000000-0000-0000-0000-000000000016", make_id: "b1000000-0000-0000-0000-000000000006", name: "RE 205 (4-Stroke)", slug: "re-205-4s" },
  { id: "d1000000-0000-0000-0000-000000000017", make_id: "b1000000-0000-0000-0000-000000000006", name: "Compact 4S", slug: "compact-4s" },
  // TVS Three-Wheelers
  { id: "d1000000-0000-0000-0000-000000000018", make_id: "b1000000-0000-0000-0000-000000000007", name: "King Deluxe", slug: "king-deluxe" },
  { id: "d1000000-0000-0000-0000-000000000019", make_id: "b1000000-0000-0000-0000-000000000007", name: "King Duramax", slug: "king-duramax" },
  // Motorcycles
  { id: "d1000000-0000-0000-0000-000000000020", make_id: "b1000000-0000-0000-0000-000000000009", name: "Pulsar 150", slug: "pulsar-150" },
  { id: "d1000000-0000-0000-0000-000000000021", make_id: "b1000000-0000-0000-0000-000000000009", name: "Discover 125", slug: "discover-125" },
  { id: "d1000000-0000-0000-0000-000000000022", make_id: "b1000000-0000-0000-0000-000000000010", name: "FZ-S", slug: "fz-s" },
  { id: "d1000000-0000-0000-0000-000000000023", make_id: "b1000000-0000-0000-0000-000000000011", name: "Dio", slug: "dio" },
  // Vans
  { id: "d1000000-0000-0000-0000-000000000024", make_id: "b1000000-0000-0000-0000-000000000013", name: "HiAce KDH / GDH", slug: "hiace" },
  { id: "d1000000-0000-0000-0000-000000000025", make_id: "b1000000-0000-0000-0000-000000000014", name: "Caravan E25 / NV350", slug: "caravan" },
  // Trucks & Buses
  { id: "d1000000-0000-0000-0000-000000000026", make_id: "b1000000-0000-0000-0000-000000000015", name: "Elf NKR / NPR", slug: "isuzu-elf" },
  { id: "d1000000-0000-0000-0000-000000000027", make_id: "b1000000-0000-0000-0000-000000000016", name: "Canter FE / FG", slug: "canter" },
  { id: "d1000000-0000-0000-0000-000000000028", make_id: "b1000000-0000-0000-0000-000000000017", name: "Ace Dimo Batta", slug: "tata-ace" },
  { id: "d1000000-0000-0000-0000-000000000029", make_id: "b1000000-0000-0000-0000-000000000018", name: "Viking Chassis", slug: "leyland-viking" },
  // Tractors & Machinery
  { id: "d1000000-0000-0000-0000-000000000030", make_id: "b1000000-0000-0000-0000-000000000019", name: "MF 240", slug: "mf-240" },
  { id: "d1000000-0000-0000-0000-000000000031", make_id: "b1000000-0000-0000-0000-000000000020", name: "320D Excavator", slug: "cat-320d" },
  // Nissan Cars
  { id: "d1000000-0000-0000-0000-000000000032", make_id: "b1000000-0000-0000-0000-000000000003", name: "Sunny", slug: "sunny" },
  { id: "d1000000-0000-0000-0000-000000000033", make_id: "b1000000-0000-0000-0000-000000000003", name: "Leaf", slug: "leaf" },
  { id: "d1000000-0000-0000-0000-000000000034", make_id: "b1000000-0000-0000-0000-000000000003", name: "X-Trail", slug: "x-trail" },
  // Mitsubishi Cars
  { id: "d1000000-0000-0000-0000-000000000035", make_id: "b1000000-0000-0000-0000-000000000005", name: "Lancer", slug: "lancer" },
  { id: "d1000000-0000-0000-0000-000000000036", make_id: "b1000000-0000-0000-0000-000000000005", name: "Montero / Pajero", slug: "montero" },
  // Piaggio Three-Wheelers
  { id: "d1000000-0000-0000-0000-000000000037", make_id: "b1000000-0000-0000-0000-000000000008", name: "Ape City / Xtra LDX", slug: "ape-city" },
  // TVS Motorcycles
  { id: "d1000000-0000-0000-0000-000000000038", make_id: "b1000000-0000-0000-0000-000000000012", name: "Apache RTR 160", slug: "apache-rtr-160" },
  { id: "d1000000-0000-0000-0000-000000000039", make_id: "b1000000-0000-0000-0000-000000000012", name: "NTorq 125", slug: "ntorq-125" },
  // Komatsu Heavy Machinery
  { id: "d1000000-0000-0000-0000-000000000040", make_id: "b1000000-0000-0000-0000-000000000021", name: "PC200-8 Excavator", slug: "pc200-8" },
];

export const FALLBACK_VEHICLE_VARIANTS: VehicleVariantOption[] = [
  // Toyota Corolla (d1000000-0000-0000-0000-000000000001)
  { id: "e1000000-0000-0000-0000-000000000001", model_id: "d1000000-0000-0000-0000-000000000001", generation_chassis: "AE110 (5A-FE 1.5L)", year_start: 1995, year_end: 2000, engine_code: "5A-FE", transmission: "Automatic / Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000002", model_id: "d1000000-0000-0000-0000-000000000001", generation_chassis: "NZE121 (1NZ-FE 1.5L)", year_start: 2000, year_end: 2006, engine_code: "1NZ-FE", transmission: "Automatic / Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000003", model_id: "d1000000-0000-0000-0000-000000000001", generation_chassis: "ZRE142 / NZE141", year_start: 2007, year_end: 2013, engine_code: "1NZ-FE / 1ZR-FE", transmission: "Automatic / CVT", fuel_type: "petrol" },
  // Toyota Prius (d1000000-0000-0000-0000-000000000002)
  { id: "e1000000-0000-0000-0000-000000000004", model_id: "d1000000-0000-0000-0000-000000000002", generation_chassis: "ZVW30 (3rd Gen Hybrid)", year_start: 2009, year_end: 2015, engine_code: "2ZR-FXE 1.8L", transmission: "e-CVT", fuel_type: "hybrid" },
  { id: "e1000000-0000-0000-0000-000000000005", model_id: "d1000000-0000-0000-0000-000000000002", generation_chassis: "ZVW50 (4th Gen Hybrid)", year_start: 2015, year_end: 2022, engine_code: "2ZR-FXE 1.8L", transmission: "e-CVT", fuel_type: "hybrid" },
  // Toyota Aqua (d1000000-0000-0000-0000-000000000003)
  { id: "e1000000-0000-0000-0000-000000000006", model_id: "d1000000-0000-0000-0000-000000000003", generation_chassis: "NHP10 (1NZ-FXE Hybrid)", year_start: 2011, year_end: 2021, engine_code: "1NZ-FXE 1.5L", transmission: "e-CVT", fuel_type: "hybrid" },
  // Toyota Vitz (d1000000-0000-0000-0000-000000000004)
  { id: "e1000000-0000-0000-0000-000000000007", model_id: "d1000000-0000-0000-0000-000000000004", generation_chassis: "KSP90 / SCP90", year_start: 2005, year_end: 2010, engine_code: "1KR-FE / 2SZ-FE", transmission: "CVT", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000008", model_id: "d1000000-0000-0000-0000-000000000004", generation_chassis: "KSP130 / NSP130", year_start: 2011, year_end: 2020, engine_code: "1KR-FE / 1NR-FE", transmission: "CVT", fuel_type: "petrol" },
  // Toyota Axio (d1000000-0000-0000-0000-000000000005)
  { id: "e1000000-0000-0000-0000-000000000009", model_id: "d1000000-0000-0000-0000-000000000005", generation_chassis: "NZE141 (1.5L Petrol)", year_start: 2006, year_end: 2012, engine_code: "1NZ-FE", transmission: "CVT", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000010", model_id: "d1000000-0000-0000-0000-000000000005", generation_chassis: "NKE165 (Hybrid) / NZE161", year_start: 2012, year_end: 2023, engine_code: "1NZ-FXE / 1NZ-FE", transmission: "e-CVT / CVT", fuel_type: "hybrid" },
  // Toyota Premio (d1000000-0000-0000-0000-000000000006)
  { id: "e1000000-0000-0000-0000-000000000011", model_id: "d1000000-0000-0000-0000-000000000006", generation_chassis: "NZT260 / ZRT260 (260 Series)", year_start: 2007, year_end: 2021, engine_code: "1NZ-FE / 2ZR-FAE", transmission: "CVT", fuel_type: "petrol" },
  // Honda Civic (d1000000-0000-0000-0000-000000000007)
  { id: "e1000000-0000-0000-0000-000000000012", model_id: "d1000000-0000-0000-0000-000000000007", generation_chassis: "FD1 / FD4 (8th Gen)", year_start: 2006, year_end: 2011, engine_code: "R18A / R16A", transmission: "Automatic / Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000013", model_id: "d1000000-0000-0000-0000-000000000007", generation_chassis: "FC1 / FK7 (10th Gen Turbo)", year_start: 2016, year_end: 2021, engine_code: "L15B7 / P10A2", transmission: "CVT", fuel_type: "petrol" },
  // Honda Fit / Jazz (d1000000-0000-0000-0000-000000000008)
  { id: "e1000000-0000-0000-0000-000000000014", model_id: "d1000000-0000-0000-0000-000000000008", generation_chassis: "GP1 (IMA Hybrid)", year_start: 2010, year_end: 2013, engine_code: "LDA 1.3L", transmission: "CVT", fuel_type: "hybrid" },
  { id: "e1000000-0000-0000-0000-000000000015", model_id: "d1000000-0000-0000-0000-000000000008", generation_chassis: "GP5 (i-DCD Hybrid)", year_start: 2013, year_end: 2020, engine_code: "LEB 1.5L", transmission: "7-Speed DCT", fuel_type: "hybrid" },
  // Honda Vezel (d1000000-0000-0000-0000-000000000009)
  { id: "e1000000-0000-0000-0000-000000000016", model_id: "d1000000-0000-0000-0000-000000000009", generation_chassis: "RU3 / RU4 (Hybrid Z / RS)", year_start: 2013, year_end: 2021, engine_code: "LEB 1.5L", transmission: "7-Speed DCT", fuel_type: "hybrid" },
  // Honda Grace (d1000000-0000-0000-0000-000000000010)
  { id: "e1000000-0000-0000-0000-000000000017", model_id: "d1000000-0000-0000-0000-000000000010", generation_chassis: "GM4 / GM5 (i-DCD Hybrid)", year_start: 2014, year_end: 2020, engine_code: "LEB 1.5L", transmission: "7-Speed DCT", fuel_type: "hybrid" },
  // Suzuki Alto (d1000000-0000-0000-0000-000000000011)
  { id: "e1000000-0000-0000-0000-000000000018", model_id: "d1000000-0000-0000-0000-000000000011", generation_chassis: "Alto 800 (F8D Indian)", year_start: 2012, year_end: 2022, engine_code: "F8D 796cc", transmission: "5-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000019", model_id: "d1000000-0000-0000-0000-000000000011", generation_chassis: "HA36S / HA36V (Japanese 660cc)", year_start: 2014, year_end: 2021, engine_code: "R06A 660cc", transmission: "CVT / AGS", fuel_type: "petrol" },
  // Suzuki WagonR (d1000000-0000-0000-0000-000000000012)
  { id: "e1000000-0000-0000-0000-000000000020", model_id: "d1000000-0000-0000-0000-000000000012", generation_chassis: "MH34S / MH44S (FZ / Stingray)", year_start: 2012, year_end: 2017, engine_code: "R06A 660cc", transmission: "CVT", fuel_type: "hybrid" },
  { id: "e1000000-0000-0000-0000-000000000021", model_id: "d1000000-0000-0000-0000-000000000012", generation_chassis: "MH35S / MH55S (FX / FZ / Stingray)", year_start: 2017, year_end: 2023, engine_code: "R06A 660cc", transmission: "CVT", fuel_type: "hybrid" },
  // Suzuki Swift (d1000000-0000-0000-0000-000000000013)
  { id: "e1000000-0000-0000-0000-000000000022", model_id: "d1000000-0000-0000-0000-000000000013", generation_chassis: "ZC11S / ZC72S (1.2L / 1.3L)", year_start: 2004, year_end: 2016, engine_code: "M13A / K12B", transmission: "Automatic / CVT", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000023", model_id: "d1000000-0000-0000-0000-000000000013", generation_chassis: "ZC13S / ZC83S (RS Turbo / Hybrid)", year_start: 2017, year_end: 2023, engine_code: "K10C / K12C", transmission: "6AT / CVT", fuel_type: "hybrid" },
  // Suzuki Spacia (d1000000-0000-0000-0000-000000000014)
  { id: "e1000000-0000-0000-0000-000000000024", model_id: "d1000000-0000-0000-0000-000000000014", generation_chassis: "MK42S / MK53S (Custom Z / XS)", year_start: 2015, year_end: 2023, engine_code: "R06A 660cc", transmission: "CVT", fuel_type: "hybrid" },
  // Bajaj Three-Wheelers (d1000000-0000-0000-0000-000000000015..17)
  { id: "e1000000-0000-0000-0000-000000000025", model_id: "d1000000-0000-0000-0000-000000000015", generation_chassis: "RE 2S 145cc (2-Stroke)", year_start: 1998, year_end: 2008, engine_code: "RE145-2S", transmission: "4-Speed Hand Shift", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000026", model_id: "d1000000-0000-0000-0000-000000000016", generation_chassis: "RE 4S 175cc / 205cc", year_start: 2007, year_end: 2016, engine_code: "RE205-4S", transmission: "4-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000027", model_id: "d1000000-0000-0000-0000-000000000017", generation_chassis: "RE Compact 4S FL / BS6", year_start: 2014, year_end: null, engine_code: "DTS-i 198cc", transmission: "4-Speed Manual", fuel_type: "petrol" },
  // TVS Three-Wheelers (d1000000-0000-0000-0000-000000000018..19)
  { id: "e1000000-0000-0000-0000-000000000028", model_id: "d1000000-0000-0000-0000-000000000018", generation_chassis: "King 4S 200cc Deluxe", year_start: 2010, year_end: null, engine_code: "TVS-200-4S", transmission: "4-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000029", model_id: "d1000000-0000-0000-0000-000000000019", generation_chassis: "King Duramax 225cc LC", year_start: 2018, year_end: null, engine_code: "TVS-225-LC", transmission: "4-Speed Manual", fuel_type: "petrol" },
  // Motorcycles (d1000000-0000-0000-0000-000000000020..23)
  { id: "e1000000-0000-0000-0000-000000000030", model_id: "d1000000-0000-0000-0000-000000000020", generation_chassis: "UG4.5 / Twin Disc BS4/BS6", year_start: 2010, year_end: null, engine_code: "DTS-i 149cc", transmission: "5-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000031", model_id: "d1000000-0000-0000-0000-000000000021", generation_chassis: "Discover 125M / DRL Disc", year_start: 2011, year_end: 2021, engine_code: "DTS-i 124.5cc", transmission: "5-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000022", model_id: "d1000000-0000-0000-0000-000000000022", generation_chassis: "FZ-S V2.0 / V3.0 FI", year_start: 2014, year_end: null, engine_code: "BlueCore 149cc FI", transmission: "5-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000023", model_id: "d1000000-0000-0000-0000-000000000023", generation_chassis: "HET 110cc / DLX LED", year_start: 2012, year_end: null, engine_code: "HET 109.2cc", transmission: "V-Matic CVT", fuel_type: "petrol" },
  // Vans (d1000000-0000-0000-0000-000000000024..25)
  { id: "e1000000-0000-0000-0000-000000000024", model_id: "d1000000-0000-0000-0000-000000000024", generation_chassis: "KDH200 / KDH201 / KDH222", year_start: 2004, year_end: 2020, engine_code: "1KD-FTV 3.0L / 2KD-FTV 2.5L", transmission: "Automatic / Manual", fuel_type: "diesel" },
  { id: "e1000000-0000-0000-0000-000000000025", model_id: "d1000000-0000-0000-0000-000000000025", generation_chassis: "E25 (ZD30) / NV350 E26 (YD25)", year_start: 2001, year_end: 2021, engine_code: "ZD30DDTi / YD25DDTi", transmission: "Automatic / Manual", fuel_type: "diesel" },
  // Trucks & Buses (d1000000-0000-0000-0000-000000000026..29)
  { id: "e1000000-0000-0000-0000-000000000026", model_id: "d1000000-0000-0000-0000-000000000026", generation_chassis: "NKR66 / NPR75 (10.5ft / 14.5ft)", year_start: 1999, year_end: 2020, engine_code: "4HF1 4.3L / 4HK1 5.2L", transmission: "5/6-Speed Manual", fuel_type: "diesel" },
  { id: "e1000000-0000-0000-0000-000000000027", model_id: "d1000000-0000-0000-0000-000000000027", generation_chassis: "FE70 / FE85 / FBA", year_start: 2002, year_end: 2020, engine_code: "4D33 / 4M50", transmission: "5-Speed Manual", fuel_type: "diesel" },
  { id: "e1000000-0000-0000-0000-000000000028", model_id: "d1000000-0000-0000-0000-000000000028", generation_chassis: "Ace HT / EX2 (Dimo Batta)", year_start: 2006, year_end: 2020, engine_code: "275 IDI 702cc", transmission: "4/5-Speed Manual", fuel_type: "diesel" },
  { id: "e1000000-0000-0000-0000-000000000029", model_id: "d1000000-0000-0000-0000-000000000029", generation_chassis: "Viking 210 / 222 WB (H-Series)", year_start: 2005, year_end: null, engine_code: "HA6ETI 5.7L", transmission: "5/6-Speed Manual", fuel_type: "diesel" },
  // Tractors & Heavy Machinery (d1000000-0000-0000-0000-000000000030..31, 40)
  { id: "e1000000-0000-0000-0000-000000000030", model_id: "d1000000-0000-0000-0000-000000000030", generation_chassis: "MF 240 2WD (50 HP)", year_start: 1985, year_end: null, engine_code: "Perkins AD3.152", transmission: "8F / 2R Sliding Spur", fuel_type: "diesel" },
  { id: "e1000000-0000-0000-0000-000000000031", model_id: "d1000000-0000-0000-0000-000000000031", generation_chassis: "320D / 320D2 Hydraulic Excavator", year_start: 2006, year_end: 2020, engine_code: "CAT C6.4 ACERT", transmission: "Hydrostatic", fuel_type: "diesel" },
  // Nissan Cars (d1000000-0000-0000-0000-000000000032..34)
  { id: "e1000000-0000-0000-0000-000000000032", model_id: "d1000000-0000-0000-0000-000000000032", generation_chassis: "FB15 / N16 (Super Saloon / Ex Saloon)", year_start: 1998, year_end: 2006, engine_code: "QG15DE 1.5L", transmission: "Automatic / Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000033", model_id: "d1000000-0000-0000-0000-000000000033", generation_chassis: "ZE0 / AZE0 (24kWh / 30kWh) & ZE1 (40kWh)", year_start: 2011, year_end: 2022, engine_code: "EM57 / EM61", transmission: "Single-Speed Reduction", fuel_type: "electric" },
  { id: "e1000000-0000-0000-0000-000000000034", model_id: "d1000000-0000-0000-0000-000000000034", generation_chassis: "NT32 / HT32 (20X Hybrid)", year_start: 2014, year_end: 2021, engine_code: "MR20DD 2.0L", transmission: "Xtronic CVT", fuel_type: "hybrid" },
  // Mitsubishi Cars (d1000000-0000-0000-0000-000000000035..36)
  { id: "e1000000-0000-0000-0000-000000000035", model_id: "d1000000-0000-0000-0000-000000000035", generation_chassis: "CS2A / CS3A (GLX) & CY2A (EX)", year_start: 2001, year_end: 2016, engine_code: "4G15 / 4A91", transmission: "INVECS-III CVT / Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000036", model_id: "d1000000-0000-0000-0000-000000000036", generation_chassis: "V73 / V78 / V93 / V98 (3.2 DI-D)", year_start: 2000, year_end: 2019, engine_code: "4M41 3.2L / 6G72", transmission: "Automatic / Manual", fuel_type: "diesel" },
  // Piaggio (d1000000-0000-0000-0000-000000000037)
  { id: "e1000000-0000-0000-0000-000000000037", model_id: "d1000000-0000-0000-0000-000000000037", generation_chassis: "Ape City Diesel / Xtra LDX 435cc", year_start: 2008, year_end: null, engine_code: "Greaves G435", transmission: "4-Speed Manual", fuel_type: "diesel" },
  // TVS Motorcycles (d1000000-0000-0000-0000-000000000038..39)
  { id: "e1000000-0000-0000-0000-000000000038", model_id: "d1000000-0000-0000-0000-000000000038", generation_chassis: "RTR 160 2V / 4V", year_start: 2012, year_end: null, engine_code: "RT-Fi 159.7cc", transmission: "5-Speed Manual", fuel_type: "petrol" },
  { id: "e1000000-0000-0000-0000-000000000039", model_id: "d1000000-0000-0000-0000-000000000039", generation_chassis: "NTorq 125 Race Edition / Disc", year_start: 2018, year_end: null, engine_code: "CVTi-REVV 124.8cc", transmission: "CVT", fuel_type: "petrol" },
  // Komatsu (d1000000-0000-0000-0000-000000000040)
  { id: "e1000000-0000-0000-0000-000000000040", model_id: "d1000000-0000-0000-0000-000000000040", generation_chassis: "PC200-8 / PC200LC-8", year_start: 2006, year_end: 2020, engine_code: "SAA6D107E-1", transmission: "HydrauMind", fuel_type: "diesel" },
];

/**
 * Formats a vehicle variant year range cleanly (e.g. "2009–2015" or "2014–Present").
 */
export function formatVariantYearRange(
  yearStart?: number | null,
  yearEnd?: number | null
): string {
  if (!yearStart) return "";
  if (yearEnd && yearEnd >= yearStart) {
    return yearEnd === yearStart ? `${yearStart}` : `${yearStart}–${yearEnd}`;
  }
  return `${yearStart}–Present`;
}

/**
 * Formats a concise human-readable label for a vehicle variant option.
 */
export function formatVariantLabel(variant: VehicleVariantOption): string {
  const years = formatVariantYearRange(variant.year_start, variant.year_end);
  const parts = [variant.generation_chassis];
  if (years) parts[0] = `${variant.generation_chassis} (${years})`;
  if (variant.engine_code) parts.push(variant.engine_code);
  if (variant.fuel_type) parts.push(variant.fuel_type);
  return parts.join(" • ");
}

export interface ValidatedVehicleParams {
  isValid: boolean;
  hasFilter: boolean;
  vehicleType?: VehicleTypeOption;
  vehicleMake?: VehicleMakeOption;
  vehicleModel?: VehicleModelOption;
  vehicleVariant?: VehicleVariantOption;
  displayLabel: string;
  fitmentScope: "universal" | "variant" | "model" | "make" | "type" | "none";
  sanitizedParams: {
    type?: string;
    make?: string;
    model?: string;
    variant?: string;
  };
  filterSummary: string;
}

/**
 * Server-side validation and sanitization of untrusted vehicle query parameters.
 * Validates the strict 4-level hierarchy: Type -> Make -> Model -> Variant.
 * Drops mismatched downstream selections (e.g. variant of another model).
 */
export function resolveAndValidateVehicleQueryParams(
  rawParams: {
    type?: string | null;
    make?: string | null;
    model?: string | null;
    variant?: string | null;
  },
  hierarchy: VehicleTaxonomyHierarchy
): ValidatedVehicleParams {
  const rawType = rawParams.type?.trim().toLowerCase() || "";
  const rawMake = rawParams.make?.trim().toLowerCase() || "";
  const rawModel = rawParams.model?.trim().toLowerCase() || "";
  const rawVariant = rawParams.variant?.trim().toLowerCase() || "";

  let resolvedType: VehicleTypeOption | undefined;
  let resolvedMake: VehicleMakeOption | undefined;
  let resolvedModel: VehicleModelOption | undefined;
  let resolvedVariant: VehicleVariantOption | undefined;

  // 1. Resolve vehicle type
  if (rawType && rawType !== "all") {
    resolvedType = hierarchy.vehicleTypes.find(
      (t) => t.id.toLowerCase() === rawType || t.name.toLowerCase() === rawType
    );
  }

  // 2. Resolve vehicle make
  if (rawMake && rawMake !== "all") {
    const candidateMake = hierarchy.vehicleMakes.find(
      (m) =>
        m.id.toLowerCase() === rawMake ||
        m.slug.toLowerCase() === rawMake ||
        m.name.toLowerCase() === rawMake
    );

    if (candidateMake) {
      if (resolvedType) {
        if (candidateMake.vehicle_type_id === resolvedType.id) {
          resolvedMake = candidateMake;
        }
      } else {
        // Auto-resolve vehicle type from make if type was not explicitly supplied
        resolvedMake = candidateMake;
        resolvedType = hierarchy.vehicleTypes.find(
          (t) => t.id === candidateMake.vehicle_type_id
        );
      }
    }
  }

  // 3. Resolve vehicle model (must belong to resolved make)
  if (rawModel && rawModel !== "all" && resolvedMake) {
    const candidateModel = hierarchy.vehicleModels.find(
      (m) =>
        m.make_id === resolvedMake!.id &&
        (m.id.toLowerCase() === rawModel ||
          m.slug.toLowerCase() === rawModel ||
          m.name.toLowerCase() === rawModel)
    );

    if (candidateModel) {
      resolvedModel = candidateModel;
    }
  }

  // 4. Resolve vehicle variant (must belong to resolved model)
  if (rawVariant && rawVariant !== "all" && resolvedModel) {
    const candidateVariant = hierarchy.vehicleVariants.find(
      (v) =>
        v.model_id === resolvedModel!.id &&
        (v.id.toLowerCase() === rawVariant ||
          v.generation_chassis.toLowerCase() === rawVariant)
    );

    if (candidateVariant) {
      resolvedVariant = candidateVariant;
    }
  }

  const hasFilter = Boolean(resolvedType || resolvedMake || resolvedModel || resolvedVariant);
  let displayLabel = "";
  let filterSummary = "All Vehicles";
  let fitmentScope: ValidatedVehicleParams["fitmentScope"] = "none";

  if (resolvedVariant && resolvedModel && resolvedMake) {
    displayLabel = `${resolvedMake.name} ${resolvedModel.name} (${formatVariantLabel(resolvedVariant)})`;
    filterSummary = `Fits ${resolvedMake.name} ${resolvedModel.name} • ${resolvedVariant.generation_chassis}`;
    fitmentScope = "variant";
  } else if (resolvedModel && resolvedMake) {
    displayLabel = `${resolvedMake.name} ${resolvedModel.name} (All Generations)`;
    filterSummary = `Fits all ${resolvedMake.name} ${resolvedModel.name} models`;
    fitmentScope = "model";
  } else if (resolvedMake) {
    displayLabel = `${resolvedMake.name} (All Models)`;
    filterSummary = `Fits ${resolvedMake.name} vehicles`;
    fitmentScope = "make";
  } else if (resolvedType) {
    displayLabel = `${resolvedType.name} (All Makes)`;
    filterSummary = `Fits ${resolvedType.name}`;
    fitmentScope = "type";
  }

  const sanitizedParams: ValidatedVehicleParams["sanitizedParams"] = {};
  if (resolvedType) sanitizedParams.type = resolvedType.id;
  if (resolvedMake) sanitizedParams.make = resolvedMake.id;
  if (resolvedModel) sanitizedParams.model = resolvedModel.id;
  if (resolvedVariant) sanitizedParams.variant = resolvedVariant.id;

  return {
    isValid: true,
    hasFilter,
    vehicleType: resolvedType,
    vehicleMake: resolvedMake,
    vehicleModel: resolvedModel,
    vehicleVariant: resolvedVariant,
    displayLabel,
    fitmentScope,
    sanitizedParams,
    filterSummary,
  };
}

export interface ProductFitmentEvaluation {
  isMatch: boolean;
  isExactFit: boolean;
  fitmentType:
    | "universal"
    | "exact_variant"
    | "model_compatible"
    | "make_compatible"
    | "type_compatible"
    | "none";
  fitmentBadge: string;
  fitmentDetails: string;
}

/**
 * Evaluates whether a product is compatible with a validated vehicle filter,
 * returning the precise fitment classification according to SpareHub's 4-level schema.
 */
export function evaluateProductFitment(
  product: {
    is_universal: boolean;
    product_compatibility?: Array<{
      vehicle_type_id?: string | null;
      make_id?: string | null;
      vehicle_model_id?: string | null;
      vehicle_variant_id?: string | null;
      is_exact_fit?: boolean | null;
      generation_chassis?: string | null;
      year_start?: number | null;
      year_end?: number | null;
      notes?: string | null;
    }> | null;
  },
  filter: {
    vehicleTypeId?: string;
    vehicleMakeId?: string;
    vehicleModelId?: string;
    vehicleVariantId?: string;
  }
): ProductFitmentEvaluation {
  const hasVehicleFilter = Boolean(
    (filter.vehicleTypeId && filter.vehicleTypeId !== "all") ||
      (filter.vehicleMakeId && filter.vehicleMakeId !== "all") ||
      (filter.vehicleModelId && filter.vehicleModelId !== "all") ||
      (filter.vehicleVariantId && filter.vehicleVariantId !== "all")
  );

  // If no vehicle filter is specified, all published products match
  if (!hasVehicleFilter) {
    return {
      isMatch: true,
      isExactFit: true,
      fitmentType: product.is_universal ? "universal" : "none",
      fitmentBadge: product.is_universal ? "Universal Fit" : "Verified Fit",
      fitmentDetails: product.is_universal
        ? "Universal Fitment (All Vehicles)"
        : "Verified Compatibility",
    };
  }

  // Universal fit products match any selected vehicle
  if (product.is_universal) {
    return {
      isMatch: true,
      isExactFit: true,
      fitmentType: "universal",
      fitmentBadge: "Universal Fit",
      fitmentDetails: "Universal Fitment (Fits All Vehicles)",
    };
  }

  const entries = product.product_compatibility || [];
  if (entries.length === 0) {
    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  // 1. Variant filter specified: look for exact variant match first, then model-wide match
  if (filter.vehicleVariantId && filter.vehicleVariantId !== "all") {
    const exactMatch = entries.find(
      (c) => c.vehicle_variant_id === filter.vehicleVariantId
    );
    if (exactMatch) {
      return {
        isMatch: true,
        isExactFit: exactMatch.is_exact_fit !== false,
        fitmentType: "exact_variant",
        fitmentBadge:
          exactMatch.is_exact_fit !== false ? "Direct OEM Fit" : "Compatible Variant Fit",
        fitmentDetails: exactMatch.notes
          ? `Direct Fit • ${exactMatch.notes}`
          : "Direct OEM Fitment for Selected Variant",
      };
    }

    // Check for model-level fitment (where vehicle_variant_id is null, meaning it fits all variants of the model)
    const modelLevelMatch = entries.find(
      (c) =>
        c.vehicle_model_id === filter.vehicleModelId &&
        (!c.vehicle_variant_id || c.vehicle_variant_id === null)
    );
    if (modelLevelMatch) {
      return {
        isMatch: true,
        isExactFit: modelLevelMatch.is_exact_fit !== false,
        fitmentType: "model_compatible",
        fitmentBadge: "Model Compatible",
        fitmentDetails: modelLevelMatch.notes
          ? `Compatible • ${modelLevelMatch.notes}`
          : "Model-wide fitment (All Generations)",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  // 2. Model filter specified (without variant): any entry with matching vehicle_model_id
  if (filter.vehicleModelId && filter.vehicleModelId !== "all") {
    const modelMatch = entries.find(
      (c) => c.vehicle_model_id === filter.vehicleModelId
    );
    if (modelMatch) {
      return {
        isMatch: true,
        isExactFit: modelMatch.is_exact_fit !== false,
        fitmentType: "model_compatible",
        fitmentBadge:
          modelMatch.is_exact_fit !== false ? "Direct OEM Fit" : "Compatible Model Fit",
        fitmentDetails: modelMatch.notes
          ? `Fits Model • ${modelMatch.notes}`
          : "Compatible with selected model",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  // 3. Make filter specified: any entry matching make_id
  if (filter.vehicleMakeId && filter.vehicleMakeId !== "all") {
    const makeMatch = entries.find((c) => c.make_id === filter.vehicleMakeId);
    if (makeMatch) {
      return {
        isMatch: true,
        isExactFit: false,
        fitmentType: "make_compatible",
        fitmentBadge: "Make Compatible",
        fitmentDetails: "Compatible with manufacturer vehicles",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  // 4. Vehicle Type filter specified: any entry matching vehicle_type_id
  if (filter.vehicleTypeId && filter.vehicleTypeId !== "all") {
    const typeMatch = entries.find(
      (c) => c.vehicle_type_id === filter.vehicleTypeId
    );
    if (typeMatch) {
      return {
        isMatch: true,
        isExactFit: false,
        fitmentType: "type_compatible",
        fitmentBadge: "Vehicle Compatible",
        fitmentDetails: "Compatible with vehicle class",
      };
    }

    return {
      isMatch: false,
      isExactFit: false,
      fitmentType: "none",
      fitmentBadge: "",
      fitmentDetails: "",
    };
  }

  return {
    isMatch: true,
    isExactFit: true,
    fitmentType: "none",
    fitmentBadge: "Verified Fit",
    fitmentDetails: "Verified Compatibility",
  };
}
