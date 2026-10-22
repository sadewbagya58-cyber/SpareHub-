-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 012 - Checkout Idempotency, Buy Now & Robust Delivery
-- Description:
-- 1. Adds checkout_attempt_id column to public.customer_orders with unique constraint
--    to guarantee absolute idempotency against double-submissions / network retries.
-- 2. Upgrades public.process_checkout_order to accept checkout attempt ID, buy-now
--    single product checkout parameters, and transactional delivery fee calculation.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. CHECKOUT ATTEMPT IDEMPOTENCY KEY ON CUSTOMER ORDERS
-- -----------------------------------------------------------------------------
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS checkout_attempt_id text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_customer_orders_checkout_attempt
  ON public.customer_orders(checkout_attempt_id);

-- -----------------------------------------------------------------------------
-- 2. UPGRADED TRANSACTIONAL CHECKOUT FUNCTION (Supports Cart, Buy Now & Idempotency)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_checkout_order(
  p_shipping_full_name text,
  p_shipping_phone text,
  p_shipping_address_line1 text,
  p_shipping_address_line2 text,
  p_shipping_district text,
  p_shipping_city text,
  p_shipping_postal_code text,
  p_payment_method text,
  p_customer_notes text DEFAULT NULL,
  p_checkout_attempt_id text DEFAULT NULL,
  p_buy_now_product_id uuid DEFAULT NULL,
  p_buy_now_quantity int DEFAULT 1
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
  v_existing_order RECORD;
  v_merchandise_subtotal bigint := 0;
  v_total_delivery_fee bigint := 0;
  v_grand_total bigint := 0;
  v_cart_count int;
  v_shop_record RECORD;
  v_item_record RECORD;
  v_seller_order_id uuid;
  v_sub_order_number text;
  v_shop_subtotal bigint;
  v_shop_delivery_fee bigint;
  v_sub_index int := 1;
  v_is_buy_now boolean := (p_buy_now_product_id IS NOT NULL);
  v_buy_qty int := coalesce(p_buy_now_quantity, 1);
BEGIN
  -- 1. Authentication check
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to place an order.';
  END IF;

  -- 2. Validate payment method
  IF p_payment_method NOT IN ('online', 'cod') THEN
    RAISE EXCEPTION 'Invalid payment method: %', p_payment_method;
  END IF;

  -- 3. Idempotency Check: if checkout_attempt_id already exists, return existing order
  IF p_checkout_attempt_id IS NOT NULL AND trim(p_checkout_attempt_id) <> '' THEN
    SELECT id, order_number, total_grand_minor
    INTO v_existing_order
    FROM public.customer_orders
    WHERE checkout_attempt_id = trim(p_checkout_attempt_id)
      AND customer_id = v_user_id;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'customer_order_id', v_existing_order.id,
        'order_number', v_existing_order.order_number,
        'total_grand_minor', v_existing_order.total_grand_minor,
        'is_idempotent_replay', true
      );
    END IF;
  END IF;

  -- 4. Check for active inventory & acquire row-level locks
  IF v_is_buy_now THEN
    IF v_buy_qty < 1 THEN
      v_buy_qty := 1;
    END IF;

    -- Lock and validate single Buy Now product
    SELECT
      p.id as product_id,
      p.title,
      p.price_minor_units,
      p.stock_quantity,
      p.is_published,
      p.status as product_status,
      p.part_number,
      p.brand_name,
      s.id as shop_id,
      s.status as shop_status
    INTO v_item_record
    FROM public.products p
    JOIN public.shops s ON p.shop_id = s.id
    WHERE p.id = p_buy_now_product_id
    FOR UPDATE OF p;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product not found for Buy Now.';
    END IF;

    IF NOT v_item_record.is_published OR v_item_record.product_status <> 'active' THEN
      RAISE EXCEPTION 'Product "%" is currently unavailable for purchase.', v_item_record.title;
    END IF;

    IF v_item_record.shop_status = 'suspended' THEN
      RAISE EXCEPTION 'Vendor store is currently inactive.', v_item_record.title;
    END IF;

    IF v_item_record.stock_quantity < v_buy_qty THEN
      RAISE EXCEPTION 'Insufficient stock for "%": requested %, available %.',
        v_item_record.title, v_buy_qty, v_item_record.stock_quantity;
    END IF;

    v_merchandise_subtotal := v_item_record.price_minor_units * v_buy_qty;

    -- Calculate delivery fee for this shop
    BEGIN
      SELECT public.calculate_shop_delivery_fee(v_item_record.shop_id, p_shipping_district, v_merchandise_subtotal)
      INTO v_shop_delivery_fee;
    EXCEPTION WHEN OTHERS THEN
      v_shop_delivery_fee := 0;
    END;

    v_total_delivery_fee := coalesce(v_shop_delivery_fee, 0);
    v_grand_total := v_merchandise_subtotal + v_total_delivery_fee;

  ELSE
    -- Standard Cart Checkout: verify cart has items and lock products
    SELECT COUNT(*) INTO v_cart_count
    FROM public.cart_items
    WHERE user_id = v_user_id;

    IF v_cart_count = 0 THEN
      RAISE EXCEPTION 'Cannot checkout: Shopping cart is empty.';
    END IF;

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
      ORDER BY p.id ASC
      FOR UPDATE OF p
    LOOP
      IF NOT v_item_record.is_published OR v_item_record.product_status <> 'active' THEN
        RAISE EXCEPTION 'Product "%" is currently unavailable.', v_item_record.title;
      END IF;

      IF v_item_record.shop_status = 'suspended' THEN
        RAISE EXCEPTION 'Shop for product "%" is currently inactive.', v_item_record.title;
      END IF;

      IF v_item_record.stock_quantity < v_item_record.quantity THEN
        RAISE EXCEPTION 'Insufficient stock for product "%": requested %, available %.',
          v_item_record.title, v_item_record.quantity, v_item_record.stock_quantity;
      END IF;

      v_merchandise_subtotal := v_merchandise_subtotal + (v_item_record.price_minor_units * v_item_record.quantity);
    END LOOP;

    -- Calculate delivery fees per shop across the cart
    FOR v_shop_record IN
      SELECT DISTINCT p.shop_id
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id
    LOOP
      SELECT SUM(p.price_minor_units * ci.quantity)
      INTO v_shop_subtotal
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id;

      BEGIN
        SELECT public.calculate_shop_delivery_fee(v_shop_record.shop_id, p_shipping_district, v_shop_subtotal)
        INTO v_shop_delivery_fee;
      EXCEPTION WHEN OTHERS THEN
        v_shop_delivery_fee := 0;
      END;

      v_total_delivery_fee := v_total_delivery_fee + coalesce(v_shop_delivery_fee, 0);
    END LOOP;

    v_grand_total := v_merchandise_subtotal + v_total_delivery_fee;
  END IF;

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
    total_grand_minor,
    checkout_attempt_id
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
    v_merchandise_subtotal,
    v_total_delivery_fee,
    0,
    v_grand_total,
    NULLIF(trim(p_checkout_attempt_id), '')
  )
  RETURNING id INTO v_customer_order_id;

  -- 7. Partition items by shop into seller suborders
  IF v_is_buy_now THEN
    v_sub_order_number := v_order_number || '-S1';

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
      v_item_record.shop_id,
      v_sub_order_number,
      'placed',
      v_merchandise_subtotal,
      v_total_delivery_fee,
      v_grand_total
    )
    RETURNING id INTO v_seller_order_id;

    -- Insert snapshot item
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
      v_buy_qty,
      v_merchandise_subtotal
    );

    -- Decrement stock atomically
    UPDATE public.products
    SET 
      stock_quantity = stock_quantity - v_buy_qty,
      updated_at = now()
    WHERE id = v_item_record.product_id;

    -- Insert initial status history
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
      'Buy Now express order placed'
    );

  ELSE
    FOR v_shop_record IN
      SELECT DISTINCT p.shop_id
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id
    LOOP
      v_sub_order_number := v_order_number || '-S' || v_sub_index;
      v_sub_index := v_sub_index + 1;

      SELECT SUM(p.price_minor_units * ci.quantity)
      INTO v_shop_subtotal
      FROM public.cart_items ci
      JOIN public.products p ON ci.product_id = p.id
      WHERE ci.user_id = v_user_id AND p.shop_id = v_shop_record.shop_id;

      BEGIN
        SELECT public.calculate_shop_delivery_fee(v_shop_record.shop_id, p_shipping_district, v_shop_subtotal)
        INTO v_shop_delivery_fee;
      EXCEPTION WHEN OTHERS THEN
        v_shop_delivery_fee := 0;
      END;

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
        coalesce(v_shop_delivery_fee, 0),
        v_shop_subtotal + coalesce(v_shop_delivery_fee, 0)
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

        UPDATE public.products
        SET 
          stock_quantity = stock_quantity - v_item_record.quantity,
          updated_at = now()
        WHERE id = v_item_record.product_id;
      END LOOP;

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
        'Order placed via multi-vendor checkout'
      );
    END LOOP;

    -- Clear shopping cart only for cart checkout
    DELETE FROM public.cart_items
    WHERE user_id = v_user_id;
  END IF;

  -- 8. Return created order details
  RETURN jsonb_build_object(
    'customer_order_id', v_customer_order_id,
    'order_number', v_order_number,
    'total_grand_minor', v_grand_total,
    'total_delivery_fee_minor', v_total_delivery_fee,
    'is_idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_checkout_order FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_checkout_order TO authenticated, service_role;
