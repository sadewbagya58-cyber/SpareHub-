# SPAREHUB — MASTER ARCHITECTURE & IMPLEMENTATION PLAN
**Every Part. One Marketplace.**

---

## 1. WORKSPACE ASSESSMENT

- **Workspace Path:** `C:\Users\x\SpareHub`
- **Assessment Finding:** **Option A — Empty Workspace**
- **Inspection Details & Evidence:**
  - Directory contents check: 0 files, 0 folders.
  - Git repository status: Not initialized (`fatal: not a git repository`).
  - System environment verified:
    - Node.js runtime: `v24.14.1` (Active LTS / Current)
    - npm package manager: `11.11.0`
    - Git version: `2.53.0.windows.2`
    - Shell: Windows PowerShell
- **Workspace State:** A clean slate ready for structured scaffolding following architecture approval. No legacy code, conflicting packages, or destructive migration risks are present.

---

## 2. PRODUCT REQUIREMENTS & SCOPE

### 2.1 Core Business Model
SpareHub is a multi-vendor automotive spare parts marketplace initially targeting **Sri Lanka**, with architectural provisions for long-term international expansion.

The platform provides a unified marketplace bridging spare parts vendors and vehicle owners/garages/fleets. It supports four distinct seller classes:
1. **Retail Spare Parts Shops** (Local brick-and-mortar storefronts).
2. **Individual Sellers** (Private vehicle owners selling spare or refurbished parts; subject to strict identity and ownership verification).
3. **Wholesalers** (Distributors selling parts in volume or to trade accounts).
4. **Automotive Parts Importers** (Direct importers of OEM/aftermarket components).

### 2.2 Vehicle Scope
The platform must support structured compatibility and search across all dominant vehicle categories in Sri Lanka and regional markets:
- **Passenger Cars** (Sedans, Hatchbacks, SUVs, Crossovers)
- **Motorcycles & Scooters**
- **Three-Wheelers** (Tuk-tuks: Bajaj, Piaggio, TVS, etc. — vital for Sri Lankan commercial transport)
- **Vans** (Passenger & Cargo vans)
- **Buses** (Private and commercial transport)
- **Lorries and Trucks** (Light commercial to heavy-duty haulage)
- **Tractors & Agricultural Equipment**
- **Heavy Vehicles & Construction Machinery** (Excavators, Cranes, Forklifts, Loaders)
- **Other specialized vehicles**

### 2.3 Requirement Classification
To maintain governance, all requirements are formally categorized:

| Category | Description | Status |
|---|---|---|
| **[CONFIRMED]** | Explicitly mandated functional/technical requirement from the Master Specification | In-Scope for Architecture |
| **[PROPOSED]** | Recommended technical implementation pattern adhering to engineering best practices | Subject to Architecture Review |
| **[UNRESOLVED]** | Commercial, legal, or financial policy requiring explicit platform owner approval | Pending Owner Sign-off |
| **[RISK]** | Identified architectural or operational threat requiring mitigation controls | Mitigation Defined |

---

## 3. MVP SCOPE VS. POST-MVP ROADMAP

### 3.1 Minimum Viable Product (Phase 1–13)
1. **Foundation & Shared Design System:** Next.js App Router, Tailwind CSS design tokens matching SpareHub branding (`#FF6B00`, `#171717`, `#FFFFFF`, `#F5F5F5`, `#E5E7EB`, `#16A34A`, `#DC2626`), responsive navigation and UI shell.
2. **Auth & Identity:** Supabase Auth (Email/Password, Session management, Role-Based Access Control: Customer, Seller, Platform Admin).
3. **Seller Onboarding & Shop Governance:** Multi-step shop application, document upload to secure private storage, administrative verification workflow (Draft $\rightarrow$ Pending Review $\rightarrow$ Approved $\rightarrow$ Rejected $\rightarrow$ Suspended).
4. **Vehicle Data & Compatibility Matrix:** Structured hierarchical vehicle catalog (Type $\rightarrow$ Brand $\rightarrow$ Model $\rightarrow$ Generation/Chassis $\rightarrow$ Year Range $\rightarrow$ Engine/Fuel variant). Extensible compatibility linkages for each SKU.
5. **Product & Inventory Management:** Multi-image uploads (optimized web storage), OEM & aftermarket part numbers, condition (Brand New, Reconditioned/Used), warranty details, price (integer cents/minor units or precise numeric), real-time stock allocation with non-negative constraints.
6. **Customer Discovery & Catalog:** Real-time debounced search, faceted filtering (Vehicle Selector, Category, Part Number, Price, Seller, Location/District), responsive product detail page with verified compatibility badge.
7. **Cart & Secure Checkout:** Multi-seller cart partitioning (grouped by shop for separate fulfillment), shipping address capture (Sri Lanka districts/cities), payment method selection (Online Payment Architecture vs. Cash on Delivery).
8. **Order Management & Lifecycle:** State-machine-driven order workflows (`pending_payment`, `payment_confirmed`, `processing`, `dispatched`, `delivered`, `cancelled`, `refund_requested`, `refunded`).
9. **Configurable Commission Engine:** Schema-driven, non-hardcoded commission calculator supporting platform defaults, category rates, and shop overrides. Immutable financial audit ledger.
10. **Administration Suite:** Master back-office for shop approvals, moderation, catalog management, order monitoring, dispute observation, and audit logs.
11. **Negative Security & Quality Suite:** 100% typed interfaces, RLS policy penetration testing, button-responsiveness validation, cart concurrency tests.

### 3.2 Deferred / Post-MVP Capabilities (Explicitly Non-MVP)
- **Centralized Platform Delivery Fleet:** Initial MVP requires seller-managed or seller-arranged courier delivery. Centralized delivery routing is deferred to Phase 2.
- **Native Android / React Native App:** Architecture strictly provides a single unified REST/Supabase backend API; native app development commences after web market validation.
- **Live Payment Gateway Activation:** Only test/sandbox adapters will be connected until provider selection, merchant account verification, and settlement terms are formally approved.
- **International Multi-Currency & Cross-Border Logistics:** Sri Lankan Rupee (LKR) is the initial base currency. Multi-currency translation deferred to international phase.
- **Automated Payout Banking APIs:** Direct bank ledger disbursement APIs deferred pending banking partner integration; initial payouts tracked via administrative settlement logs.

---

## 4. PROPOSED TECHNOLOGY STACK

