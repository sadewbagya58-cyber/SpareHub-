-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 005 - Multi-Vendor Cart & Partitioned Orders
-- Description: Shopping cart, customer orders, shop-partitioned suborders, item snapshots,
-- and an atomic, transactional checkout function resistant to race conditions & price tampering.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. SHOPPING CART ITEMS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_product ON public.cart_items(product_id);

DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON public.cart_items;
CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 2. CUSTOMER ORDERS (Aggregated Customer Invoice)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'partially_dispatched', 'completed', 'cancelled')),
  payment_method text NOT NULL CHECK (payment_method IN ('online', 'cod')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'cod_pending', 'failed', 'refunded')),
  shipping_full_name text NOT NULL,
  shipping_phone text NOT NULL,
  shipping_address_line1 text NOT NULL,
  shipping_address_line2 text,
  shipping_district text NOT NULL,
  shipping_city text NOT NULL,
  shipping_postal_code text,
  customer_notes text,
  total_items_subtotal_minor bigint NOT NULL CHECK (total_items_subtotal_minor >= 0),
  total_delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (total_delivery_fee_minor >= 0),
  total_discount_minor bigint NOT NULL DEFAULT 0 CHECK (total_discount_minor >= 0),
  total_grand_minor bigint NOT NULL CHECK (total_grand_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_orders_customer ON public.customer_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX IF NOT EXISTS idx_customer_orders_created ON public.customer_orders(created_at DESC);

DROP TRIGGER IF EXISTS trg_customer_orders_updated_at ON public.customer_orders;
CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 3. SELLER ORDERS (Sub-orders Partitioned by Shop)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seller_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  sub_order_number text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned')),
  fulfillment_type text NOT NULL DEFAULT 'seller_courier',
  courier_name text,
  tracking_number text,
  tracking_url text,
  dispatched_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (delivery_fee_minor >= 0),
  total_amount_minor bigint NOT NULL CHECK (total_amount_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_orders_customer_order ON public.seller_orders(customer_order_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_shop ON public.seller_orders(shop_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_status ON public.seller_orders(status);

DROP TRIGGER IF EXISTS trg_seller_orders_updated_at ON public.seller_orders;
CREATE TRIGGER trg_seller_orders_updated_at
  BEFORE UPDATE ON public.seller_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- -----------------------------------------------------------------------------
-- 4. ORDER ITEMS (Immutable Snapshots at Checkout)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_title_snapshot text NOT NULL,
  product_part_number_snapshot text,
  product_brand_snapshot text,
  unit_price_minor_units bigint NOT NULL CHECK (unit_price_minor_units >= 0),
  quantity int NOT NULL CHECK (quantity > 0),
  total_price_minor_units bigint NOT NULL CHECK (total_price_minor_units >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_seller_order ON public.order_items(seller_order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);


-- -----------------------------------------------------------------------------
-- 5. ORDER STATUS HISTORY (Audit Trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON public.order_status_history(seller_order_id);


-- =============================================================================
-- ATOMIC TRANSACTIONAL CHECKOUT FUNCTION (Anti-Price-Tampering & Anti-Overselling)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_shipping_full_name text,
  p_shipping_phone text,
  p_shipping_address_line1 text,
  p_shipping_address_line2 text,
  p_shipping_district text,
  p_shipping_city text,
  p_shipping_postal_code text,
  p_payment_method text,
  p_customer_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_customer_order_id uuid;
  v_order_number text;
  v_grand_total bigint := 0;
  v_cart_count int;
  v_shop_record RECORD;
  v_item_record RECORD;
  v_seller_order_id uuid;
  v_sub_order_number text;
  v_shop_subtotal bigint;
  v_sub_index int := 1;
BEGIN
  -- 1. Authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to place an order.';
  END IF;

  -- 2. Validate payment method
  IF p_payment_method NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- 3. Verify cart has items and acquire row-level locks on products to prevent concurrent overselling
  SELECT COUNT(*) INTO v_cart_count
  FROM public.cart_items
  WHERE user_id = v_user_id;

  IF v_cart_count = 0 THEN
    RAISE EXCEPTION 'Cannot checkout: Shopping cart is empty.';
  END IF;

  -- 4. Validate stock, active status, and compute grand total with row-level locks
  FOR v_item_record IN
    SELECT 
      ci.id as cart_item_id,
      ci.quantity,
      p.id as product_id,
      p.title,
      p.price_minor_units,
      p.stock_quantity,
      p.is_published,
      p.status as product_status,
      s.id as shop_id,
      s.status as shop_status
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    JOIN public.shops s ON p.shop_id = s.id
    WHERE ci.user_id = v_user_id
    FOR UPDATE OF p
  LOOP
    IF NOT v_item_record.is_published OR v_item_record.product_status <> 'active' THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable.', v_item_record.title;
    END IF;

    IF v_item_record.shop_status <> 'approved' THEN
      RAISE EXCEPTION 'Shop for product "%" is not active.', v_item_record.title;
    END IF;

    IF v_item_record.stock_quantity < v_item_record.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for product "%": requested %, available %.',
        v_item_record.title, v_item_record.quantity, v_item_record.stock_quantity;
    END IF;

    v_grand_total := v_grand_total + (v_item_record.price_minor_units * v_item_record.quantity);
  END LOOP;

  -- 5. Generate unique order number (e.g. SH-YYYYMMDD-HEX)
  v_order_number := 'SH-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6));

  -- 6. Insert parent customer order
  INSERT INTO public.customer_orders (
    order_number,
    customer_id,
    status,
    payment_method,
    payment_status,
    shipping_full_name,
    shipping_phone,
    shipping_address_line1,
    shipping_address_line2,
    shipping_district,
    shipping_city,
    shipping_postal_code,
    customer_notes,
    total_items_subtotal_minor,
    total_delivery_fee_minor,
    total_discount_minor,
    total_grand_minor
  ) VALUES (
    v_order_number,
    v_user_id,
    'pending',
    p_payment_method,
    CASE WHEN p_payment_method = 'cod' THEN 'cod_pending' ELSE 'unpaid' END,
    p_shipping_full_name,
    p_shipping_phone,
    p_shipping_address_line1,
    p_shipping_address_line2,
    p_shipping_district,
    p_shipping_city,
    p_shipping_postal_code,
    p_customer_notes,
    v_grand_total,
    0, -- Delivery fee unfinalized (Phase 7 commercial sign-off)
    0,
    v_grand_total
  )
  RETURNING id INTO v_customer_order_id;

  -- 7. Partition items by shop into seller suborders
  FOR v_shop_record IN
    SELECT DISTINCT p.shop_id
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = v_user_id
  LOOP
    v_sub_order_number := v_order_number || '-S' || v_sub_index;
    v_sub_index := v_sub_index + 1;

    -- Calculate subtotal for this shop
    SELECT SUM(p.price_minor_units * ci.quantity)
    INTO v_shop_subtotal
    FROM public.cart_items ci
    JOIN public.products p ON ci.product_id = p.id
    WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id;

    -- Create seller suborder
    INSERT INTO public.seller_orders (
      customer_order_id,
      shop_id,
      sub_order_number,
      status,
      subtotal_minor,
      delivery_fee_minor,
      total_amount_minor
    ) VALUES (
      v_customer_order_id,
      v_shop_record.shop_id,
      v_sub_order_number,
      'placed',
      v_shop_subtotal,
      0,
      v_shop_subtotal
    )
    RETURNING id INTO v_seller_order_id;

    -- Insert order items and decrement stock
    FOR v_item_record IN
      SELECT 
        ci.quantity,
        p.id as product_id,
        p.title,
        p.part_number,
        p.brand_name,
        p.price_minor_units
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id
    LOOP
      INSERT INTO public.order_items (
        seller_order_id,
        product_id,
        product_title_snapshot,
        product_part_number_snapshot,
        product_brand_snapshot,
        unit_price_minor_units,
        quantity,
        total_price_minor_units
      ) VALUES (
        v_seller_order_id,
        v_item_record.product_id,
        v_item_record.title,
        v_item_record.part_number,
        v_item_record.brand_name,
        v_item_record.price_minor_units,
        v_item_record.quantity,
        v_item_record.price_minor_units * v_item_record.quantity
      );

      -- Atomically decrement stock
      UPDATE public.products
      SET stock_quantity = stock_quantity - v_item_record.quantity
      WHERE id = v_item_record.product_id;
    END LOOP;

    -- Record status history
    INSERT INTO public.order_status_history (
      seller_order_id,
      from_status,
      to_status,
      changed_by,
      notes
    ) VALUES (
      v_seller_order_id,
      NULL,
      'placed',
      v_user_id,
      'Order placed via checkout'
    );
  END LOOP;

  -- 8. Clear user cart
  DELETE FROM public.cart_items WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'customer_order_id', v_customer_order_id,
    'order_number', v_order_number,
    'total_grand_minor', v_grand_total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_order TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY POLICIES (Idempotent & Rerun-Safe)
-- -----------------------------------------------------------------------------

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- cart_items RLS
DROP POLICY IF EXISTS "Users can manage own cart" ON public.cart_items;
CREATE POLICY "Users can manage own cart"
  ON public.cart_items FOR ALL
  USING (user_id = auth.uid());

-- customer_orders RLS: Read-only for customers; all mutations go through process_checkout_order() or Admin
DROP POLICY IF EXISTS "Customers can view own orders" ON public.customer_orders;
CREATE POLICY "Customers can view own orders"
  ON public.customer_orders FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management customer_orders" ON public.customer_orders;
CREATE POLICY "Admin full management customer_orders"
  ON public.customer_orders FOR ALL
  USING (public.is_platform_admin());

-- seller_orders RLS (Strict Multi-Tenant Separation)
DROP POLICY IF EXISTS "Customers can view sub-orders for their own customer order" ON public.seller_orders;
CREATE POLICY "Customers can view sub-orders for their own customer order"
  ON public.seller_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = seller_orders.customer_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view own shop sub-orders" ON public.seller_orders;
CREATE POLICY "Sellers can view own shop sub-orders"
  ON public.seller_orders FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers can update fulfillment on own sub-orders" ON public.seller_orders;
CREATE POLICY "Sellers can update fulfillment on own sub-orders"
  ON public.seller_orders FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admin full management seller_orders" ON public.seller_orders;
CREATE POLICY "Admin full management seller_orders"
  ON public.seller_orders FOR ALL
  USING (public.is_platform_admin());

-- order_items RLS
DROP POLICY IF EXISTS "Customers can view items in own customer orders" ON public.order_items;
CREATE POLICY "Customers can view items in own customer orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_items.seller_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers can view items in own shop sub-orders" ON public.order_items;
CREATE POLICY "Sellers can view items in own shop sub-orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_items.seller_order_id AND public.owns_shop(so.shop_id)
    )
    OR public.is_platform_admin()
  );

DROP POLICY IF EXISTS "Admin full management order_items" ON public.order_items;
CREATE POLICY "Admin full management order_items"
  ON public.order_items FOR ALL
  USING (public.is_platform_admin());

-- order_status_history RLS
DROP POLICY IF EXISTS "Authorized parties can view order history" ON public.order_status_history;
CREATE POLICY "Authorized parties can view order history"
  ON public.order_status_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_status_history.seller_order_id
        AND (public.owns_shop(so.shop_id) OR public.is_platform_admin())
    )
    OR EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_status_history.seller_order_id AND co.customer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin and Sellers can append status history" ON public.order_status_history;
CREATE POLICY "Admin and Sellers can append status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_status_history.seller_order_id
        AND (public.owns_shop(so.shop_id) OR public.is_platform_admin())
    )
  );
