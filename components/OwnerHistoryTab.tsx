'use client';

// Owner "History" tab — security audit trail viewer.
// Reads public.activity_log rows written by lib/activity.ts (logActivity).
// 100% real data. Newest first, filterable by action type + free-text search.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ACT } from '@/lib/activity';
import { Card, Empty, Input } from './ui';

interface ActivityRow {
  id: string;
  restaurant_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  [ACT.ORDER_CREATED]: 'Order placed',
  [ACT.ORDER_STATUS_CHANGED]: 'Order status changed',
  [ACT.ORDER_CANCELLED]: 'Order cancelled',
  [ACT.PAYMENT_COLLECTED]: 'Payment collected',
  [ACT.PAYMENT_REFUNDED]: 'Payment refunded',
  [ACT.MENU_ITEM_CREATED]: 'Menu item added',
  [ACT.MENU_ITEM_UPDATED]: 'Menu item updated',
  [ACT.MENU_ITEM_DELETED]: 'Menu item deleted',
  [ACT.MENU_ITEM_AVAILABILITY]: 'Availability changed',
  [ACT.CATEGORY_CREATED]: 'Category added',
  [ACT.CATEGORY_UPDATED]: 'Category updated',
  [ACT.CATEGORY_DELETED]: 'Category deleted',
  [ACT.TABLE_ADDED]: 'Table added',
  [ACT.TABLE_UPDATED]: 'Table updated',
  [ACT.TABLE_REMOVED]: 'Table removed',
  [ACT.STAFF_ADDED]: 'Staff added',
  [ACT.STAFF_REMOVED]: 'Staff removed',
  [ACT.STAFF_LOGIN_ADDED]: 'Login account created',
  [ACT.WASTE_LOGGED]: 'Waste logged',
  [ACT.SETTINGS_UPDATED]: 'Settings updated',
  [ACT.BILLING_UPDATED]: 'Billing settings updated',
  [ACT.STAFF_LOGIN]: 'Staff login',
  [ACT.STAFF_LOGOUT]: 'Staff logout',
  [ACT.INVENTORY_DEDUCTED]: 'Stock auto-deducted',
  [ACT.SUPPLIER_ADDED]: 'Supplier added',
  [ACT.SUPPLIER_UPDATED]: 'Supplier updated',
  [ACT.SUPPLIER_DELETED]: 'Supplier deleted',
  [ACT.PO_CREATED]: 'Purchase order created',
  [ACT.PO_STATUS_CHANGED]: 'Purchase order status changed',
};

function actionLabel(action: string): string {
  return (
    ACTION_LABELS[action] ??
    action
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ')
  );
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function detailsSummary(details: Record<string, unknown> | null): string {
  if (!details) return '—';
  const pairs = Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${fmtVal(v)}`);
  return pairs.length ? pairs.join(' · ') : '—';
}

export default function OwnerHistoryTab({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('activity_log')
      .select('id, restaurant_id, actor_id, action, entity_type, entity_id, details, created_at')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: false })
      .limit(200);
    const list = (data ?? []) as ActivityRow[];
    setRows(list);
    // Batch-fetch actor names for distinct non-null actor_ids.
    const ids = [...new Set(list.map((r) => r.actor_id).filter((x): x is string => !!x))];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, name').in('id', ids);
      const m: Record<string, string> = {};
      for (const p of (profs ?? []) as { id: string; name: string }[]) m[p.id] = p.name;
      setActors(m);
    } else {
      setActors({});
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const actionOptions = useMemo(() => {
    const seen = new Set(rows.map((r) => r.action));
    return [...seen].sort().map((a) => ({ value: a, label: actionLabel(a) }));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== 'all' && r.action !== filter) return false;
      if (!needle) return true;
      const hay = [
        actionLabel(r.action),
        r.action,
        r.entity_type,
        r.entity_id ?? '',
        JSON.stringify(r.details ?? {}),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, filter, q]);

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-slate-600 to-slate-800 text-[22px] text-white shadow-sm">
            🕘
          </span>
          <div>
            <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">
              Tracking History
            </h2>
            <p className="text-[12px] font-medium text-muted">
              Security audit trail — every important action, newest first
            </p>
          </div>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-[13px] border border-line/70 bg-[var(--c-surface-solid)] px-4 py-2 text-[13px] font-extrabold text-ink shadow-sm transition-all hover:border-brand/40"
        >
          <span>🔄</span> Refresh
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter by action type"
            className="rounded-full border border-line/70 bg-soft/60 px-3.5 py-1.5 text-[12px] font-extrabold text-ink outline-none focus:border-brand/50"
          >
            <option value="all">All activity</option>
            {actionOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search actions, entities, details..."
            aria-label="Search activity history"
            className="!w-56 !rounded-full !px-3.5 !py-1.5 !text-[12px]"
          />
        </div>

        {loading ? (
          <p className="p-8 text-center text-[13px] font-medium text-muted">Loading history...</p>
        ) : visible.length === 0 ? (
          <div className="p-6">
            <Empty
              title={rows.length === 0 ? 'No activity yet' : 'No matches'}
              sub={
                rows.length === 0
                  ? 'Actions will appear here as staff use the system.'
                  : 'Try a different filter or search.'
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-2 border-b border-line px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted md:grid">
              <p className="col-span-2">Time</p>
              <p className="col-span-3">Action</p>
              <p className="col-span-2">Actor</p>
              <p className="col-span-2">Entity</p>
              <p className="col-span-3">Details</p>
            </div>
            <div className="max-h-[560px] divide-y divide-line/50 overflow-y-auto">
              {visible.map((r) => (
                <div key={r.id} className="grid grid-cols-12 items-start gap-2 px-4 py-3">
                  <p className="col-span-12 font-mono text-[11.5px] font-bold text-muted md:col-span-2">
                    {fmtTime(r.created_at)}
                  </p>
                  <p className="col-span-12 text-[13px] font-extrabold text-ink md:col-span-3">
                    {actionLabel(r.action)}
                  </p>
                  <p className="col-span-6 text-[12.5px] font-medium text-body md:col-span-2">
                    {r.actor_id ? actors[r.actor_id] ?? '…' : 'Customer'}
                  </p>
                  <p className="col-span-6 text-[12px] font-medium text-muted md:col-span-2">
                    {r.entity_type}
                    {r.entity_id && (
                      <span className="font-mono"> #{r.entity_id.slice(0, 8)}</span>
                    )}
                  </p>
                  <p className="col-span-12 truncate text-[12px] font-medium text-muted md:col-span-3" title={detailsSummary(r.details)}>
                    {detailsSummary(r.details)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
      <p className="text-[11.5px] font-medium text-muted">
        Showing latest {visible.length} of {rows.length} logged events (last 200).
      </p>
    </div>
  );
}