```
+-----------------------------------------------------------------------------------+
|                              SPAREHUB CLIENT LAYER                                |
|  Next.js 15+ (App Router)  |  React 19  |  Tailwind CSS v4  |  Lucide Icons       |
|  - Customer Web & PWA                                                             |
|  - Seller Portal (/seller)                                                        |
|  - Platform Administration (/admin)                                               |
+-----------------------------------------------------------------------------------+
                                          |
                                   HTTPS / TLS 1.3
                                          |
+-----------------------------------------------------------------------------------+
|                        APPLICATION SERVER / API LAYER                             |
|  Next.js Route Handlers & Server Actions (Node.js runtime)                        |
|  - Input Validation: Zod schemas                                                  |
|  - Session Context: @supabase/ssr (HttpOnly, Secure, SameSite=Lax Cookies)        |
|  - Idempotency & Rate Limiting                                                    |
|  - Safe Decimal Financial Math: Decimal.js / integer minor units                  |
+-----------------------------------------------------------------------------------+
                                          |
                                   Connection Pooling (PgBouncer)
                                          |
+-----------------------------------------------------------------------------------+
|                      SUPABASE AUTHORITATIVE DATA LAYER                            |
|  PostgreSQL 16 Engine                                                             |
|  - Row Level Security (RLS) enforcement on EVERY table                            |
|  - Database Triggers: updated_at, audit logging, inventory checks                 |
|  - Supabase Storage: Public buckets (products) & Private buckets (documents)      |
|  - Full-Text Search: pg_trgm & tsvector on product names, codes, part numbers     |
+-----------------------------------------------------------------------------------+
```

### Justification & Technical Alignment
- **Next.js App Router & TypeScript:** Provides end-to-end type safety, high-performance Server Components (RSC) for lightning-fast catalog rendering, and isolated Server Actions for atomic mutations.
- **Tailwind CSS:** Enables strict implementation of SpareHub design tokens (`sparehub-orange`, `sparehub-dark`, etc.) with zero runtime overhead and complete mobile responsiveness.
- **Supabase (PostgreSQL 16):** Offers ACID transactions, relational integrity, row-level security (RLS), real-time notifications, and full-text search, eliminating the need for brittle external microservices in early-to-mid stages.
- **Single Authoritative Backend:** The web application and future Android mobile app will communicate with the same Supabase database and API endpoints, guaranteeing zero data drift.

---

## 5. APPLICATION ARCHITECTURE & FOLDER STRUCTURE

### Monorepo Structure (`src/`)

```
c:\Users\x\SpareHub\
├── .env.example
├── .gitignore
├── README.md
├── docs\
│   └── SPAREHUB_ARCHITECTURE_PLAN.md
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── public\
│   └── images\
│       ├── brand\
│       └── placeholders\
├── src\
│   ├── app\
│   │   ├── (marketplace)\              # Public Marketplace Route Group
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx                # Homepage / Hero / Vehicle Selector
│   │   │   ├── search\
│   │   │   │   └── page.tsx            # Vehicle & Part Search / Filter
│   │   │   ├── products\
│   │   │   │   └── [slug]\
│   │   │   │       └── page.tsx        # Product Detail & Compatibility
│   │   │   ├── shops\
│   │   │   │   └── [slug]\
│   │   │   │       └── page.tsx        # Public Shop Storefront
│   │   │   ├── cart\
│   │   │   │   └── page.tsx            # Multi-vendor Shopping Cart
│   │   │   ├── checkout\
│   │   │   │   └── page.tsx            # Checkout & Address Entry
│   │   │   └── account\
│   │   │       ├── orders\
│   │   │       │   ├── page.tsx        # Customer Orders
│   │   │       │   └── [id]\page.tsx   # Order Tracking & Details
│   │   │       └── profile\page.tsx
│   │   ├── (auth)\                     # Authentication Route Group
│   │   │   ├── login\page.tsx
│   │   │   ├── register\page.tsx
│   │   │   ├── seller-register\page.tsx
│   │   │   └── forgot-password\page.tsx
│   │   ├── seller\                     # Seller Back-Office Portal
│   │   │   ├── layout.tsx              # Seller Portal Shell & Navigation
│   │   │   ├── dashboard\page.tsx
│   │   │   ├── onboarding\page.tsx     # Shop Application & Verification Docs
│   │   │   ├── products\
│   │   │   │   ├── page.tsx            # Inventory Listing
│   │   │   │   ├── new\page.tsx        # Product Creation & Compatibility
│   │   │   │   └── [id]\edit\page.tsx
│   │   │   ├── orders\
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]\page.tsx       # Order Fulfillment & Tracking Updates
│   │   │   ├── earnings\page.tsx       # Sales, Deductions, Payout Ledger
│   │   │   └── settings\page.tsx
│   │   ├── admin\                      # Platform Admin Portal
│   │   │   ├── layout.tsx              # Admin Shell with Role Guard
│   │   │   ├── dashboard\page.tsx
│   │   │   ├── shops\
│   │   │   │   ├── page.tsx            # Shop Application Queue & Status
│   │   │   │   └── [id]\page.tsx       # Document Verification & Actions
│   │   │   ├── vehicles\page.tsx       # Master Vehicle Catalog Management
│   │   │   ├── categories\page.tsx     # Part Categories & Attributes
│   │   │   ├── orders\page.tsx         # Platform-wide Order Auditing
│   │   │   ├── commission\page.tsx     # Commission Rule Configuration
│   │   │   └── audit-logs\page.tsx     # Immutable Administrative Logs
│   │   └── api\                        # Secure Server-Side Route Handlers
│   │       ├── auth\callback\route.ts
│   │       ├── webhooks\payment\route.ts   # Idempotent Payment Gateway Hook
│   │       └── upload\verification-doc\route.ts
│   ├── components\
│   │   ├── ui\                         # Atom UI Components (Design System)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── card.tsx
│   │   │   ├── skeleton.tsx
│   │   │   └── toast.tsx
│   │   ├── layout\                     # Header, Footer, Mobile Navigation
│   │   ├── marketplace\                # ProductCard, VehicleSelector, FilterBar
│   │   ├── seller\                     # ProductForm, CompatibilityPicker
│   │   └── admin\                      # VerificationViewer, CommissionEditor
│   ├── lib\
│   │   ├── supabase\
│   │   │   ├── client.ts               # Browser Client (Public Anon Key)
│   │   │   ├── server.ts               # Server Client (@supabase/ssr)
│   │   │   └── admin.ts                # Service-Role Client (Strictly API/Server)
│   │   ├── money.ts                    # Precise Decimal / Minor Unit Math
│   │   ├── validators\                 # Zod validation schemas
│   │   ├── vehicle-data.ts             # Vehicle Taxonomy Helpers
│   │   └── utils.ts
│   ├── types\
│   │   ├── database.types.ts           # Auto-generated Supabase DB Types
│   │   └── index.ts
│   └── styles\
│       └── globals.css                 # CSS Variables & Token Definitions
├── supabase\
│   ├── migrations\                     # Timestamped PostgreSQL Migrations
│   └── seed.sql                        # Seed: Sri Lanka Vehicles, Categories
└── tests\
    ├── unit\                           # Unit Tests (Money, Commission, Helpers)
    ├── integration\                    # API & Service Tests
    └── security\                       # RLS Negative Penetration Tests
```

