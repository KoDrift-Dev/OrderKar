'use client';

// Uniform table card used everywhere: owner Table Performance,
// manager Tables, waiter Tables.
//
//   T1            ← main heading
//   4 seats · Indoor
//   [ Free | Seated | Bill ]
//
// Free   → default card                 (no active orders)
// Seated → FULL solid teal              (order in kitchen: pending/preparing)
// Bill   → FULL solid amber             (food ready — payment/bill pending)

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

interface StateStyle {
  card: string;
  pill: string;
  label: string;
  title: string;
  sub: string;
  metaWrap: string;
  metaText: string;
}

const STATE_STYLE: Record<TableState, StateStyle> = {
  free: {
    card: '',
    pill: 'bg-soft text-muted',
    label: 'Free',
    title: 'text-ink',
    sub: 'text-muted',
    metaWrap: 'border-line',
    metaText: 'text-ink',
  },
  seated: {
    card: '!border-transparent !bg-gradient-to-br from-[#0D9488] to-[#0b7c72]',
    pill: 'bg-white/25 text-white',
    label: 'Seated',
    title: 'text-white',
    sub: 'text-white/85',
    metaWrap: 'border-white/25',
    metaText: 'text-white',
  },
  bill: {
    card: '!border-transparent !bg-gradient-to-br from-[#F59E0B] to-[#d97706]',
    pill: 'bg-white/25 text-white',
    label: 'Bill',
    title: 'text-white',
    sub: 'text-white/85',
    metaWrap: 'border-white/25',
    metaText: 'text-white',
  },
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
      <p className={`font-display text-[22px] font-extrabold leading-none ${st.title}`}>T{table.table_number}</p>
      <p className={`mt-1.5 text-[11.5px] font-semibold ${st.sub}`}>
        {table.capacity} seats · {sectionName(table)}
      </p>
      <div className="mt-2.5 flex justify-center">
        <span className={`rounded-full px-3.5 py-1 text-[11.5px] font-extrabold ${st.pill}`}>{st.label}</span>
      </div>
      {meta && <div className={`mt-2.5 border-t pt-2.5 ${st.metaWrap} ${st.metaText}`}>{meta}</div>}
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
