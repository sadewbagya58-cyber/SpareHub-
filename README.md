# SpareHub
**Every Part. One Marketplace.**

SpareHub is a multi-vendor automotive spare parts marketplace built initially for Sri Lanka, designed with scalability for regional and international expansion.

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

## Technology Stack
- **Framework:** Next.js 16 (App Router)
- **UI & Language:** React 19, TypeScript 5 (Strict Mode)
- **Styling:** Tailwind CSS v4, Lucide Icons
- **Database & Auth (Phases 2–4):** Supabase PostgreSQL 16 with Row Level Security (RLS)

---

## Getting Started

### Prerequisites
- Node.js `v20+` or `v24+`
- npm `v10+` or `v11+`

### Installation
```bash
npm install
```

### Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Quality Assurance & Build Commands
```bash
# TypeScript strict type check
npm run typecheck

# ESLint code quality audit
npm run lint

# Production build verification
npm run build
```

---

## Project Structure
```
c:\Users\x\SpareHub\
├── docs\
│   └── SPAREHUB_ARCHITECTURE_PLAN.md   # Master architecture and specifications
├── src\
│   ├── app\                            # Next.js App Router pages and layouts
│   ├── components\
│   │   ├── layout\                     # Navbar, Footer, MobileNav
│   │   ├── marketplace\                # VehicleSelector, DemoCatalog, SellerCTA
│   │   └── ui\                         # Accessible atomic components (Button, Badge, Input, Card)
│   ├── lib\
│   │   ├── constants.ts                # Brand colors, vehicle types, districts
│   │   ├── types.ts                    # Shared TypeScript types
│   │   └── utils.ts                    # Tailwind merge and currency formatting
│   └── styles\                         # Global CSS & brand tokens
└── .env.example                        # Template for required environment variables
```

---

## Phase 1 Implementation Status
- [x] Project initialized with strict TypeScript, Next.js 16 App Router, and Tailwind CSS v4.
- [x] Global SpareHub design tokens and color palette implemented.
- [x] Responsive layout shell built (Desktop Header, Mobile Menu Drawer, Sticky Bottom Navigation).
- [x] Atomic UI components with non-blocking local loading states (`Button`, `Badge`, `Input`, `Card`, `Skeleton`).
- [x] Initial marketplace homepage built with interactive Vehicle Selector, category shortcuts, demo catalog, and seller onboarding call-to-action.
- [x] `.env.example` created.
- [x] Architecture plan preserved at `docs/SPAREHUB_ARCHITECTURE_PLAN.md`.

### Phase 1 Limitations
- Database queries currently present structured demonstration datasets pending Phase 2 (Database Schema) and Phase 3 (Supabase Auth).
- Live payment gateways are intentionally not integrated in Phase 1 pending platform owner commercial approval.
