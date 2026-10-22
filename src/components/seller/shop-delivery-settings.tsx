"use client";

import React, { useState, useTransition } from "react";
import { Truck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SRI_LANKA_DISTRICTS } from "@/lib/constants";
import { updateShopDeliverySettingsAction } from "@/lib/seller/actions";

interface ShopDeliverySettingsProps {
  shop: {
    id: string;
    delivery_enabled?: boolean;
    default_delivery_fee_minor?: number;
    district_delivery_fees?: Record<string, number> | null;
    free_delivery_threshold_minor?: number | null;
    supported_districts?: string[] | null;
    estimated_delivery_days?: string | null;
  };
}

export function ShopDeliverySettings({ shop }: ShopDeliverySettingsProps) {
  const [deliveryEnabled, setDeliveryEnabled] = useState(shop.delivery_enabled ?? true);
  const [defaultFeeLKR, setDefaultFeeLKR] = useState<number>(
    Math.round((shop.default_delivery_fee_minor ?? 0) / 100)
  );
  const [freeThresholdLKR, setFreeThresholdLKR] = useState<string>(
    shop.free_delivery_threshold_minor != null
      ? String(Math.round(shop.free_delivery_threshold_minor / 100))
      : ""
  );
  const [estimatedDays, setEstimatedDays] = useState(
    shop.estimated_delivery_days || "2-4 business days"
  );

  // District specific fees map (LKR)
  const [districtFeesLKR, setDistrictFeesLKR] = useState<Record<string, number>>(() => {
    const raw = shop.district_delivery_fees || {};
    const res: Record<string, number> = {};
    for (const [dist, feeMinor] of Object.entries(raw)) {
      if (typeof feeMinor === "number") {
        res[dist.toLowerCase().trim()] = Math.round(feeMinor / 100);
      }
    }
    return res;
  });

  // District customization section accordion
  const [showDistrictCustomizer, setShowDistrictCustomizer] = useState(
    Object.keys(shop.district_delivery_fees || {}).length > 0
  );

  // Supported districts restriction
  const [restrictDistricts, setRestrictDistricts] = useState(
    Boolean(shop.supported_districts && shop.supported_districts.length > 0)
  );
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>(
    shop.supported_districts || [...SRI_LANKA_DISTRICTS]
  );

  const [isPending, startTransition] = useTransition();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDistrictFeeChange = (districtName: string, valStr: string) => {
    const key = districtName.toLowerCase().trim();
    if (!valStr || isNaN(Number(valStr))) {
      const copy = { ...districtFeesLKR };
      delete copy[key];
      setDistrictFeesLKR(copy);
    } else {
      setDistrictFeesLKR((prev) => ({
        ...prev,
        [key]: Math.max(0, Math.round(Number(valStr))),
      }));
    }
  };

  const handleToggleDistrict = (districtName: string) => {
    setSelectedDistricts((prev) =>
      prev.includes(districtName)
        ? prev.filter((d) => d !== districtName)
        : [...prev, districtName]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage(null);
    setErrorMessage(null);

    const fee = Number(defaultFeeLKR);
    if (isNaN(fee) || fee < 0) {
      setErrorMessage("Default delivery fee must be a non-negative number.");
      return;
    }

    let parsedThreshold: number | null = null;
    if (freeThresholdLKR.trim() !== "") {
      const parsed = Number(freeThresholdLKR);
      if (isNaN(parsed) || parsed < 0) {
        setErrorMessage("Free delivery threshold must be a positive number or left blank.");
        return;
      }
      parsedThreshold = parsed;
    }

    if (restrictDistricts && selectedDistricts.length === 0) {
      setErrorMessage("Please select at least one supported delivery district.");
      return;
    }

    startTransition(async () => {
      const res = await updateShopDeliverySettingsAction({
        shopId: shop.id,
        delivery_enabled: deliveryEnabled,
        default_delivery_fee_lkr: fee,
        free_delivery_threshold_lkr: parsedThreshold,
        district_fees_lkr: districtFeesLKR,
        supported_districts: restrictDistricts ? selectedDistricts : null,
        estimated_delivery_days: estimatedDays,
      });

      if (res.error) {
        setErrorMessage(res.error);
      } else {
        setSuccessMessage(res.message || "Delivery configuration saved successfully.");
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-sparehub-orange" />
            <CardTitle className="text-lg">Courier & Delivery Settings</CardTitle>
          </div>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              deliveryEnabled
                ? "bg-green-100 text-sparehub-success"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {deliveryEnabled ? "Delivery Active" : "Delivery Disabled"}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Messages */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-xs text-green-800 font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sparehub-success shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-sparehub-error shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Delivery Enable Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-sparehub-border">
            <div className="space-y-0.5">
              <label htmlFor="delivery-toggle" className="text-xs font-bold text-sparehub-dark cursor-pointer">
                Offer Courier Delivery to Customers
              </label>
              <p className="text-[11px] text-gray-500">
                When disabled, customers will not be able to order delivery from your shop.
              </p>
            </div>
            <input
              id="delivery-toggle"
              type="checkbox"
              checked={deliveryEnabled}
              onChange={(e) => setDeliveryEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-gray-300 text-sparehub-orange focus:ring-sparehub-orange cursor-pointer"
            />
          </div>

          {/* 2. Default Delivery Fee & Free Delivery Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-sparehub-dark">
                Default Delivery Fee (LKR)
              </label>
              <Input
                type="number"
                min="0"
                step="1"
                placeholder="e.g. 450"
                value={defaultFeeLKR}
                onChange={(e) => setDefaultFeeLKR(Math.max(0, Math.round(Number(e.target.value) || 0)))}
                disabled={!deliveryEnabled || isPending}
              />
              <p className="text-[10px] text-gray-400">
                Standard courier rate applied to districts without specific custom rates (0 = Free).
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-sparehub-dark">
                Free Delivery Order Threshold (LKR, Optional)
              </label>
              <Input
                type="number"
                min="0"
                step="100"
                placeholder="e.g. 10000"
                value={freeThresholdLKR}
                onChange={(e) => setFreeThresholdLKR(e.target.value)}
                disabled={!deliveryEnabled || isPending}
              />
              <p className="text-[10px] text-gray-400">
                Automatically waive delivery fee when shop merchandise exceeds this amount.
              </p>
            </div>
          </div>

          {/* 3. Estimated Delivery Timeframe */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-sparehub-dark">
              Estimated Delivery Time
            </label>
            <Input
              type="text"
              placeholder="e.g. 2-3 business days"
              value={estimatedDays}
              onChange={(e) => setEstimatedDays(e.target.value)}
              disabled={!deliveryEnabled || isPending}
              maxLength={50}
            />
            <p className="text-[10px] text-gray-400">
              Shown to customers on product pages and at checkout.
            </p>
          </div>

          {/* 4. District-Specific Delivery Rates (Accordion) */}
          <div className="rounded-xl border border-sparehub-border overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDistrictCustomizer(!showDistrictCustomizer)}
              className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between text-xs font-bold text-sparehub-dark hover:bg-gray-100 transition-colors"
            >
              <span>District-Specific Delivery Rates ({Object.keys(districtFeesLKR).length} custom rates configured)</span>
              {showDistrictCustomizer ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showDistrictCustomizer && (
              <div className="p-4 bg-white border-t border-sparehub-border space-y-3">
                <p className="text-[11px] text-gray-500">
                  Specify custom delivery charges for specific Sri Lankan districts. Any district left blank will use your default delivery fee (LKR {defaultFeeLKR}).
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto pr-1">
                  {SRI_LANKA_DISTRICTS.map((district) => {
                    const key = district.toLowerCase().trim();
                    const val = districtFeesLKR[key];
                    return (
                      <div key={district} className="space-y-1 p-2 rounded-lg bg-gray-50 border border-gray-200">
                        <span className="text-[11px] font-bold text-gray-700 block truncate">
                          {district}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400">LKR</span>
                          <input
                            type="number"
                            min="0"
                            placeholder={String(defaultFeeLKR)}
                            value={val !== undefined ? val : ""}
                            onChange={(e) => handleDistrictFeeChange(district, e.target.value)}
                            disabled={!deliveryEnabled || isPending}
                            className="w-full text-xs p-1 rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-sparehub-orange"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 5. Supported Delivery Coverage */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-sparehub-dark">
                Delivery Coverage Restrictions
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="restrict-districts"
                  type="checkbox"
                  checked={restrictDistricts}
                  onChange={(e) => setRestrictDistricts(e.target.checked)}
                  disabled={!deliveryEnabled || isPending}
                  className="w-4 h-4 rounded border-gray-300 text-sparehub-orange focus:ring-sparehub-orange cursor-pointer"
                />
                <label htmlFor="restrict-districts" className="text-xs text-gray-600 cursor-pointer">
                  Limit delivery to selected districts only
                </label>
              </div>
            </div>

            {restrictDistricts && (
              <div className="p-3 rounded-xl border border-sparehub-border bg-gray-50 space-y-2">
                <span className="text-[10px] text-gray-400 block">
                  Select which districts your courier service can reach:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {SRI_LANKA_DISTRICTS.map((district) => {
                    const isChecked = selectedDistricts.includes(district);
                    return (
                      <label
                        key={district}
                        className={`flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-white border-sparehub-orange font-bold text-sparehub-dark"
                            : "bg-gray-100/50 border-gray-200 text-gray-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDistrict(district)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-sparehub-orange focus:ring-sparehub-orange"
                        />
                        <span className="truncate">{district}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isPending}
              loadingText="Saving Delivery Settings..."
              disabled={isPending}
            >
              Save Delivery Settings
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
