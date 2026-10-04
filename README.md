# OrderKar SaaS — multi-tenant restaurant platform (Phase 1)

Production-grade SaaS for Pakistani restaurants: QR table ordering, live kitchen
display, waiter app, manager + owner analytics — one codebase, many restaurants,
fully isolated per tenant via PostgreSQL Row-Level Security.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS v3 · Supabase
(Postgres + Auth + Realtime) · `@supabase/ssr` — **no Prisma** (direct client + RLS).

> The single-restaurant localStorage prototype lives in a separate repo and is
> the feature reference. This repo is the production multi-tenant build.

---

## 1. Database setup (Supabase)

1. Create a Supabase project (free tier works for 10–15 restaurants).
2. **SQL Editor → run `supabase/schema.sql`** (idempotent — safe to re-run).
   Creates all tables + RLS policies + helper functions.
3. **SQL Editor → run `supabase/seed.sql`** (re-runnable).
   Creates 2 demo restaurants:
   - **Spice Villa** — slug `spice-villa` (G.T. Road, Kharian)
   - **Lahore Grill House** — slug `lahore-grill` (fictional demo data)
   
   Each gets 6 tables, 8 menu categories, 20 menu items and a subscription row.
4. **Authentication → Users → Add user** — create one user per staff member.
5. Copy each user's UUID and run the `profiles` INSERT template at the bottom
   of `seed.sql` (role: `owner` / `manager` / `waiter` / `kitchen`).
   
   For the platform super-admin (you): insert a profile with
   `restaurant_id = NULL`, `role = 'super_admin'`, `is_super_admin = true`.
6. **Authentication → Sign In / Providers → Email**: turn **OFF** "Confirm
   email" for the smoothest onboarding (or keep it on — the signup flow tells
   the user to confirm first).

## 2. Environment

```bash
cp .env.example .env.local
```

Fill in (Dashboard → Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

> The **service_role key is NEVER used** in this codebase — not even on the
> server. All access goes through the anon key + RLS. Never commit `.env.local`.

## 3. Run / deploy

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # must pass
npm run lint     # must pass
```

**Vercel:** import the repo, add the two env vars, deploy. No other config needed.

The build is safe without real keys (placeholder fallback + setup notices), but
every data page needs a configured project at runtime.

## 4. Routes

| Route | Who | What |
|---|---|---|
| `/` | public | SaaS marketing landing, pricing, CTA |
| `/login`, `/signup` | public | Staff login · restaurant-owner signup (creates tenant + trial) |
| `/admin` | super_admin | All-restaurants picker |
| `/r/[slug]` | public | Restaurant home |
| `/r/[slug]/table/[n]` | public (QR) | Customer menu, cart, live order tracker |
| `/r/[slug]/feedback` | public (QR) | Star ratings + comments |
| `/r/[slug]/waiter` | waiter+ | Table grid, tableside ordering, my orders |
| `/r/[slug]/kitchen` | kitchen+ | Live KDS queue, beep + flash, status buttons |
| `/r/[slug]/manager` | manager+ | Today's stats, orders feed, tables, waste log, QR codes |
| `/r/[slug]/owner` | owner | Analytics (KPIs, trends, rush hours, top items), staff, menu manager, QR codes |

Role hierarchy: `kitchen < waiter < manager < owner < super_admin` — higher roles
inherit lower routes. `middleware.ts` enforces session + tenant binding (your
profile's restaurant must match the URL slug) + role gates.

## 5. Multi-tenancy & RLS (how isolation works)

- Every tenant table has `restaurant_id`. RLS is **enabled on all tables**.
- Staff policies: `restaurant_id = public.my_restaurant_id()` — a
  `SECURITY DEFINER` helper reading the signed-in user's `profiles` row
  (no policy recursion). Super-admins bypass via `public.am_super_admin()`.
- Public QR flows need anonymous access, granted narrowly:
  - `restaurants`, `menu_categories`, `menu_items`, `tables` — anon SELECT
  - `orders`, `order_items` — anon SELECT (status tracker) + anon INSERT
    (placing orders)
  - `reviews` — anon SELECT + INSERT (feedback page)
- Realtime (`postgres_changes`) respects the same SELECT policies, so the
  kitchen/manager/customer screens update live with zero extra backend.
- Signup inserts go through RLS too: `restaurants_insert` (authenticated) and
  `profiles_insert_own` (`auth.uid() = id`).

## 6. QR codes

`/r/[slug]/owner` and `/manager` render a QR section: one QR per table
(`{origin}/r/{slug}/table/N` — built from `window.location.origin`, so QRs
always match the live deployment) plus a reviews QR. QRs render as inline SVG
at runtime (`qrcode` package); **Download PNG** converts via canvas client-side;
**Print all** prints a clean sheet.

## 7. Project structure

```
app/
  page.tsx                 SaaS landing (pricing, features)
  login/  signup/          Auth (signup creates tenant via server action)
  admin/                   Super-admin restaurant picker
  r/[slug]/                Tenant shell (slug → restaurant, 404 if unknown)
    page.tsx               Restaurant home
    table/[id]/page.tsx    Customer QR ordering
    feedback/page.tsx      Public reviews
    waiter/ kitchen/       Staff apps (realtime)
    manager/ owner/        Manager pulse · Owner analytics + menu + QR
components/
  ui.tsx                   Glass kit (Card, Btn, Input, Kpi, Tabs…)
  charts.tsx               Hand-rolled SVG charts
  KitchenApp/WaiterApp/ManagerApp/OwnerApp
  MenuOrder/OrderTracker/StatusPill/QrSection/StaffShell/ThemeToggle
lib/
  supabase/client.ts|server.ts   (@supabase/ssr, placeholder-safe)
  tenant.ts  auth.ts  staff-server.ts
  types.ts  format.ts  qr.ts
middleware.ts              Session + tenant binding + role gates for /r/*
supabase/
  schema.sql               Full multi-tenant schema + RLS (idempotent)
  seed.sql                 2 demo restaurants + profiles template
```

## 8. What's next (Phase 2+)

- AI menu scanner (photo → Textract/Vision → menu items)
- Inventory + recipes + purchase suggestions
- JazzCash / EasyPaisa payments, thermal printer (ESC/POS)
- Subscription billing + trial expiry enforcement
- Email confirmation hardening, password reset, staff invites
