export const BRAND_COLORS = {
  orange: "#FF6B00",
  dark: "#171717",
  white: "#FFFFFF",
  lightGray: "#F5F5F5",
  borderGray: "#E5E7EB",
  successGreen: "#16A34A",
  errorRed: "#DC2626",
} as const;

export interface VehicleTypeOption {
  id: string;
  name: string;
  icon: string;
  description: string;
}

export const VEHICLE_TYPES: VehicleTypeOption[] = [
  { id: "car", name: "Cars & SUVs", icon: "Car", description: "Sedans, hatchbacks, SUVs, crossovers" },
  { id: "motorcycle", name: "Motorcycles", icon: "Bike", description: "Scooters, commuters, sport bikes" },
  { id: "three_wheeler", name: "Three-Wheelers", icon: "Navigation", description: "Bajaj, TVS, Piaggio tuk-tuks" },
  { id: "van", name: "Vans", icon: "Truck", description: "Passenger vans, cargo vans" },
  { id: "bus", name: "Buses", icon: "Bus", description: "Private coaches, public route buses" },
  { id: "truck", name: "Lorries & Trucks", icon: "Truck", description: "Light commercial to heavy haulage" },
  { id: "tractor", name: "Tractors", icon: "Tractor", description: "Agricultural & estate machinery" },
  { id: "heavy_machinery", name: "Heavy Machinery", icon: "HardHat", description: "Excavators, loaders, construction" },
];

export const SRI_LANKA_DISTRICTS = [
  "Colombo",
  "Gampaha",
  "Kalutara",
  "Kandy",
  "Matale",
  "Nuwara Eliya",
  "Galle",
  "Matara",
  "Hambantota",
  "Jaffna",
  "Kilinochchi",
  "Mannar",
  "Vavuniya",
  "Mullaitivu",
  "Batticaloa",
  "Ampara",
  "Trincomalee",
  "Kurunegala",
  "Puttalam",
  "Anuradhapura",
  "Polonnaruwa",
  "Badulla",
  "Monaragala",
  "Ratnapura",
  "Kegalle",
] as const;

export const FEATURED_CATEGORIES = [
  { id: "braking", name: "Braking Systems", icon: "Disc", count: "Pads, Rotors, Calipers" },
  { id: "engine", name: "Engine Parts", icon: "Cog", count: "Pistons, Valves, Gaskets" },
  { id: "suspension", name: "Suspension & Steering", icon: "Activity", count: "Shocks, Struts, Arms" },
  { id: "electrical", name: "Electrical & Lighting", icon: "Zap", count: "Alternators, Lights, Sensors" },
  { id: "filters", name: "Filters & Maintenance", icon: "Filter", count: "Oil, Air, Fuel, Cabin" },
  { id: "transmission", name: "Clutch & Transmission", icon: "Layers", count: "Clutch kits, Gearbox parts" },
  { id: "body", name: "Body & Mirrors", icon: "Shield", count: "Bumpers, Mirrors, Panels" },
  { id: "cooling", name: "Cooling & AC", icon: "Wind", count: "Radiators, AC Compressors" },
];

export const SAMPLE_VEHICLE_DATA: Record<string, Record<string, Record<string, string[]>>> = {
  car: {
    Toyota: {
      Corolla: ["2002-2007 (NZE121)", "2007-2013 (Axio/Fielder 140)", "2013-2019 (Axio 160)"],
      Prius: ["2009-2015 (3rd Gen XW30)", "2015-2022 (4th Gen XW50)"],
      Vitz: ["2005-2010 (2nd Gen)", "2010-2020 (3rd Gen KSP130)"],
    },
    Honda: {
      Vezel: ["2013-2020 (RU3 Hybrid)", "2021+ (RV3)"],
      Fit: ["2008-2013 (GE6/GP1)", "2013-2020 (GP5 Hybrid)"],
      Civic: ["2006-2011 (FD1)", "2016-2021 (FC1)"],
    },
    Suzuki: {
      WagonR: ["2012-2017 (MH34S)", "2017-2022 (MH55S FX/FZ)"],
      Alto: ["2000-2012 (Japanese HA24/HA25)", "2010-2020 (Indian 800/K10)"],
    },
  },
  three_wheeler: {
    Bajaj: {
      "RE 205": ["2-Stroke Classic", "4-Stroke (2010-2016)", "4-Stroke (2017-Present)"],
      Compact: ["4-Stroke 205cc (2018+)"],
      Maxima: ["Diesel Cargo", "Diesel Passenger"],
    },
    TVS: {
      King: ["King 200 (4-Stroke)", "King Deluxe (2016+)"],
    },
    Piaggio: {
      Ape: ["Ape City (Petrol)", "Ape Classic (Diesel)"],
    },
  },
  motorcycle: {
    Yamaha: {
      FZ: ["FZ-S V2.0", "FZ V3.0 FI"],
      RayZR: ["113cc Carb", "125cc FI Hybrid"],
    },
    Honda: {
      Dio: ["Dio 110 (2012-2018)", "Dio 110 HET (2018+)"],
      CD110: ["Dream DX"],
    },
    Bajaj: {
      Pulsar: ["Pulsar 150 Classic", "Pulsar 150 UG4", "Pulsar 200 NS"],
      Discover: ["Discover 125 ST", "Discover 100M"],
    },
  },
};
