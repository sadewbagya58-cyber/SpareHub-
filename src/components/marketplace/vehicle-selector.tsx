"use client";

import React, {
  useState,
  useMemo,
  useTransition,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  Car,
  CheckCircle2,
  RotateCcw,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  X,
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

export interface SavedVehicleSelection {
  typeId: string;
  makeId: string;
  modelId: string;
  variantId: string;
}

const STORAGE_KEY = "sparehub:selected-vehicle";
let cachedRawSaved: string | null = null;
let cachedParsedSaved: SavedVehicleSelection | null = null;
const storageListeners = new Set<() => void>();

function subscribeSavedVehicle(cb: () => void) {
  storageListeners.add(cb);
  return () => {
    storageListeners.delete(cb);
  };
}

function notifySavedVehicleChange() {
  storageListeners.forEach((cb) => cb());
}

function getSavedVehicleSnapshot(): SavedVehicleSelection | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRawSaved) {
      cachedRawSaved = raw;
      cachedParsedSaved = raw ? (JSON.parse(raw) as SavedVehicleSelection) : null;
    }
    return cachedParsedSaved;
  } catch {
    return null;
  }
}

function getSavedVehicleServerSnapshot(): SavedVehicleSelection | null {
  return null;
}

function writeSavedVehicleStorage(selection: SavedVehicleSelection | null) {
  if (typeof window === "undefined") return;
  try {
    if (selection && selection.makeId && selection.modelId) {
      const serialized = JSON.stringify(selection);
      window.sessionStorage.setItem(STORAGE_KEY, serialized);
      cachedRawSaved = serialized;
      cachedParsedSaved = selection;
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
      cachedRawSaved = null;
      cachedParsedSaved = null;
    }
    notifySavedVehicleChange();
  } catch {
    // Ignore storage quota / privacy mode errors
  }
}

