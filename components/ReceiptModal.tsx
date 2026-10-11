'use client';

// Thermal receipt popup — opened from "Collect Payment" anywhere (Orders,
// Kitchen, Tables, Waiter). Layout mirrors a real 80mm thermal bill:
// logo, restaurant header, meta rows, item table (Description / Rate / Qty /
// Amount), Sub Total, Tax, FBR POS Charges, Grand Total, Service Charges,
// G. Total. Tax / service charges / FBR / NTN / STRN come from Settings →
// Billing & Receipt (each Rs or %). Includes payment-method picker, a real
// file Download, Print, and the Paid button. 100% real data.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/lib/types';
import {
  parseBillingConfig,
  calcBill,
  chargeLabel,
  fmtReceipt,
  PAY_METHODS,
  type BillingConfig,
  type BillBreakdown,
} from '@/lib/billing';

interface BizInfo {
  name: string;
  address: string;
  phone: string;
  ntn: string;
  strn: string;
  logoUrl: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s2 = String(d.getSeconds()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m}:${s2}${ap}`;
}

/** Single source of truth for the receipt markup (screen + download + print). */
function buildReceiptInner(
  biz: BizInfo,
  order: Order,
  items: OrderItem[],
  bill: BillBreakdown,
  cfg: BillingConfig,
  meta: { date: string; time: string; cashier: string; tableNo: string | null; waiterName: string | null; method: string },
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

function buildReceiptDoc(inner: string, orderNumber: string | number): string {
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

export default function ReceiptModal({
  restaurantId,
  order,
  items,
  tableNo,
  waiterName,
  onClose,
  onPaid,
  payBusy,
}: {
  restaurantId: string;
  order: Order;
  items: OrderItem[];
  tableNo?: string | null;
  waiterName?: string | null;
  onClose: () => void;
  onPaid: (method: string) => void | Promise<void>;
  payBusy?: boolean;
}) {
  const [biz, setBiz] = useState<BizInfo>({ name: '', address: '', phone: '', ntn: '', strn: '', logoUrl: '' });
  const [cfg, setCfg] = useState<BillingConfig>({ taxValue: 0, taxType: 'pct', svcValue: 0, svcType: 'pct', fbrValue: 0 });
  const [cashier, setCashier] = useState('—');
  const [method, setMethod] = useState('cash');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const [{ data }, { data: auth }] = await Promise.all([
        supabase.from('restaurants').select('name, theme_config').eq('id', restaurantId).single(),
        supabase.auth.getUser(),
      ]);
      if (!live) return;
      if (data) {
        const tc = (data.theme_config ?? {}) as Record<string, unknown>;
        const str = (k: string) => (typeof tc[k] === 'string' ? (tc[k] as string) : '');
        setBiz({
          name: (data.name as string) ?? '',
          address: str('address'),
          phone: str('phone'),
          ntn: str('ntn'),
          strn: str('strn'),
          logoUrl: str('logo_url'),
        });
        setCfg(parseBillingConfig(tc));
      }
      if (auth?.user) {
        const { data: prof } = await supabase.from('profiles').select('name').eq('id', auth.user.id).single();
        if (live && prof?.name) setCashier(String(prof.name).split(' ')[0]);
      }
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  const subtotal = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const bill = calcBill(subtotal, cfg);
  const created = new Date(order.created_at);
  const meta = {
    date: created.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
    time: fmtTime(created),
    cashier,
    tableNo: tableNo ?? null,
    waiterName: waiterName ?? null,
    method: PAY_METHODS.find((m) => m.value === method)?.label ?? method,
  };
  const inner = buildReceiptInner(biz, order, items, bill, cfg, meta);

  const download = () => {
    const blob = new Blob([buildReceiptDoc(inner, order.order_number)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Receipt-${order.order_number}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const print = () => {
    // Dedicated print document: ONLY the receipt exists in it, so the print
    // preview is always exactly the receipt — 1 page, no blank sheets, no
    // CSS isolation tricks on the live app.
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) {
      // Popup blocked — fall back to in-page print via the portal.
      document.body.classList.add('receipt-printing');
      const done = () => {
        document.body.classList.remove('receipt-printing');
        window.removeEventListener('afterprint', done);
      };
      window.addEventListener('afterprint', done);
      window.print();
      window.setTimeout(done, 5000);
      return;
    }
    w.document.write(buildReceiptDoc(inner, order.order_number));
    w.document.close();
    w.focus();
    const doPrint = () => {
      w.print();
    };
    // Give the document a beat to render (logo image etc.) before printing.
    if (w.document.readyState === 'complete') window.setTimeout(doPrint, 350);
    else w.addEventListener('load', () => window.setTimeout(doPrint, 350));
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-[20px] border border-line bg-[var(--c-surface-solid)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5 print:hidden">
          <h3 className="font-display text-[16px] font-black text-ink">🧾 Receipt</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[18px] font-bold text-muted transition-colors hover:bg-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-200 px-5 py-4 dark:bg-black/40">
          {/* Printable receipt — single markup source for screen/download/print */}
          <div className="receipt-print-area" dangerouslySetInnerHTML={{ __html: inner }} />
        </div>

        {/* Method picker (screen only) */}
        <div className="border-t border-line px-5 pt-3 print:hidden">
          <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-muted">Payment method</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {PAY_METHODS.map((m) => (
              <button
                key={m.value}
                onClick={() => setMethod(m.value)}
                className={`rounded-[10px] border px-1 py-2 text-[11px] font-extrabold transition-all ${
                  method === m.value
                    ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-line/70 text-muted hover:text-ink'
                }`}
              >
                <span className="block text-[16px]">{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 px-5 py-3.5 print:hidden">
          <div className="flex gap-2">
            <button
              onClick={download}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-line/70 px-3 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:border-brand/40"
            >
              <span>⬇</span> Download
            </button>
            <button
              onClick={print}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-line/70 px-3 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:border-brand/40"
            >
              <span>🖨</span> Print
            </button>
          </div>
          <button
            onClick={() => onPaid(method)}
            disabled={payBusy}
            className="flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-emerald-600 px-4 py-3 text-[14px] font-black text-white shadow-lift transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
          >
            {payBusy ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <span>✓</span>
            )}
            Mark Paid · {fmtReceipt(bill.total)}
          </button>
        </div>
      </div>

      {/* Print portal: direct child of <body> so the print CSS can isolate it.
          Screen: display:none. Print: only this prints — 1 page, no blanks. */}
      {typeof document !== 'undefined' &&
        createPortal(
          <div className="receipt-print-portal" dangerouslySetInnerHTML={{ __html: inner }} />,
          document.body,
        )}
    </div>
  );
}
