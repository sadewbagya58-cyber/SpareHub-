# SpareHub
**Every Part. One Marketplace.**

SpareHub is a multi-vendor automotive spare parts marketplace built initially for Sri Lanka, engineered with enterprise scalability for regional and international expansion.

**GitHub Repository:** [https://github.com/sadewbagya58-cyber/SpareHub-.git](https://github.com/sadewbagya58-cyber/SpareHub-.git)

---

## Brand Identity

| Color | Hex Code | Purpose |
|---|---|---|
| **Primary Orange** | `#FF6B00` | Primary call-to-actions, brand accents, active states |
| **Dark Black** | `#171717` | Typography headers, dark utility navigation, footers |
| **White** | `#FFFFFF` | Primary shopping canvas background, card surfaces |
| **Light Gray** | `#F5F5F5` | Neutral container surfaces, secondary cards |
| **Border Gray** | `#E5E7EB` | Dividers, card borders, form input outlines |
| **Success Green** | `#16A34A` | Fitment verified badges, in-stock indicators |
| **Error Red** | `#DC2626` | Incompatible fitment alerts, out-of-stock indicators |

---

## Vehicle Scope
The platform provides structured compatibility modeling and search across all vehicle categories in Sri Lanka:
- **Passenger Cars & SUVs**
- **Three-Wheelers** (Bajaj, TVS, Piaggio tuk-tuks)
- **Motorcycles & Scooters**
- **Vans & Light Commercial Vehicles**
- **Buses** (Private and public transport)
- **Lorries & Trucks** (Light to heavy haulage)
- **Tractors & Agricultural Equipment**
- **Heavy Construction Machinery** (Excavators, Loaders)

---

## Supported Seller Classes
SpareHub is an authentic multi-vendor platform with four distinct merchant types:
1. **Retail Spare Parts Shops** (Local brick-and-mortar storefronts)
2. **Individual Sellers** (Private owners selling spare/reconditioned parts with identity verification)
3. **Wholesalers** (Distributors selling parts in volume to regional garages)
4. **Automotive Parts Importers** (Direct importers of OEM and aftermarket components)

---

## Multi-Role Architecture & Security
SpareHub supports three core user roles with strict separation of privileges:
- **`customer`**: Browses catalog, places orders, manages profile and shipping addresses.
- **`seller`**: Registers business profile, manages catalog inventory, fulfills suborders. Protected by seller verification workflow (`draft` &rarr; `pending_review` &rarr; `approved`).
- **`platform_admin`**: Platform supervisory oversight, merchant KYC verification, commission policy enforcement, dispute resolution, and immutable audit logs.

### Security Defenses
- **Row Level Security (RLS):** All 21 database tables enforce Postgres RLS policies. Cross-seller and customer data isolation is enforced at the database layer.
- **Privilege Escalation Protection:** Database triggers (`trg_protect_user_roles`, `trg_protect_seller_approval`) and API validation prevent users from self-promoting to `platform_admin` or approving their own seller accounts/shops.
- **Open-Redirect Defense:** `safeRedirectUrl()` sanitizer strips protocol-relative links (`//`), backslashes (`\`), CRLF characters, and external domains.
- **Password Strength:** Enforced 8+ characters, uppercase, lowercase, and numeric requirements.
- **Route Protection:** Next.js Edge Middleware and Server Actions guard protected paths (`/account/*`, `/seller/*`, `/admin/*`).

---

## Technology Stack
- **Framework:** Next.js 16 (App Router with Server Actions)
- **UI & Language:** React 19, TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS v4, Lucide Icons
- **Database & Auth:** Supabase PostgreSQL 16 with Row Level Security (RLS), `@supabase/ssr`, `@supabase/supabase-js`
- **Validation:** Zod v4

---

## Getting Started

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+` or `v11+`

### Environment Configuration
Copy `.env.example` to `.env.local` and configure your Supabase credentials:
```bash
cp .env.example .env.local
```

Required environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Verification & Quality Assurance Suite

Run the complete 4-step QA verification suite:
```bash
# 1. Run unit test suite (36 tests across 8 suites)
npm run test

# 2. TypeScript strict type check
npm run typecheck

# 3. ESLint code quality & security rules
npm run lint

# 4. Next.js production build & static route generation
npm run build
```

---

## Database Migrations

The database migration suite resides in `supabase/migrations/` and is consolidated into `supabase/deploy/sparehub_complete_schema.sql`.

Execution order:
1. `001_core_extensions_and_enums.sql`: Extensions, enums, audit triggers.
2. `002_users_and_profiles.sql`: Profiles, authorization helpers (`has_role`, `is_platform_admin`, `owns_seller_profile`, `owns_shop`), anti-escalation triggers.
3. `003_seller_and_shop_management.sql`: Seller profiles, shop branches, verification docs, review queues.
4. `004_catalog_and_inventory.sql`: Vehicle categories, brands, models, products, partial unique fitment indexes.
5. `005_orders_checkout_and_fulfillment.sql`: Orders, suborders, items, atomic checkout RPC (`process_checkout_order`).
6. `006_reviews_disputes_and_audit.sql`: Reviews, disputes, and immutable audit ledger.
7. `007_storage_buckets_and_policies.sql`: Private storage buckets (`verification-documents`) and public asset buckets (`product-images`).

> **Note:** The SQL migration suite is completely verified and idempotent. Running against a remote production Supabase instance is staged for controlled release.

---

## Implementation Progress

- [x] **Phase 1: Project Foundation & Design System Scaffolding**
  - Next.js 16 App Router, TypeScript, Tailwind CSS v4, Lucide icons.
  - Reusable accessible UI components (`Button`, `Badge`, `Input`, `Card`, `Skeleton`).
  - Responsive layout shell (Desktop Header, Mobile Menu Drawer, Mobile Bottom Navigation).
  - High-converting marketplace homepage with interactive Vehicle Selector, category shortcuts, demo catalog.
- [x] **Phase 2: Database Architecture & PostgreSQL Migration Suite**
  - 21 domain tables with 100% RLS coverage.
  - Idempotent migration suite and consolidated deployment script.
  - Concurrency-safe atomic checkout function with deadlock prevention (`ORDER BY id ASC FOR UPDATE`).
  - Private storage security for merchant identity verification documents.
- [x] **Phase 3: Authentication & Multi-Role Profiles**
  - Customer registration with Zod validation and password strength enforcement.
  - Session-aware navigation (`AuthNav`) and mobile drawer integration.
  - Customer account portal (`/account`) with profile updater and multi-role badges.
  - Role-protected vendor dashboard (`/seller/dashboard`) and admin control center (`/admin/dashboard`).
  - Next.js SSR session refresh middleware with route guards and open-redirect sanitization.
  - 36 automated unit tests verifying design tokens, vehicle taxonomy, database schema, auth validation, and redirect security.