---

## 6. DATABASE ENTITIES & RELATIONSHIPS (POSTGRESQL SCHEMA)

```
                            +-------------------+
                            |    auth.users     |
                            +-------------------+
                                      |
                     +----------------+----------------+
                     | 1:1                             | 1:1
                     v                                 v
          +--------------------+             +--------------------+
          |    user_profiles   |             |  seller_profiles   |
          | (Customer / Admin) |             +--------------------+
          +--------------------+                       | 1:N
                                                       v
                                             +--------------------+
                                             |       shops        |
                                             +--------------------+
                                                       |
               +---------------------------------------+---------------------------------------+
               | 1:N                                   | 1:N                                   | 1:N
               v                                       v                                       v
    +--------------------+                  +--------------------+                  +--------------------+
    |      products      |                  |   seller_orders    |                  |  seller_documents  |
    +--------------------+                  +--------------------+                  +--------------------+
         | 1:N        | M:N                             | 1:N
         |            v                                 v
         |     +-----------------------+     +--------------------+
         |     | product_compatibility |     |     order_items    |
         |     +-----------------------+     +--------------------+
         |                 | M:1                        |
         |                 v                            | (Snapshot of Price/SKU)
         |     +-----------------------+                |
         |     |   vehicle_variants    |                |
         |     +-----------------------+                |
         v                 ^                            v
+-----------------+        |                 +--------------------+
| product_images  |        |                 | customer_orders    |
+-----------------+        |                 +--------------------+
                           |                            | 1:1
                +--------------------+                  v
                |   vehicle_models   |       +--------------------+
                +--------------------+       |  payment_records   |
                           ^                 +--------------------+
                           |                            |
                +--------------------+                  v
                | vehicle_makes/types|       +--------------------+
                +--------------------+       | commission_ledger  |
                                             +--------------------+
```

### 6.1 Core Tables & Invariants

#### Identity & Permissions
1. `user_profiles`:
   - `id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `email text NOT NULL`
   - `full_name text NOT NULL`
   - `phone text`
   - `role text NOT NULL CHECK (role IN ('customer', 'seller', 'platform_admin', 'support_agent'))`
   - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

2. `seller_profiles`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`
   - `seller_type text NOT NULL CHECK (seller_type IN ('retail_shop', 'individual', 'wholesaler', 'importer'))`
   - `id_number text` (National Identity Card / Passport / Business Registration)
   - `id_type text CHECK (id_type IN ('nic', 'passport', 'business_reg'))`
   - `verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'pending_review', 'verified', 'rejected'))`
   - `rejection_reason text`
   - `verified_at timestamptz`, `created_at timestamptz DEFAULT now()`

3. `shops`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE RESTRICT`
   - `name text NOT NULL`
   - `slug text NOT NULL UNIQUE` (URL-safe string, indexed)
   - `description text`
   - `logo_url text`
   - `cover_url text`
   - `phone text NOT NULL`
   - `email text NOT NULL`
   - `address_line1 text NOT NULL`, `address_line2 text`
   - `district text NOT NULL` (e.g., Colombo, Gampaha, Kandy, Galle, etc.)
   - `city text NOT NULL`
   - `postal_code text`
   - `status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'suspended'))`
   - `status_reason text`
   - `approved_by uuid REFERENCES auth.users(id)`
   - `approved_at timestamptz`
   - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

4. `seller_documents`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `seller_profile_id uuid NOT NULL REFERENCES seller_profiles(id) ON DELETE CASCADE`
   - `shop_id uuid REFERENCES shops(id) ON DELETE CASCADE`
   - `document_type text NOT NULL CHECK (document_type IN ('nic_front', 'nic_back', 'br_certificate', 'tax_document', 'proof_of_address', 'importer_license'))`
   - `storage_path text NOT NULL` (Stored in private Supabase bucket `verification-documents`)
   - `verified boolean DEFAULT false`
   - `created_at timestamptz DEFAULT now()`

#### Vehicle Taxonomy & Compatibility
5. `vehicle_types`:
   - `id text PRIMARY KEY` (e.g., `car`, `motorcycle`, `three_wheeler`, `van`, `bus`, `truck`, `tractor`, `heavy_machinery`)
   - `name text NOT NULL` (e.g., 'Three-Wheeler', 'Car', 'Heavy Vehicle')
   - `display_order int DEFAULT 0`

6. `vehicle_makes`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `vehicle_type_id text NOT NULL REFERENCES vehicle_types(id)`
   - `name text NOT NULL` (e.g., Toyota, Honda, Bajaj, TVS, Dimo, Ashok Leyland, Caterpillar)
   - `slug text NOT NULL`
   - UNIQUE(`vehicle_type_id`, `name`)

7. `vehicle_models`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `make_id uuid NOT NULL REFERENCES vehicle_makes(id) ON DELETE CASCADE`
   - `name text NOT NULL` (e.g., Corolla, RE 205, Hilux, Viking, Super Cub)
   - `slug text NOT NULL`
   - UNIQUE(`make_id`, `name`)

8. `vehicle_variants`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `model_id uuid NOT NULL REFERENCES vehicle_models(id) ON DELETE CASCADE`
   - `generation_chassis text` (e.g., 'NZE121', 'RE 4S', 'KDH200')
   - `year_start int NOT NULL CHECK (year_start >= 1950 AND year_start <= 2035)`
   - `year_end int CHECK (year_end IS NULL OR year_end >= year_start)`
   - `engine_code text` (e.g., '1NZ-FE', '205cc 4-stroke')
   - `transmission text` (e.g., 'Manual', 'Automatic', 'CVT')
   - `fuel_type text CHECK (fuel_type IN ('petrol', 'diesel', 'electric', 'hybrid', 'cng'))`

#### Product Catalog & Compatibility Mapping
9. `categories`:
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
   - `parent_id uuid REFERENCES categories(id) ON DELETE SET NULL`
   - `name text NOT NULL` (e.g., 'Braking Systems', 'Brake Pads & Shoes', 'Suspension', 'Filters')
   - `slug text NOT NULL UNIQUE`
   - `icon_name text`
   - `display_order int DEFAULT 0`

10. `products`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT`
    - `category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT`
    - `title text NOT NULL`
    - `slug text NOT NULL`
    - `description text NOT NULL`
    - `part_number text` (indexed for instant exact lookup)
    - `oem_part_number text` (indexed for cross-reference)
    - `brand_name text NOT NULL` (Part manufacturer, e.g., Bosch, Denso, NGK, OEM)
    - `condition text NOT NULL CHECK (condition IN ('brand_new', 'reconditioned', 'used'))`
    - `price_minor_units bigint NOT NULL CHECK (price_minor_units >= 0)` (in Sri Lankan Cents: 100 cents = 1 LKR)
    - `compare_at_price_minor_units bigint CHECK (compare_at_price_minor_units IS NULL OR compare_at_price_minor_units >= price_minor_units)`
    - `stock_quantity int NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0)` (Enforced by check constraint: **negative inventory prohibited**)
    - `warranty_period_months int DEFAULT 0`
    - `warranty_details text`
    - `is_universal boolean NOT NULL DEFAULT false` (True if part fits any vehicle)
    - `is_published boolean NOT NULL DEFAULT false`
    - `status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'out_of_stock', 'archived', 'banned'))`
    - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
    - UNIQUE(`shop_id`, `slug`)

