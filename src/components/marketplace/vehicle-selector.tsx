"use client";

import React, { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  CheckCircle2,
  RotateCcw,
  Search,
  ChevronRight,
} from "lucide-react";
import {
  FALLBACK_VEHICLE_TYPES,
  FALLBACK_VEHICLE_MAKES,
  FALLBACK_VEHICLE_MODELS,
  FALLBACK_VEHICLE_VARIANTS,
  formatVariantLabel,
  type VehicleTaxonomyHierarchy,
} from "@/lib/products/taxonomy-constants";
import { Button } from "@/components/ui/button";

export interface VehicleSelectorProps {
  taxonomy?: VehicleTaxonomyHierarchy;
  initialTypeId?: string;
  initialMakeId?: string;
  initialModelId?: string;
  initialVariantId?: string;
  compact?: boolean;
  preserveParams?: Record<string, string | undefined>;
  onSelectionChange?: (selection: {
    typeId: string;
    makeId: string;
    modelId: string;
    variantId: string;
  }) => void;
  className?: string;
}

export function VehicleSelector({
  taxonomy,
  initialTypeId,
  initialMakeId,
  initialModelId,
  initialVariantId,
  compact = false,
  preserveParams,
  onSelectionChange,
  className = "",
}: VehicleSelectorProps) {
  const router = useRouter();

  const types = taxonomy?.vehicleTypes || FALLBACK_VEHICLE_TYPES;
  const makes = taxonomy?.vehicleMakes || FALLBACK_VEHICLE_MAKES;
  const models = taxonomy?.vehicleModels || FALLBACK_VEHICLE_MODELS;
  const variants = taxonomy?.vehicleVariants || FALLBACK_VEHICLE_VARIANTS;

  // Resolve initial selections safely (matching ID, slug, or name)
  const resolvedInitialType = useMemo(() => {
    if (!initialTypeId) return "car";
    const found = types.find(
      (t) =>
        t.id.toLowerCase() === initialTypeId.toLowerCase() ||
        t.name.toLowerCase() === initialTypeId.toLowerCase()
    );
    return found ? found.id : "car";
  }, [initialTypeId, types]);

  const resolvedInitialMake = useMemo(() => {
    if (!initialMakeId) return "";
    const found = makes.find(
      (m) =>
        m.id.toLowerCase() === initialMakeId.toLowerCase() ||
        m.slug.toLowerCase() === initialMakeId.toLowerCase() ||
        m.name.toLowerCase() === initialMakeId.toLowerCase()
    );
    return found ? found.id : "";
  }, [initialMakeId, makes]);

  const resolvedInitialModel = useMemo(() => {
    if (!initialModelId || !resolvedInitialMake) return "";
    const found = models.find(
      (m) =>
        m.make_id === resolvedInitialMake &&
        (m.id.toLowerCase() === initialModelId.toLowerCase() ||
          m.slug.toLowerCase() === initialModelId.toLowerCase() ||
          m.name.toLowerCase() === initialModelId.toLowerCase())
    );
    return found ? found.id : "";
  }, [initialModelId, resolvedInitialMake, models]);

  const resolvedInitialVariant = useMemo(() => {
    if (!initialVariantId || !resolvedInitialModel) return "";
    const found = variants.find(
      (v) =>
        v.model_id === resolvedInitialModel &&
        (v.id.toLowerCase() === initialVariantId.toLowerCase() ||
          v.generation_chassis.toLowerCase() === initialVariantId.toLowerCase())
    );
    return found ? found.id : "";
  }, [initialVariantId, resolvedInitialModel, variants]);

  const [selectedType, setSelectedType] = useState<string>(resolvedInitialType);
  const [selectedMake, setSelectedMake] = useState<string>(resolvedInitialMake);
  const [selectedModel, setSelectedModel] = useState<string>(resolvedInitialModel);
  const [selectedVariant, setSelectedVariant] = useState<string>(resolvedInitialVariant);
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigating, startSearchTransition] = useTransition();


  // Available makes for current type
  const availableMakes = useMemo(() => {
    return selectedType
      ? makes.filter((m) => m.vehicle_type_id === selectedType)
      : makes;
  }, [selectedType, makes]);

  // Available models for selected make
  const availableModels = useMemo(() => {
    return selectedMake
      ? models.filter((m) => m.make_id === selectedMake)
      : [];
  }, [selectedMake, models]);

  // Available variants for selected model
  const availableVariants = useMemo(() => {
    return selectedModel
      ? variants.filter((v) => v.model_id === selectedModel)
      : [];
  }, [selectedModel, variants]);

  // Cascading resets
  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    setSelectedMake("");
    setSelectedModel("");
    setSelectedVariant("");
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMake = e.target.value;
    setSelectedMake(nextMake);
    setSelectedModel("");
    setSelectedVariant("");
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextModel = e.target.value;
    setSelectedModel(nextModel);
    setSelectedVariant("");
  };

  const handleReset = () => {
    setSelectedMake("");
    setSelectedModel("");
    setSelectedVariant("");
  };

  const handleFindParts = () => {
    setIsSearching(true);
    const params = new URLSearchParams();

    // Preserve existing non-vehicle query params (e.g. q, category, sort)
    if (preserveParams) {
      Object.entries(preserveParams).forEach(([k, v]) => {
        if (
          v &&
          !["type", "make", "model", "variant", "page"].includes(k)
        ) {
          params.set(k, v);
        }
      });
    }

    if (selectedType) params.set("type", selectedType);
    if (selectedMake) params.set("make", selectedMake);
    if (selectedModel) params.set("model", selectedModel);
    if (selectedVariant) params.set("variant", selectedVariant);

    startSearchTransition(() => {
      router.push(`/search?${params.toString()}`);
    });

    if (onSelectionChange) {
      onSelectionChange({
        typeId: selectedType,
        makeId: selectedMake,
        modelId: selectedModel,
        variantId: selectedVariant,
      });
    }
  };

  const isVehicleFullySelected = Boolean(selectedMake && selectedModel);

  const selectedMakeObj = makes.find((m) => m.id === selectedMake);
  const selectedModelObj = models.find((m) => m.id === selectedModel);
  const selectedVariantObj = variants.find((v) => v.id === selectedVariant);

  return (
    <div
      className={`w-full rounded-2xl bg-white border border-sparehub-border shadow-md overflow-hidden ${className}`}
    >
      {/* Selector Header */}
      <div className="bg-sparehub-dark text-white px-4 sm:px-5 py-3.5 sm:py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sparehub-orange text-white shrink-0">
            <Car className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base leading-tight">
              Select Your Vehicle
            </h3>
            <p className="text-[11px] sm:text-xs text-gray-300">
              Filter parts guaranteed to fit your exact vehicle model &amp; year
            </p>
          </div>
        </div>
        {isVehicleFullySelected && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Selection
          </button>
        )}
      </div>

      {/* Vehicle Type Tabs (Responsive wrap eliminating mobile horizontal overflow) */}
      <div className="px-3.5 sm:px-5 pt-3 sm:pt-4 pb-2.5 border-b border-sparehub-border/60 bg-sparehub-light/40">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {types.map((v) => {
            const isSelected = selectedType === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleTypeChange(v.id)}
                className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-sparehub-orange text-white shadow-xs"
                    : "bg-white text-sparehub-dark border border-sparehub-border hover:bg-gray-100"
                }`}
              >
                {v.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selector Dropdown Grid */}
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Make Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-make-select"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              1. Manufacturer / Make
            </label>
            <select
              id="vehicle-make-select"
              value={selectedMake}
              onChange={handleMakeChange}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none"
            >
              <option value="">Select Manufacturer...</option>
              {availableMakes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-model-select"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              2. Vehicle Model
            </label>
            <select
              id="vehicle-model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={!selectedMake || availableModels.length === 0}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="">
                {!selectedMake
                  ? "Select Make First..."
                  : availableModels.length === 0
                  ? "No Models Available"
                  : "Select Model..."}
              </option>
              {availableModels.map((mod) => (
                <option key={mod.id} value={mod.id}>
                  {mod.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year / Variant Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-variant-select"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              3. Generation / Year
            </label>
            <select
              id="vehicle-variant-select"
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              disabled={!selectedModel}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="">
                {!selectedModel
                  ? "Select Model First..."
                  : availableVariants.length === 0
                  ? "All Generations (Model-Wide)"
                  : "All Generations / Years"}
              </option>
              {availableVariants.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVariantLabel(v)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Empty state notice for unpopulated make */}
        {selectedMake && availableModels.length === 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            No vehicle models cataloged under this make yet. Please select another make or browse universal consumables.
          </p>
        )}

        {/* Action Row */}
        <div className="pt-3 border-t border-sparehub-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            {isVehicleFullySelected ? (
              <span className="text-sparehub-success font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Active vehicle: {selectedMakeObj?.name} {selectedModelObj?.name}{" "}
                {selectedVariantObj
                  ? `(${selectedVariantObj.generation_chassis})`
                  : "(All Generations)"}
              </span>
            ) : (
              <span>
                Select at least Make and Model to activate fitment guarantees
              </span>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSearching || isNavigating}
            loadingText="Filtering Parts..."
            disabled={!isVehicleFullySelected || isSearching || isNavigating}
            onClick={handleFindParts}
            className="w-full sm:w-auto font-bold shadow-sm gap-1.5"
          >
            <Search className="w-4 h-4" />
            {compact ? "Apply Fitment Filter" : "Find Matching Parts"}
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
