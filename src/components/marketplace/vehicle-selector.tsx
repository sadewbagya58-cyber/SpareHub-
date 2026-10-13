"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Car, CheckCircle2, RotateCcw, Search, ChevronRight } from "lucide-react";
import { VEHICLE_TYPES, SAMPLE_VEHICLE_DATA } from "@/lib/constants";
import { Button } from "@/components/ui/button";

export function VehicleSelector() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string>("car");
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [isSearching, setIsSearching] = useState(false);

  // Available makes for current type
  const typeData = SAMPLE_VEHICLE_DATA[selectedType] || {};
  const availableMakes = Object.keys(typeData);

  // Available models for selected make
  const availableModels = selectedMake && typeData[selectedMake] ? Object.keys(typeData[selectedMake]) : [];

  // Available variants for selected model
  const availableVariants =
    selectedMake && selectedModel && typeData[selectedMake]?.[selectedModel]
      ? typeData[selectedMake][selectedModel]
      : [];

  const handleTypeChange = (newType: string) => {
    setSelectedType(newType);
    setSelectedMake("");
    setSelectedModel("");
    setSelectedVariant("");
  };

  const handleMakeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMake(e.target.value);
    setSelectedModel("");
    setSelectedVariant("");
  };

  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedModel(e.target.value);
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
    if (selectedType) params.set("type", selectedType);
    if (selectedMake) params.set("make", selectedMake);
    if (selectedModel) params.set("model", selectedModel);
    if (selectedVariant) params.set("variant", selectedVariant);

    router.push(`/search?${params.toString()}`);
  };

  const isVehicleFullySelected = Boolean(selectedMake && selectedModel);

  return (
    <div className="w-full rounded-2xl bg-white border border-sparehub-border shadow-md overflow-hidden">
      {/* Selector Header */}
      <div className="bg-sparehub-dark text-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-sparehub-orange text-white">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base leading-tight">Select Your Vehicle</h3>
            <p className="text-xs text-gray-300">
              Filter parts guaranteed to fit your exact vehicle model & year
            </p>
          </div>
        </div>
        {isVehicleFullySelected && (
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-300 hover:text-white flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Selection
          </button>
        )}
      </div>

      {/* Vehicle Type Tabs */}
      <div className="px-5 pt-4 pb-2 border-b border-sparehub-border/60 bg-sparehub-light/40 overflow-x-auto">
        <div className="flex gap-2 min-w-max pb-1">
          {VEHICLE_TYPES.map((v) => {
            const isSelected = selectedType === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleTypeChange(v.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 ${
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
      <div className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Make Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-make"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              1. Manufacturer / Make
            </label>
            <select
              id="vehicle-make"
              value={selectedMake}
              onChange={handleMakeChange}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none"
            >
              <option value="">Select Manufacturer...</option>
              {availableMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
              {availableMakes.length === 0 && (
                <option value="" disabled>
                  (Additional makes seeding in Phase 6)
                </option>
              )}
            </select>
          </div>

          {/* Model Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-model"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              2. Vehicle Model
            </label>
            <select
              id="vehicle-model"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={!selectedMake}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="">Select Model...</option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>

          {/* Year / Variant Dropdown */}
          <div className="space-y-1.5">
            <label
              htmlFor="vehicle-variant"
              className="block text-xs font-bold uppercase tracking-wider text-sparehub-dark"
            >
              3. Generation / Year
            </label>
            <select
              id="vehicle-variant"
              value={selectedVariant}
              onChange={(e) => setSelectedVariant(e.target.value)}
              disabled={!selectedModel}
              className="w-full rounded-lg border border-sparehub-border bg-white px-3.5 py-2.5 text-sm text-sparehub-dark focus:border-sparehub-orange focus:ring-2 focus:ring-sparehub-orange/20 focus:outline-none disabled:bg-sparehub-light disabled:cursor-not-allowed disabled:text-gray-400"
            >
              <option value="">All Generations / Years</option>
              {availableVariants.map((variant) => (
                <option key={variant} value={variant}>
                  {variant}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Row */}
        <div className="mt-5 pt-4 border-t border-sparehub-border/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-gray-500 flex items-center gap-1.5">
            {isVehicleFullySelected ? (
              <span className="text-sparehub-success font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Active vehicle: {selectedMake} {selectedModel} {selectedVariant ? `(${selectedVariant})` : ""}
              </span>
            ) : (
              <span>Select at least make and model to activate fitment guarantees</span>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            isLoading={isSearching}
            loadingText="Filtering Parts..."
            disabled={!isVehicleFullySelected}
            onClick={handleFindParts}
            className="w-full sm:w-auto font-bold shadow-sm"
          >
            <Search className="w-4 h-4" />
            Find Matching Parts
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
