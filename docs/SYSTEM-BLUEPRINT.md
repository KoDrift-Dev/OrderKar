# OrderKar — System Blueprint (as of 2026-10-05)

## 1. Roles & Access

| Role | Route | Kya kar sakta hai | Kya NAHI kar sakta |
|---|---|---|---|
| **Owner** | `/r/[slug]/owner` | Sab dekho: Dashboard (KPIs/charts), Sales (analytics + CSV), Operations (**read-only** kitchen monitor + table performance), Staff (leaderboard), Customers (reviews), Tables (add/edit/delete + QR), Settings (restaurant details, apna account, email/password change) | Kitchen order status change nahi kar sakta (sirf monitor) |
| **Manager** | `/r/[slug]/manager` | Today's orders dekho, **payment collect** (ready orders — waiter wale + QR self-orders dono), tables status, waste log, QR codes | Kitchen status change nahi, menu edit nahi |
| **Kitchen** | `/r/[slug]/kitchen` | Live orders: **pending → preparing → ready**, cancel with reason (5 reasons) | Payment nahi, menu nahi |
| **Waiter** | `/r/[slug]/waiter` | Tables dekho, kisi table ke liye **order lo**, My Orders, apne ready orders pe **payment collect** | Dusre waiter ke orders nahi, kitchen status nahi |
| **Customer** | `/r/[slug]/table/[n]` (QR, no login) | Menu dekho, order karo, apne order ka **status track** karo | Kuch aur nahi |
| **Super admin** | `/admin` | Cross-restaurant (internal) | — |

## 2. Order Lifecycle (statuses)

```
pending → preparing → ready → completed
   ↓ (kisi bhi waqt)
cancelled (reason: customer request / kitchen error / long wait /
           item unavailable / duplicate order)
```

- **pending**: naya order aya (QR customer ya waiter ne lagaya)
- **preparing**: kitchen ne uthaya
- **ready**: khana tayyar — ab payment collect ho sakti hai
- **completed**: payment ho gayi (`payment_status` = paid + method save)
- **cancelled**: kitchen ne cancel kiya

**Kaun status badalta hai:**
- pending → preparing → ready: **sirf Kitchen**
- ready → completed: **Waiter/Manager** (Collect payment dabane pe auto)
- cancelled: **sirf Kitchen** (reason ke saath)

**Automatic cheezein (koi button nahi):**
- Table cards: Free / Seated (purple→ab teal) / Bill (amber) — orders se auto derive
- Kitchen display pe naya order — realtime auto
- Customer tracker updates — auto
- Owner analytics/reports — auto

## 3. Example Scenario (scan → pay)

1. Customer T3 pe baithta hai, QR scan → menu khulta hai
2. 2× Chicken Karahi + 2× Naan → **Place order** → Order #1042 (pending) → T3 card **Seated**
3. Kitchen display pe foran order (realtime) → kitchen **Preparing**
4. Khana tayyar → kitchen **Ready** → T3 **Bill (amber)**, customer tracker pe "Ready"
5. Waiter khana serve karta hai
6. Customer bill mangta hai → waiter/manager **Collect payment** → Rs 2,450 Cash → order **paid + completed** → T3 **Free**
7. Owner dashboard: revenue +Rs 2,450, Sales mein cash entry

## 4. Gaps — kya NAHI hai abhi

### A. POS System (counter) — sab se bara gap
Abhi order sirf 2 raste se aata hai: customer QR scan, ya waiter app.
Counter pe khare bande ke liye koi tez screen nahi: walk-in / takeaway /
delivery phone order → item tap → cart → payment → receipt.
**Chahiye:** POS screen (fast item grid, cart, payment methods, receipt print).

### B. Receipt
Payment ke baad koi receipt nahi — na print, na view.
**Chahiye:** receipt view (restaurant name, order no, date/time, table,
items × qty × price, subtotal, total, payment method, "thank you") + print.

### C. Order History / Record
Manager ke paas sirf **Today's Orders** hai. Kal/parson/pichle hafte ke
orders dekhne ka koi tareeqa nahi.
**Chahiye:** history with date filter + search (order no, table, amount).

### D. Bill Request (customer side)
Customer khud bill nahi mangwa sakta — waiter ko awaz deni parti hai.
**Chahiye (optional):** tracker pe "Request Bill" button → waiter/manager ko
alert (unke orders feed mein "bill requested" badge).

### E. Day Close (Z-report)
Din band karte waqt ek summary: cash kitna, card kitna, JazzCash/EasyPaisa
kitna, total orders, cancelled kitne.
**Chahiye:** day-close summary screen (manager/owner).

### F. Refund / Void paid order
Paid order wapas karne ka koi flow nahi.
**Chahiye (baad mein):** paid order pe "Refund" (reason ke saath, record rehta hai).

### G. Discounts
Koi discount system nahi (pehle se Phase-2 list mein tha).

## 5. Build Status

- [x] **POS tab** (manager dashboard) — dine-in/takeaway/delivery, fast tiles, cart, cash tendered/change, 4 payment methods (2026-10-05)
- [x] **Receipt** — on-screen preview + print: browser format + 80mm thermal (2026-10-05)
- [x] **Paid-order completion** — ready+paid orders get "Complete order" (manager/waiter); tableState: ready+paid = Seated, ready+unpaid = Bill (2026-10-05)
- [x] **Superadmin POS toggle** — /admin per-restaurant on/off (theme_config.pos_enabled, default on) (2026-10-05)
- [x] **Language: Roman Urdu / English** (2026-10-05) — superadmin sets per restaurant in /admin (theme_config.language, default roman). 300+ strings converted across owner/manager/waiter/kitchen/customer/feedback/login. Login page has its own toggle (localStorage).
- [ ] **Order history** — date filter + search (manager/owner)
- [ ] **Day close summary**
- [ ] **Request Bill button** (customer tracker → staff alert)
- [ ] **FBR module (Phase 2)** — settings (POS ID + token, secure table mein), bill pe FBR ko bhejna, invoice number + QR receipt pe, retry queue agar net down ho
- [ ] Discounts, refunds/voids (baad mein)
