'use client';

// Uniform table card used everywhere: owner Table Performance,
// manager Tables, waiter Tables.
//
//   T1            ← main heading
//   4 seats · Indoor
//   [ Free | Seated | Bill ]
//
// Free   → neutral/default      (no active orders)
// Seated → solid purple         (order in kitchen: pending/preparing)
// Bill   → solid amber          (food ready — payment/bill pending)

import type { DiningTable, Order } from '@/lib/types';
import { Card } from './ui';

export type TableState = 'free' | 'seated' | 'bill';

type OrderLike = Pick<Order, 'table_id' | 'status'>;

export function tableState(tableId: string, orders: OrderLike[]): TableState {
  let seated = false;
  for (const o of orders) {
    if (o.table_id !== tableId) continue;
    if (o.status === 'ready') return 'bill';
    if (o.status === 'pending' || o.status === 'preparing') seated = true;
  }
  return seated ? 'seated' : 'free';
}

const STATE_STYLE: Record<TableState, { card: string; pill: string; label: string }> = {
  free: { card: '', pill: 'bg-soft text-muted', label: 'Free' },
  seated: { card: '!border-brand/40 bg-brand/[0.07]', pill: 'bg-brand text-white shadow', label: 'Seated' },
  bill: { card: '!border-amber/40 bg-amber/[0.08]', pill: 'bg-amber text-white shadow', label: 'Bill' },
};

function sectionName(t: DiningTable): string {
  const s = (t.floor_section || '').trim().toLowerCase();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Indoor';
}

export default function TableCard({
  table,
  state,
  meta,
  onClick,
}: {
  table: DiningTable;
  state: TableState;
  meta?: React.ReactNode;
  onClick?: () => void;
}) {
  const st = STATE_STYLE[state];
  const card = (
    <Card
      className={`border p-4 text-center transition-all ${st.card} ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      }`}
    >
      <p className="font-display text-[22px] font-extrabold leading-none text-ink">T{table.table_number}</p>
      <p className="mt-1.5 text-[11.5px] font-semibold text-muted">
        {table.capacity} seats · {sectionName(table)}
      </p>
      <div className="mt-2.5 flex justify-center">
        <span className={`rounded-full px-3.5 py-1 text-[11.5px] font-extrabold ${st.pill}`}>{st.label}</span>
      </div>
      {meta && <div className="mt-2.5 border-t border-line pt-2.5">{meta}</div>}
    </Card>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {card}
    </button>
  ) : (
    card
  );
}
