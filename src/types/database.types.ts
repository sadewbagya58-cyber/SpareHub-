export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "customer" | "seller" | "platform_admin" | "support_agent";
export type SellerType = "retail_shop" | "individual" | "wholesaler" | "importer";
export type VerificationStatus = "unverified" | "pending_review" | "verified" | "rejected";
export type ShopStatus = "draft" | "pending_review" | "approved" | "rejected" | "suspended";
export type PartCondition = "brand_new" | "reconditioned" | "used";
export type ProductStatus = "active" | "out_of_stock" | "archived" | "banned";
export type OrderStatus = "pending" | "confirmed" | "processing" | "partially_dispatched" | "completed" | "cancelled";
export type SubOrderStatus = "placed" | "confirmed" | "processing" | "dispatched" | "delivered" | "cancelled" | "returned";
export type PaymentMethod = "online" | "cod";
export type PaymentStatus = "unpaid" | "authorized" | "captured" | "cod_pending" | "failed" | "refunded";
export type CommissionRuleType = "platform_default" | "category_override" | "shop_override";
export type CommissionStatus = "accrued" | "earned" | "cancelled" | "refunded" | "settled";

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          phone: string | null;
          role: UserRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          phone?: string | null;
          role?: UserRole;
          created_at?: string;
          updated_at?: string;
        };
      };
      seller_profiles: {
        Row: {
          id: string;
          user_id: string;
          seller_type: SellerType;
          id_number: string | null;
          id_type: "nic" | "passport" | "business_reg" | null;
          verification_status: VerificationStatus;
          rejection_reason: string | null;
          verified_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          seller_type: SellerType;
          id_number?: string | null;
          id_type?: "nic" | "passport" | "business_reg" | null;
          verification_status?: VerificationStatus;
          rejection_reason?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          seller_type?: SellerType;
          id_number?: string | null;
          id_type?: "nic" | "passport" | "business_reg" | null;
          verification_status?: VerificationStatus;
          rejection_reason?: string | null;
          verified_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      shops: {
        Row: {
          id: string;
          seller_profile_id: string;
          name: string;
          slug: string;
          description: string | null;
          logo_url: string | null;
          cover_url: string | null;
          phone: string;
          email: string;
          address_line1: string;
          address_line2: string | null;
          district: string;
          city: string;
          postal_code: string | null;
          status: ShopStatus;
          status_reason: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_profile_id: string;
          name: string;
          slug: string;
          description?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          phone: string;
          email: string;
          address_line1: string;
          address_line2?: string | null;
          district: string;
          city: string;
          postal_code?: string | null;
          status?: ShopStatus;
          status_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_profile_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          logo_url?: string | null;
          cover_url?: string | null;
          phone?: string;
          email?: string;
          address_line1?: string;
          address_line2?: string | null;
          district?: string;
          city?: string;
          postal_code?: string | null;
          status?: ShopStatus;
          status_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      seller_documents: {
        Row: {
          id: string;
          seller_profile_id: string;
          shop_id: string | null;
          document_type: string;
          storage_path: string;
          file_name: string;
          file_size_bytes: number | null;
          verified: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_profile_id: string;
          shop_id?: string | null;
          document_type: string;
          storage_path: string;
          file_name: string;
          file_size_bytes?: number | null;
          verified?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_profile_id?: string;
          shop_id?: string | null;
          document_type?: string;
          storage_path?: string;
          file_name?: string;
          file_size_bytes?: number | null;
          verified?: boolean;
          created_at?: string;
        };
      };
      vehicle_types: {
        Row: {
          id: string;
          name: string;
          display_order: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
        };
      };
      vehicle_makes: {
        Row: {
          id: string;
          vehicle_type_id: string;
          name: string;
          slug: string;
          is_popular: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_type_id: string;
          name: string;
          slug: string;
          is_popular?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_type_id?: string;
          name?: string;
          slug?: string;
          is_popular?: boolean;
          created_at?: string;
        };
      };
      vehicle_models: {
        Row: {
          id: string;
          make_id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          make_id: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          make_id?: string;
          name?: string;
          slug?: string;
          created_at?: string;
        };
      };
      vehicle_variants: {
        Row: {
          id: string;
          model_id: string;
          generation_chassis: string | null;
          year_start: number;
          year_end: number | null;
          engine_code: string | null;
          transmission: string | null;
          fuel_type: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          model_id: string;
          generation_chassis?: string | null;
          year_start: number;
          year_end?: number | null;
          engine_code?: string | null;
          transmission?: string | null;
          fuel_type?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          model_id?: string;
          generation_chassis?: string | null;
          year_start?: number;
          year_end?: number | null;
          engine_code?: string | null;
          transmission?: string | null;
          fuel_type?: "petrol" | "diesel" | "electric" | "hybrid" | "cng" | null;
          created_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          icon_name: string | null;
          display_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          name: string;
          slug: string;
          icon_name?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string | null;
          name?: string;
          slug?: string;
          icon_name?: string | null;
          display_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          shop_id: string;
          category_id: string;
          title: string;
          slug: string;
          description: string;
          part_number: string | null;
          oem_part_number: string | null;
          brand_name: string;
          condition: PartCondition;
          price_minor_units: number;
          compare_at_price_minor_units: number | null;
          stock_quantity: number;
          warranty_period_months: number;
          warranty_details: string | null;
          is_universal: boolean;
          is_published: boolean;
          status: ProductStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          shop_id: string;
          category_id: string;
          title: string;
          slug: string;
          description: string;
          part_number?: string | null;
          oem_part_number?: string | null;
          brand_name: string;
          condition: PartCondition;
          price_minor_units: number;
          compare_at_price_minor_units?: number | null;
          stock_quantity?: number;
          warranty_period_months?: number;
          warranty_details?: string | null;
          is_universal?: boolean;
          is_published?: boolean;
          status?: ProductStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          shop_id?: string;
          category_id?: string;
          title?: string;
          slug?: string;
          description?: string;
          part_number?: string | null;
          oem_part_number?: string | null;
          brand_name?: string;
          condition?: PartCondition;
          price_minor_units?: number;
          compare_at_price_minor_units?: number | null;
          stock_quantity?: number;
          warranty_period_months?: number;
          warranty_details?: string | null;
          is_universal?: boolean;
          is_published?: boolean;
          status?: ProductStatus;
          created_at?: string;
          updated_at?: string;
        };
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          image_url: string;
          alt_text: string | null;
          display_order: number;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          image_url: string;
          alt_text?: string | null;
          display_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          image_url?: string;
          alt_text?: string | null;
          display_order?: number;
          is_primary?: boolean;
          created_at?: string;
        };
      };
      product_compatibility: {
        Row: {
          id: string;
          product_id: string;
          vehicle_variant_id: string | null;
          vehicle_model_id: string | null;
          notes: string | null;
          is_exact_fit: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          vehicle_variant_id?: string | null;
          vehicle_model_id?: string | null;
          notes?: string | null;
          is_exact_fit?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          vehicle_variant_id?: string | null;
          vehicle_model_id?: string | null;
          notes?: string | null;
          is_exact_fit?: boolean;
          created_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          quantity: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      customer_orders: {
        Row: {
          id: string;
          order_number: string;
          customer_id: string;
          status: OrderStatus;
          payment_method: PaymentMethod;
          payment_status: PaymentStatus;
          shipping_full_name: string;
          shipping_phone: string;
          shipping_address_line1: string;
          shipping_address_line2: string | null;
          shipping_district: string;
          shipping_city: string;
          shipping_postal_code: string | null;
          customer_notes: string | null;
          total_items_subtotal_minor: number;
          total_delivery_fee_minor: number;
          total_discount_minor: number;
          total_grand_minor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number: string;
          customer_id: string;
          status?: OrderStatus;
          payment_method: PaymentMethod;
          payment_status?: PaymentStatus;
          shipping_full_name: string;
          shipping_phone: string;
          shipping_address_line1: string;
          shipping_address_line2?: string | null;
          shipping_district: string;
          shipping_city: string;
          shipping_postal_code?: string | null;
          customer_notes?: string | null;
          total_items_subtotal_minor: number;
          total_delivery_fee_minor?: number;
          total_discount_minor?: number;
          total_grand_minor: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          customer_id?: string;
          status?: OrderStatus;
          payment_method?: PaymentMethod;
          payment_status?: PaymentStatus;
          shipping_full_name?: string;
          shipping_phone?: string;
          shipping_address_line1?: string;
          shipping_address_line2?: string | null;
          shipping_district?: string;
          shipping_city?: string;
          shipping_postal_code?: string | null;
          customer_notes?: string | null;
          total_items_subtotal_minor?: number;
          total_delivery_fee_minor?: number;
          total_discount_minor?: number;
          total_grand_minor?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      seller_orders: {
        Row: {
          id: string;
          customer_order_id: string;
          shop_id: string;
          sub_order_number: string;
          status: SubOrderStatus;
          fulfillment_type: string;
          courier_name: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          dispatched_at: string | null;
          delivered_at: string | null;
          cancelled_at: string | null;
          cancellation_reason: string | null;
          subtotal_minor: number;
          delivery_fee_minor: number;
          total_amount_minor: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_order_id: string;
          shop_id: string;
          sub_order_number: string;
          status?: SubOrderStatus;
          fulfillment_type?: string;
          courier_name?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          subtotal_minor: number;
          delivery_fee_minor?: number;
          total_amount_minor: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_order_id?: string;
          shop_id?: string;
          sub_order_number?: string;
          status?: SubOrderStatus;
          fulfillment_type?: string;
          courier_name?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          dispatched_at?: string | null;
          delivered_at?: string | null;
          cancelled_at?: string | null;
          cancellation_reason?: string | null;
          subtotal_minor?: number;
          delivery_fee_minor?: number;
          total_amount_minor?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      order_items: {
        Row: {
          id: string;
          seller_order_id: string;
          product_id: string;
          product_title_snapshot: string;
          product_part_number_snapshot: string | null;
          product_brand_snapshot: string | null;
          unit_price_minor_units: number;
          quantity: number;
          total_price_minor_units: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_order_id: string;
          product_id: string;
          product_title_snapshot: string;
          product_part_number_snapshot?: string | null;
          product_brand_snapshot?: string | null;
          unit_price_minor_units: number;
          quantity: number;
          total_price_minor_units: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_order_id?: string;
          product_id?: string;
          product_title_snapshot?: string;
          product_part_number_snapshot?: string | null;
          product_brand_snapshot?: string | null;
          unit_price_minor_units?: number;
          quantity?: number;
          total_price_minor_units?: number;
          created_at?: string;
        };
      };
      order_status_history: {
        Row: {
          id: string;
          seller_order_id: string;
          from_status: string | null;
          to_status: string;
          changed_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_order_id: string;
          from_status?: string | null;
          to_status: string;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_order_id?: string;
          from_status?: string | null;
          to_status?: string;
          changed_by?: string | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      commission_rules: {
        Row: {
          id: string;
          name: string;
          rule_type: CommissionRuleType;
          category_id: string | null;
          shop_id: string | null;
          rate_basis_points: number;
          effective_from: string;
          effective_until: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          rule_type: CommissionRuleType;
          category_id?: string | null;
          shop_id?: string | null;
          rate_basis_points: number;
          effective_from: string;
          effective_until?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          rule_type?: CommissionRuleType;
          category_id?: string | null;
          shop_id?: string | null;
          rate_basis_points?: number;
          effective_from?: string;
          effective_until?: string | null;
          is_active?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
      };
      commission_ledger: {
        Row: {
          id: string;
          seller_order_id: string;
          order_item_id: string;
          shop_id: string;
          applied_rule_id: string | null;
          item_subtotal_minor: number;
          commission_rate_bps: number;
          commission_amount_minor: number;
          seller_net_earning_minor: number;
          status: CommissionStatus;
          payout_reference: string | null;
          settled_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seller_order_id: string;
          order_item_id: string;
          shop_id: string;
          applied_rule_id?: string | null;
          item_subtotal_minor: number;
          commission_rate_bps: number;
          commission_amount_minor: number;
          seller_net_earning_minor: number;
          status?: CommissionStatus;
          payout_reference?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seller_order_id?: string;
          order_item_id?: string;
          shop_id?: string;
          applied_rule_id?: string | null;
          item_subtotal_minor?: number;
          commission_rate_bps?: number;
          commission_amount_minor?: number;
          seller_net_earning_minor?: number;
          status?: CommissionStatus;
          payout_reference?: string | null;
          settled_at?: string | null;
          created_at?: string;
        };
      };
      payment_records: {
        Row: {
          id: string;
          customer_order_id: string;
          gateway_provider: string;
          gateway_reference: string | null;
          idempotency_key: string;
          amount_minor: number;
          currency: string;
          status: "initiated" | "pending" | "successful" | "failed" | "refunded";
          raw_payload: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_order_id: string;
          gateway_provider: string;
          gateway_reference?: string | null;
          idempotency_key: string;
          amount_minor: number;
          currency?: string;
          status: "initiated" | "pending" | "successful" | "failed" | "refunded";
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_order_id?: string;
          gateway_provider?: string;
          gateway_reference?: string | null;
          idempotency_key?: string;
          amount_minor?: number;
          currency?: string;
          status?: "initiated" | "pending" | "successful" | "failed" | "refunded";
          raw_payload?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      admin_audit_logs: {
        Row: {
          id: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          old_values: Json | null;
          new_values: Json | null;
          ip_address: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id: string;
          action: string;
          target_type: string;
          target_id: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string;
          action?: string;
          target_type?: string;
          target_id?: string;
          old_values?: Json | null;
          new_values?: Json | null;
          ip_address?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
      };
    };
  };
}
