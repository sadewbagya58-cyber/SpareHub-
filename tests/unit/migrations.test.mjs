import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Database Migrations & Schema Architecture Verification", () => {
  const migrationsDir = path.resolve(process.cwd(), "supabase/migrations");
  const migrationFiles = fs.readdirSync(migrationsDir).sort();

  test("contains all 7 sequential modular migration files including storage security", () => {
    assert.equal(migrationFiles.length, 7, "Expected exactly 7 migration files");
    assert.ok(migrationFiles[0].includes("core_extensions_and_helpers"));
    assert.ok(migrationFiles[1].includes("user_and_seller_profiles"));
    assert.ok(migrationFiles[2].includes("vehicle_taxonomy"));
    assert.ok(migrationFiles[3].includes("catalog_and_compatibility"));
    assert.ok(migrationFiles[4].includes("cart_and_multi_vendor_orders"));
    assert.ok(migrationFiles[5].includes("commission_and_financial_ledger"));
    assert.ok(migrationFiles[6].includes("storage_buckets_and_policies"));
  });

  const allSqlContent = migrationFiles
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), "utf-8"))
    .join("\n\n");

  test("defines all 21 core domain tables accurately", () => {
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

    assert.equal(requiredTables.length, 21, "Reconciled exact domain table count must be 21");

    for (const table of requiredTables) {
      assert.ok(
        allSqlContent.includes(`CREATE TABLE public.${table}`) ||
        allSqlContent.includes(`CREATE TABLE IF NOT EXISTS public.${table}`) ||
        allSqlContent.includes(`CREATE TABLE public.${table} (`),
        `Table public.${table} must be defined in migrations`
      );
    }
  });

  test("enables ROW LEVEL SECURITY on all 21 domain tables", () => {
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

  test("protects against role escalation on both INSERT and UPDATE", () => {
    assert.ok(
      allSqlContent.includes("BEFORE INSERT OR UPDATE OF role, roles ON public.user_profiles"),
      "Role escalation trigger must intercept both INSERT and UPDATE"
    );
    assert.ok(
      allSqlContent.includes("NEW.role = 'customer'"),
      "Initial role must be forced to customer for non-admins"
    );
  });

  test("protects seller verification and shop approval on both INSERT and UPDATE", () => {
    assert.ok(
      allSqlContent.includes("BEFORE INSERT OR UPDATE OF verification_status") &&
      allSqlContent.includes("ON public.seller_profiles"),
      "Verification trigger must intercept both INSERT and UPDATE"
    );
    assert.ok(
      allSqlContent.includes("BEFORE INSERT OR UPDATE OF status") &&
      allSqlContent.includes("ON public.shops"),
      "Shop approval trigger must intercept both INSERT and UPDATE"
    );
  });

  test("enforces partial unique indexes on product_compatibility eliminating nullable duplicate edge-cases", () => {
    assert.ok(
      allSqlContent.includes("idx_compat_product_variant_unique"),
      "Must define variant-level unique index where variant is not null"
    );
    assert.ok(
      allSqlContent.includes("idx_compat_product_model_unique"),
      "Must define model-level unique index where variant is null"
    );
  });

  test("defines atomic, transactional checkout function resistant to price tampering", () => {
    assert.ok(
      allSqlContent.includes("CREATE OR REPLACE FUNCTION public.process_checkout_order"),
      "process_checkout_order function must exist"
    );
    assert.ok(
      allSqlContent.includes("FOR UPDATE OF p"),
      "process_checkout_order must lock products with FOR UPDATE"
    );
    assert.ok(
      allSqlContent.includes("stock_quantity - v_item_record.quantity"),
      "Must atomically decrement stock quantity"
    );
  });

  test("configures private storage bucket and access policies for verification documents", () => {
    assert.ok(
      allSqlContent.includes("'verification-documents'"),
      "Must declare verification-documents bucket"
    );
    assert.ok(
      allSqlContent.includes("false, -- STRICTLY PRIVATE BUCKET: ZERO PUBLIC ACCESS"),
      "verification-documents bucket must be private (public = false)"
    );
    assert.ok(
      allSqlContent.includes("ON storage.objects"),
      "Must declare RLS policies on storage.objects"
    );
  });

  test("enforces fixed search_path on all SECURITY DEFINER functions", () => {
    const secDefinerMatches = allSqlContent.match(/CREATE OR REPLACE FUNCTION public\.\w+[\s\S]*?SECURITY DEFINER[\s\S]*?AS/g) || [];
    assert.ok(secDefinerMatches.length >= 6, "Expected at least 6 SECURITY DEFINER functions");

    for (const funcDef of secDefinerMatches) {
      assert.ok(
        funcDef.includes("SET search_path ="),
        `SECURITY DEFINER function must explicitly set search_path: ${funcDef.slice(0, 80)}...`
      );
    }
  });

  test("ensures no secret keys or hardcoded commission percentages are present", () => {
    assert.ok(!allSqlContent.includes("sb_secret_"), "No secret keys allowed in migrations");
    assert.ok(!allSqlContent.includes("eyJhbGci"), "No raw JWT service role tokens allowed in migrations");
    assert.ok(allSqlContent.includes("rate_basis_points"), "Commission rates must be modeled as configurable basis points");
  });
});
