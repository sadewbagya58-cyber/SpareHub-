"use client";

import React, { useState } from "react";
import { Plus, Trash2, CheckCircle, Car, AlertCircle } from "lucide-react";
import {
  type VehicleTypeOption,
  type VehicleMakeOption,
  type VehicleModelOption,
} from "@/lib/products/taxonomy";
import { type ProductCompatibilityItem } from "@/lib/validators/product";

interface CompatibilityBuilderProps {
  compatibilities: ProductCompatibilityItem[];
  onChange: (items: ProductCompatibilityItem[]) => void;
  isUniversal: boolean;
  onUniversalToggle: (val: boolean) => void;
  vehicleTypes: VehicleTypeOption[];
  vehicleMakes: VehicleMakeOption[];
  vehicleModels: VehicleModelOption[];
}

export function CompatibilityBuilder({
  compatibilities,
  onChange,
  isUniversal,
  onUniversalToggle,
  vehicleTypes,
  vehicleMakes,
  vehicleModels,
}: CompatibilityBuilderProps) {
  // Local state for the "Add New Fitment" selector row
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [selectedMakeId, setSelectedMakeId] = useState<string>("");
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [fitNotes, setFitNotes] = useState<string>("");
  const [isExactFit, setIsExactFit] = useState<boolean>(true);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Filter makes by selected vehicle type
  const filteredMakes = selectedTypeId
    ? vehicleMakes.filter((m) => m.vehicle_type_id === selectedTypeId)
    : vehicleMakes;

  // Filter models by selected make
  const filteredModels = selectedMakeId
    ? vehicleModels.filter((m) => m.make_id === selectedMakeId)
    : [];

  const handleAddFitment = () => {
    setValidationError(null);

    if (!selectedModelId) {
      setValidationError("Please select a specific vehicle model to add compatibility.");
      return;
    }

    const modelObj = vehicleModels.find((m) => m.id === selectedModelId);
    const makeObj = vehicleMakes.find((m) => m.id === selectedMakeId);

    // Check if already added
    if (compatibilities.some((c) => c.vehicle_model_id === selectedModelId)) {
      setValidationError(`${makeObj?.name} ${modelObj?.name} is already in the compatibility list.`);
      return;
    }

    const newItem: ProductCompatibilityItem = {
      vehicle_model_id: selectedModelId,
      make_name: makeObj?.name || "",
      model_name: modelObj?.name || "",
      notes: fitNotes.trim() || undefined,
      is_exact_fit: isExactFit,
    };

    onChange([...compatibilities, newItem]);

    // Reset selection inputs
    setSelectedModelId("");
    setFitNotes("");
    setIsExactFit(true);
  };

  const handleRemoveFitment = (index: number) => {
    const updated = compatibilities.filter((_, i) => i !== index);
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {/* Universal Fit Toggle */}
      <div className="flex items-center justify-between p-3.5 bg-gray-50 border border-sparehub-border rounded-xl">
        <div>
          <label className="text-xs font-bold text-sparehub-dark flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isUniversal}
              onChange={(e) => onUniversalToggle(e.target.checked)}
              className="w-4 h-4 text-sparehub-orange rounded border-gray-300 focus:ring-sparehub-orange"
            />
            Universal Fitment / Consumable Part
          </label>
          <p className="text-[11px] text-gray-500 mt-0.5 ml-5.5">
            Check this if this part fits any vehicle or is a universal consumable (e.g. engine oil, wiper fluid, fuses).
          </p>
        </div>

        {isUniversal && (
          <span className="text-[10px] font-bold bg-green-100 text-sparehub-success px-2 py-0.5 rounded-full border border-green-200">
            Universal Fit Active
          </span>
        )}
      </div>

      {!isUniversal && (
        <div className="space-y-4 pt-2">
          {/* Fitment Selector Widget */}
          <div className="p-4 rounded-xl border border-sparehub-border bg-white space-y-3">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-sparehub-orange" />
              <h4 className="text-xs font-bold text-sparehub-dark uppercase tracking-wider">
                Add Compatible Vehicle
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  }}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none"
                >
                  <option value="">-- All Types --</option>
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
                  2. Make / Brand
                </label>
                <select
                  value={selectedMakeId}
                  onChange={(e) => {
                    setSelectedMakeId(e.target.value);
                    setSelectedModelId("");
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
                  3. Specific Model
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  disabled={!selectedMakeId}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg bg-white focus:border-sparehub-orange focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {selectedMakeId ? "-- Select Model --" : "-- Choose Make First --"}
                  </option>
                  {filteredModels.map((mod) => (
                    <option key={mod.id} value={mod.id}>
                      {mod.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end pt-1">
              {/* Optional Fitment Notes */}
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                  Fitment Notes / Position (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Front axle only, Petrol 1NZ engine, 2012-2018 models"
                  value={fitNotes}
                  onChange={(e) => setFitNotes(e.target.value)}
                  className="w-full text-xs py-2 px-2.5 border border-sparehub-border rounded-lg focus:border-sparehub-orange focus:outline-none"
                />
              </div>

              {/* Add Button */}
              <button
                type="button"
                onClick={handleAddFitment}
                disabled={!selectedModelId}
                className="w-full py-2 px-3 bg-sparehub-dark hover:bg-sparehub-orange text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5" />
                Add to Fitment List
              </button>
            </div>

            {validationError && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </div>
            )}
          </div>

          {/* Current Compatibility List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700">
                Compatible Vehicles ({compatibilities.length})
              </span>
              {compatibilities.length === 0 && (
                <span className="text-[11px] text-amber-700 font-medium">
                  At least 1 compatible model recommended for vehicle search matching.
                </span>
              )}
            </div>

            {compatibilities.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-gray-300 text-center text-xs text-gray-500 bg-gray-50/50">
                No vehicle fitments added yet. Use the selector above to link this part to models like Toyota Corolla, Bajaj RE, etc.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {compatibilities.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 bg-white border border-sparehub-border rounded-lg shadow-2xs hover:border-sparehub-orange transition-colors"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckCircle className="w-4 h-4 text-sparehub-success shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-sparehub-dark truncate">
                          {c.make_name ? `${c.make_name} ` : ""}
                          {c.model_name || "Specified Model"}
                        </div>
                        {c.notes && (
                          <div className="text-[11px] text-gray-500 truncate">
                            {c.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFitment(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title="Remove vehicle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
