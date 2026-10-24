-- =============================================================================
-- Migration: 20261024000015_seller_order_customer_details_rls.sql
-- Description: Fix BUG-003 — Allow sellers to access recipient delivery details
--              and payment mode for customer orders containing sub-orders
--              for their shop, while preserving tenant isolation.
-- =============================================================================

-- 1. Ensure public.owns_shop exists
CREATE OR REPLACE FUNCTION public.owns_shop(target_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.seller_profiles sp ON s.seller_profile_id = sp.id
    WHERE s.id = target_shop_id AND sp.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid) TO authenticated, service_role;

-- 2. Add RLS policy on public.customer_orders for sellers with sub-orders
-- Allows a seller to read recipient name, delivery destination, phone, customer notes,
-- payment_method, and payment_status strictly for customer orders containing items from their shop.
DROP POLICY IF EXISTS "Sellers can view customer orders for their own sub-orders" ON public.customer_orders;
CREATE POLICY "Sellers can view customer orders for their own sub-orders"
  ON public.customer_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.seller_orders so
      WHERE so.customer_order_id = customer_orders.id
        AND public.owns_shop(so.shop_id)
    )
  );

-- 3. Ensure permissions on customer_orders for authenticated users
GRANT SELECT ON public.customer_orders TO authenticated;