export interface VehicleSelectorProps {
  taxonomy?: VehicleTaxonomyHierarchy;
  initialTypeId?: string;
  initialMakeId?: string;
  initialModelId?: string;
  initialVariantId?: string;
  compact?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
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
  collapsible = false,
  defaultExpanded = false,
  preserveParams,
  onSelectionChange,
  className = "",
}: VehicleSelectorProps) {
  const router = useRouter();
  const savedVehicle = useSyncExternalStore(
    subscribeSavedVehicle,
    getSavedVehicleSnapshot,
    getSavedVehicleServerSnapshot
  );

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

  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const [localType, setLocalType] = useState<string>(resolvedInitialType);
  const [localMake, setLocalMake] = useState<string>(resolvedInitialMake);
  const [localModel, setLocalModel] = useState<string>(resolvedInitialModel);
  const [localVariant, setLocalVariant] = useState<string>(resolvedInitialVariant);

  const [isExpanded, setIsExpanded] = useState<boolean>(
    collapsible ? defaultExpanded : true
  );
  const [isSearching, setIsSearching] = useState(false);
  const [isNavigating, startSearchTransition] = useTransition();

  // If no explicit URL initial Make/Model was provided and user hasn't edited locally yet,
  // hydrate active selection from saved session vehicle if available.
  const useSavedFallback =
    !hasLocalEdits &&
    !resolvedInitialMake &&
    !resolvedInitialModel &&
    Boolean(savedVehicle?.makeId && savedVehicle?.modelId);

  const selectedType = useSavedFallback
    ? savedVehicle!.typeId || "car"
    : localType;
  const selectedMake = useSavedFallback ? savedVehicle!.makeId : localMake;
  const selectedModel = useSavedFallback ? savedVehicle!.modelId : localModel;
  const selectedVariant = useSavedFallback
    ? savedVehicle!.variantId
    : localVariant;

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
    setHasLocalEdits(true);
    setLocalType(newType);
    setLocalMake("");
    setLocalModel("");
    setLocalVariant("");
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextMake = e.target.value;
    setHasLocalEdits(true);
    setLocalType(selectedType);
    setLocalMake(nextMake);
    setLocalModel("");
    setLocalVariant("");
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextModel = e.target.value;
    setHasLocalEdits(true);
    setLocalType(selectedType);
    setLocalMake(selectedMake);
    setLocalModel(nextModel);
    setLocalVariant("");
    if (selectedMake && nextModel) {
      writeSavedVehicleStorage({
        typeId: selectedType,
        makeId: selectedMake,
        modelId: nextModel,
        variantId: "",
      });
    }
  };

  const handleVariantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextVariant = e.target.value;
    setHasLocalEdits(true);
    setLocalType(selectedType);
    setLocalMake(selectedMake);
    setLocalModel(selectedModel);
    setLocalVariant(nextVariant);
    if (selectedMake && selectedModel) {
      writeSavedVehicleStorage({
        typeId: selectedType,
        makeId: selectedMake,
        modelId: selectedModel,
        variantId: nextVariant,
      });
    }
  };

  const handleReset = () => {
    setHasLocalEdits(true);
    setLocalMake("");
    setLocalModel("");
    setLocalVariant("");
    writeSavedVehicleStorage(null);
  };

  const handleFindParts = () => {
    setIsSearching(true);
    if (selectedMake && selectedModel) {
      writeSavedVehicleStorage({
        typeId: selectedType,
        makeId: selectedMake,
        modelId: selectedModel,
        variantId: selectedVariant,
      });
    }

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

  // Collapsed state when used as an expandable card on the homepage
  if (collapsible && !isExpanded) {
    if (isVehicleFullySelected) {
      return (
        <div
          className={`w-full rounded-xl bg-white border border-emerald-500/40 shadow-xs p-3.5 sm:p-4 transition-all ${className}`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start sm:items-center gap-3 min-w-0">
              <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                <Car className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Selected Vehicle
                  </span>
                </div>
                <h3 className="font-bold text-sm sm:text-base text-sparehub-dark truncate mt-0.5">
                  {selectedMakeObj?.name} {selectedModelObj?.name}{" "}
                  <span className="font-normal text-xs text-gray-500">
                    {selectedVariantObj
                      ? `(${selectedVariantObj.generation_chassis})`
                      : "(All Generations)"}
                  </span>
                </h3>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="primary"
                size="sm"
                isLoading={isSearching || isNavigating}
                loadingText="Filtering..."
                disabled={isSearching || isNavigating}
                onClick={handleFindParts}
                className="h-8 sm:h-9 px-3 text-xs font-bold gap-1"
              >
                <Search className="w-3.5 h-3.5" />
                Find Matching Parts
              </Button>
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                aria-expanded={false}
                aria-controls="vehicle-selector-panel"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-sparehub-border bg-white text-xs font-bold text-sparehub-dark hover:bg-gray-50 transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-sparehub-orange" />
                Change Vehicle
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                title="Clear selected vehicle"
              >
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`w-full rounded-xl bg-white border border-sparehub-border shadow-xs p-3.5 sm:p-4 transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 rounded-lg bg-sparehub-orange-light text-sparehub-orange border border-sparehub-orange/20 shrink-0">
              <Car className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm sm:text-base text-sparehub-dark leading-snug">
                Find Parts for Your Vehicle
              </h2>
              <p className="text-xs text-gray-500 line-clamp-1">
                Choose your vehicle to find compatible spare parts
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            aria-expanded={false}
            aria-controls="vehicle-selector-panel"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sparehub-dark text-white hover:bg-gray-800 text-xs sm:text-sm font-bold shrink-0 transition-all active:scale-[0.97] cursor-pointer shadow-2xs"
          >
            <span>Select Vehicle</span>
            <ChevronDown className="w-4 h-4 text-sparehub-orange" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      id="vehicle-selector-panel"
      className={`w-full rounded-xl bg-white border border-sparehub-border shadow-sm overflow-hidden ${className}`}
    >
      {/* Compact Selector Header */}
      <div className="bg-sparehub-light/70 border-b border-sparehub-border px-3.5 sm:px-5 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sparehub-orange text-white shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs sm:text-sm text-sparehub-dark leading-tight">
              Find Parts for Your Vehicle
            </h3>
            <p className="text-[11px] text-gray-500">
              Choose your vehicle to find compatible spare parts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isVehicleFullySelected && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-semibold text-gray-600 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Selection
            </button>
          )}
          {collapsible && (
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              aria-expanded={true}
              aria-controls="vehicle-selector-panel"
              className="inline-flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-sparehub-dark px-2.5 py-1 rounded-md border border-sparehub-border bg-white hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <span>Collapse</span>
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Vehicle Type Tabs (Responsive wrap eliminating mobile horizontal overflow) */}
      <div className="px-3.5 sm:px-5 py-2.5 border-b border-sparehub-border/60 bg-sparehub-light/30">
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {types.map((v) => {
            const isSelected = selectedType === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleTypeChange(v.id)}
                className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-1 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? "bg-sparehub-orange text-white shadow-2xs"
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
      <div className="p-3.5 sm:p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5">
          {/* Make Dropdown */}
          <div className="space-y-1">
            <label
              htmlFor="vehicle-make-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-sparehub-dark"
            >
              1. Manufacturer / Make
            </label>
            <select
              id="vehicle-make-select"
              value={selectedMake}
              onChange={handleMakeChange}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3 py-2 text-xs sm:text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none"
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
          <div className="space-y-1">
            <label
              htmlFor="vehicle-model-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-sparehub-dark"
            >
              2. Vehicle Model
            </label>
            <select
              id="vehicle-model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={!selectedMake || availableModels.length === 0}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3 py-2 text-xs sm:text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
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
          <div className="space-y-1">
            <label
              htmlFor="vehicle-variant-select"
              className="block text-[11px] font-bold uppercase tracking-wider text-sparehub-dark"
            >
              3. Generation / Year
            </label>
            <select
              id="vehicle-variant-select"
              value={selectedVariant}
              onChange={handleVariantChange}
              disabled={!selectedModel}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3 py-2 text-xs sm:text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
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
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
            No vehicle models cataloged under this make yet. Please select another make or browse universal consumables.
          </p>
        )}

        {/* Action Row */}
        <div className="pt-2.5 border-t border-sparehub-border/60 flex flex-col sm:flex-row items-center justify-between gap-2.5">
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
            size="sm"
            isLoading={isSearching || isNavigating}
            loadingText="Filtering Parts..."
            disabled={!isVehicleFullySelected || isSearching || isNavigating}
            onClick={handleFindParts}
            className="w-full sm:w-auto font-bold shadow-xs gap-1.5 h-9 sm:h-10 px-4"
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
