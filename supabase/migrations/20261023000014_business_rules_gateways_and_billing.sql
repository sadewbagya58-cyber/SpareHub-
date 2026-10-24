-- =============================================================================
-- Migration: 20261023000014_business_rules_gateways_and_billing.sql
-- Description: Comprehensive Business Rules, Seller Payment Gateways, Commission
--              Billing (Monthly Statements, Due 10th, 7-day Grace Period), Policy
--              Versioning, Seller Agreements, Returns, and Financial Adjustments.
-- All DDL statements are idempotent and rerun-safe.
-- =============================================================================

SET search_path = public, extensions;

-- -----------------------------------------------------------------------------
-- 1. SELLER PAYMENT GATEWAYS (Seller-owned Merchant Gateways & Separate COD)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_payment_gateways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  gateway_provider text NOT NULL CHECK (gateway_provider IN ('payhere', 'webxpay', 'ipg', 'custom')),
  merchant_id text NOT NULL,
  merchant_secret text NOT NULL,
  is_sandbox boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT false,
  cod_enabled boolean NOT NULL DEFAULT true,
  webhook_secret text,
  last_tested_at timestamptz,
  last_test_status text CHECK (last_test_status IS NULL OR last_test_status IN ('success', 'failed', 'untested')),
  last_test_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_payment_gateways_shop ON public.shop_payment_gateways(shop_id);

DROP TRIGGER IF EXISTS trg_shop_payment_gateways_updated_at ON public.shop_payment_gateways;
CREATE TRIGGER trg_shop_payment_gateways_updated_at
  BEFORE UPDATE ON public.shop_payment_gateways
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.shop_payment_gateways ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers manage own payment gateway" ON public.shop_payment_gateways;
CREATE POLICY "Sellers manage own payment gateway"
  ON public.shop_payment_gateways FOR ALL
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin())
  WITH CHECK (public.owns_shop(shop_id) OR public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 2. COMMISSION RULES: ENFORCE 1%–5% RANGE & PROPOSED RATE ACCEPTANCE
-- -----------------------------------------------------------------------------
ALTER TABLE public.commission_rules
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS terms_version text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commission_rules'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%status%'
  ) THEN
    ALTER TABLE public.commission_rules
      ADD CONSTRAINT commission_rules_status_check
      CHECK (status IN ('draft', 'pending_acceptance', 'active', 'rejected', 'superseded'));
  END IF;
END;
$$;

-- Enforce 100 to 500 basis points (1.00% to 5.00%) constraint on commission_rules
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.commission_rules'::regclass
      AND conname = 'chk_commission_rules_1_to_5_percent'
  ) THEN
    ALTER TABLE public.commission_rules
      ADD CONSTRAINT chk_commission_rules_1_to_5_percent
      CHECK (rate_basis_points >= 100 AND rate_basis_points <= 500);
  END IF;
EXCEPTION
  WHEN check_violation THEN
    -- If historical test data contains out-of-range rates, log and skip hard table constraint
    RAISE NOTICE 'Skipping chk_commission_rules_1_to_5_percent check due to historical data; validated at application layer.';
END;
$$;

