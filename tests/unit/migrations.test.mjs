import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Database Migrations & Schema Architecture Verification", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const migrationFiles = fs.readdirSync(migrationsDir).sort();

  test("contains all 6 sequential modular migration files", () => {
    assert.equal(migrationFiles.length, 6, "Expected 6 migration files");
    assert.ok(migrationFiles[0].includes("core_extensions_and_helpers"));
    assert.ok(migrationFiles[1].includes("user_and_seller_profiles"));
    assert.ok(migrationFiles[2].includes("vehicle_taxonomy"));
    assert.ok(migrationFiles[3].includes("catalog_and_compatibility"));
    assert.ok(migrationFiles[4].includes("cart_and_multi_vendor_orders"));
    assert.ok(migrationFiles[5].includes("commission_and_financial_ledger"));
  });

  const allSqlContent = migrationFiles
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf-8"))
    .join("\n\n");

  test("defines all 18 core domain tables", () => {
    const requiredTables = [
      "user_profiles",
      "seller_profiles",
      "shops",
      "seller_documents",
      "vehicle_types",
      "vehicle_makes",
      "vehicle_models",
      "vehicle_variants",
      "categories",
      "products",
      "product_images",
      "product_compatibility",
      "cart_items",
      "customer_orders",
      "seller_orders",
      "order_items",
      "order_status_history",
      "commission_rules",
      "commission_ledger",
      "payment_records",
      "admin_audit_logs",
    ];

    for (const table of requiredTables) {
      assert.ok(
        allSqlContent.includes(`CREATE TABLE public.${table}`) ||
        allSqlContent.includes(`CREATE TABLE public.${table} (`),
        `Table public.${table} must be defined in migrations`
      );
    }
  });

  test("enables ROW LEVEL SECURITY on all domain tables", () => {
    const requiredRlsTables = [
      "user_profiles",
      "seller_profiles",
      "shops",
      "seller_documents",
      "vehicle_types",
      "vehicle_makes",
      "vehicle_models",
      "vehicle_variants",
      "categories",
      "products",
      "product_images",
      "product_compatibility",
      "cart_items",
      "customer_orders",
      "seller_orders",
      "order_items",
      "order_status_history",
      "commission_rules",
      "commission_ledger",
      "payment_records",
      "admin_audit_logs",
    ];

    for (const table of requiredRlsTables) {
      assert.ok(
        allSqlContent.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`),
        `Row Level Security must be explicitly enabled for public.${table}`
      );
    }
  });

  test("enforces non-negative constraints on price and stock quantities", () => {
    assert.ok(
      allSqlContent.includes("CHECK (price_minor_units >= 0)"),
      "Products table must prohibit negative price"
    );
    assert.ok(
      allSqlContent.includes("CHECK (stock_quantity >= 0)"),
      "Products table must prohibit negative inventory"
    );
  });

  test("enforces fixed search_path on all SECURITY DEFINER functions", () => {
    // Regular expression matching functions declared with SECURITY DEFINER
    const secDefinerMatches = allSqlContent.match(/CREATE OR REPLACE FUNCTION public\.\w+[\s\S]*?SECURITY DEFINER[\s\S]*?AS/g) || [];
    assert.ok(secDefinerMatches.length >= 4, "Expected multiple SECURITY DEFINER functions");

    for (const funcDef of secDefinerMatches) {
      assert.ok(
        funcDef.includes("SET search_path ="),
        `SECURITY DEFINER function must explicitly set search_path to prevent hijacking: ${funcDef.slice(0, 80)}...`
      );
    }
  });

  test("ensures no secret keys or hardcoded commission percentages are present", () => {
    assert.ok(!allSqlContent.includes("sb_secret_"), "No secret keys allowed in migrations");
    assert.ok(!allSqlContent.includes("service_role"), "No raw service role tokens allowed in migrations");
    // Verify commission rate is configurable and not hardcoded
    assert.ok(allSqlContent.includes("rate_basis_points"), "Commission rates must be modeled as configurable basis points");
  });
});
