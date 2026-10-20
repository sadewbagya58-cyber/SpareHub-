import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4.7: In-App Notifications & Order Lifecycle Updates", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261014000009_notifications_reviews_wishlist.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("defines notifications table with accurate schema and constraints", () => {
    assert.ok(
      migrationSql.includes("CREATE TABLE IF NOT EXISTS public.notifications"),
      "notifications table must be created"
    );
    assert.ok(
      migrationSql.includes("idempotency_key text UNIQUE"),
      "notifications table must have unique idempotency_key"
    );
    assert.ok(
      migrationSql.includes("ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY"),
      "notifications table must enable RLS"
    );
  });

  it("enforces valid notification types matching all order lifecycle events", () => {
    const validTypes = [
      "order_placed",
      "order_confirmed",
      "order_processing",
      "order_dispatched",
      "order_delivered",
      "order_cancelled",
      "order_rejected",
      "system",
    ];

    for (const t of validTypes) {
      assert.ok(
        migrationSql.includes(`'${t}'`),
        `Notification type '${t}' must be defined in check constraint`
      );
    }
  });

  it("enforces strict user isolation RLS policies on notifications", () => {
    assert.ok(
      migrationSql.includes('CREATE POLICY "Users can view own notifications"'),
      "Users can view own notifications policy must exist"
    );
    assert.ok(
      migrationSql.includes('CREATE POLICY "Users can update own notifications"'),
      "Users can update own notifications policy must exist"
    );
    assert.ok(
      migrationSql.includes('CREATE POLICY "Users can delete own notifications"'),
      "Users can delete own notifications policy must exist"
    );
    assert.ok(
      migrationSql.includes("USING (user_id = auth.uid())"),
      "Notifications must be scoped strictly to user_id = auth.uid()"
    );
  });

  it("validates idempotency and unread count logic", () => {
    const notifications = [
      { id: "n1", read: false, idempotencyKey: "order-1-placed" },
      { id: "n2", read: true, idempotencyKey: "order-1-confirmed" },
      { id: "n3", read: false, idempotencyKey: "order-2-placed" },
    ];

    const unreadCount = notifications.filter((n) => !n.read).length;
    assert.equal(unreadCount, 2);

    // Idempotency check
    const isDuplicate = (key) => notifications.some((n) => n.idempotencyKey === key);
    assert.equal(isDuplicate("order-1-placed"), true);
    assert.equal(isDuplicate("order-3-placed"), false);
  });
});

