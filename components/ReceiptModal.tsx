'use client';

// Receipt popup — opened from "Collect Payment" anywhere (Orders, Kitchen,
// Tables, Waiter). Shows the full bill: every item with its amount, subtotal,
// tax + service charges from Settings (Rs or %), and the total. Includes a
// payment-method picker, a Download/Print button, and the Paid button.
// 100% real data; nothing is faked.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Order, OrderItem } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import {
  parseBillingConfig,
  calcBill,
  chargeLabel,
  PAY_METHODS,
  type BillingConfig,
} from '@/lib/billing';

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
  const [biz, setBiz] = useState<{ name: string; address: string; phone: string }>({
    name: '',
    address: '',
    phone: '',
  });
  const [cfg, setCfg] = useState<BillingConfig>({
    taxValue: 0,
    taxType: 'pct',
    svcValue: 0,
    svcType: 'pct',
  });
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
      const { data } = await createClient()
        .from('restaurants')
        .select('name, theme_config')
        .eq('id', restaurantId)
        .single();
      if (!live || !data) return;
      const tc = (data.theme_config ?? {}) as Record<string, unknown>;
      setBiz({
        name: (data.name as string) ?? '',
        address: typeof tc.address === 'string' ? tc.address : '',
        phone: typeof tc.phone === 'string' ? tc.phone : '',
      });
      setCfg(parseBillingConfig(tc));
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  const subtotal = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const bill = calcBill(subtotal, cfg);
  const created = new Date(order.created_at);
  const dateStr = created.toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  const timeStr = created.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' });
  const methodLabel = PAY_METHODS.find((m) => m.value === method)?.label ?? method;

  const download = () => {
    document.body.classList.add('receipt-printing');
    const done = () => {
      document.body.classList.remove('receipt-printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // Fallback in case afterprint never fires (e.g. dialog cancelled oddly).
    window.setTimeout(done, 2000);
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-[20px] border border-line bg-[var(--c-surface-solid)] shadow-2xl">
        {/* Header (not printed) */}
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

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* ── Printable receipt ── */}
          <div className="receipt-print-area rounded-[14px] border border-dashed border-line/80 bg-white p-4 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
            <div className="text-center">
              <p className="font-display text-[19px] font-black tracking-tight">{biz.name || '—'}</p>
              {biz.address && <p className="mt-0.5 text-[11.5px] font-medium text-slate-500">{biz.address}</p>}
              {biz.phone && <p className="text-[11.5px] font-medium text-slate-500">{biz.phone}</p>}
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11.5px]">
              <p className="text-slate-500">Receipt</p>
              <p className="text-right font-bold">#{order.order_number}</p>
              <p className="text-slate-500">Date</p>
              <p className="text-right font-bold">{dateStr} · {timeStr}</p>
              <p className="text-slate-500">Table</p>
              <p className="text-right font-bold">{tableNo ? `Table ${tableNo}` : order.order_type.replace('_', ' ')}</p>
              {waiterName && (
                <>
                  <p className="text-slate-500">Waiter</p>
                  <p className="text-right font-bold">{waiterName}</p>
                </>
              )}
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <ul className="space-y-2">
              {items.map((it) => (
                <li key={it.id}>
                  <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                    <p className="min-w-0 flex-1 truncate font-bold">
                      {it.item_name}
                      <span className="ml-1.5 font-mono font-medium text-slate-500">
                        {it.quantity} × {fmtPKR(Number(it.unit_price))}
                      </span>
                    </p>
                    <p className="shrink-0 font-mono font-bold">
                      {fmtPKR(it.quantity * Number(it.unit_price))}
                    </p>
                  </div>
                  {it.notes && <p className="mt-0.5 text-[11px] text-slate-500">📝 {it.notes}</p>}
                </li>
              ))}
              {items.length === 0 && <li className="text-[12px] text-slate-500">No items.</li>}
            </ul>

            <div className="my-3 border-t border-dashed border-slate-300" />

            <div className="space-y-1 font-mono text-[12.5px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold">{fmtPKR(bill.subtotal)}</span>
              </div>
              {bill.tax > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tax ({chargeLabel(cfg.taxValue, cfg.taxType)})</span>
                  <span className="font-bold">{fmtPKR(bill.tax)}</span>
                </div>
              )}
              {bill.svc > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Charges ({chargeLabel(cfg.svcValue, cfg.svcType)})</span>
                  <span className="font-bold">{fmtPKR(bill.svc)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-300 pt-2 text-[15px]">
                <span className="font-black">TOTAL</span>
                <span className="font-black">{fmtPKR(bill.total)}</span>
              </div>
            </div>

            <div className="my-3 border-t border-dashed border-slate-300" />

            {/* Method shown on the printed receipt */}
            <p className="text-center font-mono text-[12px] font-bold">
              Payment: {methodLabel}
              {order.payment_status === 'paid' ? ' · ✅ PAID' : ''}
            </p>
            <p className="mt-1 text-center text-[11px] text-slate-400">Thank you for dining with us!</p>

            {/* Method picker — screen only */}
            <div className="mt-3 print:hidden">
              <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                Payment method
              </p>
              <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => setMethod(m.value)}
                    className={`rounded-[10px] border px-1 py-2 text-[11px] font-extrabold transition-all ${
                      method === m.value
                        ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300'
                        : 'border-slate-200 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className="block text-[16px]">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Actions (not printed) */}
        <div className="space-y-2 border-t border-line px-5 py-3.5 print:hidden">
          <div className="flex gap-2">
            <button
              onClick={download}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-line/70 px-4 py-2.5 text-[13px] font-extrabold text-ink transition-all hover:border-brand/40"
            >
              <span>⬇</span> Download
            </button>
            <button
              onClick={() => onPaid(method)}
              disabled={payBusy}
              className="flex flex-[2] items-center justify-center gap-1.5 rounded-[12px] bg-emerald-600 px-4 py-2.5 text-[13.5px] font-black text-white shadow-lift transition-all hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-60"
            >
              {payBusy ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <span>✓</span>
              )}
              Mark Paid · {fmtPKR(bill.total)}
            </button>
          </div>
          <p className="text-center text-[11px] font-medium text-muted">
            Download opens the print dialog — choose “Save as PDF” to save the receipt.
          </p>
        </div>
      </div>
    </div>
  );
}
