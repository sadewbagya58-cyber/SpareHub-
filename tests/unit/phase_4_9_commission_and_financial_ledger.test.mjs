import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4.9: Configurable Commission Engine Schema & Migration Verification", () => {
  const schemaMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261014000006_commission_and_financial_ledger.sql"
  );
  const engineMigrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261014000010_commission_engine_and_settlement.sql"
  );
  const deployScriptPath = path.resolve(
    process.cwd(),
    "supabase/deploy/phase_4_9_commission_ledger.sql"
  );

  const schemaMigrationSql = fs.readFileSync(schemaMigrationPath, "utf-8");
  const engineMigrationSql = fs.readFileSync(engineMigrationPath, "utf-8");
  const deploySql = fs.readFileSync(deployScriptPath, "utf-8");

  it("defines commission_rules table with all required columns and constraints", () => {
    assert.ok(
      schemaMigrationSql.includes("CREATE TABLE IF NOT EXISTS public.commission_rules"),
      "commission_rules table must be created in schema migration"
    );
    assert.ok(
      schemaMigrationSql.includes("rule_type text NOT NULL"),
      "commission_rules must define rule_type"
    );
    assert.ok(
      schemaMigrationSql.includes("rate_basis_points int NOT NULL"),
      "commission_rules must store rate in basis points integer"
    );
    assert.ok(
      schemaMigrationSql.includes("CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000)"),
      "commission_rules must constrain rate between 0 and 10000 basis points (0% - 100%)"
    );
    assert.ok(
      schemaMigrationSql.includes("CHECK (rule_type IN ('platform_default', 'category_override', 'shop_override'))"),
      "commission_rules must strictly enforce rule types"
    );
  });

  it("defines commission_ledger table with immutable order_item_id unique constraint", () => {
    assert.ok(
      schemaMigrationSql.includes("CREATE TABLE IF NOT EXISTS public.commission_ledger"),
      "commission_ledger table must be created"
    );
    assert.ok(
      schemaMigrationSql.includes("order_item_id uuid NOT NULL UNIQUE"),
      "order_item_id must be UNIQUE in commission_ledger for strict 1:1 immutability"
    );
    assert.ok(
      schemaMigrationSql.includes("item_subtotal_minor bigint NOT NULL"),
      "commission_ledger must record item_subtotal_minor"
    );
    assert.ok(
      schemaMigrationSql.includes("commission_amount_minor bigint NOT NULL"),
      "commission_ledger must record commission_amount_minor"
    );
    assert.ok(
      schemaMigrationSql.includes("seller_net_earning_minor bigint NOT NULL"),
      "commission_ledger must record seller_net_earning_minor"
    );
    assert.ok(
      schemaMigrationSql.includes(
        "CHECK (status IN ('accrued', 'earned', 'cancelled', 'refunded', 'settled'))"
      ),
      "commission_ledger must strictly validate ledger statuses"
    );
  });

  it("enforces Row Level Security and configures administrative and seller policies", () => {
    assert.ok(
      schemaMigrationSql.includes("ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY"),
      "RLS must be enabled on commission_rules"
    );
    assert.ok(
      schemaMigrationSql.includes("ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY"),
      "RLS must be enabled on commission_ledger"
    );
    assert.ok(
      schemaMigrationSql.includes('CREATE POLICY "Admin full management commission_rules"'),
      "Platform admin full access policy on commission_rules must exist"
    );
    assert.ok(
      schemaMigrationSql.includes('CREATE POLICY "Sellers can view own shop earnings ledger"'),
      "Sellers must be restricted to viewing only their own shop ledger records"
    );
  });

  it("defines resolve_effective_commission_rule function with search_path security", () => {
    assert.ok(
      engineMigrationSql.includes("CREATE OR REPLACE FUNCTION public.resolve_effective_commission_rule"),
      "resolve_effective_commission_rule function must be defined in engine migration"
    );
    assert.ok(
      engineMigrationSql.includes("SET search_path = public, pg_temp"),
      "SECURITY DEFINER function must protect search_path"
    );
  });

  it("implements automated triggers for order item accrual and seller order reconciliation", () => {
    assert.ok(
      engineMigrationSql.includes("CREATE TRIGGER trg_accrue_order_item_commission"),
      "trg_accrue_order_item_commission trigger must be attached to order_items"
    );
    assert.ok(
      engineMigrationSql.includes("CREATE TRIGGER trg_reconcile_seller_order_commission_status"),
      "trg_reconcile_seller_order_commission_status trigger must be attached to seller_orders"
    );
  });

  it("ensures deployment script contains comprehensive verification queries", () => {
    assert.ok(
      deploySql.includes("VERIFICATION QUERIES"),
      "Deployment script must have verification queries"
    );
    assert.ok(
      deploySql.includes("FROM public.commission_rules"),
      "Verification must check commission_rules"
    );
    assert.ok(
      deploySql.includes("FROM public.commission_ledger"),
      "Verification must check commission_ledger"
    );
  });
});

