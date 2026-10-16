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

  test("enforces shops RLS policies using direct seller profile ownership", () => {
    assert.ok(
      allSqlContent.includes("public.owns_seller_profile(seller_profile_id)"),
      "Shops RLS policies must evaluate ownership via owns_seller_profile(seller_profile_id)"
    );
    assert.ok(
      allSqlContent.includes("CREATE POLICY \"Public can view active shops\""),
      "Public must be able to view active shops (status != 'suspended')"
    );
  });

  test("seeds 4-level Sri Lankan vehicle taxonomy (types, makes, models, variants) and enforces compatibility hierarchy trigger", () => {
    assert.ok(
      allSqlContent.includes("INSERT INTO public.vehicle_makes"),
      "Must seed vehicle_makes"
    );
    assert.ok(
      allSqlContent.includes("INSERT INTO public.vehicle_models"),
      "Must seed vehicle_models"
    );
    assert.ok(
      allSqlContent.includes("INSERT INTO public.vehicle_variants"),
      "Must seed vehicle_variants"
    );
    assert.ok(
      allSqlContent.includes("CREATE OR REPLACE FUNCTION public.validate_product_compatibility_hierarchy()"),
      "Must define validate_product_compatibility_hierarchy trigger function"
    );
    assert.ok(
      allSqlContent.includes("CREATE TRIGGER trg_validate_product_compatibility_hierarchy"),
      "Must attach trg_validate_product_compatibility_hierarchy to product_compatibility"
    );
  });

  test("enforces all taxonomy UUIDs in migrations and deployment scripts are strictly valid hex UUIDs", () => {
    const deployDir = path.resolve(process.cwd(), "supabase/deploy");
    const sqlFiles = [
      ...migrationFiles.map((f) => path.join(migrationsDir, f)),
      path.join(deployDir, "sparehub_complete_schema.sql"),
      path.join(deployDir, "phase_4_3_vehicle_compatibility.sql"),
    ];

    const uuidRegex = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;
    const invalidPrefixRegex = /\b[g-zG-Z][0-9a-zA-Z]{7}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{4}-[0-9a-zA-Z]{12}\b/g;

    for (const filePath of sqlFiles) {
      if (!fs.existsSync(filePath)) continue;
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        !content.includes("m1000000-"),
        `File ${path.basename(filePath)} must not contain non-hex make UUID prefix m1000000-`
      );
      assert.ok(
        !content.includes("v1000000-"),
        `File ${path.basename(filePath)} must not contain non-hex variant UUID prefix v1000000-`
      );

      const invalidMatches = content.match(invalidPrefixRegex) || [];
      assert.deepEqual(
        invalidMatches,
        [],
        `File ${path.basename(filePath)} contains invalid non-hex UUIDs: ${invalidMatches.join(", ")}`
      );

      // Verify files that seed vehicle taxonomy contain strictly valid hex UUIDs
      if (
        filePath.includes("vehicle_taxonomy") ||
        filePath.includes("phase_4_3") ||
        filePath.includes("sparehub_complete_schema")
      ) {
        const validMatches = content.match(uuidRegex) || [];
        assert.ok(
          validMatches.length > 0,
          `File ${path.basename(filePath)} should contain valid hex UUIDs`
        );
      }
    }
  });

  test("ensures vehicle taxonomy seeding statements use resilient foreign-key JOINs protecting against ID drift", () => {
    const taxonomyMigrationPath = path.join(migrationsDir, "20261014000003_vehicle_taxonomy.sql");
    const content = fs.readFileSync(taxonomyMigrationPath, "utf-8");

    assert.ok(
      content.includes("JOIN public.vehicle_makes m") &&
      content.includes("m.id = v.make_id::uuid"),
      "vehicle_models seed must join vehicle_makes to dynamically resolve foreign keys"
    );

    assert.ok(
      content.includes("JOIN public.vehicle_models md") &&
      content.includes("md.id = v.model_id::uuid"),
      "vehicle_variants seed must join vehicle_models to dynamically resolve foreign keys"
    );
  });

  test("includes Section 4 taxonomy verification query in phase_4_3 deployment script", () => {
    const deployScriptPath = path.resolve(process.cwd(), "supabase/deploy/phase_4_3_vehicle_compatibility.sql");
    const content = fs.readFileSync(deployScriptPath, "utf-8");

    assert.ok(
      content.includes("SELECT COUNT(*) FROM public.vehicle_types") &&
      content.includes("SELECT COUNT(*) FROM public.vehicle_makes") &&
      content.includes("SELECT COUNT(*) FROM public.vehicle_models") &&
      content.includes("SELECT COUNT(*) FROM public.vehicle_variants"),
      "Deployment script must include Section 4 verification query for taxonomy counts"
    );
  });
});

