'use client';

// Shared owner-console widgets: hero stat types, notification bell with
// dropdown, and the activity-history slide-over drawer.

import { useEffect, useRef, useState } from 'react';
import type { Order } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import type { OwnerTabKey } from './OwnerShell';

export interface HeroStats {
  todayRev: number;
  yRev: number;
  revPct: number | null;
  todayCust: number;
  yCust: number;
  custPct: number | null;
  activeCount: number;
  todayOrders: number;
}

export interface BranchStat {
  id: string;
  name: string;
  revenue: number;
  share: number;
}

export interface StockItem {
  id: string;
  name: string;
  stock: number;
  par: number;
  unit: string;
}

export interface HistEvent {
  id: string;
  at: string;
  icon: string;
  text: string;
  sub?: string;
}

export function pctChange(cur: number, prev: number): number | null {
  if (prev <= 0) return cur > 0 ? 100 : null;
  return ((cur - prev) / prev) * 100;
}

export function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - +new Date(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/** Flat event list from orders: placed / cancelled / completed. */
export function buildHistory(orders: Order[]): HistEvent[] {
  const ev: HistEvent[] = [];
  for (const o of orders) {
    ev.push({
      id: `${o.id}-p`,
      at: o.created_at,
      icon: '🧾',
      text: `Order #${o.order_number} placed`,
      sub: `${fmtPKR(Number(o.total_amount))} · ${o.order_type}`,
    });
    if (o.status === 'cancelled') {
      ev.push({
        id: `${o.id}-c`,
        at: o.updated_at,
        icon: '❌',
        text: `Order #${o.order_number} cancelled`,
        sub: o.cancel_reason || undefined,
      });
    } else if (o.status === 'completed') {
      ev.push({
        id: `${o.id}-d`,
        at: o.updated_at,
        icon: '✅',
        text: `Order #${o.order_number} completed`,
        sub: o.payment_method ? `Paid · ${o.payment_method}` : undefined,
      });
    }
  }
  return ev.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

interface Notif {
  id: string;
  at: string;
  icon: string;
  title: string;
  sub?: string;
  tab: OwnerTabKey;
}

/** Bell icon with unread badge + dropdown of recent activity. */
export function NotifBell({
  orders,
  stockLow,
  restaurantId,
  onGo,
}: {
  orders: Order[];
  stockLow: StockItem[];
  restaurantId: string;
  onGo: (t: OwnerTabKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const key = `ok_notif_seen_${restaurantId}`;

  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(key) || 0));
    } catch {
      /* ignore */
    }
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open ]);

  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const notifs: Notif[] = [];
  for (const o of orders) {
    if (+new Date(o.created_at) < dayAgo) continue;
    if (o.status === 'cancelled') {
      notifs.push({
        id: `c${o.id}`,
        at: o.created_at,
        icon: '❌',
        title: `Order #${o.order_number} cancelled`,
        sub: fmtPKR(Number(o.total_amount)),
        tab: 'operations',
      });
    } else {
      notifs.push({
        id: `n${o.id}`,
        at: o.created_at,
        icon: '🧾',
        title: `New order #${o.order_number}`,
        sub: `${fmtPKR(Number(o.total_amount))} · ${o.order_type}`,
        tab: 'operations',
      });
    }
  }
  for (const s of stockLow) {
    notifs.push({
      id: `s${s.id}`,
      at: new Date().toISOString(),
      icon: '⚠️',
      title: `Low stock: ${s.name}`,
      sub: `${s.stock} / ${s.par} ${s.unit}`,
      tab: 'dashboard',
    });
  }
  notifs.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  const list = notifs.slice(0, 12);
  const unread = list.filter((n) => +new Date(n.at) > seen).length;

  const toggle = () => {
    if (!open) {
      const now = Date.now();
      setSeen(now);
      try {
        localStorage.setItem(key, String(now));
      } catch {
        /* ignore */
      }
    }
    setOpen(!open);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label="Notifications"
        className="glass relative flex h-10 w-10 items-center justify-center !rounded-[12px] text-[17px] text-ink"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#7c3aed] to-[#0d9488] px-1 text-[10px] font-extrabold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[320px] max-w-[88vw] overflow-hidden rounded-[18px] border border-line bg-[var(--c-surface-solid)] shadow-2xl">
          <p className="border-b border-line px-4 py-3 font-display text-[14px] font-extrabold text-ink">
            Notifications
          </p>
          <div className="max-h-[380px] overflow-y-auto">
            {list.length === 0 && (
              <p className="px-4 py-8 text-center text-[13px] font-semibold text-muted">
                All caught up — no new activity. 🎉
              </p>
            )}
            {list.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  onGo(n.tab);
                }}
                className="flex w-full items-start gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors last:border-0 hover:bg-soft"
              >
                <span className="mt-0.5 text-[17px]">{n.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold text-ink">{n.title}</span>
                  {n.sub && <span className="block truncate text-[12px] text-muted">{n.sub}</span>}
                  <span className="block text-[11px] font-semibold text-muted/80">{timeAgo(n.at)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Right slide-over with the full recorded-action history. */
export function HistoryDrawer({
  open,
  onClose,
  events,
}: {
  open: boolean;
  onClose: () => void;
  events: HistEvent[];
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute right-0 top-0 flex h-full w-[380px] max-w-[92vw] animate-slide-in-right flex-col bg-[var(--c-surface-solid)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-display text-[16px] font-extrabold text-ink">History</p>
            <p className="text-[12px] text-muted">Every recorded action</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close history"
            className="glass flex h-9 w-9 items-center justify-center !rounded-full text-[14px] text-muted"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {events.length === 0 && (
            <p className="py-10 text-center text-[13px] font-semibold text-muted">No actions recorded yet.</p>
          )}
          {events.map((e) => (
            <div key={e.id} className="flex items-start gap-3 border-b border-line/60 px-1 py-3 last:border-0">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-soft text-[15px]">
                {e.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold text-ink">{e.text}</p>
                {e.sub && <p className="truncate text-[12px] text-muted">{e.sub}</p>}
                <p className="text-[11px] font-semibold text-muted/80">{timeAgo(e.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