describe("Phase 4.9: Priority Rule Resolution Hierarchy Simulation", () => {
  // Simulates the SQL resolve_effective_commission_rule prioritized lookup
  function resolveEffectiveRule({ shopId, categoryId, rules }) {
    const activeRules = rules.filter((r) => r.is_active);

    // 1. Shop override
    if (shopId) {
      const shopRule = activeRules.find(
        (r) => r.rule_type === "shop_override" && r.scope_id === shopId
      );
      if (shopRule) return shopRule;
    }

    // 2. Category override
    if (categoryId) {
      const categoryRule = activeRules.find(
        (r) => r.rule_type === "category_override" && r.scope_id === categoryId
      );
      if (categoryRule) return categoryRule;
    }

    // 3. Platform default
    const platformDefault = activeRules.find((r) => r.rule_type === "platform_default");
    if (platformDefault) return platformDefault;

    // 4. Hard fallback
    return {
      id: null,
      rule_type: "platform_default",
      rate_basis_points: 0,
      name: "Zero fallback",
    };
  }

  const mockRules = [
    {
      id: "rule-default",
      rule_type: "platform_default",
      scope_id: null,
      rate_basis_points: 500, // 5.00%
      name: "Default Platform Commission (5%)",
      is_active: true,
    },
    {
      id: "rule-cat-engines",
      rule_type: "category_override",
      scope_id: "cat-engines-uuid",
      rate_basis_points: 700, // 7.00%
      name: "Engine Parts Override (7%)",
      is_active: true,
    },
    {
      id: "rule-shop-vip",
      rule_type: "shop_override",
      scope_id: "shop-colombo-motors-uuid",
      rate_basis_points: 350, // 3.50%
      name: "Colombo Motors Partner Rate (3.5%)",
      is_active: true,
    },
    {
      id: "rule-shop-inactive",
      rule_type: "shop_override",
      scope_id: "shop-inactive-uuid",
      rate_basis_points: 200,
      name: "Inactive Discount",
      is_active: false,
    },
  ];

  it("prioritizes shop override above category override and platform default", () => {
    const resolved = resolveEffectiveRule({
      shopId: "shop-colombo-motors-uuid",
      categoryId: "cat-engines-uuid",
      rules: mockRules,
    });

    assert.equal(resolved.id, "rule-shop-vip");
    assert.equal(resolved.rate_basis_points, 350);
    assert.equal(resolved.rule_type, "shop_override");
  });

  it("prioritizes category override when no shop override matches", () => {
    const resolved = resolveEffectiveRule({
      shopId: "shop-regular-uuid",
      categoryId: "cat-engines-uuid",
      rules: mockRules,
    });

    assert.equal(resolved.id, "rule-cat-engines");
    assert.equal(resolved.rate_basis_points, 700);
    assert.equal(resolved.rule_type, "category_override");
  });

  it("falls back to platform default when neither shop nor category overrides match", () => {
    const resolved = resolveEffectiveRule({
      shopId: "shop-regular-uuid",
      categoryId: "cat-brakes-uuid",
      rules: mockRules,
    });

    assert.equal(resolved.id, "rule-default");
    assert.equal(resolved.rate_basis_points, 500);
    assert.equal(resolved.rule_type, "platform_default");
  });

  it("ignores inactive overrides and falls back to platform default", () => {
    const resolved = resolveEffectiveRule({
      shopId: "shop-inactive-uuid",
      categoryId: "cat-brakes-uuid",
      rules: mockRules,
    });

    assert.equal(resolved.id, "rule-default");
    assert.equal(resolved.rate_basis_points, 500);
  });

  it("falls back to zero bps if all rules are inactive or absent", () => {
    const resolved = resolveEffectiveRule({
      shopId: "some-shop",
      categoryId: "some-cat",
      rules: [],
    });

    assert.equal(resolved.id, null);
    assert.equal(resolved.rate_basis_points, 0);
  });
});

