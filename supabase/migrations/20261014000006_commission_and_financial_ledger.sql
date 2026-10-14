-- =============================================================================
-- SPAREHUB DATABASE MIGRATION: 006 - Configurable Commission, Ledger & Audit Logs
-- Description: Extensible commission rules, immutable financial ledger, payment records, and audit logs.
-- =============================================================================

-- 1. COMMISSION RULES (Configurable Platform, Category & Shop Rates)
CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('platform_default', 'category_override', 'shop_override')),
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  -- Stored in basis points: 100 bps = 1.00%, 200 bps = 2.00%, 500 bps = 5.00%
  rate_basis_points int NOT NULL CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_rules_lookup ON public.commission_rules(rule_type, is_active);
CREATE INDEX idx_commission_rules_category ON public.commission_rules(category_id);
CREATE INDEX idx_commission_rules_shop ON public.commission_rules(shop_id);


-- 2. COMMISSION LEDGER (Immutable Financial Record)
CREATE TABLE public.commission_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  order_item_id uuid NOT NULL UNIQUE REFERENCES public.order_items(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  applied_rule_id uuid REFERENCES public.commission_rules(id),
  item_subtotal_minor bigint NOT NULL CHECK (item_subtotal_minor >= 0),
  commission_rate_bps int NOT NULL CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 10000),
  commission_amount_minor bigint NOT NULL CHECK (commission_amount_minor >= 0),
  seller_net_earning_minor bigint NOT NULL CHECK (seller_net_earning_minor >= 0),
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'earned', 'cancelled', 'refunded', 'settled')),
  payout_reference text,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_commission_ledger_shop ON public.commission_ledger(shop_id);
CREATE INDEX idx_commission_ledger_status ON public.commission_ledger(status);
CREATE INDEX idx_commission_ledger_order ON public.commission_ledger(seller_order_id);


-- 3. PAYMENT RECORDS (Idempotent Webhook Transactions)
CREATE TABLE public.payment_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  gateway_provider text NOT NULL,
  gateway_reference text,
  -- Unique idempotency key prevents duplicate callback/replay attacks
  idempotency_key text NOT NULL UNIQUE,
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency text NOT NULL DEFAULT 'LKR',
  status text NOT NULL CHECK (status IN ('initiated', 'pending', 'successful', 'failed', 'refunded')),
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_records_order ON public.payment_records(customer_order_id);
CREATE INDEX idx_payment_records_idempotency ON public.payment_records(idempotency_key);

CREATE TRIGGER trg_payment_records_updated_at
  BEFORE UPDATE ON public.payment_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4. ADMINISTRATIVE AUDIT LOGS (Immutable Activity Log)
CREATE TABLE public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  old_values jsonb,
  new_values jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON public.admin_audit_logs(actor_id);
CREATE INDEX idx_audit_logs_target ON public.admin_audit_logs(target_type, target_id);
CREATE INDEX idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);


-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- commission_rules RLS (Admin Only)
CREATE POLICY "Admin full management commission_rules"
  ON public.commission_rules FOR ALL
  USING (public.is_platform_admin());

-- commission_ledger RLS
CREATE POLICY "Sellers can view own shop earnings ledger"
  ON public.commission_ledger FOR SELECT
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

CREATE POLICY "Admin full management commission_ledger"
  ON public.commission_ledger FOR ALL
  USING (public.is_platform_admin());

-- payment_records RLS
CREATE POLICY "Customers can view payment status of own order"
  ON public.payment_records FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_orders co
      WHERE co.id = payment_records.customer_order_id AND co.customer_id = auth.uid()
    )
    OR public.is_platform_admin()
  );

CREATE POLICY "Admin full management payment_records"
  ON public.payment_records FOR ALL
  USING (public.is_platform_admin());

-- admin_audit_logs RLS (Admin View Only, Append-Only)
CREATE POLICY "Admin view audit logs"
  ON public.admin_audit_logs FOR SELECT
  USING (public.is_platform_admin());

CREATE POLICY "Admin append audit logs"
  ON public.admin_audit_logs FOR INSERT
  WITH CHECK (public.is_platform_admin());
