import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
  icon_name?: string | null;
}

export interface VehicleTypeOption {
  id: string;
  name: string;
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
  { id: "car", name: "Cars & SUVs" },
  { id: "three_wheeler", name: "Three-Wheelers" },
  { id: "motorcycle", name: "Motorcycles" },
  { id: "van", name: "Vans" },
  { id: "bus", name: "Buses" },
  { id: "truck", name: "Lorries & Trucks" },
  { id: "tractor", name: "Tractors" },
  { id: "heavy_machinery", name: "Heavy Machinery" },
];

export const FALLBACK_VEHICLE_MAKES: VehicleMakeOption[] = [
  // Cars
  { id: "m1000000-0000-0000-0000-000000000001", vehicle_type_id: "car", name: "Toyota", slug: "toyota" },
  { id: "m1000000-0000-0000-0000-000000000002", vehicle_type_id: "car", name: "Honda", slug: "honda" },
  { id: "m1000000-0000-0000-0000-000000000003", vehicle_type_id: "car", name: "Nissan", slug: "nissan" },
  { id: "m1000000-0000-0000-0000-000000000004", vehicle_type_id: "car", name: "Suzuki", slug: "suzuki" },
  { id: "m1000000-0000-0000-0000-000000000005", vehicle_type_id: "car", name: "Mitsubishi", slug: "mitsubishi" },
  // Three-Wheelers
  { id: "m1000000-0000-0000-0000-000000000006", vehicle_type_id: "three_wheeler", name: "Bajaj", slug: "bajaj-three-wheeler" },
  { id: "m1000000-0000-0000-0000-000000000007", vehicle_type_id: "three_wheeler", name: "TVS", slug: "tvs-three-wheeler" },
  { id: "m1000000-0000-0000-0000-000000000008", vehicle_type_id: "three_wheeler", name: "Piaggio", slug: "piaggio" },
  // Motorcycles
  { id: "m1000000-0000-0000-0000-000000000009", vehicle_type_id: "motorcycle", name: "Bajaj", slug: "bajaj-moto" },
  { id: "m1000000-0000-0000-0000-000000000010", vehicle_type_id: "motorcycle", name: "Yamaha", slug: "yamaha" },
  { id: "m1000000-0000-0000-0000-000000000011", vehicle_type_id: "motorcycle", name: "Honda", slug: "honda-moto" },
  { id: "m1000000-0000-0000-0000-000000000012", vehicle_type_id: "motorcycle", name: "TVS", slug: "tvs-moto" },
  // Vans
  { id: "m1000000-0000-0000-0000-000000000013", vehicle_type_id: "van", name: "Toyota", slug: "toyota-van" },
  { id: "m1000000-0000-0000-0000-000000000014", vehicle_type_id: "van", name: "Nissan", slug: "nissan-van" },
  // Commercial & Trucks
  { id: "m1000000-0000-0000-0000-000000000015", vehicle_type_id: "truck", name: "Isuzu", slug: "isuzu" },
  { id: "m1000000-0000-0000-0000-000000000016", vehicle_type_id: "truck", name: "Mitsubishi Fuso", slug: "fuso" },
  { id: "m1000000-0000-0000-0000-000000000017", vehicle_type_id: "truck", name: "Tata", slug: "tata" },
  { id: "m1000000-0000-0000-0000-000000000018", vehicle_type_id: "bus", name: "Ashok Leyland", slug: "ashok-leyland" },
  // Tractors & Heavy Machinery
  { id: "m1000000-0000-0000-0000-000000000019", vehicle_type_id: "tractor", name: "Massey Ferguson", slug: "massey-ferguson" },
  { id: "m1000000-0000-0000-0000-000000000020", vehicle_type_id: "heavy_machinery", name: "Caterpillar", slug: "caterpillar" },
  { id: "m1000000-0000-0000-0000-000000000021", vehicle_type_id: "heavy_machinery", name: "Komatsu", slug: "komatsu" },
];

