-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 005 - Multi-Vendor Cart & Partitioned Orders
-- Description: Shopping cart, customer orders, shop-partitioned suborders, and item snapshots.
-- =============================================================================

-- 1. SHOPPING CART ITEMS
CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity int NOT NULL CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX idx_cart_items_user ON public.cart_items(user_id);
CREATE INDEX idx_cart_items_product ON public.cart_items(product_id);

CREATE TRIGGER trg_cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2. CUSTOMER ORDERS (Aggregated Customer Invoice)
CREATE TABLE public.customer_orders (
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

CREATE INDEX idx_customer_orders_customer ON public.customer_orders(customer_id);
CREATE INDEX idx_customer_orders_status ON public.customer_orders(status);
CREATE INDEX idx_customer_orders_created ON public.customer_orders(created_at DESC);

CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 3. SELLER ORDERS (Sub-orders Partitioned by Shop)
CREATE TABLE public.seller_orders (
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

CREATE INDEX idx_seller_orders_customer_order ON public.seller_orders(customer_order_id);
CREATE INDEX idx_seller_orders_shop ON public.seller_orders(shop_id);
CREATE INDEX idx_seller_orders_status ON public.seller_orders(status);

CREATE TRIGGER trg_seller_orders_updated_at
  BEFORE UPDATE ON public.seller_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. ORDER ITEMS (Immutable Snapshots at Checkout)
CREATE TABLE public.order_items (
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

CREATE INDEX idx_order_items_seller_order ON public.order_items(seller_order_id);
CREATE INDEX idx_order_items_product ON public.order_items(product_id);


-- 5. ORDER STATUS HISTORY (Audit Trail)
CREATE TABLE public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_status_history_order ON public.order_status_history(seller_order_id);


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- cart_items RLS
CREATE POLICY "Users can manage own cart"
  ON public.cart_items FOR ALL
  USING (user_id = auth.uid());

-- customer_orders RLS
CREATE POLICY "Customers can view own orders"
  ON public.customer_orders FOR SELECT
  USING (customer_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Customers can create own orders"
  ON public.customer_orders FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Admin full management customer_orders"
  ON public.customer_orders FOR ALL
  USING (public.is_platform_admin());

-- seller_orders RLS (Strict Multi-Tenant Separation)
CREATE POLICY "Customers can view sub-orders for their own customer order"
  ON public.seller_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = seller_orders.customer_order_id AND co.customer_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view own shop sub-orders"
  ON public.seller_orders FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Sellers can update fulfillment on own sub-orders"
  ON public.seller_orders FOR UPDATE
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Admin full management seller_orders"
  ON public.seller_orders FOR ALL
  USING (public.is_platform_admin());

-- order_items RLS
CREATE POLICY "Customers can view items in own customer orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      JOIN public.customer_orders co ON so.customer_order_id = co.id
      WHERE so.id = order_items.seller_order_id AND co.customer_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view items in own shop sub-orders"
  ON public.order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_items.seller_order_id AND public.owns_shop(so.shop_id)
    )
    OR public.is_platform_admin()
  );

CREATE POLICY "Admin full management order_items"
  ON public.order_items FOR ALL
  USING (public.is_platform_admin());

-- order_status_history RLS
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

CREATE POLICY "Admin and Sellers can append status history"
  ON public.order_status_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.id = order_status_history.seller_order_id
        AND (public.owns_shop(so.shop_id) OR public.is_platform_admin())
    )
  );
