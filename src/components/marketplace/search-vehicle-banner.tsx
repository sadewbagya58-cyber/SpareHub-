"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Car,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { VehicleSelector } from "@/components/marketplace/vehicle-selector";
import type {
  VehicleTaxonomyHierarchy,
  ValidatedVehicleParams,
} from "@/lib/products/taxonomy-constants";

interface SearchVehicleBannerProps {
  taxonomy: VehicleTaxonomyHierarchy;
  validatedVehicle: ValidatedVehicleParams;
  preserveParams: Record<string, string | undefined>;
  clearVehicleUrl: string;
}

export function SearchVehicleBanner({
  taxonomy,
  validatedVehicle,
  preserveParams,
  clearVehicleUrl,
}: SearchVehicleBannerProps) {
  const hasVehicle = validatedVehicle.hasFilter;
  // If no vehicle is selected, expand selector by default. If selected, collapse into banner.
  const [isExpanded, setIsExpanded] = useState(!hasVehicle);

  return (
    <div className="w-full space-y-3">
      {hasVehicle ? (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-white to-emerald-50/50 p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shrink-0 shadow-xs mt-0.5 sm:mt-0">
                <Car className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Verified Fitment Active
                  </span>
                  {validatedVehicle.fitmentScope === "variant" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                      Exact Variant &amp; Chassis Fit
                    </span>
                  )}
                  {validatedVehicle.fitmentScope === "model" && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-gray-700 px-2 py-0.5 rounded border border-gray-200">
                      Model-Wide Fit (All Generations)
                    </span>
                  )}
                </div>

                <h3 className="text-base sm:text-lg font-black text-sparehub-dark tracking-tight">
                  {validatedVehicle.displayLabel}
                </h3>

                <p className="text-xs text-gray-600 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  Showing listings guaranteed to fit this vehicle, plus universal parts.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-200 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-sparehub-orange" />
                {isExpanded ? "Hide Vehicle Filter" : "Change Vehicle"}
                {isExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                )}
              </button>

              <Link
                href={clearVehicleUrl}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove vehicle compatibility filter"
              >
                <X className="w-3.5 h-3.5" />
                Clear Vehicle
              </Link>
            </div>
          </div>

          {/* Collapsible Vehicle Selector Panel */}
          {isExpanded && (
            <div className="mt-4 pt-4 border-t border-emerald-200/60 animate-in fade-in duration-200">
              <VehicleSelector
                key={`banner-${validatedVehicle.sanitizedParams.type || 'all'}-${validatedVehicle.sanitizedParams.make || 'none'}-${validatedVehicle.sanitizedParams.model || 'none'}-${validatedVehicle.sanitizedParams.variant || 'none'}`}
                taxonomy={taxonomy}
                initialTypeId={validatedVehicle.sanitizedParams.type}
                initialMakeId={validatedVehicle.sanitizedParams.make}
                initialModelId={validatedVehicle.sanitizedParams.model}
                initialVariantId={validatedVehicle.sanitizedParams.variant}
                preserveParams={preserveParams}
                compact
              />
            </div>
          )}
        </div>
      ) : (
        /* When No Vehicle is selected yet */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="inline-flex items-center gap-2 text-xs font-bold text-sparehub-dark hover:text-sparehub-orange transition-colors cursor-pointer"
            >
              <div className="p-1 rounded bg-sparehub-orange/10 text-sparehub-orange">
                <Car className="w-4 h-4" />
              </div>
              <span>Filter by Vehicle (Guaranteed Fitment)</span>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
          </div>

          {isExpanded && (
            <div className="animate-in fade-in duration-200">
              <VehicleSelector
                key={`empty-${validatedVehicle.sanitizedParams.type || 'all'}-${validatedVehicle.sanitizedParams.make || 'none'}`}
                taxonomy={taxonomy}
                initialTypeId={validatedVehicle.sanitizedParams.type}
                initialMakeId={validatedVehicle.sanitizedParams.make}
                initialModelId={validatedVehicle.sanitizedParams.model}
                initialVariantId={validatedVehicle.sanitizedParams.variant}
                preserveParams={preserveParams}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