11. `product_images`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE`
    - `image_url text NOT NULL`
    - `alt_text text`
    - `display_order int NOT NULL DEFAULT 0`
    - `is_primary boolean NOT NULL DEFAULT false`

12. `product_compatibility`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE`
    - `vehicle_variant_id uuid REFERENCES vehicle_variants(id) ON DELETE CASCADE`
    - `vehicle_model_id uuid REFERENCES vehicle_models(id) ON DELETE CASCADE`
    - `notes text` (e.g., 'Fits front axle only; ABS models only')
    - `is_exact_fit boolean NOT NULL DEFAULT true`
    - CONSTRAINT check_variant_or_model CHECK (vehicle_variant_id IS NOT NULL OR vehicle_model_id IS NOT NULL),
    - UNIQUE(`product_id`, `vehicle_variant_id`),
    - UNIQUE(`product_id`, `vehicle_model_id`)

#### Shopping Cart & Multi-Vendor Orders
13. `cart_items`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
    - `product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE`
    - `quantity int NOT NULL CHECK (quantity > 0)`
    - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`
    - UNIQUE(`user_id`, `product_id`)

14. `customer_orders`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `order_number text NOT NULL UNIQUE` (e.g., `SH-20261013-XXXX`)
    - `customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT`
    - `status text NOT NULL DEFAULT 'pending'`
    - `payment_method text NOT NULL CHECK (payment_method IN ('online', 'cod'))`
    - `payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'cod_pending', 'failed', 'refunded'))`
    - `shipping_full_name text NOT NULL`
    - `shipping_phone text NOT NULL`
    - `shipping_address_line1 text NOT NULL`, `shipping_address_line2 text`
    - `shipping_district text NOT NULL`, `shipping_city text NOT NULL`, `shipping_postal_code text`
    - `total_items_subtotal_minor bigint NOT NULL CHECK (total_items_subtotal_minor >= 0)`
    - `total_delivery_fee_minor bigint NOT NULL DEFAULT 0 CHECK (total_delivery_fee_minor >= 0)`
    - `total_discount_minor bigint NOT NULL DEFAULT 0 CHECK (total_discount_minor >= 0)`
    - `total_grand_minor bigint NOT NULL CHECK (total_grand_minor >= 0)`
    - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

15. `seller_orders` (Sub-orders partitioned by shop for multi-vendor fulfillment):
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT`
    - `shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT`
    - `sub_order_number text NOT NULL UNIQUE` (e.g., `SH-20261013-XXXX-S1`)
    - `status text NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled', 'returned'))`
    - `fulfillment_type text NOT NULL DEFAULT 'seller_courier'`
    - `tracking_number text`
    - `courier_name text`
    - `dispatched_at timestamptz`, `delivered_at timestamptz`, `cancelled_at timestamptz`
    - `subtotal_minor bigint NOT NULL`
    - `delivery_fee_minor bigint NOT NULL DEFAULT 0`
    - `total_amount_minor bigint NOT NULL`
    - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

16. `order_items`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `seller_order_id uuid NOT NULL REFERENCES seller_orders(id) ON DELETE RESTRICT`
    - `product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT`
    - `product_title_snapshot text NOT NULL` (Immutable snapshot at checkout)
    - `product_part_number_snapshot text`
    - `unit_price_minor_units bigint NOT NULL CHECK (unit_price_minor_units >= 0)`
    - `quantity int NOT NULL CHECK (quantity > 0)`
    - `total_price_minor_units bigint NOT NULL CHECK (total_price_minor_units >= 0)`
    - `created_at timestamptz DEFAULT now()`

#### Financials & Commission Ledger
17. `commission_rules`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `name text NOT NULL` (e.g., 'Default Standard Rate', 'Engine Parts Tier', 'VIP Importer Contract')
    - `rule_type text NOT NULL CHECK (rule_type IN ('platform_default', 'category_override', 'shop_override'))`
    - `category_id uuid REFERENCES categories(id) ON DELETE CASCADE`
    - `shop_id uuid REFERENCES shops(id) ON DELETE CASCADE`
    - `rate_basis_points int NOT NULL CHECK (rate_basis_points >= 0 AND rate_basis_points <= 10000)` (e.g. 200 bps = 2.00%, 500 bps = 5.00%)
    - `effective_from timestamptz NOT NULL`
    - `effective_until timestamptz`
    - `is_active boolean NOT NULL DEFAULT true`
    - `created_by uuid REFERENCES auth.users(id)`
    - `created_at timestamptz DEFAULT now()`

