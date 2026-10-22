import { SRI_LANKA_DISTRICTS } from "@/lib/constants";

export interface ShopDeliverySettings {
  id: string;
  name?: string;
  delivery_enabled?: boolean;
  default_delivery_fee_minor?: number | bigint;
  district_delivery_fees?: Record<string, number> | null;
  free_delivery_threshold_minor?: number | bigint | null;
  supported_districts?: string[] | null;
  estimated_delivery_days?: string | null;
}

export interface DeliveryCalculationResult {
  allowed: boolean;
  feeMinor: number;
  isFree: boolean;
  estimatedDays: string;
  reason?: string;
}

export interface MultiVendorDeliverySummary {
  allowed: boolean;
  shopFees: Array<{
    shopId: string;
    shopName: string;
    merchandiseSubtotalMinor: number;
    deliveryFeeMinor: number;
    isFree: boolean;
    estimatedDays: string;
    error?: string;
  }>;
  totalDeliveryFeeMinor: number;
  error?: string;
}

/**
 * Calculates delivery fee for a specific shop and destination district.
 */
export function calculateShopDeliveryFee(
  shop: ShopDeliverySettings,
  destinationDistrict: string,
  merchandiseSubtotalMinor: number
): DeliveryCalculationResult {
  const defaultDays = shop.estimated_delivery_days || "2-4 business days";
  const normalizedDistrict = (destinationDistrict || "").trim().toLowerCase();

  // 1. Check if delivery is enabled
  if (shop.delivery_enabled === false) {
    return {
      allowed: false,
      feeMinor: 0,
      isFree: false,
      estimatedDays: defaultDays,
      reason: `Delivery is currently disabled by vendor "${shop.name || 'this shop'}".`,
    };
  }

  // 2. Validate district is within Sri Lanka
  const isValidDistrict = SRI_LANKA_DISTRICTS.some(
    (d) => d.toLowerCase() === normalizedDistrict
  );
  if (!isValidDistrict && normalizedDistrict !== "") {
    return {
      allowed: false,
      feeMinor: 0,
      isFree: false,
      estimatedDays: defaultDays,
      reason: `"${destinationDistrict}" is not a recognized administrative district in Sri Lanka.`,
    };
  }

  // 3. Check supported districts if shop has restricted them
  if (shop.supported_districts && shop.supported_districts.length > 0) {
    const isSupported = shop.supported_districts.some(
      (d) => d.trim().toLowerCase() === normalizedDistrict
    );
    if (!isSupported) {
      return {
        allowed: false,
        feeMinor: 0,
        isFree: false,
        estimatedDays: defaultDays,
        reason: `Delivery to ${destinationDistrict} is not available from vendor "${shop.name || 'this shop'}".`,
      };
    }
  }

  // 4. Check free delivery threshold
  const threshold = Number(shop.free_delivery_threshold_minor);
  if (!isNaN(threshold) && threshold > 0 && merchandiseSubtotalMinor >= threshold) {
    return {
      allowed: true,
      feeMinor: 0,
      isFree: true,
      estimatedDays: defaultDays,
    };
  }

  // 5. Check district-specific delivery fee override
  const districtFees = shop.district_delivery_fees;
  if (districtFees && typeof districtFees === "object") {
    const override = districtFees[normalizedDistrict];
    if (typeof override === "number" && !isNaN(override) && override >= 0) {
      return {
        allowed: true,
        feeMinor: Math.round(override),
        isFree: override === 0,
        estimatedDays: defaultDays,
      };
    }
  }

  // 6. Fallback to default delivery fee (default: 0 LKR)
  const defaultFee = Math.max(0, Math.round(Number(shop.default_delivery_fee_minor) || 0));
  return {
    allowed: true,
    feeMinor: defaultFee,
    isFree: defaultFee === 0,
    estimatedDays: defaultDays,
  };
}

/**
 * Calculates delivery fee across multiple vendor shops for an aggregated customer order.
 */
export function calculateMultiVendorDeliverySummary(
  shops: Array<{
    shop: ShopDeliverySettings;
    merchandiseSubtotalMinor: number;
  }>,
  destinationDistrict: string
): MultiVendorDeliverySummary {
  let totalDeliveryFeeMinor = 0;
  const shopFees: MultiVendorDeliverySummary["shopFees"] = [];

  for (const item of shops) {
    const res = calculateShopDeliveryFee(item.shop, destinationDistrict, item.merchandiseSubtotalMinor);
    if (!res.allowed) {
      return {
        allowed: false,
        shopFees: [
          ...shopFees,
          {
            shopId: item.shop.id,
            shopName: item.shop.name || "Vendor",
            merchandiseSubtotalMinor: item.merchandiseSubtotalMinor,
            deliveryFeeMinor: 0,
            isFree: false,
            estimatedDays: res.estimatedDays,
            error: res.reason,
          },
        ],
        totalDeliveryFeeMinor: 0,
        error: res.reason,
      };
    }

    totalDeliveryFeeMinor += res.feeMinor;
    shopFees.push({
      shopId: item.shop.id,
      shopName: item.shop.name || "Vendor",
      merchandiseSubtotalMinor: item.merchandiseSubtotalMinor,
      deliveryFeeMinor: res.feeMinor,
      isFree: res.isFree,
      estimatedDays: res.estimatedDays,
    });
  }

  return {
    allowed: true,
    shopFees,
    totalDeliveryFeeMinor,
  };
}

/**
 * Derives parent customer order status from child seller sub-order statuses.
 */
export function deriveParentOrderStatus(
  statuses: string[]
): "pending" | "confirmed" | "processing" | "partially_dispatched" | "completed" | "cancelled" {
  if (!statuses || statuses.length === 0) return "pending";

  const nonCancelled = statuses.filter((s) => s !== "cancelled");
  if (nonCancelled.length === 0) {
    // All sub-orders are cancelled
    return "cancelled";
  }

  // If every non-cancelled sub-order is delivered (and there's at least one delivered)
  if (nonCancelled.every((s) => s === "delivered")) {
    return "completed";
  }

  // If any sub-order is dispatched or delivered, packages have begun delivery
  if (statuses.some((s) => s === "dispatched" || s === "delivered")) {
    return "partially_dispatched";
  }

  // If any sub-order is confirmed or processing
  if (statuses.some((s) => s === "confirmed" || s === "processing")) {
    return "processing";
  }

  // All non-cancelled sub-orders are "placed"
  return "pending";
}
