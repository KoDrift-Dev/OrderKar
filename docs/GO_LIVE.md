# OrderKar v1.0 — GO LIVE

## Launch Status

**READY FOR FIRST CUSTOMER**

- Version: v1.0
- Deployed commit: `af94b4bae1ff`
- Production URL: https://orderkarr.vercel.app
- Date: 2026-10-12

## Verification Summary

| Check | Result |
|---|---|
| Unit tests | 58/58 PASS |
| TypeScript | 0 errors |
| Production build | Success |
| E2E smoke tests | 6/6 PASS |
| verify-production.sql | CONFIRMED (manual DB verification) |
| Security hardening | ~95% |

### E2E Tests (all on production)

1. Tenant isolation (Spice Route vs Spice Villa) — PASS
2. Waiter owner-route denial — PASS
3. Open redirect protection — PASS
4. Anonymous QR order (#77, Rs 430) — PASS
5. Slug change rejection (UI read-only) — PASS
6. Waiter POS cash payment (#78, Rs 690, receipt shown) — PASS

## What Works (Confirmed)

- **Multi-tenant isolation** — 2 restaurants verified live, no cross-tenant leakage
- **Customer QR ordering** — anonymous, server-side pricing enforced
- **Waiter ordering + POS cash payment + receipt** — full flow verified end-to-end
- **Kitchen realtime flow** — New → Preparing → Ready transitions working
- **Owner console** — 15 sections (Dashboard, Orders, Tables, Kitchen, Menu, Sales & POS, Staff, Reports, Settings, etc.)
- **Inventory** — atomic stock deduction, low-stock alerts
- **Activity logging** — order creation, payments, tracking history
- **Security** — RLS tenant isolation, server-side rate limiting, open-redirect protection, billing paywall guard, slug immutability, deactivated-staff API gate

## Known Deferred Items (Not Blockers)

- Live JazzCash/EasyPaisa gateway (customers pay via QR/card machine directly)
- ESC/POS direct printer integration
- Custom domains (DNS parked until first deal)
- Multi-branch, public API, mobile apps, forecasting (Phase 3 — frozen)
- Redis-based rate limiting (current in-memory limiter is abuse mitigation, not distributed quota)
- Fully role-aware RLS refinements (deferred)

## Manual-Blocked Items (Accepted as Non-Blockers)

1. **Concurrent inventory deduction** — true concurrency cannot be reliably tested via browser automation. Code-verified: atomic RPC uses `SELECT FOR UPDATE` + `GREATEST(0, ...)` so stock never goes negative.
2. **Deactivated staff 403** — code-verified (`is_active` check on protected APIs). Live production test deferred (requires deactivating a real staff account).

## First-Customer Onboarding Checklist

1. Create restaurant + menu + tables + QR codes
2. Create owner/manager/waiter/kitchen accounts
3. Print QR stands for tables
4. Train staff (2 hours)
5. First live order test (QR → kitchen → payment → receipt)
6. Monitor first 10 orders closely

## Support Escalation Path

- **Bug report** → WhatsApp group → fix within 24h
- **Critical issue** → immediate hotfix

---

*Project CLOSED for v1. No further changes unless explicitly requested.*
