export type VehicleType =
  | "car"
  | "motorcycle"
  | "three_wheeler"
  | "van"
  | "bus"
  | "truck"
  | "tractor"
  | "heavy_machinery";

export type PartCondition = "brand_new" | "reconditioned" | "used";

export interface DemoProduct {
  id: string;
  title: string;
  slug?: string;
  partNumber: string;
  oemNumber?: string;
  brand: string;
  condition: PartCondition;
  priceMinorUnits: number; // in cents (LKR 1 = 100 minor units)
  compareAtPriceMinorUnits?: number;
  stockQuantity: number;
  shopName: string;
  shopLocation: string;
  vehicleCompatibilitySummary: string;
  category: string;
  imageUrl: string;
  isDemo?: boolean;
  fitmentBadge?: string;
  fitmentType?: string;
  isExactFit?: boolean;
}

export interface VehicleSelection {
  vehicleType: string;
  make: string;
  model: string;
  yearOrVariant: string;
}

export type SellerType = "retail_shop" | "individual" | "wholesaler" | "importer";

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  productTitle: string;
  productSlug?: string;
  partNumber?: string;
  brandName?: string;
  imageUrl?: string;
  priceMinorUnits: number; // in cents
  stockQuantity: number;
  isPublished: boolean;
  shopId: string;
  shopName: string;
  shopSlug?: string;
  shopDistrict?: string;
}

export interface MultiVendorCartGroup {
  shopId: string;
  shopName: string;
  shopSlug?: string;
  shopDistrict?: string;
  items: CartItem[];
  subtotalMinorUnits: number;
}

export interface OrderItemSnapshot {
  id: string;
  sellerOrderId: string;
  productId: string;
  productTitle: string;
  partNumber?: string | null;
  brandName?: string | null;
  unitPriceMinorUnits: number;
  quantity: number;
  totalPriceMinorUnits: number;
  imageUrl?: string | null;
}

export interface OrderStatusHistoryItem {
  id: string;
  sellerOrderId: string;
  fromStatus?: string | null;
  toStatus: string;
  changedBy?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface SellerSubOrder {
  id: string;
  customerOrderId: string;
  shopId: string;
  shopName?: string;
  subOrderNumber: string;
  status: "placed" | "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled" | "returned";
  fulfillmentType: string;
  courierName?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  dispatchedAt?: string | null;
  deliveredAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  subtotalMinor: number;
  deliveryFeeMinor: number;
  totalAmountMinor: number;
  createdAt: string;
  items?: OrderItemSnapshot[];
  customerOrder?: {
    orderNumber: string;
    shippingFullName: string;
    shippingPhone: string;
    shippingAddressLine1: string;
    shippingAddressLine2?: string | null;
    shippingDistrict: string;
    shippingCity: string;
    shippingPostalCode?: string | null;
    customerNotes?: string | null;
    paymentMethod: string;
    paymentStatus: string;
    createdAt: string;
  };
  history?: OrderStatusHistoryItem[];
}

export interface CustomerOrderSummary {
  id: string;
  orderNumber: string;
  status: "pending" | "confirmed" | "processing" | "partially_dispatched" | "completed" | "cancelled";
  paymentMethod: "online" | "cod";
  paymentStatus: "unpaid" | "authorized" | "captured" | "cod_pending" | "failed" | "refunded";
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingDistrict: string;
  shippingCity: string;
  shippingPostalCode?: string | null;
  customerNotes?: string | null;
  totalItemsSubtotalMinor: number;
  totalDeliveryFeeMinor: number;
  totalDiscountMinor: number;
  totalGrandMinor: number;
  createdAt: string;
  sellerOrders?: SellerSubOrder[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  type:
    | "order_placed"
    | "order_confirmed"
    | "order_processing"
    | "order_dispatched"
    | "order_delivered"
    | "order_cancelled"
    | "order_rejected"
    | "system";
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  readAt?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ProductReviewItem {
  id: string;
  productId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1 - 5
  title?: string | null;
  comment: string;
  isVerifiedPurchase: boolean;
  status: "published" | "hidden" | "flagged";
  createdAt: string;
  updatedAt: string;
}

export interface ProductRatingSummary {
  averageRating: number;
  totalReviews: number;
  distribution: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product?: {
    id: string;
    title: string;
    slug: string;
    brandName?: string | null;
    partNumber?: string | null;
    priceMinorUnits: number;
    stockQuantity: number;
    isPublished: boolean;
    status: string;
    imageUrl?: string | null;
    shopName?: string;
    shopSlug?: string;
  };
}