18. `commission_ledger`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `seller_order_id uuid NOT NULL REFERENCES seller_orders(id) ON DELETE RESTRICT`
    - `order_item_id uuid REFERENCES order_items(id) ON DELETE RESTRICT`
    - `shop_id uuid NOT NULL REFERENCES shops(id) ON DELETE RESTRICT`
    - `applied_rule_id uuid REFERENCES commission_rules(id)`
    - `item_subtotal_minor bigint NOT NULL`
    - `commission_rate_bps int NOT NULL`
    - `commission_amount_minor bigint NOT NULL` (Platform cut)
    - `seller_net_earning_minor bigint NOT NULL` (Seller share = subtotal - commission)
    - `status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'earned', 'cancelled', 'refunded', 'settled'))`
    - `created_at timestamptz DEFAULT now()`
    - UNIQUE(`order_item_id`) -- Prevents duplicate commission ledger records per line item

19. `payment_records`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `customer_order_id uuid NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT`
    - `gateway_provider text NOT NULL` (e.g., 'sandbox_manual', 'payhere', 'webxpay', 'cod')
    - `gateway_reference text`
    - `idempotency_key text NOT NULL UNIQUE` (Prevents duplicate processing of webhooks)
    - `amount_minor bigint NOT NULL`
    - `currency text NOT NULL DEFAULT 'LKR'`
    - `status text NOT NULL CHECK (status IN ('initiated', 'pending', 'successful', 'failed', 'refunded'))`
    - `raw_payload jsonb`
    - `created_at timestamptz DEFAULT now()`, `updated_at timestamptz DEFAULT now()`

20. `admin_audit_logs`:
    - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
    - `actor_id uuid NOT NULL REFERENCES auth.users(id)`
    - `action text NOT NULL` (e.g., 'shop.approve', 'shop.suspend', 'commission.update', 'refund.authorize')
    - `target_type text NOT NULL`
    - `target_id uuid NOT NULL`
    - `old_values jsonb`
    - `new_values jsonb`
    - `ip_address text`
    - `user_agent text`
    - `created_at timestamptz DEFAULT now()`

---

## 7. SUPABASE ROW LEVEL SECURITY (RLS) STRATEGY

RLS is treated as an impermeable security perimeter. Every table will have `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`.

### 7.1 Security Matrix

| Table | Public Read | Customer Read/Write | Seller Read/Write | Admin Read/Write |
|---|---|---|---|---|
| `user_profiles` | None | Own profile only (`auth.uid() = id`) | Own profile only | Full access |
| `seller_profiles` | None | None | Own profile only (`auth.uid() = user_id`) | Full access |
| `shops` | Approved shops only (`status = 'approved'`) | Approved shops only | Own shop only (`seller_profile_id IN (...)`) | Full access |
| `seller_documents` | **NEVER** | **NEVER** | Own documents only (Read-only after upload) | Full access |
| `vehicle_taxonomies` | All active | All active (Read only) | All active (Read only) | Full CRUD |
| `categories` | All active | All active (Read only) | All active (Read only) | Full CRUD |
| `products` | Published in approved shops (`is_published = true AND shop.status = 'approved'`) | Same as public | Own shop products only (Full CRUD) | Full moderation |
| `product_compatibility` | Public for published products | Public for published products | Own shop products only | Full CRUD |
| `cart_items` | None | Own cart items (`user_id = auth.uid()`) | None | None |
| `customer_orders` | None | Own orders only (`customer_id = auth.uid()`) | None | Full audit |
| `seller_orders` | None | Associated customer order only | Own shop sub-orders only | Full audit |
| `order_items` | None | Items in own customer orders | Items in own shop sub-orders | Full audit |
| `commission_rules` | None | None | None | Full CRUD |
| `commission_ledger` | None | None | Read-only summary for own shop | Full audit |
| `payment_records` | None | Read-only status for own orders | None | Full audit |
| `admin_audit_logs` | None | None | None | Append-only / Admin read |

### 7.2 Helper Functions for High-Performance RLS
To prevent deep recurring subqueries in RLS policies, PostgreSQL helper functions with `SECURITY DEFINER` and memoized JWT claims will be deployed:

```sql
-- Check if current authenticated user is a Platform Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'platform_admin'
  );
$$;

-- Check if current authenticated user owns a specific shop
CREATE OR REPLACE FUNCTION public.owns_shop(shop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops s
    JOIN public.seller_profiles sp ON s.seller_profile_id = sp.id
    WHERE s.id = shop_id AND sp.user_id = auth.uid()
  );
$$;
```

### 7.3 Storage Bucket Security
1. **Bucket `product-images` (Public):**
   - Read: Public (`anon`, `authenticated`).
   - Write: Restricted to authenticated users who own the associated shop. Max file size: 5MB. Formats: WebP, JPEG, PNG.
2. **Bucket `verification-documents` (Strictly Private):**
   - Read: Strictly `is_admin() = true`. Sellers cannot view other sellers' documents. Public access is forbidden.
   - Write: Authenticated seller during onboarding only. Max file size: 10MB. Formats: PDF, JPEG, PNG.

---

## 8. SELLER ONBOARDING & SHOP APPROVAL WORKFLOW

```
  +------------------+
  |  Register as     |
  |  Seller Account  |
  +------------------+
           |
           v
  +------------------+
  | Complete Shop    |  State: 'draft'
  | Profile & Form   |  (Shop details, business address, district, phone)
  +------------------+
           |
           v
  +------------------+
  | Upload Identity  |  (NIC, BR Certificate, Importer License)
  | Documents        |  Secure upload -> private storage
  +------------------+
           |
           v
  +------------------+
  | Submit for       |  State: 'pending_review'
  | Review           |  (Locked from public; products cannot be published)
  +------------------+
           |
           +-----------------------+-----------------------+
           |                                               |
           v Admin Approval                                v Admin Rejection
  +------------------+                           +------------------+
  | Approved         |                           | Rejected         |
  | State: 'approved'|                           | State: 'rejected'|
  | Can publish & sell                           | Reason provided  |
  +------------------+                           +------------------+
           |                                               |
           v Admin Action (Violation/Fraud)                v Resubmit
  +------------------+                           +------------------+
  | Suspended        |                           | Edit Draft &     |
  | State: 'suspended|                           | Re-upload Docs   |
  | Products hidden  |                           +------------------+
  +------------------+
```

