'use client';

// Receipt — on-screen preview + printing in two formats:
//  - "browser": normal full-width receipt
//  - "thermal": 80mm thermal-printer layout (monospace)
// Printing opens a standalone window so page print-CSS can't interfere.

export interface ReceiptItem {
  name: string;
  qty: number;
  price: number;
}

export interface ReceiptData {
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

const TYPE_LABEL: Record<ReceiptData['orderType'], string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
  delivery: 'Delivery',
};

const PAY_LABEL: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  jazzcash: 'JazzCash',
  easypaisa: 'EasyPaisa',
};

function pkr(n: number): string {
  return 'Rs ' + Math.round(n).toLocaleString('en-PK');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}-${d.toLocaleString('en', { month: 'short' })}-${String(d.getFullYear()).slice(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function dots(left: string, right: string, width: number): string {
  const gap = Math.max(2, width - left.length - right.length);
  return left + '.'.repeat(gap) + right;
}

function buildThermal(d: ReceiptData): string {
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
  line(dots(`Order #${d.orderNo}`, fmtDate(d.date), W));
  line(
    dots(
      d.orderType === 'dine_in' ? `Dine-in${d.tableLabel ? ' · ' + d.tableLabel : ''}` : TYPE_LABEL[d.orderType],
      d.cashier ? `Cashier: ${d.cashier}` : '',
      W,
    ),
  );
  if (d.customerName) line(`Customer: ${d.customerName}`);
  if (d.customerPhone) line(`Phone: ${d.customerPhone}`);
  if (d.deliveryAddress) line(`Addr: ${d.deliveryAddress}`);
  sep();
  for (const i of d.items) {
    line(`${i.qty}x ${i.name}`.slice(0, W));
    line(dots('', pkr(i.qty * i.price), W));
  }
  sep();
  line(dots('TOTAL', pkr(total), W));
  line(dots('Payment', PAY_LABEL[d.paymentMethod] ?? d.paymentMethod, W));
  if (d.tendered != null) {
    line(dots('Tendered', pkr(d.tendered), W));
    line(dots('Change', pkr(change ?? 0), W));
  }
  if (d.fbrInvoiceNo) {
    sep();
    line(dots('FBR Invoice', d.fbrInvoiceNo, W));
  }
  sep();
  c('Thank you! Visit again.');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt #${d.orderNo}</title>
<style>
@page { size: 80mm auto; margin: 0; }
body { width: 80mm; margin: 0; padding: 8px 6px; font-family: "Courier New", monospace; font-size: 12px; line-height: 1.45; color: #000; }
pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; }
</style></head><body><pre>${esc(L.join('\n'))}</pre>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
}

function buildBrowser(d: ReceiptData): string {
  const total = d.items.reduce((s, i) => s + i.qty * i.price, 0);
  const change = d.tendered != null ? d.tendered - total : null;
  const rows = d.items
    .map(
      (i) => `<tr><td>${esc(i.name)}<span class="qty">× ${i.qty}</span></td><td class="r">${pkr(i.qty * i.price)}</td></tr>`,
    )
    .join('');

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
<div class="meta"><span>Order <b>#${d.orderNo}</b></span><span>${fmtDate(d.date)}</span></div>
<div class="meta"><span>${d.orderType === 'dine_in' ? `Dine-in${d.tableLabel ? ' · ' + esc(d.tableLabel) : ''}` : TYPE_LABEL[d.orderType]}</span>${d.cashier ? `<span>Cashier: ${esc(d.cashier)}</span>` : ''}</div>
${d.customerName ? `<div class="meta"><span>Customer: ${esc(d.customerName)}</span></div>` : ''}
${d.customerPhone ? `<div class="meta"><span>Phone: ${esc(d.customerPhone)}</span></div>` : ''}
${d.deliveryAddress ? `<div class="meta"><span>Address: ${esc(d.deliveryAddress)}</span></div>` : ''}
<hr>
<table>${rows}</table>
<hr>
<div class="total"><span>TOTAL</span><span>${pkr(total)}</span></div>
<div class="pay"><span>Payment</span><span>${esc(PAY_LABEL[d.paymentMethod] ?? d.paymentMethod)}</span></div>
${d.tendered != null ? `<div class="pay"><span>Tendered</span><span>${pkr(d.tendered)}</span></div><div class="pay"><span>Change</span><span>${pkr(change ?? 0)}</span></div>` : ''}
${d.fbrInvoiceNo ? `<div class="fbr">FBR Invoice: <b>${esc(d.fbrInvoiceNo)}</b></div>` : ''}
<hr>
<p class="thanks">Thank you! Visit again.</p>
</div>
<script>window.onload = function(){ setTimeout(function(){ window.print(); }, 350); };</script>
</body></html>`;
}

/** Open a print window with the receipt. Call from a click handler. */
export function printReceipt(data: ReceiptData, format: 'browser' | 'thermal'): void {
  const html = format === 'thermal' ? buildThermal(data) : buildBrowser(data);
  const w = window.open('', '_blank', 'width=420,height=700');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
}

/** On-screen receipt preview (modal body). */
export function ReceiptPreview({ data }: { data: ReceiptData }) {
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
          Order <b className="text-ink">#{data.orderNo}</b>
        </span>
        <span>{fmtDate(data.date)}</span>
      </div>
      <div className="mt-1 flex justify-between text-[12.5px] text-muted">
        <span>{data.orderType === 'dine_in' ? `Dine-in${data.tableLabel ? ' · ' + data.tableLabel : ''}` : TYPE_LABEL[data.orderType]}</span>
        {data.cashier && <span>Cashier: {data.cashier}</span>}
      </div>
      {data.customerName && <p className="mt-1 text-[12.5px] text-muted">Customer: {data.customerName}</p>}
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
        <span>TOTAL</span>
        <span className="font-mono">{pkr(total)}</span>
      </div>
      <div className="mt-1.5 space-y-1 text-[13px] text-muted">
        <div className="flex justify-between">
          <span>Payment</span>
          <span className="font-bold text-ink">{PAY_LABEL[data.paymentMethod] ?? data.paymentMethod}</span>
        </div>
        {data.tendered != null && (
          <>
            <div className="flex justify-between">
              <span>Tendered</span>
              <span>{pkr(data.tendered)}</span>
            </div>
            <div className="flex justify-between">
              <span>Change</span>
              <span className="font-bold text-ink">{pkr(change ?? 0)}</span>
            </div>
          </>
        )}
      </div>
      {data.fbrInvoiceNo && (
        <p className="mt-3 rounded-[10px] bg-soft p-2 text-center text-[12px] font-bold">
          FBR Invoice: {data.fbrInvoiceNo}
        </p>
      )}
      <p className="mt-3 text-center text-[12px] text-muted">Thank you! Visit again.</p>
    </div>
  );
}
