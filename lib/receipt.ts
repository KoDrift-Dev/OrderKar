// Shared receipt builders — single source of truth for ALL receipt HTML.
// Both components/ReceiptModal.tsx (thermal billing receipt) and
// components/Receipt.tsx (POS browser/thermal receipts) import from here.
// Pure functions: no DOM, no React. Safe to use anywhere.

import { tr, type Lang } from '@/lib/i18n';
import { fmtReceipt, chargeLabel, type BillingConfig, type BillBreakdown } from '@/lib/billing';
import type { Order, OrderItem } from '@/lib/types';

// ── Shared HTML escaper ─────────────────────────────────────────────────────
export function esc(s: string | null | undefined): string {
  if (s == null) return '';
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Types ───────────────────────────────────────────────────────────────────
export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export interface ReceiptData {
  lang: Lang;
  restaurant: { name: string; address?: string; phone?: string; email?: string };
  orderNo: number;
  date: Date;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableLabel?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  cashier?: string;
  items: ReceiptItem[];
  paymentMethod: string;
  tendered?: number | null;
  fbrInvoiceNo?: string | null; // Phase 2 — FBR integration
}

export interface BizInfo {
  name: string;
  address: string;
  phone: string;
  ntn: string;
  strn: string;
  logoUrl: string;
}

export interface ReceiptMeta {
  date: string;
  time: string;
  cashier: string;
  tableNo: string | null;
  waiterName: string | null;
  method: string;
}

// ── POS receipt builders (browser + thermal text) ───────────────────────────
export function typeLabel(lang: Lang, orderType: ReceiptData['orderType']): string {
  if (orderType === 'dine_in') return tr(lang, 'rct_type_dinein');
  if (orderType === 'takeaway') return tr(lang, 'rct_type_takeaway');
  return tr(lang, 'rct_type_delivery');
}

const PAY_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
};

export function payMethodLabel(method: string): string {
  return PAY_LABEL[method] ?? method;
}