export const FALLBACK_VEHICLE_MODELS: VehicleModelOption[] = [
  // Toyota Cars
  { id: "d1000000-0000-0000-0000-000000000001", make_id: "m1000000-0000-0000-0000-000000000001", name: "Corolla", slug: "corolla" },
  { id: "d1000000-0000-0000-0000-000000000002", make_id: "m1000000-0000-0000-0000-000000000001", name: "Prius", slug: "prius" },
  { id: "d1000000-0000-0000-0000-000000000003", make_id: "m1000000-0000-0000-0000-000000000001", name: "Aqua", slug: "aqua" },
  { id: "d1000000-0000-0000-0000-000000000004", make_id: "m1000000-0000-0000-0000-000000000001", name: "Vitz", slug: "vitz" },
  { id: "d1000000-0000-0000-0000-000000000005", make_id: "m1000000-0000-0000-0000-000000000001", name: "Axio", slug: "axio" },
  { id: "d1000000-0000-0000-0000-000000000006", make_id: "m1000000-0000-0000-0000-000000000001", name: "Premio", slug: "premio" },
  // Honda Cars
  { id: "d1000000-0000-0000-0000-000000000007", make_id: "m1000000-0000-0000-0000-000000000002", name: "Civic", slug: "civic" },
  { id: "d1000000-0000-0000-0000-000000000008", make_id: "m1000000-0000-0000-0000-000000000002", name: "Fit / Jazz", slug: "fit" },
  { id: "d1000000-0000-0000-0000-000000000009", make_id: "m1000000-0000-0000-0000-000000000002", name: "Vezel", slug: "vezel" },
  { id: "d1000000-0000-0000-0000-000000000010", make_id: "m1000000-0000-0000-0000-000000000002", name: "Grace", slug: "grace" },
  // Suzuki Cars
  { id: "d1000000-0000-0000-0000-000000000011", make_id: "m1000000-0000-0000-0000-000000000004", name: "Alto", slug: "alto" },
  { id: "d1000000-0000-0000-0000-000000000012", make_id: "m1000000-0000-0000-0000-000000000004", name: "WagonR", slug: "wagonr" },
  { id: "d1000000-0000-0000-0000-000000000013", make_id: "m1000000-0000-0000-0000-000000000004", name: "Swift", slug: "swift" },
  { id: "d1000000-0000-0000-0000-000000000014", make_id: "m1000000-0000-0000-0000-000000000004", name: "Spacia", slug: "spacia" },
  // Bajaj Three-Wheelers
  { id: "d1000000-0000-0000-0000-000000000015", make_id: "m1000000-0000-0000-0000-000000000006", name: "RE 205 (2-Stroke)", slug: "re-205-2s" },
  { id: "d1000000-0000-0000-0000-000000000016", make_id: "m1000000-0000-0000-0000-000000000006", name: "RE 205 (4-Stroke)", slug: "re-205-4s" },
  { id: "d1000000-0000-0000-0000-000000000017", make_id: "m1000000-0000-0000-0000-000000000006", name: "Compact 4S", slug: "compact-4s" },
  // TVS Three-Wheelers
  { id: "d1000000-0000-0000-0000-000000000018", make_id: "m1000000-0000-0000-0000-000000000007", name: "King Deluxe", slug: "king-deluxe" },
  { id: "d1000000-0000-0000-0000-000000000019", make_id: "m1000000-0000-0000-0000-000000000007", name: "King Duramax", slug: "king-duramax" },
  // Motorcycles
  { id: "d1000000-0000-0000-0000-000000000020", make_id: "m1000000-0000-0000-0000-000000000009", name: "Pulsar 150", slug: "pulsar-150" },
  { id: "d1000000-0000-0000-0000-000000000021", make_id: "m1000000-0000-0000-0000-000000000009", name: "Discover 125", slug: "discover-125" },
  { id: "d1000000-0000-0000-0000-000000000022", make_id: "m1000000-0000-0000-0000-000000000010", name: "FZ-S", slug: "fz-s" },
  { id: "d1000000-0000-0000-0000-000000000023", make_id: "m1000000-0000-0000-0000-000000000011", name: "Dio", slug: "dio" },
  // Vans
  { id: "d1000000-0000-0000-0000-000000000024", make_id: "m1000000-0000-0000-0000-000000000013", name: "HiAce KDH / GDH", slug: "hiace" },
  { id: "d1000000-0000-0000-0000-000000000025", make_id: "m1000000-0000-0000-0000-000000000014", name: "Caravan E25 / NV350", slug: "caravan" },
  // Trucks & Buses
  { id: "d1000000-0000-0000-0000-000000000026", make_id: "m1000000-0000-0000-0000-000000000015", name: "Elf NKR / NPR", slug: "isuzu-elf" },
  { id: "d1000000-0000-0000-0000-000000000027", make_id: "m1000000-0000-0000-0000-000000000016", name: "Canter FE / FG", slug: "canter" },
  { id: "d1000000-0000-0000-0000-000000000028", make_id: "m1000000-0000-0000-0000-000000000017", name: "Ace Dimo Batta", slug: "tata-ace" },
  { id: "d1000000-0000-0000-0000-000000000029", make_id: "m1000000-0000-0000-0000-000000000018", name: "Viking Chassis", slug: "leyland-viking" },
  // Tractors & Machinery
  { id: "d1000000-0000-0000-0000-000000000030", make_id: "m1000000-0000-0000-0000-000000000019", name: "MF 240", slug: "mf-240" },
  { id: "d1000000-0000-0000-0000-000000000031", make_id: "m1000000-0000-0000-0000-000000000020", name: "320D Excavator", slug: "cat-320d" },
];

/**
 * Fetch product categories from Supabase, falling back to comprehensive seeded defaults.
 */
export async function getProductCategories(): Promise<CategoryOption[]> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name, slug, icon_name")
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error || !data || data.length === 0) {
      return FALLBACK_CATEGORIES;
    }

    return data;
  } catch (err) {
    console.warn("Using fallback categories due to fetch error:", err);
    return FALLBACK_CATEGORIES;
  }
}

/**
 * Fetch hierarchical vehicle taxonomy for structured compatibility selection.
 */
export async function getVehicleTaxonomyHierarchy() {
  try {
    const supabase = await createServerSupabaseClient();

    const [typesRes, makesRes, modelsRes] = await Promise.all([
      supabase.from("vehicle_types").select("id, name, display_order").eq("is_active", true).order("display_order"),
      supabase.from("vehicle_makes").select("id, vehicle_type_id, name, slug").order("name"),
      supabase.from("vehicle_models").select("id, make_id, name, slug").order("name"),
    ]);

    const vehicleTypes = typesRes.data && typesRes.data.length > 0 ? typesRes.data : FALLBACK_VEHICLE_TYPES;
    const vehicleMakes = makesRes.data && makesRes.data.length > 0 ? makesRes.data : FALLBACK_VEHICLE_MAKES;
    const vehicleModels = modelsRes.data && modelsRes.data.length > 0 ? modelsRes.data : FALLBACK_VEHICLE_MODELS;

    return {
      vehicleTypes,
      vehicleMakes,
      vehicleModels,
    };
  } catch (err) {
    console.warn("Using fallback vehicle taxonomy due to fetch error:", err);
    return {
      vehicleTypes: FALLBACK_VEHICLE_TYPES,
      vehicleMakes: FALLBACK_VEHICLE_MAKES,
      vehicleModels: FALLBACK_VEHICLE_MODELS,
    };
  }
}