describe("Phase 4.9: Financial Ledger Math & Basis Points Calculations", () => {
  function calculateCommissionAndNet(subtotalCents, rateBasisPoints) {
    if (subtotalCents < 0) throw new Error("Subtotal cannot be negative");
    if (rateBasisPoints < 0 || rateBasisPoints > 10000) {
      throw new Error("Rate basis points must be between 0 and 10000");
    }

    const commissionCents = Math.round((subtotalCents * rateBasisPoints) / 10000);
    const netEarningsCents = subtotalCents - commissionCents;

    return {
      subtotalCents,
      rateBasisPoints,
      commissionCents,
      netEarningsCents,
    };
  }

  it("calculates accurate 5.00% (500 bps) commission on LKR 10,000.00 (1,000,000 cents)", () => {
    const res = calculateCommissionAndNet(1000000, 500);
    assert.equal(res.commissionCents, 50000); // LKR 500.00
    assert.equal(res.netEarningsCents, 950000); // LKR 9,500.00
    assert.equal(res.commissionCents + res.netEarningsCents, res.subtotalCents);
  });

  it("calculates accurate 7.50% (750 bps) commission on LKR 3,550.00 (355,000 cents)", () => {
    const res = calculateCommissionAndNet(355000, 750);
    assert.equal(res.commissionCents, 26625); // LKR 266.25
    assert.equal(res.netEarningsCents, 328375); // LKR 3,283.75
    assert.equal(res.commissionCents + res.netEarningsCents, res.subtotalCents);
  });

  it("handles 0.00% (0 bps) commission cleanly with zero platform cut", () => {
    const res = calculateCommissionAndNet(5000000, 0);
    assert.equal(res.commissionCents, 0);
    assert.equal(res.netEarningsCents, 5000000);
  });

  it("handles 100.00% (10000 bps) commission cleanly with 100% platform cut", () => {
    const res = calculateCommissionAndNet(100000, 10000);
    assert.equal(res.commissionCents, 100000);
    assert.equal(res.netEarningsCents, 0);
  });

  it("properly rounds fractional cents without precision drift", () => {
    // 333 cents at 500 bps (5%) -> 16.65 cents -> rounds to 17 cents
    const res = calculateCommissionAndNet(333, 500);
    assert.equal(res.commissionCents, 17);
    assert.equal(res.netEarningsCents, 316);
    assert.equal(res.commissionCents + res.netEarningsCents, 333);
  });

  it("rejects invalid rate bounds outside 0 to 10000 bps", () => {
    assert.throws(() => calculateCommissionAndNet(100000, -100), /Rate basis points/);
    assert.throws(() => calculateCommissionAndNet(100000, 10001), /Rate basis points/);
  });
});