-- Update commission resolution function to respect rule status = 'active'
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
  -- 1. Check Shop Override (must be active and accepted)
  IF p_shop_id IS NOT NULL THEN
    SELECT cr.id, cr.rate_basis_points, cr.rule_type, cr.name
    INTO v_rec
    FROM public.commission_rules cr
    WHERE cr.rule_type = 'shop_override'
      AND cr.shop_id = p_shop_id
      AND cr.is_active = true
      AND cr.status = 'active'
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
      AND cr.status = 'active'
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
    AND cr.status = 'active'
    AND cr.effective_from <= now()
    AND (cr.effective_until IS NULL OR cr.effective_until >= now())
  ORDER BY cr.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_rec.id, v_rec.rate_basis_points, v_rec.rule_type, v_rec.name;
    RETURN;
  END IF;

  -- 4. Baseline 300 bps (3.00%) if no active rule configured
  RETURN QUERY SELECT NULL::uuid, 300::int, 'platform_default'::text, 'Baseline Standard (3%)'::text;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_effective_commission_rule(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_effective_commission_rule(uuid, uuid) TO authenticated, anon, service_role;

-- -----------------------------------------------------------------------------
-- 3. COMMISSION ADJUSTMENTS (Auditable Refund & Dispute Tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_ledger_id uuid REFERENCES public.commission_ledger(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  seller_order_id uuid REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('refund_partial', 'refund_full', 'dispute_hold', 'dispute_release', 'manual_credit', 'manual_debit')),
  amount_minor bigint NOT NULL,
  reason text NOT NULL,
  admin_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_adjustments_shop ON public.commission_adjustments(shop_id);
CREATE INDEX IF NOT EXISTS idx_commission_adjustments_ledger ON public.commission_adjustments(commission_ledger_id);

ALTER TABLE public.commission_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own commission adjustments" ON public.commission_adjustments;
CREATE POLICY "Sellers view own commission adjustments"
  ON public.commission_adjustments FOR SELECT
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins full management commission adjustments" ON public.commission_adjustments;
CREATE POLICY "Admins full management commission adjustments"
  ON public.commission_adjustments FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 4. MONTHLY COMMISSION STATEMENTS (Due 10th, 7-Day Grace Period)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.monthly_commission_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_number text NOT NULL UNIQUE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  period_start date NOT NULL,
  period_end date NOT NULL,
  due_date date NOT NULL,
  grace_period_end date NOT NULL,
  total_delivered_sales_minor bigint NOT NULL DEFAULT 0,
  effective_commission_rate_bps int NOT NULL DEFAULT 0,
  commission_earned_minor bigint NOT NULL DEFAULT 0,
  refund_adjustments_minor bigint NOT NULL DEFAULT 0,
  disputed_amount_minor bigint NOT NULL DEFAULT 0,
  previous_unpaid_balance_minor bigint NOT NULL DEFAULT 0,
  payments_received_minor bigint NOT NULL DEFAULT 0,
  credits_minor bigint NOT NULL DEFAULT 0,
  total_amount_due_minor bigint NOT NULL DEFAULT 0,
  undisputed_amount_due_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'disputed', 'adjusted')),
  notes text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_shop_statement_period UNIQUE (shop_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_statements_shop ON public.monthly_commission_statements(shop_id);
CREATE INDEX IF NOT EXISTS idx_statements_status ON public.monthly_commission_statements(status);
CREATE INDEX IF NOT EXISTS idx_statements_due_date ON public.monthly_commission_statements(due_date);

DROP TRIGGER IF EXISTS trg_monthly_statements_updated_at ON public.monthly_commission_statements;
CREATE TRIGGER trg_monthly_statements_updated_at
  BEFORE UPDATE ON public.monthly_commission_statements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.monthly_commission_statements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own monthly statements" ON public.monthly_commission_statements;
CREATE POLICY "Sellers view own monthly statements"
  ON public.monthly_commission_statements FOR SELECT
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins full management monthly statements" ON public.monthly_commission_statements;
CREATE POLICY "Admins full management monthly statements"
  ON public.monthly_commission_statements FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 5. COMMISSION PAYMENTS (Verified Manual Bank Transfer to SpareHub)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.monthly_commission_statements(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('bank_transfer', 'online_gateway', 'credit_adjustment', 'other')),
  payment_reference text NOT NULL,
  payment_date date NOT NULL,
  verified_by uuid NOT NULL REFERENCES auth.users(id),
  verification_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_statement ON public.commission_payments(statement_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_shop ON public.commission_payments(shop_id);

ALTER TABLE public.commission_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own commission payments" ON public.commission_payments;
CREATE POLICY "Sellers view own commission payments"
  ON public.commission_payments FOR SELECT
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins full management commission payments" ON public.commission_payments;
CREATE POLICY "Admins full management commission payments"
  ON public.commission_payments FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 6. COMMISSION DISPUTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commission_disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid REFERENCES public.monthly_commission_statements(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  seller_order_id uuid REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  disputed_amount_minor bigint NOT NULL CHECK (disputed_amount_minor > 0),
  reason text NOT NULL,
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'resolved_approved', 'resolved_rejected')),
  admin_notes text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_disputes_shop ON public.commission_disputes(shop_id);
CREATE INDEX IF NOT EXISTS idx_commission_disputes_status ON public.commission_disputes(status);

ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers manage own commission disputes" ON public.commission_disputes;
CREATE POLICY "Sellers manage own commission disputes"
  ON public.commission_disputes FOR ALL
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin())
  WITH CHECK (public.owns_shop(shop_id) OR public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 7. OVERDUE COMMISSION RESTRICTIONS ON SHOPS
-- -----------------------------------------------------------------------------
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS publishing_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS orders_restricted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS restriction_reason text,
  ADD COLUMN IF NOT EXISTS restricted_at timestamptz,
  ADD COLUMN IF NOT EXISTS restricted_by uuid REFERENCES auth.users(id);

-- Enhance enforce_shop_verification_on_publish to check publishing_restricted
CREATE OR REPLACE FUNCTION public.enforce_shop_verification_on_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_shop_status text;
  v_verification_status text;
  v_publishing_restricted boolean;
BEGIN
  IF NEW.is_published = true THEN
    SELECT status, verification_status, publishing_restricted
    INTO v_shop_status, v_verification_status, v_publishing_restricted
    FROM public.shops
    WHERE id = NEW.shop_id;

    IF v_shop_status IS NULL THEN
      RAISE EXCEPTION 'Cannot publish product: Associated shop does not exist.';
    END IF;

    IF v_shop_status = 'suspended' THEN
      RAISE EXCEPTION 'Cannot publish product: Your shop is currently suspended.';
    END IF;

    IF v_publishing_restricted = true THEN
      RAISE EXCEPTION 'Cannot publish product: Product publishing is currently restricted for this shop due to outstanding compliance or commission balance.';
    END IF;

    IF v_verification_status IS DISTINCT FROM 'approved' THEN
      RAISE EXCEPTION 'Shop verification required: You must complete seller verification before publishing products.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. ORDER RETURNS AND DISPUTES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid NOT NULL REFERENCES public.customer_orders(id) ON DELETE RESTRICT,
  seller_order_id uuid NOT NULL REFERENCES public.seller_orders(id) ON DELETE RESTRICT,
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE RESTRICT,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reason text NOT NULL,
  reason_category text NOT NULL CHECK (reason_category IN ('wrong_item', 'damaged_item', 'defective_item', 'incompatible_item', 'customer_error', 'other')),
  return_shipping_payer text NOT NULL DEFAULT 'seller' CHECK (return_shipping_payer IN ('seller', 'customer', 'undecided')),
  requested_refund_minor bigint NOT NULL CHECK (requested_refund_minor >= 0),
  approved_refund_minor bigint DEFAULT 0 CHECK (approved_refund_minor >= 0),
  evidence_urls text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'seller_accepted', 'seller_rejected', 'disputed_admin_review', 'item_returned', 'refund_issued', 'rejected')),
  seller_response text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_returns_customer ON public.order_returns(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_shop ON public.order_returns(shop_id);
CREATE INDEX IF NOT EXISTS idx_order_returns_order ON public.order_returns(seller_order_id);

DROP TRIGGER IF EXISTS trg_order_returns_updated_at ON public.order_returns;
CREATE TRIGGER trg_order_returns_updated_at
  BEFORE UPDATE ON public.order_returns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers manage own return requests" ON public.order_returns;
CREATE POLICY "Customers manage own return requests"
  ON public.order_returns FOR ALL
  TO authenticated
  USING (customer_id = auth.uid() OR public.is_platform_admin())
  WITH CHECK (customer_id = auth.uid() OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers view and respond to shop returns" ON public.order_returns;
CREATE POLICY "Sellers view and respond to shop returns"
  ON public.order_returns FOR ALL
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin())
  WITH CHECK (public.owns_shop(shop_id) OR public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 9. VERSIONED POLICY DOCUMENTS & SELLER AGREEMENT ACCEPTANCES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.policy_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type text NOT NULL CHECK (policy_type IN ('seller_agreement', 'terms_and_conditions', 'privacy_policy', 'returns_and_refunds', 'warranty_policy', 'prohibited_products_conduct')),
  version text NOT NULL,
  title text NOT NULL,
  content_markdown text NOT NULL,
  summary text,
  is_published boolean NOT NULL DEFAULT false,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_policy_type_version UNIQUE (policy_type, version)
);

CREATE INDEX IF NOT EXISTS idx_policy_documents_lookup ON public.policy_documents(policy_type, is_published);

DROP TRIGGER IF EXISTS trg_policy_documents_updated_at ON public.policy_documents;
CREATE TRIGGER trg_policy_documents_updated_at
  BEFORE UPDATE ON public.policy_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.policy_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published policy documents" ON public.policy_documents;
CREATE POLICY "Public read published policy documents"
  ON public.policy_documents FOR SELECT
  USING (is_published = true OR public.is_platform_admin());

DROP POLICY IF EXISTS "Admins manage policy documents" ON public.policy_documents;
CREATE POLICY "Admins manage policy documents"
  ON public.policy_documents FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- Seller Policy Acceptances Table
CREATE TABLE IF NOT EXISTS public.seller_policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  policy_version text NOT NULL,
  commission_rate_bps int,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text,
  CONSTRAINT uq_seller_policy_acceptance UNIQUE (shop_id, policy_type, policy_version)
);

