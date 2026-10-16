"use client";

import React, { useState } from "react";
import {
  Plus,
  Trash2,
  CheckCircle,
  Car,
  AlertCircle,
  Edit3,
  X,
  Wrench,
} from "lucide-react";
import type {
  VehicleTypeOption,
  VehicleMakeOption,
  VehicleModelOption,
  VehicleVariantOption,
} from "@/lib/products/taxonomy";
import {
  formatVariantLabel,
  formatVariantYearRange,
  type ProductCompatibilityItem,
} from "@/lib/validators/product";

interface CompatibilityBuilderProps {
  compatibilities: ProductCompatibilityItem[];
  onChange: (items: ProductCompatibilityItem[]) => void;
  isUniversal: boolean;
  onUniversalToggle: (val: boolean) => void;
  vehicleTypes: VehicleTypeOption[];
  vehicleMakes: VehicleMakeOption[];
  vehicleModels: VehicleModelOption[];
  vehicleVariants?: VehicleVariantOption[];
}

export function CompatibilityBuilder({
  compatibilities,
  onChange,
  isUniversal,
  onUniversalToggle,
  vehicleTypes,
  vehicleMakes,
  vehicleModels,
  vehicleVariants = [],
}: CompatibilityBuilderProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedMakeId, setSelectedMakeId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [fitNotes, setFitNotes] = useState<string>("");
  const [isExactFit, setIsExactFit] = useState<boolean>(true);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter makes by selected vehicle type
  const filteredMakes = selectedTypeId
    ? vehicleMakes.filter((m) => m.vehicle_type_id === selectedTypeId)
    : vehicleMakes;

  // Filter models by selected make
  const filteredModels = selectedMakeId
    ? vehicleModels.filter((m) => m.make_id === selectedMakeId)
    : [];

  // Filter variants by selected model
  const filteredVariants = selectedModelId
    ? vehicleVariants.filter((v) => v.model_id === selectedModelId)
    : [];

  const resetBuilderInputs = () => {
    setSelectedModelId("");
    setSelectedVariantId("");
    setFitNotes("");
    setIsExactFit(true);
    setEditingIndex(null);
    setValidationError(null);
  };

  const handleSaveFitment = () => {
    setValidationError(null);

    if (!selectedMakeId) {
      setValidationError("Please select a vehicle make / brand.");
      return;
    }

    if (!selectedModelId) {
      setValidationError(
        "Please select a specific vehicle model to add compatibility."
      );
      return;
    }

    const makeObj = vehicleMakes.find((m) => m.id === selectedMakeId);
    const modelObj = vehicleModels.find((m) => m.id === selectedModelId);

    if (!makeObj || !modelObj || modelObj.make_id !== makeObj.id) {
      setValidationError(
        "Selected vehicle model does not belong to the selected vehicle make."
      );
      return;
    }

    const resolvedTypeId = selectedTypeId || makeObj.vehicle_type_id;
    const typeObj = vehicleTypes.find((t) => t.id === resolvedTypeId);

    if (selectedTypeId && makeObj.vehicle_type_id !== selectedTypeId) {
      setValidationError(
        "Selected vehicle make does not belong to the selected vehicle type."
      );
      return;
    }

    let variantObj: VehicleVariantOption | undefined;
    if (selectedVariantId) {
      variantObj = vehicleVariants.find((v) => v.id === selectedVariantId);
      if (!variantObj || variantObj.model_id !== modelObj.id) {
        setValidationError(
          "Selected vehicle variant does not belong to the selected vehicle model."
        );
        return;
      }
    }

    const targetVariantId = variantObj ? variantObj.id : null;

    // Check for duplicate entry (excluding the item currently being edited)
    const isDuplicate = compatibilities.some((c, idx) => {
      if (editingIndex !== null && idx === editingIndex) return false;
      const existingVariantId = c.vehicle_variant_id || null;
      return (
        c.vehicle_model_id === selectedModelId &&
        existingVariantId === targetVariantId
      );
    });

    if (isDuplicate) {
      const duplicateLabel = variantObj
        ? `${makeObj.name} ${modelObj.name} (${variantObj.generation_chassis})`
        : `${makeObj.name} ${modelObj.name} (All Variants)`;
      setValidationError(
        `${duplicateLabel} is already in the compatibility list.`
      );
      return;
    }

    const newItem: ProductCompatibilityItem = {
      id:
        editingIndex !== null ? compatibilities[editingIndex]?.id : undefined,
      vehicle_type_id: resolvedTypeId,
      vehicle_type_name: typeObj?.name || resolvedTypeId,
      make_id: makeObj.id,
      make_name: makeObj.name,
      vehicle_model_id: modelObj.id,
      model_name: modelObj.name,
      vehicle_variant_id: targetVariantId,
      variant_label: variantObj ? formatVariantLabel(variantObj) : null,
      generation_chassis: variantObj?.generation_chassis || null,
      year_start: variantObj?.year_start ?? null,
      year_end: variantObj?.year_end ?? null,
      engine_code: variantObj?.engine_code ?? null,
      transmission: variantObj?.transmission ?? null,
      fuel_type: variantObj?.fuel_type ?? null,
      notes: fitNotes.trim() || undefined,
      is_exact_fit: isExactFit,
    };

    if (editingIndex !== null) {
      const updated = [...compatibilities];
      updated[editingIndex] = newItem;
      onChange(updated);
    } else {
      onChange([...compatibilities, newItem]);
    }

    resetBuilderInputs();
  };

  const handleEditFitment = (index: number) => {
    const item = compatibilities[index];
    if (!item) return;

    setValidationError(null);
    const modelObj = vehicleModels.find((m) => m.id === item.vehicle_model_id);
    const makeId = item.make_id || modelObj?.make_id || "";
    const makeObj = vehicleMakes.find((m) => m.id === makeId);
    const typeId = item.vehicle_type_id || makeObj?.vehicle_type_id || "";

    setSelectedTypeId(typeId);
    setSelectedMakeId(makeId);
    setSelectedModelId(item.vehicle_model_id || "");
    setSelectedVariantId(item.vehicle_variant_id || "");
    setFitNotes(item.notes || "");
    setIsExactFit(item.is_exact_fit ?? true);
    setEditingIndex(index);
  };

  const handleRemoveFitment = (index: number) => {
    const updated = compatibilities.filter((_, i) => i !== index);
    onChange(updated);
    if (editingIndex === index) {
      resetBuilderInputs();
    } else if (editingIndex !== null && index < editingIndex) {
      setEditingIndex(editingIndex - 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Universal Fit Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-gray-50 border border-sparehub-border rounded-xl">
        <div>
          <label className="text-xs font-bold text-sparehub-dark flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isUniversal}
              onChange={(e) => onUniversalToggle(e.target.checked)}
              className="w-4 h-4 text-sparehub-orange rounded border-gray-300 focus:ring-sparehub-orange"
            />
            Universal Fitment / Consumable Part
          </label>
          <p className="text-[11px] text-gray-500 mt-0.5 sm:ml-6">
            Enable this if the product fits all vehicles or is a universal consumable (e.g. engine oil, brake fluid, bulbs, fuses).
          </p>
        </div>

        {isUniversal && (
          <span className="self-start sm:self-center text-[10px] font-bold bg-green-100 text-sparehub-success px-2.5 py-1 rounded-full border border-green-200 whitespace-nowrap">
            Universal Fit Active
          </span>
        )}
      </div>

      {!isUniversal && (
        <div className="space-y-4 pt-1">
          {/* 4-Level Fitment Selector Widget */}
          <div
            className={`p-4 rounded-xl border space-y-3.5 transition-colors ${
              editingIndex !== null
                ? "border-sparehub-orange bg-orange-50/20"
                : "border-sparehub-border bg-white"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-sparehub-orange shrink-0" />
                <h4 className="text-xs font-bold text-sparehub-dark uppercase tracking-wider">
                  {editingIndex !== null
                    ? `Editing Fitment Entry #${editingIndex + 1}`
                    : "Add Compatible Vehicle (Type → Make → Model → Variant)"}
                </h4>
              </div>

              {editingIndex !== null && (
                <button
                  type="button"
                  onClick={resetBuilderInputs}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-gray-800"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Step 1: Vehicle Type */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  1. Vehicle Type
                </label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => {
                    setSelectedTypeId(e.target.value);
                    setSelectedMakeId("");
                    setSelectedModelId("");
                    setSelectedVariantId("");
                    setValidationError(null);
                  }}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none"
                >
                  <option value="">-- All Vehicle Types --</option>
                  {vehicleTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Make */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  2. Make / Brand <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedMakeId}
                  onChange={(e) => {
                    const nextMakeId = e.target.value;
                    setSelectedMakeId(nextMakeId);
                    setSelectedModelId("");
                    setSelectedVariantId("");
                    setValidationError(null);
                    if (nextMakeId && !selectedTypeId) {
                      const mk = vehicleMakes.find((m) => m.id === nextMakeId);
                      if (mk) setSelectedTypeId(mk.vehicle_type_id);
                    }
                  }}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none"
                >
                  <option value="">-- Select Make --</option>
                  {filteredMakes.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Model */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  3. Specific Model <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => {
                    setSelectedModelId(e.target.value);
                    setSelectedVariantId("");
                    setValidationError(null);
                  }}
                  disabled={!selectedMakeId || filteredModels.length === 0}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {!selectedMakeId
                      ? "-- Choose Make First --"
                      : filteredModels.length === 0
                      ? "-- No Models Available --"
                      : "-- Select Model --"}
                  </option>
                  {filteredModels.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 4: Variant / Generation / Chassis */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  4. Variant / Generation / Year
                </label>
                <select
                  value={selectedVariantId}
                  onChange={(e) => {
                    setSelectedVariantId(e.target.value);
                    setValidationError(null);
                  }}
                  disabled={!selectedModelId}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {!selectedModelId
                      ? "-- Choose Model First --"
                      : filteredVariants.length === 0
                      ? "All Generations / Model-Wide"
                      : "All Variants / Generations of Model"}
                  </option>
                  {filteredVariants.map((v) => (
                    <option key={v.id} value={v.id}>
                      {formatVariantLabel(v)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Empty-state helper notices for Make/Model/Variant */}
            {selectedMakeId && filteredModels.length === 0 && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                No vehicle models are currently registered under this make. Please choose another make or enable Universal Fitment.
              </p>
            )}
            {selectedModelId && filteredVariants.length === 0 && (
              <p className="text-[11px] text-gray-500">
                No specific chassis variants cataloged for this model — compatibility will apply across all generations of the selected model.
              </p>
            )}

            {/* Fitment Notes, Exact-Fit Toggle & Action Button */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end pt-1">
              <div className="md:col-span-6">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Fitment Notes / Position / Trim (Optional)
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Front axle only, ABS models, 1NZ-FE petrol engine"
                  value={fitNotes}
                  onChange={(e) => setFitNotes(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none"
                />
              </div>

              <div className="md:col-span-3">
                <label className="flex items-center gap-2 py-2 px-2.5 rounded-lg border border-sparehub-border bg-gray-50/70 cursor-pointer text-xs font-semibold text-sparehub-dark">
                  <input
                    type="checkbox"
                    checked={isExactFit}
                    onChange={(e) => setIsExactFit(e.target.checked)}
                    className="w-3.5 h-3.5 text-sparehub-orange rounded border-gray-300 focus:ring-sparehub-orange"
                  />
                  <span>Exact Direct Fit</span>
                </label>
              </div>

              <div className="md:col-span-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveFitment}
                  disabled={!selectedModelId}
                  className="w-full py-2 px-3 bg-sparehub-dark hover:bg-sparehub-orange text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  {editingIndex !== null
                    ? "Update Fitment"
                    : "Add to Fitment List"}
                </button>
              </div>
            </div>

            {validationError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Current Compatibility List */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-gray-700">
                Compatible Vehicles ({compatibilities.length})
              </span>
              {compatibilities.length === 0 && (
                <span className="text-[11px] text-amber-700 font-medium">
                  At least 1 compatible vehicle is recommended for buyer vehicle search matching.
                </span>
              )}
            </div>

            {compatibilities.length === 0 ? (
              <div className="p-5 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500 bg-gray-50/50">
                No vehicle fitments added yet. Select a Vehicle Type, Make, Model, and optional Variant above to link this spare part to compatible Sri Lankan vehicles.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {compatibilities.map((c, idx) => {
                  const modelObj = vehicleModels.find(
                    (m) => m.id === c.vehicle_model_id
                  );
                  const makeObj = vehicleMakes.find(
                    (mk) => mk.id === (c.make_id || modelObj?.make_id)
                  );
                  const typeObj = vehicleTypes.find(
                    (t) =>
                      t.id === (c.vehicle_type_id || makeObj?.vehicle_type_id)
                  );
                  const variantObj = c.vehicle_variant_id
                    ? vehicleVariants.find(
                        (v) => v.id === c.vehicle_variant_id
                      )
                    : undefined;

                  const displayMake = c.make_name || makeObj?.name || "";
                  const displayModel =
                    c.model_name || modelObj?.name || "Specified Model";
                  const displayType = c.vehicle_type_name || typeObj?.name;
                  const displayChassis =
                    c.generation_chassis || variantObj?.generation_chassis;
                  const displayYears = formatVariantYearRange(
                    c.year_start ?? variantObj?.year_start,
                    c.year_end ?? variantObj?.year_end
                  );
                  const displayEngine =
                    c.engine_code || variantObj?.engine_code;
                  const displayFuel = c.fuel_type || variantObj?.fuel_type;

                  return (
                    <div
                      key={`${c.vehicle_model_id}-${c.vehicle_variant_id || "all"}-${idx}`}
                      className={`flex items-start justify-between gap-3 p-3 bg-white border rounded-xl shadow-2xs transition-colors ${
                        editingIndex === idx
                          ? "border-sparehub-orange ring-1 ring-sparehub-orange bg-orange-50/10"
                          : "border-sparehub-border hover:border-sparehub-orange/60"
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <CheckCircle className="w-4 h-4 text-sparehub-success shrink-0 mt-0.5" />
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {displayType && (
                              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                                {displayType}
                              </span>
                            )}
                            <span className="text-xs font-bold text-sparehub-dark">
                              {displayMake ? `${displayMake} ` : ""}
                              {displayModel}
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                c.is_exact_fit !== false
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-blue-50 text-blue-700 border border-blue-200"
                              }`}
                            >
                              {c.is_exact_fit !== false
                                ? "Exact Fit"
                                : "Compatible Fit"}
                            </span>
                          </div>

                          <div className="text-[11px] text-gray-600 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            {displayChassis ? (
                              <>
                                <span className="font-semibold text-gray-800">
                                  Variant: {displayChassis}
                                </span>
                                {displayYears && (
                                  <span>• Years: {displayYears}</span>
                                )}
                                {displayEngine && (
                                  <span>• Engine: {displayEngine}</span>
                                )}
                                {displayFuel && <span>• {displayFuel}</span>}
                              </>
                            ) : (
                              <span className="text-gray-500">
                                All Generations / Model-Wide Fitment
                              </span>
                            )}
                          </div>

                          {c.notes && (
                            <div className="text-[11px] text-gray-500 flex items-center gap-1">
                              <Wrench className="w-3 h-3 text-gray-400 shrink-0" />
                              <span className="truncate">{c.notes}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditFitment(idx)}
                          className="p-1.5 text-gray-400 hover:text-sparehub-orange hover:bg-orange-50 rounded-lg transition-colors"
                          title="Edit compatibility entry"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFitment(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove compatibility entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