describe("Phase 4.9: Seller Earnings Aggregation & Settlement Lifecycle", () => {
  const ledgerEntries = [
    {
      id: "l1",
      subtotalCents: 1000000, // LKR 10,000
      commissionCents: 50000, // LKR 500
      netEarningsCents: 950000, // LKR 9,500
      status: "earned",
    },
    {
      id: "l2",
      subtotalCents: 2000000, // LKR 20,000
      commissionCents: 100000, // LKR 1,000
      netEarningsCents: 1900000, // LKR 19,000
      status: "accrued", // In transit / awaiting delivery
    },
    {
      id: "l3",
      subtotalCents: 500000, // LKR 5,000
      commissionCents: 25000, // LKR 250
      netEarningsCents: 475000, // LKR 4,750
      status: "settled", // Paid out
    },
    {
      id: "l4",
      subtotalCents: 800000, // LKR 8,000
      commissionCents: 40000, // LKR 400
      netEarningsCents: 760000, // LKR 7,600
      status: "cancelled", // Order cancelled
    },
  ];

  function aggregateSellerEarnings(entries) {
    let grossSales = 0;
    let platformCommission = 0;
    let netEarnings = 0;
    let availableBalance = 0;
    let pendingClearance = 0;
    let settledPayouts = 0;

    for (const e of entries) {
      if (e.status === "cancelled" || e.status === "refunded") {
        continue;
      }
      grossSales += e.subtotalCents;
      platformCommission += e.commissionCents;
      netEarnings += e.netEarningsCents;

      if (e.status === "earned") {
        availableBalance += e.netEarningsCents;
      } else if (e.status === "accrued") {
        pendingClearance += e.netEarningsCents;
      } else if (e.status === "settled") {
        settledPayouts += e.netEarningsCents;
      }
    }

    return {
      grossSales,
      platformCommission,
      netEarnings,
      availableBalance,
      pendingClearance,
      settledPayouts,
    };
  }

  it("accurately aggregates gross, commission, and net excluding cancelled/refunded", () => {
    const summary = aggregateSellerEarnings(ledgerEntries);

    // Sum of l1, l2, l3 (l4 is cancelled)
    assert.equal(summary.grossSales, 1000000 + 2000000 + 500000); // 3,500,000 cents (LKR 35,000)
    assert.equal(summary.platformCommission, 50000 + 100000 + 25000); // 175,000 cents (LKR 1,750)
    assert.equal(summary.netEarnings, 950000 + 1900000 + 475000); // 3,325,000 cents (LKR 33,250)
  });

  it("accurately categorizes balances between available, pending, and settled", () => {
    const summary = aggregateSellerEarnings(ledgerEntries);

    assert.equal(summary.availableBalance, 950000); // LKR 9,500 (from 'earned')
    assert.equal(summary.pendingClearance, 1900000); // LKR 19,000 (from 'accrued')
    assert.equal(summary.settledPayouts, 475000); // LKR 4,750 (from 'settled')
    assert.equal(
      summary.availableBalance + summary.pendingClearance + summary.settledPayouts,
      summary.netEarnings
    );
  });

  it("transitions status safely through the order lifecycle", () => {
    const transitionLifecycle = (currentStatus, newOrderStatus) => {
      if (currentStatus === "settled") {
        // Once settled, payouts are finalized
        return currentStatus;
      }
      if (newOrderStatus === "delivered") return "earned";
      if (newOrderStatus === "cancelled") return "cancelled";
      if (newOrderStatus === "returned") return "refunded";
      return currentStatus;
    };

    assert.equal(transitionLifecycle("accrued", "delivered"), "earned");
    assert.equal(transitionLifecycle("accrued", "cancelled"), "cancelled");
    assert.equal(transitionLifecycle("accrued", "returned"), "refunded");
    assert.equal(transitionLifecycle("earned", "returned"), "refunded");
    // Settled cannot be silently reverted to cancelled
    assert.equal(transitionLifecycle("settled", "cancelled"), "settled");
  });
});
