'use client';

// Shared full order detail popup — used by Kitchen and Orders tabs.
// Shows every item with thumbnail, quantity, price, per-item notes and
// ingredients, plus order-level notes, meta and an optional status action.
// 100% real data; ingredients come from menu_items.ingredients.

import { useEffect, useState } from 'react';
import type { Order, OrderItem } from '@/lib/types';
import { fmtElapsed, fmtPKR } from '@/lib/format';
import StatusPill from './StatusPill';
import ReceiptModal from './ReceiptModal';
import SmartImage from './SmartImage';

export interface ModalMenuInfo {
  image_url: string | null;
  ingredients: string | null;
}

export default function OrderDetailModal({
  order,
  items,
  menuById,
  thumbOf,
  tableNo,
  waiterName,
  onClose,
  onAdvance,
  advanceLabel,
  busy,
  onCollectPayment,
  payBusy,
  restaurantId,
}: {
  order: Order;
  items: OrderItem[];
  menuById?: Map<string, ModalMenuInfo>;
  thumbOf?: (item: OrderItem) => string;
  tableNo?: string | null;
  waiterName?: string | null;
  onClose: () => void;
  onAdvance?: () => void;
  advanceLabel?: string;
  busy?: boolean;
  onCollectPayment?: (method: string) => void | Promise<void>;
  payBusy?: boolean;
  restaurantId?: string;
}) {
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

  const subtotal = items.reduce((s, i) => s + i.quantity * Number(i.unit_price), 0);
  const [receiptOpen, setReceiptOpen] = useState(false);
  useEffect(() => {
    setReceiptOpen(false);
  }, [order.id]);
  const collectable =
    !!onCollectPayment && !!restaurantId && order.payment_status !== 'paid' && order.status !== 'cancelled';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] border border-line bg-[var(--c-surface-solid)] shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="font-display text-[18px] font-black text-ink">
                Order #{order.order_number}
              </h3>
              <StatusPill status={order.status} />
            </div>
            <p className="mt-1 text-[12px] font-medium text-muted">
              {tableNo ? `Table ${tableNo}` : order.order_type.replace('_', ' ')}
              {waiterName ? ` · ${waiterName}` : ''}
              {' · '}
              {new Date(order.created_at).toLocaleString('en-PK', {
                day: 'numeric',
                month: 'short',
                hour: 'numeric',
                minute: '2-digit',
              })}
              {' · '}
              {fmtElapsed(Date.now() - new Date(order.created_at).getTime())} ago
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[18px] font-bold text-muted transition-colors hover:bg-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
            Items ({items.reduce((s, i) => s + i.quantity, 0)})
          </p>
          <ul className="mt-2 space-y-3">
            {items.map((it) => {
              const info = it.menu_item_id ? menuById?.get(it.menu_item_id) : undefined;
              const thumb = thumbOf?.(it);
              return (
                <li
                  key={it.id}
                  className="rounded-[14px] border border-line/60 bg-soft/40 p-3"
                >
                  <div className="flex items-center gap-3">
                    {thumb ? (
                      <SmartImage
                        src={thumb}
                        alt=""
                        width={48}
                        height={48}
                        className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-soft text-[20px]">
                        🍽️
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-extrabold text-ink">
                        {it.item_name}
                      </p>
                      <p className="font-mono text-[12px] font-bold text-muted">
                        {it.quantity} × {fmtPKR(Number(it.unit_price))}
                      </p>
                    </div>
                    <p className="font-mono text-[13px] font-black text-ink">
                      {fmtPKR(it.quantity * Number(it.unit_price))}
                    </p>
                  </div>
                  {it.notes && (
                    <p className="mt-2 rounded-[10px] bg-amber-500/10 px-2.5 py-1.5 text-[12px] font-medium text-amber-700 dark:text-amber-300">
                      📝 {it.notes}
                    </p>
                  )}
                  {info?.ingredients && (
                    <p className="mt-1.5 text-[11.5px] font-medium leading-relaxed text-muted">
                      <span className="font-extrabold text-ink/70">Ingredients: </span>
                      {info.ingredients}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          {items.length === 0 && (
            <p className="mt-2 text-[12.5px] font-medium text-muted">No items found for this order.</p>
          )}

          {order.notes && (
            <div className="mt-4 rounded-[12px] bg-soft/60 p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">
                Order Notes
              </p>
              <p className="mt-1 text-[13px] font-medium text-body">{order.notes}</p>
            </div>
          )}

          <div className="mt-4 space-y-1.5 rounded-[12px] border border-line/60 p-3">
            <div className="flex justify-between text-[12.5px] font-medium text-muted">
              <span>Payment</span>
              <span className="font-bold capitalize text-ink">
                {order.payment_method?.replace('_', ' ') ?? '—'} · {order.payment_status}
              </span>
            </div>
            {order.customer_name && (
              <div className="flex justify-between text-[12.5px] font-medium text-muted">
                <span>Customer</span>
                <span className="font-bold text-ink">{order.customer_name}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-2">
              <span className="text-[13px] font-extrabold text-ink">Total</span>
              <span className="font-mono text-[16px] font-black text-ink">
                {fmtPKR(Number(order.total_amount) || subtotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {(onAdvance && advanceLabel) || collectable ? (
          <div className="space-y-2.5 border-t border-line px-5 py-3.5">
            {onAdvance && advanceLabel && (
              <button
                onClick={onAdvance}
                disabled={busy}
                className="flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-brand px-4 py-2.5 text-[13.5px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <span>✓</span>
                )}
                <span>{advanceLabel}</span>
              </button>
            )}
            {collectable && (
              <button
                onClick={() => setReceiptOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-[13px] bg-emerald-600/10 px-4 py-2.5 text-[13.5px] font-black text-emerald-700 transition-all hover:bg-emerald-600/20 dark:text-emerald-300"
              >
                <span>🧾</span>
                <span>Receipt / Collect Payment · {fmtPKR(Number(order.total_amount) || subtotal)}</span>
              </button>
            )}
          </div>
        ) : null}

        {/* Receipt popup — payment method, download, and Paid live here */}
        {receiptOpen && collectable && (
          <ReceiptModal
            restaurantId={restaurantId as string}
            order={order}
            items={items}
            tableNo={tableNo}
            waiterName={waiterName}
            onClose={() => setReceiptOpen(false)}
            onPaid={async (method) => {
              await onCollectPayment?.(method);
              setReceiptOpen(false);
            }}
            payBusy={payBusy}
          />
        )}
      </div>
    </div>
  );
}