### Invariants:
- Products listed by a shop whose status is NOT `approved` are automatically excluded from public search and category listings via RLS and SQL queries.
- Sellers cannot manually mutate their own shop `status` or `seller_profile.verification_status` — modifications are strictly enforced via Server Actions checked against `is_admin()`.

---

## 9. PRODUCT & VEHICLE COMPATIBILITY DESIGN

Automotive parts compatibility is hierarchical and multi-faceted. A single brake pad might fit 15 different vehicle models across 4 manufacturers over a 10-year span, while an engine cylinder head may fit only one specific chassis code with a 1.5L VVT-i engine.

### 9.1 The Compatibility Selector Paradigm
The customer search UI features a persistent, sticky **Vehicle Selector Bar**:
```
[ Step 1: Vehicle Type ] -> [ Step 2: Make ] -> [ Step 3: Model ] -> [ Step 4: Year / Variant ]
Example: Three-Wheeler   -> Bajaj            -> RE 205          -> 2018 (4-Stroke)
Example: Car             -> Toyota           -> Corolla         -> 2003 (NZE121 / 1NZ-FE)
```

### 9.2 Search Filtering Architecture
1. **Selected Vehicle Filter Active:**
   The product query evaluates:
   ```sql
   WHERE p.is_published = true
     AND (
       p.is_universal = true
       OR EXISTS (
         SELECT 1 FROM public.product_compatibility pc
         WHERE pc.product_id = p.id
           AND (
             pc.vehicle_variant_id = :selected_variant_id
             OR pc.vehicle_model_id = :selected_model_id
           )
       )
     )
   ```
2. **Part Number / OEM Code Search:**
   Indexed via `pg_trgm` and clean alphanumeric normalization (e.g., stripping dashes/spaces: `04465-02220` $\rightarrow$ `0446502220`) for resilient exact and partial matching.
3. **Compatibility Badge on Product Page:**
   - **Green Badge:** "Guaranteed Fit for Your [Vehicle Details]" (when variant match is exact).
   - **Amber Badge:** "Universal Part" (requires manual specification verification).
   - **Red Alert / Warning:** "Does Not Fit Your Selected Vehicle" (prevents accidental returns).

---

## 10. CART, CHECKOUT & ORDER LIFECYCLE

### 10.1 Multi-Vendor Cart Architecture
A single customer cart can contain items from multiple independent sellers.
- In the UI, the cart is visually **partitioned by Shop**:
  - `Shop A (Auto Parts Colombo)`: 2 items $\rightarrow$ Subtotal A + Delivery Fee A
  - `Shop B (Kandy Spares)`: 1 item $\rightarrow$ Subtotal B + Delivery Fee B
- During checkout, an atomic transaction executes:
  1. Creates 1 parent `customer_orders` record (representing the aggregate payment and customer invoice).
  2. Creates $N$ child `seller_orders` records (one per shop, enabling independent tracking, dispatch, and communication).
  3. Creates line-item snapshots in `order_items` locking down title, part number, and unit price.
  4. Atomically decrements `products.stock_quantity`. If `stock_quantity - requested < 0`, transaction rolls back with a user-friendly out-of-stock notification.

### 10.2 Order State Machine

```
[ Customer Places Order ]
            |
            v
   +-----------------+
   | Payment Choice  |
   +-----------------+
      /           \
(Online)          (Cash on Delivery)
    |                     |
    v                     v
[ Initiate Gateway ]    [ Mark 'cod_pending' ]
    |                     |
(Webhook Confirmed)       |
    |                     |
    +----------+----------+
               |
               v
     [ Order: 'confirmed' ]
               |
     (Seller packages part)
               |
               v
     [ Order: 'processing' ]
               |
     (Seller assigns courier & tracking #)
               |
               v
     [ Order: 'dispatched' ]
               |
     (Delivery agent delivers package)
               |
               v
     [ Order: 'delivered' ]
               |
   +-----------+-----------+
   |                       |
(Completed)          (Customer claims defect/wrong part)
   |                       |
[ Ledger Settled ]         v
                  [ 'refund_requested' ]
                           |
                  (Dispute Investigation)
                  /                      \
             (Approved)              (Rejected)
                 |                        |
         [ 'refunded' ]           [ Dispute Closed ]
         (Ledger Reversed)
```

---

## 11. PAYMENT & COD ARCHITECTURE

### 11.1 Principle of Verification
- **A browser redirect or client-side callback is NEVER proof of payment.**
- Online payments are credited only when an authenticated, cryptographically signed webhook is processed server-side with idempotency validation.
- COD orders are flagged with `payment_status = 'cod_pending'`. COD creation never marks an order as paid.

### 11.2 Payment Gateway Idempotency Pattern
```typescript
// Pseudocode for Secure Webhook Handler:
export async function POST(req: Request) {
  const signature = req.headers.get("x-signature");
  const payload = await req.json();

  // 1. Verify cryptographic HMAC signature
  if (!verifyProviderSignature(payload, signature)) {
    return new Response("Invalid signature", { status: 401 });
  }

  const { idempotencyKey, orderId, status, amount } = payload;

  // 2. Database transaction with idempotency check
  return await db.transaction(async (tx) => {
    const existing = await tx.paymentRecords.findByKey(idempotencyKey);
    if (existing && existing.status === 'successful') {
      return new Response("Already processed", { status: 200 }); // Idempotent return
    }

    // 3. Update customer_order and seller_orders
    if (status === "PAID") {
      await tx.updatePaymentStatus(orderId, "captured");
      await tx.accrueCommissionLedger(orderId);
    }
    return new Response("OK", { status: 200 });
  });
}
```

---

## 12. COMMISSION CONFIGURATION ENGINE

### 12.1 Core Architectural Principles
- **NO HARDCODED RATES:** The platform commission rate is **NOT FINALIZED**. The 2% figure mentioned during preliminary discussions is strictly an unapproved example. No hardcoded rates will exist in code.
- **Configurable Basis Points:** Rates are stored as integer basis points ($100\text{ bps} = 1.00\%$) to guarantee precision and eliminate floating-point rounding errors.
- **Rule Hierarchy Resolution:**
  When an order item is confirmed, the commission rate resolves through a prioritized fallback:
  1. **Shop Override:** Custom negotiated agreement for that specific seller (highest priority).
  2. **Category Override:** Specific rate for the product's category (e.g., Heavy Machinery vs. Motorbike Spark Plugs).
  3. **Platform Default:** Global baseline rate configured in `commission_rules` where `rule_type = 'platform_default'`.
