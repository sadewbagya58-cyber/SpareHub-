export type VehicleType =
  | "car"
  | "motorcycle"
  | "three_wheeler"
  | "van"
  | "bus"
  | "truck"
  | "tractor"
  | "heavy_machinery";

export type PartCondition = "brand_new" | "reconditioned" | "used";

export interface DemoProduct {
  id: string;
  title: string;
  partNumber: string;
  oemNumber?: string;
  brand: string;
  condition: PartCondition;
  priceMinorUnits: number; // in cents (LKR 1 = 100 minor units)
  compareAtPriceMinorUnits?: number;
  stockQuantity: number;
  shopName: string;
  shopLocation: string;
  vehicleCompatibilitySummary: string;
  category: string;
  imageUrl: string;
  isDemo: true;
}

export interface VehicleSelection {
  vehicleType: string;
  make: string;
  model: string;
  yearOrVariant: string;
}

export type SellerType = "retail_shop" | "individual" | "wholesaler" | "importer";
