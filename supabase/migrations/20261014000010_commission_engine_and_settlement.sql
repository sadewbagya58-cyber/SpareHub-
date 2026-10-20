-- =============================================================================
-- Migration: 20261014000010_commission_engine_and_settlement.sql
-- Description: Phase 4.9: Configurable Commission Engine & Financial Ledger
--              1. Schema-driven commission rate resolution (Shop > Category > Platform Default)
--              2. Automated immutable financial ledger accrual on order_items insert
--              3. Lifecycle reconciliation: 'accrued' -> 'earned' on delivery, 'cancelled' on cancellation
--              4. Payout settlement tracking & audit logging
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. BASELINE PLATFORM COMMISSION RULE SEED (Configurable, Non-Hardcoded)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.commission_rules
    WHERE rule_type = 'platform_default' AND is_active = true
  ) THEN
    INSERT INTO public.commission_rules (
      name,
      rule_type,
      category_id,
      shop_id,
      rate_basis_points,
      effective_from,
      effective_until,
      is_active
    ) VALUES (
      'Standard Marketplace Baseline',
      'platform_default',
      NULL,
      NULL,
      500, -- 5.00% initial configurable baseline
      now(),
      NULL,
      true
    );
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. COMMISSION RESOLUTION FUNCTION
-- -----------------------------------------------------------------------------
-- Resolves the effective commission rule with prioritized fallback:
--   1. shop_override (specific shop agreement)
--   2. category_override (product category rate)
--   3. platform_default (global marketplace rate)
--   4. Fallback 0 bps if no active rule configured
CREATE OR REPLACE FUNCTION public.resolve_effective_commission_rule(
  p_shop_id uuid,
  p_category_id uuid
)
RETURNS TABLE (
  rule_id uuid,
  rate_bps int,
  rule_type text,
  rule_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rec RECORD;
BEGIN
  -- 1. Check Shop Override
  IF p_shop_id IS NOT NULL THEN
    SELECT cr.id, cr.rate_basis_points, cr.rule_type, cr.name
    INTO v_rec
    FROM public.commission_rules cr
    WHERE cr.rule_type = 'shop_override'
      AND cr.shop_id = p_shop_id
      AND cr.is_active = true
      AND cr.effective_from <= now()
      AND (cr.effective_until IS NULL OR cr.effective_until >= now())
    ORDER BY cr.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT v_rec.id, v_rec.rate_basis_points, v_rec.rule_type, v_rec.name;
      RETURN;
    END IF;
  END IF;

  -- 2. Check Category Override
  IF p_category_id IS NOT NULL THEN
    SELECT cr.id, cr.rate_basis_points, cr.rule_type, cr.name
    INTO v_rec
    FROM public.commission_rules cr
    WHERE cr.rule_type = 'category_override'
      AND cr.category_id = p_category_id
      AND cr.is_active = true
      AND cr.effective_from <= now()
      AND (cr.effective_until IS NULL OR cr.effective_until >= now())
    ORDER BY cr.created_at DESC
    LIMIT 1;

    IF FOUND THEN
      RETURN QUERY SELECT v_rec.id, v_rec.rate_basis_points, v_rec.rule_type, v_rec.name;
      RETURN;
    END IF;
  END IF;

  -- 3. Check Platform Default
  SELECT cr.id, cr.rate_basis_points, cr.rule_type, cr.name
  INTO v_rec
  FROM public.commission_rules cr
  WHERE cr.rule_type = 'platform_default'
    AND cr.is_active = true
    AND cr.effective_from <= now()
    AND (cr.effective_until IS NULL OR cr.effective_until >= now())
  ORDER BY cr.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_rec.id, v_rec.rate_basis_points, v_rec.rule_type, v_rec.name;
    RETURN;
  END IF;

  -- 4. Fallback if no rules exist (0 bps)
  RETURN QUERY SELECT NULL::uuid, 0::int, 'none'::text, 'No Active Commission Rule'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_commission_rule(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_commission_rule(uuid, uuid) TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. AUTOMATED COMMISSION LEDGER ACCRUAL TRIGGER ON ORDER_ITEMS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_fn_accrue_order_item_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop_id uuid;
  v_category_id uuid;
  v_rule_id uuid;
  v_rate_bps int := 0;
  v_comm_amount bigint := 0;
  v_net_earning bigint := 0;
BEGIN
  -- Obtain shop_id and category_id
  SELECT so.shop_id, p.category_id
  INTO v_shop_id, v_category_id
  FROM public.seller_orders so
  LEFT JOIN public.products p ON p.id = NEW.product_id
  WHERE so.id = NEW.seller_order_id;

  IF v_shop_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Resolve commission rate
  SELECT rule_id, rate_bps
  INTO v_rule_id, v_rate_bps
  FROM public.resolve_effective_commission_rule(v_shop_id, v_category_id);

  IF v_rate_bps IS NULL THEN
    v_rate_bps := 0;
  END IF;

  -- Calculate platform commission and seller net earning
  -- Mathematical rounding: round((subtotal * bps) / 10000)
  v_comm_amount := round((NEW.total_price_minor_units * v_rate_bps)::numeric / 10000.0)::bigint;
  v_net_earning := NEW.total_price_minor_units - v_comm_amount;

  -- Idempotently insert into immutable financial ledger
  INSERT INTO public.commission_ledger (
    seller_order_id,
    order_item_id,
    shop_id,
    applied_rule_id,
    item_subtotal_minor,
    commission_rate_bps,
    commission_amount_minor,
    seller_net_earning_minor,
    status
  ) VALUES (
    NEW.seller_order_id,
    NEW.id,
    v_shop_id,
    v_rule_id,
    NEW.total_price_minor_units,
    v_rate_bps,
    v_comm_amount,
    v_net_earning,
    'accrued'
  )
  ON CONFLICT (order_item_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_accrue_order_item_commission ON public.order_items;
CREATE TRIGGER trg_accrue_order_item_commission
  AFTER INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_accrue_order_item_commission();


-- -----------------------------------------------------------------------------
-- 4. ORDER STATUS RECONCILIATION TRIGGER ON SELLER_ORDERS
-- -----------------------------------------------------------------------------
-- Transitions commission status:
--   'delivered'  -> 'earned'
--   'cancelled'  -> 'cancelled'
--   'returned'   -> 'refunded'
CREATE OR REPLACE FUNCTION public.trg_fn_reconcile_seller_order_commission_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    UPDATE public.commission_ledger
    SET status = 'earned'
    WHERE seller_order_id = NEW.id
      AND status = 'accrued';
  ELSIF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    UPDATE public.commission_ledger
    SET status = 'cancelled'
    WHERE seller_order_id = NEW.id
      AND status IN ('accrued', 'earned');
  ELSIF NEW.status = 'returned' AND OLD.status <> 'returned' THEN
    UPDATE public.commission_ledger
    SET status = 'refunded'
    WHERE seller_order_id = NEW.id
      AND status IN ('accrued', 'earned');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_seller_order_commission_status ON public.seller_orders;
CREATE TRIGGER trg_reconcile_seller_order_commission_status
  AFTER UPDATE OF status ON public.seller_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_reconcile_seller_order_commission_status();


-- -----------------------------------------------------------------------------
-- 5. BACKFILL HISTORICAL ORDER ITEMS INTO COMMISSION LEDGER
-- -----------------------------------------------------------------------------
-- Idempotently accrues any existing historical order_items that lack a ledger record
DO $$
DECLARE
  v_item RECORD;
  v_rule_id uuid;
  v_rate_bps int;
  v_comm_amount bigint;
  v_net_earning bigint;
  v_target_status text;
BEGIN
  FOR v_item IN
    SELECT 
      oi.id as order_item_id,
      oi.seller_order_id,
      oi.total_price_minor_units,
      so.shop_id,
      so.status as order_status,
      p.category_id
    FROM public.order_items oi
    JOIN public.seller_orders so ON oi.seller_order_id = so.id
    LEFT JOIN public.products p ON oi.product_id = p.id
    LEFT JOIN public.commission_ledger cl ON oi.id = cl.order_item_id
    WHERE cl.id IS NULL
  LOOP
    SELECT rule_id, rate_bps
    INTO v_rule_id, v_rate_bps
    FROM public.resolve_effective_commission_rule(v_item.shop_id, v_item.category_id);

    IF v_rate_bps IS NULL THEN
      v_rate_bps := 0;
    END IF;

    v_comm_amount := round((v_item.total_price_minor_units * v_rate_bps)::numeric / 10000.0)::bigint;
    v_net_earning := v_item.total_price_minor_units - v_comm_amount;

    v_target_status := CASE 
      WHEN v_item.order_status = 'delivered' THEN 'earned'
      WHEN v_item.order_status = 'cancelled' THEN 'cancelled'
      WHEN v_item.order_status = 'returned' THEN 'refunded'
      ELSE 'accrued'
    END;

    INSERT INTO public.commission_ledger (
      seller_order_id,
      order_item_id,
      shop_id,
      applied_rule_id,
      item_subtotal_minor,
      commission_rate_bps,
      commission_amount_minor,
      seller_net_earning_minor,
      status
    ) VALUES (
      v_item.seller_order_id,
      v_item.order_item_id,
      v_item.shop_id,
      v_rule_id,
      v_item.total_price_minor_units,
      v_rate_bps,
      v_comm_amount,
      v_net_earning,
      v_target_status
    )
    ON CONFLICT (order_item_id) DO NOTHING;
  END LOOP;
END $$;
