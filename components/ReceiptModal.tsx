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
  fmtReceipt,
  PAY_METHODS,
  type BillingConfig,
  type BillBreakdown,
} from '@/lib/billing';
import {
  buildReceiptInner,
  buildReceiptDoc,
  downloadReceiptDoc,
  type BizInfo,
} from '@/lib/receipt';

function fmtTime(d: Date): string {
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const s2 = String(d.getSeconds()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m}:${s2}${ap}`;
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
    downloadReceiptDoc(buildReceiptDoc(inner, order.order_number), `Receipt-${order.order_number}.html`);
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
