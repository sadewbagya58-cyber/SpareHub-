import React from "react";
import Link from "next/link";
import { 
  Car, 
  Bike, 
  Truck, 
  Disc, 
  Cog, 
  Filter, 
  Zap, 
  Layers, 
  Shield, 
  Wind,
  Navigation,
  HardHat,
  Tractor,
  Bus
} from "lucide-react";
import { FEATURED_CATEGORIES, VEHICLE_TYPES } from "@/lib/constants";

// Icon mapping dictionary
const VEHICLE_ICONS: Record<string, React.ElementType> = {
  car: Car,
  motorcycle: Bike,
  three_wheeler: Navigation,
  van: Truck,
  bus: Bus,
  truck: Truck,
  tractor: Tractor,
  heavy_machinery: HardHat,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  braking: Disc,
  engine: Cog,
  suspension: Layers,
  electrical: Zap,
  filters: Filter,
  transmission: Layers,
  body: Shield,
  cooling: Wind,
};

export function CategoryShortcuts() {
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* 1. Vehicle Categories Showcase */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-sparehub-dark tracking-tight">
              Browse by Vehicle Category
            </h2>
            <p className="text-xs text-gray-500">
              Spare parts tailored for every vehicle on Sri Lankan roads
            </p>
          </div>
          <Link
            href="/search"
            className="text-xs font-bold text-sparehub-orange hover:underline shrink-0"
          >
            All Categories →
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {VEHICLE_TYPES.map((type) => {
            const Icon = VEHICLE_ICONS[type.id] || Car;
            return (
              <Link
                key={type.id}
                href={`/search?type=${type.id}`}
                className="group flex flex-col items-center text-center p-3 sm:p-3.5 rounded-xl border border-sparehub-border bg-white hover:border-sparehub-orange hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sparehub-light group-hover:bg-sparehub-orange-light flex items-center justify-center text-sparehub-dark group-hover:text-sparehub-orange transition-colors mb-1.5 sm:mb-2">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="text-xs font-bold text-sparehub-dark group-hover:text-sparehub-orange transition-colors">
                  {type.name}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                  {type.description.split(",")[0]}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* 2. Parts Systems Showcase */}
      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-sparehub-dark tracking-tight">
              Browse by Part System
            </h2>
            <p className="text-xs text-gray-500">
              Direct access to vital mechanical, electrical, and maintenance components
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          {FEATURED_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat.id] || Cog;
            return (
              <Link
                key={cat.id}
                href={`/search?category=${cat.id}`}
                className="group flex flex-col items-center text-center p-3 sm:p-3.5 rounded-xl border border-sparehub-border bg-white hover:border-sparehub-orange hover:shadow-sm transition-all"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-sparehub-light group-hover:bg-sparehub-orange-light flex items-center justify-center text-sparehub-dark group-hover:text-sparehub-orange transition-colors mb-1.5 sm:mb-2">
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <span className="text-xs font-bold text-sparehub-dark group-hover:text-sparehub-orange transition-colors">
                  {cat.name}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                  {cat.count}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
