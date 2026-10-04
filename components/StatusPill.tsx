'use client';

// Order status pill — shared across kitchen / waiter / tracker.

import type { OrderStatus } from '@/lib/types';

const MAP: Record<OrderStatus, { label: string; cls: string }> = {
  pending: { label: 'New', cls: 'bg-amber/15 text-amber' },
  preparing: { label: 'Preparing', cls: 'bg-brand-soft text-brand' },
  ready: { label: 'Ready', cls: 'bg-ok/10 text-ok' },
  completed: { label: 'Done', cls: 'bg-teal/10 text-teal' },
  cancelled: { label: 'Cancelled', cls: 'bg-danger/10 text-danger' },
};

export default function StatusPill({ status, size = 'md' }: { status: OrderStatus; size?: 'sm' | 'md' | 'lg' }) {
  const m = MAP[status];
  const sizes = { sm: 'px-2 py-0.5 text-[11px]', md: 'px-3 py-1 text-[12.5px]', lg: 'px-4 py-1.5 text-sm' } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold ${m.cls} ${sizes[size]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}
