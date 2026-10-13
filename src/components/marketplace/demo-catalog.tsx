import React from "react";
import Link from "next/link";
import { Info } from "lucide-react";
import { DemoProduct } from "@/lib/types";
import { ProductCard } from "@/components/marketplace/product-card";

const SAMPLE_DEMO_PRODUCTS: DemoProduct[] = [
  {
    id: "demo-1",
    title: "Front Brake Pads Set (Ceramic Semi-Metallic)",
    partNumber: "04465-02220",
    oemNumber: "04465-YZZE1",
    brand: "Akebono Japan",
    condition: "brand_new",
    priceMinorUnits: 750000, // LKR 7,500.00
    stockQuantity: 12,
    shopName: "Colombo Auto Spares",
    shopLocation: "Panchikawatta, Colombo 10",
    vehicleCompatibilitySummary: "Toyota Corolla (NZE121 / Axio 140)",
    category: "Braking Systems",
    imageUrl: "/images/placeholders/brake-pads.png",
    isDemo: true,
  },
  {
    id: "demo-2",
    title: "Rear Brake Shoes Assembly (Original Spec)",
    partNumber: "BAJ-2415-08",
    brand: "Bajaj Genuine",
    condition: "brand_new",
    priceMinorUnits: 285000, // LKR 2,850.00
    stockQuantity: 25,
    shopName: "Three Wheeler Hub Kandy",
    shopLocation: "Katugastota, Kandy",
    vehicleCompatibilitySummary: "Bajaj RE 205 (2-Stroke & 4-Stroke)",
    category: "Braking Systems",
    imageUrl: "/images/placeholders/brake-shoe.png",
    isDemo: true,
  },
  {
    id: "demo-3",
    title: "Full Synthetic Engine Oil 0W-20 (4L Can)",
    partNumber: "08880-12605",
    brand: "Toyota Genuine Motor Oil",
    condition: "brand_new",
    priceMinorUnits: 1650000, // LKR 16,500.00
    stockQuantity: 8,
    shopName: "Lanka Lubricants & Filters",
    shopLocation: "Peliyagoda, Gampaha",
    vehicleCompatibilitySummary: "Toyota Prius, Aqua, Vitz Hybrid Engines",
    category: "Filters & Maintenance",
    imageUrl: "/images/placeholders/oil.png",
    isDemo: true,
  },
  {
    id: "demo-4",
    title: "High Performance Drive Chain & Sprocket Kit",
    partNumber: "DID-520VX3-114",
    brand: "D.I.D Japan",
    condition: "brand_new",
    priceMinorUnits: 1420000, // LKR 14,200.00
    stockQuantity: 5,
    shopName: "Apex Moto Spares",
    shopLocation: "Nugegoda, Colombo",
    vehicleCompatibilitySummary: "Yamaha FZ-S / Honda Hornet 250",
    category: "Clutch & Transmission",
    imageUrl: "/images/placeholders/chain.png",
    isDemo: true,
  },
  {
    id: "demo-5",
    title: "Heavy Duty Shock Absorber (Front Left)",
    partNumber: "KYB-334399",
    brand: "KYB Excel-G",
    condition: "brand_new",
    priceMinorUnits: 2200000, // LKR 22,000.00
    stockQuantity: 4,
    shopName: "Japanese Suspension Center",
    shopLocation: "Dehiwala, Colombo",
    vehicleCompatibilitySummary: "Suzuki WagonR (MH34S / MH55S)",
    category: "Suspension & Steering",
    imageUrl: "/images/placeholders/shock.png",
    isDemo: true,
  },
  {
    id: "demo-6",
    title: "Reconditioned Alternator Unit (12V 80A)",
    partNumber: "27060-21040",
    brand: "Denso Remanufactured",
    condition: "reconditioned",
    priceMinorUnits: 1850000, // LKR 18,500.00
    stockQuantity: 2,
    shopName: "Auto Electricians & Rebuilders",
    shopLocation: "Kurunegala Town",
    vehicleCompatibilitySummary: "Toyota Vitz / Belta / Yaris (1NZ/2NZ)",
    category: "Electrical & Lighting",
    imageUrl: "/images/placeholders/alternator.png",
    isDemo: true,
  },
  {
    id: "demo-7",
    title: "Cabin Air Micro-Filter & Anti-Bacterial",
    partNumber: "87139-30040",
    brand: "Denso",
    condition: "brand_new",
    priceMinorUnits: 240000, // LKR 2,400.00
    stockQuantity: 30,
    shopName: "Lanka Filters Direct",
    shopLocation: "Maharagama, Colombo",
    vehicleCompatibilitySummary: "Universal Fit for Multiple Japanese Models",
    category: "Filters & Maintenance",
    imageUrl: "/images/placeholders/filter.png",
    isDemo: true,
  },
  {
    id: "demo-8",
    title: "Three-Wheeler Clutch Plate & Pressure Plate Set",
    partNumber: "BAJ-CL-04",
    brand: "Endurance OEM",
    condition: "brand_new",
    priceMinorUnits: 490000, // LKR 4,900.00
    stockQuantity: 15,
    shopName: "Panchikawatta Three-Wheeler Center",
    shopLocation: "Colombo 10",
    vehicleCompatibilitySummary: "Bajaj RE 205 4-Stroke (2012+)",
    category: "Clutch & Transmission",
    imageUrl: "/images/placeholders/clutch.png",
    isDemo: true,
  },
];

export function DemoCatalog() {
  return (
    <div className="space-y-6">
      {/* Header with explicit demonstration notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-sparehub-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-sparehub-dark tracking-tight">
              Featured Spare Parts
            </h2>
            <span className="text-xs font-mono bg-amber-100 text-amber-800 px-2 py-0.5 rounded border border-amber-300 font-bold">
              DEMO DATA
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Demonstration preview of part listings and multi-vendor display cards.
          </p>
        </div>

        <Link
          href="/search"
          className="text-xs font-bold text-sparehub-orange hover:underline self-start sm:self-auto"
        >
          View All Listings in Catalog →
        </Link>
      </div>

      {/* Compliance / Transparency Banner */}
      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sparehub-light border border-sparehub-border text-xs text-gray-600">
        <Info className="w-4 h-4 text-sparehub-orange shrink-0 mt-0.5" />
        <p>
          <strong className="text-sparehub-dark">Data Transparency Notice:</strong> The listings below are sample demonstration entries designed to preview the product card interface, pricing format, fitment labels, and local loading buttons. Actual vendor listings will populate automatically upon database connection and vendor onboarding approval.
        </p>
      </div>

      {/* Grid of Product Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {SAMPLE_DEMO_PRODUCTS.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