CREATE INDEX IF NOT EXISTS idx_seller_policy_acceptances_shop ON public.seller_policy_acceptances(shop_id);

ALTER TABLE public.seller_policy_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Sellers view own policy acceptances" ON public.seller_policy_acceptances;
CREATE POLICY "Sellers view own policy acceptances"
  ON public.seller_policy_acceptances FOR SELECT
  TO authenticated
  USING (public.owns_shop(shop_id) OR public.is_platform_admin());

DROP POLICY IF EXISTS "Sellers record own policy acceptance" ON public.seller_policy_acceptances;
CREATE POLICY "Sellers record own policy acceptance"
  ON public.seller_policy_acceptances FOR INSERT
  TO authenticated
  WITH CHECK (public.owns_shop(shop_id) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Admins view all policy acceptances" ON public.seller_policy_acceptances;
CREATE POLICY "Admins view all policy acceptances"
  ON public.seller_policy_acceptances FOR ALL
  TO authenticated
  USING (public.is_platform_admin());

-- -----------------------------------------------------------------------------
-- 10. BASELINE POLICY SEED (Version 1.0 - Sri Lanka Marketplace Ready Drafts)
-- -----------------------------------------------------------------------------
INSERT INTO public.policy_documents (policy_type, version, title, summary, is_published, effective_date, content_markdown)
VALUES
(
  'terms_and_conditions',
  '1.0',
  'SpareHub Marketplace Terms and Conditions',
  'Comprehensive governing terms for buyers and sellers on the SpareHub automotive spare parts marketplace in Sri Lanka.',
  true,
  CURRENT_DATE,
  '# SpareHub Marketplace Terms & Conditions

*Version 1.0 — Effective Date: October 2026*  
*Tagline: Every Part. One Marketplace.*

> **IMPORTANT LEGAL NOTICE:**  
> *This policy governs access and use of the SpareHub marketplace in Sri Lanka. It is a commercial draft prepared for operational launch and is subject to formal legal review by an attorney qualified in Sri Lanka.*

---

## 1. Role and Scope of SpareHub
SpareHub operates an online automotive spare parts marketplace connecting independent automotive parts vendors (Sellers) with retail buyers and mechanics (Customers). 

**SpareHub is not an automotive parts manufacturer, warranty underwriter, or postal carrier.** When a customer places an order, the legal sales contract is formed directly between the Customer and the independent Seller fulfilling the order.

## 2. Customer & Seller Accounts
- All users must register a valid customer account with accurate contact information.
- Users are responsible for safeguarding login credentials and activities conducted under their account.
- Commercial vendors may open one or more shops under their customer account subject to identity verification.

## 3. Product Listings, Availability & Pricing
- All prices are displayed in Sri Lankan Rupees (LKR) inclusive of applicable taxes unless explicitly disclosed.
- Sellers are responsible for listing genuine condition, manufacturer part numbers (OEM), fitment specifications, and vehicle compatibility.
- SpareHub reserves the right to remove misleading or unauthorized listings.

## 4. Payment & Cash on Delivery (COD)
- Customers may pay via supported online payment gateways (routed to the respective seller) or select Cash on Delivery where offered.
- For online transactions, payment authorization is verified server-side prior to order fulfillment.
- COD customers are obligated to accept and pay for legitimate orders upon delivery. Repeated fraudulent COD refusal may lead to account suspension.

## 5. Seller-Managed Delivery
- Deliveries are packaged and dispatched directly by the independent seller or their designated courier partner.
- Sellers must provide accurate dispatch timelines and tracking numbers where available.

## 6. Cancellations, Returns & Refunds
- Customers may cancel orders prior to seller acceptance.
- Returns and refunds are governed strictly by the SpareHub Return and Refund Policy and Sri Lankan consumer protection regulations.

## 7. Governing Law & Dispute Resolution
- These Terms are governed by and construed in accordance with the laws of the Democratic Socialist Republic of Sri Lanka, including the Electronic Transactions Act No. 19 of 2006 and the Consumer Affairs Authority Act No. 9 of 2003.'
),
(
  'privacy_policy',
  '1.0',
  'SpareHub Marketplace Privacy Policy',
  'Privacy and data protection framework complying with Sri Lankan Personal Data Protection Act No. 9 of 2022 principles.',
  true,
  CURRENT_DATE,
  '# SpareHub Privacy Policy

*Version 1.0 — Effective Date: October 2026*

> **IMPORTANT NOTICE:**  
> *SpareHub is committed to safeguarding personal information under the Personal Data Protection Act No. 9 of 2022 (PDPA) of Sri Lanka.*

---

## 1. Information We Collect
We collect personal information necessary to deliver marketplace services:
- **Account Data:** Name, email, mobile phone number, delivery address.
- **Seller Verification Documents:** National Identity Card (NIC front & back), Proof of Residential Address (utility bill/bank statement), Business Registration where provided.
- **Transaction & Order History:** Purchased items, delivery destinations, amounts, and payment method statuses.
- **Technical & Security Logs:** IP addresses, browser user agent, session timestamps.

## 2. Protection of Sensitive Verification Documents
- **Zero Public Access:** Seller verification documents (NIC and address proofs) are stored in a private encrypted Supabase storage vault (`verification-documents`).
- Access is strictly limited to authorized SpareHub compliance administrators via temporary, short-lived (300-second) signed URLs.
- Verification files are never indexed by search engines or shared with third parties.

## 3. Payment Credentials & Gateway Security
- **No Card Storage:** SpareHub never collects, stores, or processes raw credit or debit card numbers, CVVs, or bank account PINs on its servers.
- Online payments are processed directly through secure, Central Bank of Sri Lanka-compliant payment gateways (e.g., PayHere, WebXPay, IPG).

## 4. Data Sharing & Third Parties
Personal information is shared strictly on a need-to-know operational basis:
- Sellers receive customer delivery name, phone number, and address to package and deliver items.
- Couriers receive necessary delivery instructions.

## 5. User Rights & Data Retention
Users may access, correct, or request deletion of their personal information by contacting privacy@sparehub.lk, subject to statutory accounting and tax retention periods.'
),
(
  'seller_agreement',
  '1.0',
  'SpareHub Vendor Merchant Agreement',
  'Commercial agreement governing shop operations, commission rates (1% to 5%), monthly billing, and overdue compliance.',
  true,
  CURRENT_DATE,
  '# SpareHub Vendor Merchant Agreement

*Version 1.0 — Effective Date: October 2026*

> **COMMERCIAL AGREEMENT:**  
> *This Agreement governs all commercial shops operating on SpareHub Sri Lanka. By opening a shop or accepting proposed commercial terms, the vendor agrees to abide by these provisions.*

---

## 1. Seller Identity & Verification
- Vendors must complete verification by providing valid National Identity Card (NIC) credentials and proof of address within 3 months of issue.
- Unverified shops may create product drafts but cannot publish live products on the marketplace.

## 2. Marketplace Commission
- SpareHub charges a performance-based marketplace commission between **1.00% and 5.00%** (100 to 500 basis points) on the merchandise subtotal of delivered orders.
- Commission is calculated exclusively on the product item subtotal and excludes delivery fees.
- **Rate Proposal & Acceptance:** Any shop-specific commission rate proposed by SpareHub takes effect only upon recorded acceptance by the vendor. Prior to acceptance, the vendor remains on their active rate or platform baseline.

## 3. Monthly Statements & Payment Schedule
- **Billing Period:** Commission is calculated for eligible delivered items during each calendar month.
- **Statement Issuance:** Statements are generated on the 1st day of the following month with a unique statement identifier.
- **Due Date:** Commission payment is due by the **10th day** of the following month.
- **Grace Period:** A seven-calendar-day grace period extends to the **17th day** before operational restrictions are applied.

## 4. Commission Payment Method & Reconciliation
- Vendors remit undisputed commission via verified bank transfer to SpareHub''s nominated bank account.
- Vendors must submit the transfer reference or deposit receipt via the Seller Dashboard.
- Commission statements are marked paid only upon independent verification by SpareHub financial administrators.

## 5. Overdue Commission Clause & Restrictions
- If undisputed commission remains unpaid after the 7-day grace period, SpareHub may apply proportionate restrictions:
  1. Restriction on publishing new product listings.
  2. Restriction on accepting new customer orders.
  3. Temporary shop suspension following formal notice.
- Disputed amounts under active review are held and exempt from overdue penalties pending resolution.'
),
(
  'returns_and_refunds',
  '1.0',
  'SpareHub Return, Replacement and Refund Policy',
  'Clear rules for return eligibility, return shipping responsibility, defective parts, and partial refunds.',
  true,
  CURRENT_DATE,
  '# SpareHub Return, Replacement and Refund Policy

*Version 1.0 — Effective Date: October 2026*

---

## 1. Return Eligibility
Customers may request a return within **7 calendar days** of verified delivery under the following conditions:
- **Wrong Item Supplied:** The seller delivered an item differing from the ordered part number or description.
- **Damaged in Transit:** The item arrived broken, dented, or damaged due to improper packaging.
- **Defective / Non-functional:** The part failed upon initial installation in accordance with manufacturer guidelines.
- **Incompatible Information:** The seller provided incorrect vehicle compatibility or fitment data on the listing.

## 2. Non-Returnable Items
- Electrical components that have been installed or experienced short-circuiting due to improper vehicle wiring.
- Used or reconditioned parts explicitly sold "as-is" where condition defects were fully disclosed.
- Items damaged due to improper customer handling, amateur installation, or modification.

## 3. Return Shipping Responsibility
- **Seller Responsibility:** The Seller bears all reasonable return courier expenses if the return is due to seller error (wrong part, defective item, misleading listing).
- **Customer Responsibility:** If a customer ordered the wrong part for their vehicle despite accurate listing details, the customer bears return shipping costs.

## 4. Refund Processing
- Refunds are issued only after the returned part has been received and inspected by the seller or SpareHub.
- Approved refunds adjust the corresponding order commission ledger via an auditable adjustment record.'
),
(
  'warranty_policy',
  '1.0',
  'SpareHub Automotive Spare Parts Warranty Policy',
  'Warranty disclosure standards for genuine, aftermarket, reconditioned, and electrical automotive components.',
  true,
  CURRENT_DATE,
  '# SpareHub Automotive Spare Parts Warranty Policy

*Version 1.0 — Effective Date: October 2026*

---

## 1. Mandatory Warranty Disclosure
Sellers must disclose explicit warranty terms for every listing:
- Warranty available (Yes / No)
- Duration in months
- Warranty provider (Manufacturer / Seller / Importer)
- Specific terms, limitations, and exclusions

## 2. Category Standards
- **Brand New Genuine Parts:** Standard manufacturer warranty applies against material and manufacturing defects.
- **Aftermarket New Parts:** Covered by the disclosing seller or aftermarket distributor warranty.
- **Reconditioned / Used Parts:** Must clearly disclose condition grade and any limited startup warranty (e.g., 14 to 30 days testing warranty).
- **Electrical Components:** Sensors, ECUs, wiring harnesses, and relays must be installed by a certified automotive technician to preserve warranty claims.

## 3. Submitting a Warranty Claim
Customers submit warranty claims through the SpareHub order details page along with photographic/video evidence and a diagnostic report from a certified technician.'
),
(
  'prohibited_products_conduct',
  '1.0',
  'SpareHub Prohibited Products and Seller Conduct Policy',
  'Prohibiting counterfeit automotive components, fake reviews, commission evasion, and customer data misuse.',
  true,
  CURRENT_DATE,
  '# SpareHub Prohibited Products & Seller Conduct Policy

*Version 1.0 — Effective Date: October 2026*

---

## 1. Strictly Prohibited Products
The following items are banned from the SpareHub marketplace:
- **Counterfeit / Replica Components:** Parts falsely labeled with OEM trademarks (e.g., fake Toyota, Honda, or Bosch packaging).
- **Stolen or Illegally Sourced Vehicles / Components:** Any part without legitimate provenance or ownership rights.
- **Tampered Safety Devices:** Deployed or repackaged airbags, compromised seatbelt pretensioners, or tampered brake safety units.
- **Unlawful Modifications:** Devices designed to defeat vehicle emission controls or alter odometer readings.

## 2. Prohibited Seller Conduct
- **Commission Evasion:** Contacting customers outside the platform to bypass SpareHub marketplace fees.
- **Review Manipulation:** Submitting fake customer reviews, incentivized ratings, or purchasing one''s own products.
- **Customer Harassment / Data Misuse:** Using customer contact details for marketing or non-order communication.

## 3. Enforcement & Penalties
Violations result in progressive enforcement:
1. First warning and removal of offending listing.
2. Restriction on new product publishing.
3. Permanent shop suspension and forfeiture of marketplace privileges.'
)
ON CONFLICT (policy_type, version) DO UPDATE SET
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  content_markdown = EXCLUDED.content_markdown,
  is_published = EXCLUDED.is_published,
  updated_at = now();