- **Immutable Financial Ledger:** Commission calculation produces an immutable line in `commission_ledger`. Even if commission rules are adjusted in the future, past transaction records remain intact and mathematically verifiable.

---

## 13. REFUND, DISPUTE & PAYOUT CONSIDERATIONS

### 13.1 Handling Order Reversals & Cancellations
1. **Pre-dispatch Cancellation:**
   - Online payment: Gateway refund request issued; stock restored to product catalog; commission ledger status marked `cancelled`.
   - COD order: Order marked `cancelled`; stock restored; no money moved.
2. **Post-delivery Return / Refund:**
   - If a refund is approved by the platform administrator:
     - Customer is reimbursed.
     - Negative adjustment entry (`reversal`) is written to `commission_ledger` with reference to original ledger ID.
     - Seller earnings balance is debited accordingly.

### 13.2 Payout Settlement Lifecycle
- Payouts are not executed instantly on delivery.
- A **Return Dispute Window** (e.g., 3 to 7 business days post-delivery) must elapse before commission status transitions from `accrued` to `earned`, and seller earnings transition from `pending` to `available_for_payout`.

---

## 14. UI/UX DESIGN SYSTEM & BRAND TOKENS

### 14.1 Brand Colors & Semantic Design Tokens

| Token Name | Hex Code | Semantic Role |
|---|---|---|
| `--color-primary-orange` | `#FF6B00` | Primary action buttons, badges, brand accents, active states |
| `--color-primary-hover` | `#E05E00` | Hover state for primary buttons |
| `--color-dark-black` | `#171717` | Headers, primary typography, dark navigation bars, footers |
| `--color-white` | `#FFFFFF` | Primary background, card surfaces, modal containers |
| `--color-light-gray` | `#F5F5F5` | Page body background, neutral container fills |
| `--color-border-gray` | `#E5E7EB` | Dividers, card borders, input borders |
| `--color-success-green` | `#16A34A` | Fitment verified badges, in-stock indicators, payment success |
| `--color-error-red` | `#DC2626` | Incompatible fitment alerts, out of stock, validation errors |

### 14.2 Component Blueprint
- **Mobile-First Layout:** Sticky bottom navigation bar for mobile viewports (Home, Vehicles, Search, Cart, Account); desktop displays full multi-tier header with search and category dropdowns.
- **Automotive Aesthetic:** Clean, high-contrast, industrial feel. Readable typography with `Inter` or `Plus Jakarta Sans`. Distinct, legible badges for vehicle categories and part condition (`Brand New` vs. `Reconditioned`).
- **No Deceptive Patterns:** Fabricated customer reviews, simulated stock countdowns, or synthetic viewer counts are strictly prohibited.

---

## 15. UI RESPONSIVENESS & ASYNCHRONOUS PERFORMANCE

The user has explicitly highlighted concerns regarding **buttons becoming unresponsive while data is loading**. This is treated as a critical architectural quality requirement.

### 15.1 Architectural Safeguards Against UI Freezing

```
User Action (Click "Add to Cart")
       |
       v
1. Scoped Local Loading State Set -> ONLY the specific button enters loading state:
   - Displays inline mini-spinner
   - Disabled attribute applied to THAT button ONLY to prevent double-submit
   - Rest of page remains 100% interactive (menus, navigation, other cards clickable)
       |
       v
2. AbortController / Timeout Bound -> Request has an explicit 10s cancellation ceiling
       |
       v
3. Non-Blocking Async Server Action
       |
  +----+------------------------+
  |                             |
(Success in 180ms)         (Network Error / Timeout)
  |                             |
  v                             v
Toast notification         Toast error with clear "Retry" action
Button returns to normal   Button resets cleanly, NO lingering spinner
```

### 15.2 Mandatory Front-End Performance Guidelines:
1. **Never block the main thread:** All remote mutations use standard non-blocking `fetch` or React 19 `useTransition` / `useActionState`.
2. **Local Button Scoping:** The `Button` component must isolate its loading state. Submitting a review or adding an item to the cart will never trigger a global screen overlay or freeze unrelated links.
3. **Debounced Search:** Vehicle and part number search inputs will utilize a 300ms debounce with cancellation of obsolete in-flight requests (`AbortController`) to eliminate race conditions and out-of-order response overwrites.
4. **Optimistic UI with Graceful Rollback:** Quantity increment/decrement in the shopping cart applies instantly in the UI with optimistic updates, rolling back and displaying a toast if server reconciliation fails.
5. **No Infinite Spinners:** Every asynchronous operation must have a timeout guarantee (default 12 seconds). Unmounted components will safely abort background handlers without memory leaks or console warnings.

---

## 16. TESTING & QUALITY ASSURANCE STRATEGY

### 16.1 Testing Pyramid
1. **Static Analysis & Type Checking:**
   - 100% strict TypeScript (`noImplicitAny`, `strictNullChecks`).
   - ESLint and Prettier enforcement on all files.
2. **Unit Tests (Vitest):**
   - Precise decimal/cents calculation tests (`money.ts`).
   - Commission calculation fallback resolution logic.
   - Vehicle compatibility matcher algorithms.
3. **Integration Tests:**
   - Multi-vendor order splitting: Cart with 2 shops correctly produces 1 customer order and 2 seller sub-orders.
   - Non-negative stock constraints: Concurrent checkout simulation verifying that an item with stock = 1 cannot be purchased twice.
4. **Security & RLS Penetration Tests:**
   - Negative cross-tenant tests: Seller A attempts to query Seller B's orders $\rightarrow$ returns 0 records / 403.
   - Role escalation tests: Customer attempts to update own role to `platform_admin` $\rightarrow$ rejected by RLS.
   - Document protection tests: Public unauthenticated request to verification documents $\rightarrow$ access denied.
5. **UI & Responsiveness Tests (Playwright):**
   - Rapid multi-click test on checkout and cart buttons verifying zero duplicate requests.
   - Responsive viewport audits (Mobile: 360px, 390px, 412px; Tablet: 768px; Desktop: 1280px+).

---

## 17. SECURITY THREAT MODEL

