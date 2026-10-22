-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 011 - Seller-Managed Delivery Configuration & Order Status Sync
-- Description:
-- 1. Adds delivery configuration columns to shops (delivery enabled, default fee, district fees,
--    free delivery threshold, supported districts, and estimated days).
-- 2. Adds PostgreSQL function to calculate shop delivery fees with threshold & district overrides.
-- 3. Installs transactional trigger to synchronize parent customer_order status and COD payment
--    status from seller sub-orders (SECURITY DEFINER to avoid RLS silent update drops).
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. SHOPS DELIVERY CONFIGURATION COLUMNS
-- -----------------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS default_delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (default_delivery_fee_minor >= 0),
  ADD COLUMN IF NOT EXISTS district_delivery_fees jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS free_delivery_threshold_minor bigint CHECK (free_delivery_threshold_minor IS NULL OR free_delivery_threshold_minor >= 0),
  ADD COLUMN IF NOT EXISTS supported_districts text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS estimated_delivery_days text DEFAULT '2-4 business days';

-- -----------------------------------------------------------------------------
-- 2. SERVER-SIDE DELIVERY FEE CALCULATION FUNCTION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_shop_delivery_fee(
  p_shop_id uuid,
  p_destination_district text,
  p_merchandise_subtotal_minor bigint
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_delivery_enabled boolean;
  v_default_fee bigint;
  v_district_fees jsonb;
  v_free_threshold bigint;
  v_supported_districts text[];
  v_district_key text := lower(trim(p_destination_district));
  v_district_fee_val text;
BEGIN
  SELECT
    delivery_enabled,
    default_delivery_fee_minor,
    district_delivery_fees,
    free_delivery_threshold_minor,
    supported_districts
  INTO
    v_delivery_enabled,
    v_default_fee,
    v_district_fees,
    v_free_threshold,
    v_supported_districts
  FROM public.shops
  WHERE id = p_shop_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Shop % not found.', p_shop_id;
  END IF;

  -- 1. Check delivery enabled
  IF NOT coalesce(v_delivery_enabled, true) THEN
    RAISE EXCEPTION 'Delivery is currently disabled for this shop.';
  END IF;

  -- 2. Check supported districts (if explicitly restricted)
  IF v_supported_districts IS NOT NULL AND array_length(v_supported_districts, 1) > 0 THEN
    IF NOT (v_district_key = ANY(SELECT lower(trim(d)) FROM unnest(v_supported_districts) AS d)) THEN
      RAISE EXCEPTION 'Delivery to district "%" is not supported by this shop.', p_destination_district;
    END IF;
  END IF;

  -- 3. Check free delivery threshold
  IF v_free_threshold IS NOT NULL AND v_free_threshold > 0 AND p_merchandise_subtotal_minor >= v_free_threshold THEN
    RETURN 0;
  END IF;

  -- 4. Check district-specific fee override
  IF v_district_fees IS NOT NULL AND v_district_fees ? v_district_key THEN
    v_district_fee_val := v_district_fees ->> v_district_key;
    IF v_district_fee_val IS NOT NULL AND v_district_fee_val ~ '^\d+$' THEN
      RETURN v_district_fee_val::bigint;
    END IF;
  END IF;

  -- 5. Fallback to default delivery fee (defaults to 0 for backward-compatibility)
  RETURN coalesce(v_default_fee, 0);
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. TRANSACTIONAL PARENT ORDER STATUS & PAYMENT STATUS SYNC TRIGGER
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_sync_parent_order_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_customer_order_id uuid;
  v_all_count int;
  v_cancelled_count int;
  v_delivered_count int;
  v_dispatched_count int;
  v_processing_count int;
  v_new_parent_status text;
  v_curr_payment_method text;
  v_curr_payment_status text;
  v_new_payment_status text;
BEGIN
  v_customer_order_id := coalesce(NEW.customer_order_id, OLD.customer_order_id);
  IF v_customer_order_id IS NULL THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  -- Aggregate status counts for all sibling sub-orders
  SELECT
    count(*),
    count(*) FILTER (WHERE status = 'cancelled'),
    count(*) FILTER (WHERE status = 'delivered'),
    count(*) FILTER (WHERE status = 'dispatched'),
    count(*) FILTER (WHERE status IN ('confirmed', 'processing'))
  INTO
    v_all_count,
    v_cancelled_count,
    v_delivered_count,
    v_dispatched_count,
    v_processing_count
  FROM public.seller_orders
  WHERE customer_order_id = v_customer_order_id;

  IF v_all_count = 0 THEN
    RETURN coalesce(NEW, OLD);
  END IF;

  -- Determine derived parent order status
  IF v_cancelled_count = v_all_count THEN
    v_new_parent_status := 'cancelled';
  ELSIF v_delivered_count > 0 AND (v_delivered_count + v_cancelled_count) = v_all_count THEN
    v_new_parent_status := 'completed';
  ELSIF v_dispatched_count > 0 OR v_delivered_count > 0 THEN
    v_new_parent_status := 'partially_dispatched';
  ELSIF v_processing_count > 0 THEN
    v_new_parent_status := 'processing';
  ELSE
    v_new_parent_status := 'pending';
  END IF;

  -- Check existing payment details
  SELECT payment_method, payment_status
  INTO v_curr_payment_method, v_curr_payment_status
  FROM public.customer_orders
  WHERE id = v_customer_order_id;

  v_new_payment_status := v_curr_payment_status;

  -- Cash on Delivery lifecycle:
  -- When order is completed (all packages delivered), cash is collected
  IF v_curr_payment_method = 'cod' THEN
    IF v_new_parent_status = 'completed' AND v_curr_payment_status = 'cod_pending' THEN
      v_new_payment_status := 'captured';
    ELSIF v_new_parent_status = 'cancelled' AND v_curr_payment_status = 'cod_pending' THEN
      v_new_payment_status := 'unpaid';
    END IF;
  END IF;

  -- Transactionally update customer_orders
  UPDATE public.customer_orders
  SET
    status = v_new_parent_status,
    payment_status = v_new_payment_status,
    updated_at = now()
  WHERE id = v_customer_order_id;

  RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_parent_order_status ON public.seller_orders;
CREATE TRIGGER trg_sync_parent_order_status
  AFTER INSERT OR UPDATE OF status ON public.seller_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sync_parent_order_status();