export function pkr(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-PK');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Shared date formatter: `15-Jan-26 14:05`. Used by receipt builders + Receipt.tsx. */
export function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}-${d.toLocaleString('en', { month: 'short' })}-${String(d.getFullYear()).slice(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dots(left: string, right: string, width: number): string {
  const gap = Math.max(2, width - left.length - right.length);
  return left + '.'.repeat(gap) + right;
}

export function buildThermal(d: ReceiptData): string {
  const lang = d.lang;
  const W = 42;
  const L: string[] = [];
  const c = (t: string) => L.push(t.padStart(Math.floor((W + t.length) / 2)).slice(0, W));
  const line = (t = '') => L.push(t.slice(0, W));
  const sep = () => L.push('-'.repeat(W));
  const total = d.items.reduce((s, i) => s + i.qty * i.price, 0);
  const change = d.tendered != null ? d.tendered - total : null;

  c(d.restaurant.name.toUpperCase());
  if (d.restaurant.address) c(d.restaurant.address);
  if (d.restaurant.phone) c(d.restaurant.phone);
  sep();
  line(dots(`${tr(lang, 'rct_order')} #${d.orderNo}`, fmtDate(d.date), W));
  line(
    dots(
      d.orderType === 'dine_in' && d.tableLabel
        ? `${typeLabel(lang, d.orderType)} · ${d.tableLabel}`
        : typeLabel(lang, d.orderType),
      d.cashier ? tr(lang, 'rct_cashier', { name: d.cashier }) : '',
      W,
    ),
  );
  if (d.customerName) line(tr(lang, 'rct_customer', { name: d.customerName }));
  if (d.customerPhone) line(tr(lang, 'rct_phone', { phone: d.customerPhone }));
  if (d.deliveryAddress) line(tr(lang, 'rct_address', { addr: d.deliveryAddress }));
  sep();
  for (const i of d.items) {
    line(`${i.qty}x ${i.name}`.slice(0, W));
    line(dots('', pkr(i.qty * i.price), W));
  }
  sep();
  line(dots(tr(lang, 'rct_total'), pkr(total), W));
  line(dots(tr(lang, 'rct_payment'), PAY_LABEL[d.paymentMethod] ?? d.paymentMethod, W));
  if (d.tendered != null) {
    line(dots(tr(lang, 'rct_tendered'), pkr(d.tendered), W));
    line(dots(tr(lang, 'rct_change'), pkr(change ?? 0), W));
  }
  if (d.fbrInvoiceNo) {
    sep();
    line(dots(tr(lang, 'rct_fbr_invoice'), d.fbrInvoiceNo, W));
  }
  sep();
  c(tr(lang, 'rct_thanks'));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #${d.orderNo}</title>
<style>
@page { size: 80mm auto; margin: 0; }
body { width: 80mm; margin: 0; padding: 8px 6px; font-family: "Courier New", monospace; font-size: 12px; line-height: 1.45; color: #000; }
pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
</style></head><body><pre>${esc(L.join('\n'))}</pre>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
}

export function buildBrowser(d: ReceiptData): string {
  const lang = d.lang;
  const total = d.items.reduce((s, i) => s + i.qty * i.price, 0);
  const change = d.tendered != null ? d.tendered - total : null;
  const rows = d.items
    .map(
      (i) => `<tr><td>${esc(i.name)}<span class="qty">× ${i.qty}</span></td><td class="r">${pkr(i.qty * i.price)}</td></tr>`,
    )
    .join('');
  const typeLine =
    d.orderType === 'dine_in' && d.tableLabel
      ? `${esc(typeLabel(lang, d.orderType))} · ${esc(d.tableLabel)}`
      : esc(typeLabel(lang, d.orderType));

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #${d.orderNo}</title>
<style>
body { font-family: -apple-system, "Segoe UI", sans-serif; color: #111; display: flex; justify-content: center; padding: 24px; }
.receipt { width: 340px; border: 1px solid #ddd; border-radius: 12px; padding: 24px; }
h1 { font-size: 20px; margin: 0; text-align: center; }
.addr { text-align: center; color: #666; font-size: 12px; margin: 4px 0 0; }
hr { border: none; border-top: 1px dashed #ccc; margin: 14px 0; }
.meta { font-size: 12.5px; color: #444; display: flex; justify-content: space-between; margin: 3px 0; }
table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
td { padding: 5px 0; vertical-align: top; }
td.r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.qty { color: #888; margin-left: 6px; font-size: 12px; }
.total { display: flex; justify-content: space-between; font-size: 17px; font-weight: 800; }
.pay { display: flex; justify-content: space-between; font-size: 13px; margin: 3px 0; color: #444; }
.thanks { text-align: center; color: #888; font-size: 12px; margin-top: 6px; }
.fbr { background: #f4f4f4; border-radius: 8px; padding: 8px 10px; font-size: 12px; margin-top: 8px; }
@media print { body { padding: 0; } .receipt { border: none; border-radius: 0; width: 100%; } }
</style></head><body><div class="receipt">
<h1>${esc(d.restaurant.name)}</h1>
${d.restaurant.address ? `<p class="addr">${esc(d.restaurant.address)}</p>` : ''}
${d.restaurant.phone ? `<p class="addr">${esc(d.restaurant.phone)}</p>` : ''}
<hr>
<div class="meta"><span>${esc(tr(lang, 'rct_order'))} <b>#${d.orderNo}</b></span><span>${fmtDate(d.date)}</span></div>
<div class="meta"><span>${typeLine}</span>${d.cashier ? `<span>${esc(tr(lang, 'rct_cashier', { name: d.cashier }))}</span>` : ''}</div>
${d.customerName ? `<div class="meta"><span>${esc(tr(lang, 'rct_customer', { name: d.customerName }))}</span></div>` : ''}
${d.customerPhone ? `<div class="meta"><span>${esc(tr(lang, 'rct_phone', { phone: d.customerPhone }))}</span></div>` : ''}
${d.deliveryAddress ? `<div class="meta"><span>${esc(tr(lang, 'rct_address', { addr: d.deliveryAddress }))}</span></div>` : ''}
<hr>
<table>${rows}</table>
<hr>
<div class="total"><span>${esc(tr(lang, 'rct_total'))}</span><span>${pkr(total)}</span></div>
<div class="pay"><span>${esc(tr(lang, 'rct_payment'))}</span><span>${esc(PAY_LABEL[d.paymentMethod] ?? d.paymentMethod)}</span></div>
${d.tendered != null ? `<div class="pay"><span>${esc(tr(lang, 'rct_tendered'))}</span><span>${pkr(d.tendered)}</span></div><div class="pay"><span>${esc(tr(lang, 'rct_change'))}</span><span>${pkr(change ?? 0)}</span></div>` : ''}
${d.fbrInvoiceNo ? `<div class="fbr">${esc(tr(lang, 'rct_fbr_invoice'))}: <b>${esc(d.fbrInvoiceNo)}</b></div>` : ''}
<hr>
<p class="thanks">${esc(tr(lang, 'rct_thanks'))}</p>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
}

// ── Thermal billing receipt (ReceiptModal) ──────────────────────────────────
// Single source of truth for the receipt markup (screen + download + print).

export function buildReceiptInner(
  biz: BizInfo,
  order: Order,
  items: OrderItem[],
  bill: BillBreakdown,
  cfg: BillingConfig,
  meta: ReceiptMeta,
): string {
  const dash = `<div style="border-top:1px dashed #000;margin:7px 0"></div>`;
  const row = (label: string, value: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;${bold ? 'font-weight:900;' : ''}"><span>${label}</span><span>${value}</span></div>`;

  const itemRows = items
    .map((it) => {
      const amt = it.quantity * Number(it.unit_price);
      return (
        `<div style="display:flex;align-items:baseline;gap:6px;margin:2px 0">` +
        `<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.item_name.toUpperCase())}</span>` +
        `<span style="width:64px;text-align:right;flex-shrink:0">${fmtReceipt(Number(it.unit_price))}</span>` +
        `<span style="width:34px;text-align:right;flex-shrink:0">${fmtReceipt(it.quantity)}</span>` +
        `<span style="width:76px;text-align:right;flex-shrink:0;font-weight:700">${fmtReceipt(amt)}</span>` +
        `</div>` +
        (it.notes ? `<div style="font-size:10px;margin:-1px 0 2px">&gt; ${esc(it.notes)}</div>` : '')
      );
    })
    .join('');

  const totals =
    row(`Items: ${items.reduce((s, i) => s + i.quantity, 0)}`, `Sub Total&nbsp;&nbsp;&nbsp;&nbsp;${fmtReceipt(bill.subtotal)}`) +
    (bill.tax > 0
      ? row('', `Tax ${chargeLabel(cfg.taxValue, cfg.taxType)}&nbsp;&nbsp;&nbsp;&nbsp;${fmtReceipt(bill.tax)}`)
      : '') +
    (bill.fbr > 0 ? row('', `FBR POS CHARGES&nbsp;&nbsp;&nbsp;&nbsp;${fmtReceipt(bill.fbr)}`) : '') +
    (bill.tax > 0 || bill.fbr > 0 ? row('', `Grand Total&nbsp;&nbsp;&nbsp;&nbsp;${fmtReceipt(bill.grandTotal)}`, true) : '') +
    (bill.svc > 0
      ? row('', `Service Charges&nbsp;&nbsp;&nbsp;&nbsp;${fmtReceipt(bill.svc)}`)
      : '') +
    `<div style="display:flex;justify-content:space-between;font-weight:900;font-size:15px;margin-top:2px"><span>G. Total</span><span>${fmtReceipt(bill.total)}</span></div>`;

  return (
    `<div style="width:300px;max-width:100%;margin:0 auto;background:#fff;color:#000;font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.5;padding:10px 8px">` +
    `<div style="text-align:center">` +
    (biz.logoUrl ? `<img src="${esc(biz.logoUrl)}" alt="" style="max-height:64px;max-width:140px;margin-bottom:4px" />` : '') +
    `<div style="font-weight:900;font-size:17px;letter-spacing:0.5px">${esc((biz.name || 'RESTAURANT').toUpperCase())}</div>` +
    (biz.address ? `<div>${esc(biz.address)}</div>` : '') +
    (biz.phone ? `<div>Tel : ${esc(biz.phone)}</div>` : '') +
    (biz.ntn || biz.strn
      ? `<div>NTN # ${esc(biz.ntn || '—')} : STRN # ${esc(biz.strn || '—')}</div>`
      : '') +
    `</div>` +
    dash +
    `<div style="display:flex;justify-content:space-between"><span>${esc(meta.date)}</span><span>${esc(meta.time)}</span><span>Cashier: ${esc(meta.cashier)}</span></div>` +
    `<div style="display:flex;justify-content:space-between"><span>Chq#&nbsp;&nbsp;${esc(String(order.order_number))}</span><span>Table#&nbsp;&nbsp;${esc(meta.tableNo ?? '—')}</span></div>` +
    `<div style="display:flex;justify-content:space-between"><span>${esc(order.order_type === 'takeaway' ? 'TAKEAWAY' : 'DINE IN')}</span>${meta.waiterName ? `<span>Waiter: ${esc(meta.waiterName)}</span>` : ''}</div>` +
    dash +
    `<div style="display:flex;gap:6px;font-weight:900;border-bottom:1px solid #000;padding-bottom:3px;margin-bottom:4px">` +
    `<span style="flex:1">Description</span>` +
    `<span style="width:64px;text-align:right;flex-shrink:0">Rate</span>` +
    `<span style="width:34px;text-align:right;flex-shrink:0">Qty</span>` +
    `<span style="width:76px;text-align:right;flex-shrink:0">Amount</span></div>` +
    (itemRows || `<div>No items.</div>`) +
    dash +
    totals +
    dash +
    `<div style="text-align:center">Payment: ${esc(meta.method)}${order.payment_status === 'paid' ? ' · PAID' : ''}</div>` +
    `<div style="text-align:center;margin-top:6px;font-size:11px">Powered by OrderKar</div>` +
    `</div>`
  );
}

export function buildReceiptDoc(inner: string, orderNumber: string | number): string {
  // The @page size is set from JS after measuring the receipt, so the printed
  // page is exactly the receipt slip (80mm thermal) — no big blank paper.
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>Receipt #${esc(String(orderNumber))}</title>` +
    `<style>*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff}</style></head>` +
    `<body><div id="r">${inner}</div>` +
    `<script>
      function fitPage() {
        var el = document.getElementById('r');
        if (!el) return;
        var hmm = Math.ceil((el.offsetHeight * 25.4) / 96) + 2;
        var st = document.createElement('style');
        st.textContent = '@page{size:80mm ' + hmm + 'mm;margin:0;}';
        document.head.appendChild(st);
      }
      if (document.readyState === 'complete') fitPage();
      else window.addEventListener('load', fitPage);
    <\/script></body></html>`
  );
}

// ── File download ───────────────────────────────────────────────────────────
// Saves a receipt HTML document as a real file. Used by ReceiptModal's
// Download button and as the fallback when a print popup is blocked.
export function downloadReceiptDoc(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}
