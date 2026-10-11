'use client';

// Receipt — on-screen preview + printing in two formats:
//  - "browser": normal full-width receipt
//  - "thermal": 80mm thermal-printer layout (monospace)
// Printing opens a standalone window so page print-CSS can't interfere.
//
// All HTML builders live in lib/receipt.ts (shared with ReceiptModal).

import { useT } from '@/lib/i18n';
import {
  buildBrowser,
  buildThermal,
  downloadReceiptDoc,
  payMethodLabel,
  pkr,
  typeLabel,
  type ReceiptData as ReceiptDataT,
  type ReceiptItem as ReceiptItemT,
} from '@/lib/receipt';

// Re-exported so existing callers (`from './Receipt'`) keep working.
export type { ReceiptDataT as ReceiptData, ReceiptItemT as ReceiptItem };

function fmtDate(d: Date): string {
  const pad2 = (n: number) => String(n).padStart(2, '0');
  return `${pad2(d.getDate())}-${d.toLocaleString('en', { month: 'short' })}-${String(d.getFullYear()).slice(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Open a print window with the receipt. Call from a click handler.
 * Returns true when the window opened, false when the popup was blocked
 * (callers should offer the download fallback in that case).
 */
export function printReceipt(data: ReceiptDataT, format: 'browser' | 'thermal'): boolean {
  const html = format === 'thermal' ? buildThermal(data) : buildBrowser(data);
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) return false;
  w.document.write(html);
  w.document.close();
  w.focus();
  return true;
}

/** Download the receipt as an HTML file (fallback when print popups are blocked). */
export function downloadReceipt(data: ReceiptDataT, format: 'browser' | 'thermal'): void {
  const html = format === 'thermal' ? buildThermal(data) : buildBrowser(data);
  downloadReceiptDoc(html, `Receipt-${data.orderNo}.html`);
}

/** On-screen receipt preview (modal body). */
export function ReceiptPreview({ data }: { data: ReceiptDataT }) {
  const t = useT();
  const total = data.items.reduce((s, i) => s + i.qty * i.price, 0);
  const change = data.tendered != null ? data.tendered - total : null;
  return (
    <div className="mx-auto w-full max-w-[340px] rounded-[16px] border border-line bg-[var(--c-surface-solid)] p-6 text-ink">
      <h3 className="text-center font-display text-[19px] font-extrabold">{data.restaurant.name}</h3>
      {data.restaurant.address && <p className="mt-0.5 text-center text-[12px] text-muted">{data.restaurant.address}</p>}
      {data.restaurant.phone && <p className="text-center text-[12px] text-muted">{data.restaurant.phone}</p>}
      <div className="my-3 border-t border-dashed border-line" />
      <div className="flex justify-between text-[12.5px] text-muted">
        <span>
          {t('rct_order')} <b className="text-ink">#{data.orderNo}</b>
        </span>
        <span>{fmtDate(data.date)}</span>
      </div>
      <div className="mt-1 flex justify-between text-[12.5px] text-muted">
        <span>
          {data.orderType === 'dine_in' && data.tableLabel
            ? `${typeLabel(data.lang, data.orderType)} · ${data.tableLabel}`
            : typeLabel(data.lang, data.orderType)}
        </span>
        {data.cashier && <span>{t('rct_cashier', { name: data.cashier })}</span>}
      </div>
      {data.customerName && <p className="mt-1 text-[12.5px] text-muted">{t('rct_customer', { name: data.customerName })}</p>}
      <div className="my-3 border-t border-dashed border-line" />
      <div className="space-y-1.5">
        {data.items.map((i, k) => (
          <div key={k} className="flex justify-between text-[13.5px]">
            <span>
              {i.name} <span className="text-muted">× {i.qty}</span>
            </span>
            <span className="font-mono font-bold">{pkr(i.qty * i.price)}</span>
          </div>
        ))}
      </div>
      <div className="my-3 border-t border-dashed border-line" />
      <div className="flex justify-between font-display text-[17px] font-extrabold">
        <span>{t('rct_total')}</span>
        <span className="font-mono">{pkr(total)}</span>
      </div>
      <div className="mt-1.5 space-y-1 text-[13px] text-muted">
        <div className="flex justify-between">
          <span>{t('rct_payment')}</span>
          <span className="font-bold text-ink">{payMethodLabel(data.paymentMethod)}</span>
        </div>
        {data.tendered != null && (
          <>
            <div className="flex justify-between">
              <span>{t('rct_tendered')}</span>
              <span>{pkr(data.tendered)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t('rct_change')}</span>
              <span className="font-bold text-ink">{pkr(change ?? 0)}</span>
            </div>
          </>
        )}
      </div>
      {data.fbrInvoiceNo && (
        <p className="mt-3 rounded-[10px] bg-soft p-2 text-center text-[12px] font-bold">
          {t('rct_fbr_invoice')}: {data.fbrInvoiceNo}
        </p>
      )}
      <p className="mt-3 text-center text-[12px] text-muted">{t('rct_thanks')}</p>
    </div>
  );
}