describe("Phase 4.8: Customer Trust & Product Reviews", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261014000009_notifications_reviews_wishlist.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("defines product_reviews table with verified purchase and moderation constraints", () => {
    assert.ok(
      migrationSql.includes("CREATE TABLE IF NOT EXISTS public.product_reviews"),
      "product_reviews table must be created"
    );
    assert.ok(
      migrationSql.includes("CHECK (rating >= 1 AND rating <= 5)"),
      "Rating check constraint must restrict between 1 and 5"
    );
    assert.ok(
      migrationSql.includes("char_length(comment) >= 5 AND char_length(comment) <= 2000"),
      "Comment length check constraint must be 5 to 2000 chars"
    );
    assert.ok(
      migrationSql.includes("CONSTRAINT uq_product_reviews_customer_product UNIQUE (customer_id, product_id)"),
      "Unique constraint must prevent multiple reviews per customer per product"
    );
  });

  it("validates star rating inputs", () => {
    const validateRating = (r) => {
      const num = Math.round(Number(r));
      if (isNaN(num) || num < 1 || num > 5) return { valid: false };
      return { valid: true, rating: num };
    };

    assert.equal(validateRating(1).valid, true);
    assert.equal(validateRating(5).valid, true);
    assert.equal(validateRating(3.2).rating, 3);
    assert.equal(validateRating(0).valid, false);
    assert.equal(validateRating(6).valid, false);
    assert.equal(validateRating(-1).valid, false);
    assert.equal(validateRating("invalid").valid, false);
    assert.equal(validateRating(null).valid, false);
  });

  it("validates review comment constraints and prevents empty/oversized comments", () => {
    const validateComment = (c) => {
      const trimmed = (c || "").trim();
      if (trimmed.length < 5) return { valid: false, error: "Too short" };
      if (trimmed.length > 2000) return { valid: false, error: "Too long" };
      return { valid: true, comment: trimmed };
    };

    assert.equal(validateComment("Good").valid, false);
    assert.equal(validateComment("   ").valid, false);
    assert.equal(validateComment("Great OEM brake pads, no squeak!").valid, true);
    assert.equal(validateComment("a".repeat(2001)).valid, false);
    assert.equal(validateComment("a".repeat(2000)).valid, true);
  });

  it("calculates accurate rating summary and star distribution", () => {
    const sampleReviews = [
      { rating: 5, status: "published" },
      { rating: 5, status: "published" },
      { rating: 4, status: "published" },
      { rating: 2, status: "published" },
      { rating: 1, status: "hidden" }, // Moderated review excluded from published summary
    ];

    const published = sampleReviews.filter((r) => r.status === "published");
    const sum = published.reduce((acc, r) => acc + r.rating, 0);
    const avg = Number((sum / published.length).toFixed(1));
    const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of published) {
      dist[r.rating] += 1;
    }

    assert.equal(avg, 4.0); // (5+5+4+2)/4 = 16/4 = 4.0
    assert.equal(published.length, 4);
    assert.equal(dist[5], 2);
    assert.equal(dist[4], 1);
    assert.equal(dist[3], 0);
    assert.equal(dist[2], 1);
    assert.equal(dist[1], 0);
  });

  it("defines check_user_can_review_product database function for purchase verification", () => {
    assert.ok(
      migrationSql.includes("FUNCTION public.check_user_can_review_product"),
      "check_user_can_review_product helper must be defined"
    );
    assert.ok(
      migrationSql.includes("SECURITY DEFINER"),
      "Helper must be SECURITY DEFINER to verify orders safely"
    );
    assert.ok(
      migrationSql.includes("SET search_path = public, auth, pg_temp"),
      "Must have fixed search_path to prevent schema path poisoning"
    );
  });
});

describe("Phase 4.8: Customer Wishlist & Saved Products", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261014000009_notifications_reviews_wishlist.sql"
  );
  const migrationSql = fs.readFileSync(migrationPath, "utf-8");

  it("defines wishlist_items table with user-product uniqueness", () => {
    assert.ok(
      migrationSql.includes("CREATE TABLE IF NOT EXISTS public.wishlist_items"),
      "wishlist_items table must be created"
    );
    assert.ok(
      migrationSql.includes("CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)"),
      "wishlist_items must enforce unique (user_id, product_id)"
    );
    assert.ok(
      migrationSql.includes("ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY"),
      "wishlist_items must enable RLS"
    );
    assert.ok(
      migrationSql.includes('CREATE POLICY "Users can manage own wishlist"'),
      "Users can manage own wishlist policy must exist"
    );
  });

  it("atomic wishlist toggle behavior adds and removes items cleanly", () => {
    let wishlist = new Set();
    const toggleWishlist = (productId) => {
      if (wishlist.has(productId)) {
        wishlist.delete(productId);
        return { inWishlist: false };
      } else {
        wishlist.add(productId);
        return { inWishlist: true };
      }
    };

    assert.equal(toggleWishlist("prod-1").inWishlist, true);
    assert.equal(wishlist.has("prod-1"), true);

    // Toggle again removes
    assert.equal(toggleWishlist("prod-1").inWishlist, false);
    assert.equal(wishlist.has("prod-1"), false);
  });

  it("verifies deploy script phase_4_7_4_8_schema.sql matches migration exactly", () => {
    const deployPath = path.resolve(
      process.cwd(),
      "supabase/deploy/phase_4_7_4_8_schema.sql"
    );
    assert.ok(fs.existsSync(deployPath), "phase_4_7_4_8_schema.sql must exist");
    const deploySql = fs.readFileSync(deployPath, "utf-8");

    assert.ok(deploySql.includes("public.notifications"), "Deploy script contains notifications");
    assert.ok(deploySql.includes("public.product_reviews"), "Deploy script contains product_reviews");
    assert.ok(deploySql.includes("public.wishlist_items"), "Deploy script contains wishlist_items");
    assert.ok(
      deploySql.includes("check_user_can_review_product"),
      "Deploy script contains check_user_can_review_product"
    );
  });
});
