-- =============================================================================
-- Migration: 20261014000009_notifications_reviews_wishlist.sql
-- Description: Phase 4.7 & Phase 4.8 schema:
--              1. notifications (in-app alerts, order updates, idempotency)
--              2. product_reviews (star ratings, verified purchase, moderation)
--              3. wishlist_items (customer saved parts, unique per product)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'order_placed',
    'order_confirmed',
    'order_processing',
    'order_dispatched',
    'order_delivered',
    'order_cancelled',
    'order_rejected',
    'system'
  )),
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  USING (user_id = auth.uid());


-- -----------------------------------------------------------------------------
-- 2. PRODUCT REVIEWS & STAR RATINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text NOT NULL CHECK (char_length(comment) >= 5 AND char_length(comment) <= 2000),
  is_verified_purchase boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_product_reviews_customer_product UNIQUE (customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_id ON public.product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_customer_id ON public.product_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_status ON public.product_reviews(status);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published reviews" ON public.product_reviews;
CREATE POLICY "Public can view published reviews"
  ON public.product_reviews FOR SELECT
  USING (status = 'published' OR customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Customers can insert own review" ON public.product_reviews;
CREATE POLICY "Customers can insert own review"
  ON public.product_reviews FOR INSERT
  WITH CHECK (customer_id = auth.uid());

DROP POLICY IF EXISTS "Customers can update own review" ON public.product_reviews;
CREATE POLICY "Customers can update own review"
  ON public.product_reviews FOR UPDATE
  USING (customer_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Customers can delete own review" ON public.product_reviews;
CREATE POLICY "Customers can delete own review"
  ON public.product_reviews FOR DELETE
  USING (customer_id = auth.uid() OR public.is_platform_admin());

-- Review eligibility helper
CREATE OR REPLACE FUNCTION public.check_user_can_review_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    JOIN public.seller_orders so ON oi.seller_order_id = so.id
    JOIN public.customer_orders co ON so.customer_order_id = co.id
    WHERE co.customer_id = p_user_id
      AND oi.product_id = p_product_id
      AND so.status IN ('delivered', 'dispatched', 'confirmed', 'processing', 'completed')
  );
$$;

REVOKE ALL ON FUNCTION public.check_user_can_review_product(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_user_can_review_product(uuid, uuid) TO authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 3. WISHLIST / SAVED PRODUCTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_items_user_id ON public.wishlist_items(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_items_product_id ON public.wishlist_items(product_id);

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlist_items;
CREATE POLICY "Users can manage own wishlist"
  ON public.wishlist_items FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