```
+------------------------------------+---------------------------------------------------------------+
| Threat Vector                      | Architectural Defense                                         |
+------------------------------------+---------------------------------------------------------------+
| Cross-Seller Data Leakage          | Supabase RLS policies parameterized by shop ownership function|
| Client-Side Price Tampering        | Prices calculated strictly server-side from DB product record |
| Negative Inventory Race Condition  | Atomic DB transactions with SQL check constraints             |
| Self-Assigned Role Escalation      | RLS prevents modification of user_profiles.role by non-admins |
| Public Exposure of NIC / Documents | Private Supabase Storage bucket with admin-only read policy   |
| Duplicate Webhook Replay           | Idempotency keys recorded in unique payment_records table     |
| Stored XSS in Product Description  | DOMPurify / React JSX auto-escaping of markdown/html          |
| Compromised Service-Role Key       | Secret key NEVER bundled into client / browser bundles        |
+------------------------------------+---------------------------------------------------------------+
```

---

## 18. DEPLOYMENT & ENVIRONMENT STRATEGY

- **Version Control:** Git repository with conventional commits (`feat:`, `fix:`, `docs:`, `test:`).
- **Proposed Hosting:**
  - Front-end / Next.js: Vercel (Edge network, global CDN for static assets).
  - Database & Storage: Supabase Cloud (Managed PostgreSQL with automated backups).
- **Environment Tiers:**
  1. `Development`: Local environment with Supabase local CLI / test instances.
  2. `Staging / Preview`: Branch deployments on Vercel with dedicated staging database.
  3. `Production`: Production Vercel domain with production Supabase instance and strict RLS.

---

## 19. EXTERNAL DEPENDENCIES & POTENTIAL COSTS

| Dependency | Purpose | Proposed Tier / Cost Implication |
|---|---|---|
| **Next.js & Vercel** | Web framework & hosting | Free Hobby / Pro ($20/mo per seat when scaling) |
| **Supabase** | DB, Auth, Storage, RLS | Free tier for development; Pro ($25/mo) for production SLA |
| **Tailwind CSS & Lucide** | Styling & Icons | Open Source (Free) |
| **Payment Gateway (e.g., PayHere / WebXPay)** | Sri Lanka LKR card processing | ~2.6% to 3.5% per successful transaction + initial setup fee |
| **SMS Gateway (Future, e.g. Dialog / Mobitel)** | OTP verification & SMS order alerts | Pay-as-you-go per SMS (post-MVP) |

---

## 20. UNRESOLVED DECISIONS REQUIRING OWNER APPROVAL

Before implementing payment workflows or production financial logic, the following commercial decisions require explicit written sign-off from the platform owner:

1. **Payment Gateway Provider Selection:**
   - Preferred Sri Lankan payment aggregator (e.g., PayHere, WebXPay, Seylan/Commercial Bank IPG)?
2. **Platform Commission Policy:**
   - What is the approved commission percentage or fee schedule?
   - Is commission calculated on the item subtotal, or does it include delivery fees?
   - How are promotional discounts split between the seller and the platform?
3. **Cash on Delivery (COD) Reconciliation:**
   - Who collects the cash from the buyer (seller's own courier vs. platform contracted courier)?
   - How does the platform collect its commission on COD orders?
4. **Seller Payout Schedule:**
   - Are seller earnings disbursed weekly, bi-weekly, or monthly?
   - What is the dispute holding period (e.g., 3 days, 7 days post-delivery)?
5. **Delivery Fee Structure:**
   - Are delivery fees flat-rate, district-based, weight-based, or set independently by each seller?
6. **Return & Refund Liability:**
   - Who bears the delivery cost for returned or defective parts?

---

## 21. PHASED IMPLEMENTATION ROADMAP

```
Phase 1: Project Foundation & Design Tokens
  -> Scaffolding Next.js 15, TypeScript, Tailwind CSS with SpareHub brand tokens.
Phase 2: Database Schema & Migration Suite
  -> Applying PostgreSQL schema, relational tables, constraints, and indexes.
Phase 3: Supabase Auth & Multi-Role Profiles
  -> Customer, Seller, and Admin profile triggers and session middleware.
Phase 4: Supabase RLS Security Perimeter
  -> Writing and verifying RLS policies for every table with negative tests.
Phase 5: Seller Onboarding & Verification System
  -> Shop registration, private document upload, and admin approval pipeline.
Phase 6: Vehicle Taxonomy & Product Catalog Engine
  -> Seeding vehicle models, product CRUD, and multi-image uploads.
Phase 7: Structured Product Compatibility Matrix
  -> Compatibility mapping UI for sellers and fitment verification badges.
Phase 8: High-Performance Search & Faceted Discovery
  -> Debounced vehicle search, category filtering, and mobile catalog UI.
Phase 9: Multi-Vendor Cart & Checkout Architecture
  -> Shop-partitioned cart, non-blocking UI, address validation, order placement.
Phase 10: Order Lifecycle & Seller Fulfillment Dashboard
  -> Seller order tracking, status transition state machine, courier assignment.
Phase 11: Configurable Commission Engine & Ledger
  -> Schema-driven rate calculation, immutable financial ledger records.
Phase 12: Admin Control Center & Audit Trails
  -> Back-office shop moderation, dispute oversight, and immutable logging.
Phase 13: End-to-End QA, Security Penetration & Responsiveness Testing
  -> Full test suite run, negative RLS verification, button responsiveness tests.
```

---

## 22. DEFINITION OF DONE (DOD) FOR EACH MAJOR PHASE

For any phase to be declared complete:
1. **Code Completeness:** Implemented in full without placeholders, fake data, or mocked successes.
2. **Type Safety & Linting:** 0 TypeScript compile errors, 0 lint warnings.
3. **Test Execution:** Associated unit and integration tests written and passing with actual execution logs.
4. **Security Verification:** RLS policies verified with both authorized and unauthorized test users.
5. **Responsiveness Verification:** UI operations verified to be non-blocking with local scoped loading states.
6. **Documentation:** Documentation updated and verified.

---

## 23. SUMMARY OF PLANNING STAGE

- **Workspace State:** A. Empty workspace verified.
- **Application Source Files Modified:** None (Architecture planning document only created).
- **Production Commercial Status:** Commission and payment gateway marked strictly as **UNRESOLVED** pending owner sign-off.
- **Readiness:** 100% prepared to execute **Phase 1: Project Foundation & Design Tokens** upon user approval.
