'use client';

// Owner table management — add/edit/delete tables with sections
// (Indoor / Outdoor / Rooftop / custom), capacity, active toggle,
// and per-table QR view/download/print.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { deductInventoryForOrder } from '@/lib/inventory';
import { logActivity, ACT } from '@/lib/activity';
import { tableQr } from '@/lib/qr';
import { useT } from '@/lib/i18n';
import { qrSvg, downloadPng } from './QrSection';
import { Btn, Card, SectionHead, Input, Label, Empty } from './ui';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';
import type { DiningTable, Order, OrderItem, OrderStatus, Profile } from '@/lib/types';
import TableCard, { tableState } from './TableCard';
import OrderDetailModal from './OrderDetailModal';
import StatusPill from './StatusPill';
import { useMenuMap } from './useMenuMap';
import { fmtPKR } from '@/lib/format';

const PRESET_SECTIONS = ['Indoor', 'Outdoor', 'Rooftop'];

interface FormState {
  number: string;
  section: string;
  customSection: string;
  capacity: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { number: '', section: 'Indoor', customSection: '', capacity: '4', isActive: true };

type TFn = ReturnType<typeof useT>;

/** Raw section string → display label (presets translated, custom kept as-is). */
function sectionName(raw: string | undefined, tt: TFn): string {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'outdoor') return tt('tbl_sec_outdoor');
  if (s === 'rooftop') return tt('tbl_sec_rooftop');
  if (s === 'indoor' || !s) return tt('tbl_sec_indoor');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sectionLabel(t: DiningTable, tt: TFn): string {
  return sectionName(t.floor_section, tt);
}

function QrModal({ table, slug, onClose }: { table: DiningTable; slug: string; onClose: () => void }) {
  const t = useT();
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const qr = tableQr(slug, table.table_number, typeof window !== 'undefined' ? window.location.origin : '');

  useEffect(() => {
    let live = true;
    qrSvg(qr.url).then((s) => {
      if (live) setSvg(s);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line/12 react-hooks/exhaustive-deps
  }, [qr.url]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm flex-col items-center rounded-[24px] bg-[var(--c-surface-solid)] p-6 text-center shadow-2xl">
        <h2 className="font-display text-[18px] font-extrabold text-ink">
          Table {table.table_number} · {sectionLabel(table, t)}
        </h2>
        <p className="mt-1 text-[12px] text-muted">{t('tbl_qr_hint')}</p>
        {svg ? (
          <div
            className="mt-4 h-56 w-56 overflow-hidden rounded-[16px] border border-line/12 bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={t('tbl_qr_aria', { n: table.table_number })}
          />
        ) : (
          <div className="mt-4 flex h-56 w-56 items-center justify-center rounded-[16px] border border-line/12 bg-white">
            <span className="text-xs font-semibold text-muted">{t('tbl_loading')}</span>
          </div>
        )}
        <p className="mt-3 max-w-full truncate px-2 font-mono text-[11px] text-muted">{qr.url}</p>
        <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
          <Btn
            variant="secondary"
            disabled={!svg || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadPng(svg, `table-${table.table_number}-qr.png`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '…' : '⬇ PNG'}
          </Btn>
          <Btn variant="secondary" onClick={onClose}>
            {t('tbl_close')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function TableManager({
  restaurantId,
  slug,
  tables,
  orders = [],
  items = [],
  staff = [],
  onChange,
  onNavigate,
}: {
  restaurantId: string;
  slug: string;
  tables: DiningTable[];
  orders?: Order[];
  items?: OrderItem[];
  staff?: Profile[];
  onChange: (tables: DiningTable[]) => void;
  onNavigate?: (tab: any) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<DiningTable | null>(null);
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const guard = useGuard();
  const del = useUndoDelete<DiningTable>(async (tb) => {
    await createClient().from('tables').delete().eq('id', tb.id);
    logActivity(createClient(), {
      restaurantId,
      action: ACT.TABLE_REMOVED,
      entityType: 'table',
      entityId: tb.id,
      details: { table_number: tb.table_number },
    });
  });

  const sorted = useMemo(() => [...tables].sort((a, b) => a.table_number - b.table_number), [tables]);
  const usedNumbers = useMemo(() => new Set(tables.map((tb) => tb.table_number)), [tables]);

  const nextFree = useMemo(() => {
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
  }, [usedNumbers]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, number: String(nextFree) });
    setFormError('');
    setEditing('new');
  };

  const openEdit = (tb: DiningTable) => {
    const preset = PRESET_SECTIONS.find((p) => p.toLowerCase() === (tb.floor_section || '').toLowerCase());
    setForm({
      number: String(tb.table_number),
      section: preset ?? 'Custom',
      customSection: preset ? '' : tb.floor_section,
      capacity: String(tb.capacity),
      isActive: tb.is_active,
    });
    setFormError('');
    setEditing(tb);
  };

  const save = () =>
    guard(async () => {
      setFormError('');
      const num = parseInt(form.number, 10);
      if (!Number.isInteger(num) || num < 1 || num > 999) {
        setFormError(t('tbl_val_number'));
        return;
      }
      const editingId = editing !== 'new' && editing ? editing.id : null;
      if (tables.some((tb) => tb.table_number === num && tb.id !== editingId)) {
        setFormError(t('tbl_val_dup', { n: num }));
        return;
      }
      const section = form.section === 'Custom' ? form.customSection.trim() : form.section;
      if (!section) {
        setFormError(t('tbl_val_section'));
        return;
      }
      const cap = parseInt(form.capacity, 10);
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) {
        setFormError(t('tbl_val_capacity'));
        return;
      }
      setSaving(true);
      try {
        const supabase = createClient();
        const payload = {
          restaurant_id: restaurantId,
          table_number: num,
          qr_code: `${slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}-T${num}`,
          capacity: cap,
          floor_section: section.toLowerCase(),
          is_active: form.isActive,
        };
        if (editing === 'new') {
          const { data, error } = await supabase.from('tables').insert(payload).select().single();
          if (error) throw error;
          onChange([...tables, data as DiningTable]);
          logActivity(supabase, {
            restaurantId,
            action: ACT.TABLE_ADDED,
            entityType: 'table',
            entityId: data.id,
            details: { table_number: num, capacity: cap },
          });
        } else if (editing) {
          const { data, error } = await supabase.from('tables').update(payload).eq('id', editing.id).select().single();
          if (error) throw error;
          onChange(tables.map((tb) => (tb.id === editing.id ? (data as DiningTable) : tb)));
          logActivity(supabase, {
            restaurantId,
            action: ACT.TABLE_UPDATED,
            entityType: 'table',
            entityId: editing.id,
            details: { table_number: num },
          });
        }
        setEditing(null);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : t('tbl_err_save'));
      } finally {
        setSaving(false);
      }
    });

  const toggleActive = (tb: DiningTable) =>
    guard(async () => {
      const { data, error } = await createClient()
        .from('tables')
        .update({ is_active: !tb.is_active })
        .eq('id', tb.id)
        .select()
        .single();
      if (!error && data) onChange(tables.map((x) => (x.id === tb.id ? (data as DiningTable) : x)));
    });

  const askDelete = (tb: DiningTable) => setConfirmDel(tb);
  const doDelete = () =>
    guard(async () => {
      if (!confirmDel) return;
      const gone = confirmDel;
      setConfirmDel(null);
      del.schedule(gone, t('tbl_undo_label', { n: gone.table_number }), () =>
        onChange(tables.filter((x) => x.id !== gone.id)),
      );
    });

  const [filterSec, setFilterSec] = useState<string>('all');

  const filteredTables = useMemo(() => {
    if (filterSec === 'all') return sorted;
    return sorted.filter((tb) => (tb.floor_section || 'indoor').toLowerCase() === filterSec.toLowerCase());
  }, [sorted, filterSec]);

  const liveStates = useMemo(() => {
    const m = new Map<string, 'free' | 'seated' | 'bill'>();
    for (const tb of tables) m.set(tb.id, tableState(tb.id, orders));
    return m;
  }, [tables, orders]);
  const liveCounts = useMemo(() => {
    let free = 0, seated = 0, bill = 0;
    for (const tb of tables) {
      if (!tb.is_active) continue;
      const st = liveStates.get(tb.id) ?? 'free';
      if (st === 'seated') seated++;
      else if (st === 'bill') bill++;
      else free++;
    }
    return { free, seated, bill };
  }, [tables, liveStates]);

  const { thumbOf, menuInfoById } = useMenuMap(restaurantId);
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [detailOrderId, setDetailOrderId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const waiterNameById = useMemo(() => new Map(staff.map((x) => [x.id, x.name])), [staff]);

  const areaList = useMemo(() => {
    const set = new Set<string>();
    for (const tb of tables) {
      const a = (tb.floor_section || '').trim();
      set.add(a ? a.charAt(0).toUpperCase() + a.slice(1) : 'Indoor');
    }
    return [...set].sort();
  }, [tables]);

  const visibleTables = useMemo(() => {
    const list = tables.filter((x) => x.is_active).sort((a, b) => a.table_number - b.table_number);
    if (areaFilter === 'all') return list;
    return list.filter((tb) => {
      const a = (tb.floor_section || '').trim();
      const name = a ? a.charAt(0).toUpperCase() + a.slice(1) : 'Indoor';
      return name === areaFilter;
    });
  }, [tables, areaFilter]);

  const liveTotal = tables.filter((x) => x.is_active).length;
  const outOfService = tables.filter((x) => !x.is_active).length;

  // Detail panel: selected table (default = first occupied, else first)
  const detailTable = useMemo(() => {
    if (selectedTableId) return tables.find((x) => x.id === selectedTableId) ?? null;
    const occ = visibleTables.find((tb) => (liveStates.get(tb.id) ?? 'free') !== 'free');
    return occ ?? visibleTables[0] ?? null;
  }, [selectedTableId, tables, visibleTables, liveStates]);
  const detailState = detailTable ? liveStates.get(detailTable.id) ?? 'free' : 'free';
  const detailArea = useMemo(() => {
    if (!detailTable) return '';
    const a = (detailTable.floor_section || '').trim();
    return a ? a.charAt(0).toUpperCase() + a.slice(1) : 'Indoor';
  }, [detailTable]);
  const detailOrder = useMemo(() => {
    if (!detailTable) return null;
    const list = orders
      .filter((o) => o.table_id === detailTable.id && ['pending', 'preparing', 'ready'].includes(o.status))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list[0] ?? null;
  }, [orders, detailTable]);
  const detailItems = useMemo(
    () => (detailOrder ? items.filter((i) => i.order_id === detailOrder.id) : []),
    [items, detailOrder]
  );
  const detailWaiter = detailOrder?.waiter_id ? waiterNameById.get(detailOrder.waiter_id) ?? null : null;
  const detailNext: OrderStatus | undefined =
    detailOrder?.status === 'pending' ? 'preparing' : detailOrder?.status === 'preparing' ? 'ready' : undefined;
  const detailNextLabel = detailNext === 'preparing' ? 'Start Preparing' : detailNext === 'ready' ? 'Mark as Ready' : '';
  const advanceDetailOrder = async () => {
    if (!detailOrder || !detailNext) return;
    setBusyId(detailOrder.id);
    const { error } = await createClient().from('orders').update({ status: detailNext }).eq('id', detailOrder.id);
    setBusyId(null);
    if (error) {
      // realtime reload will correct; nothing else to do
    }
  };
  const collectDetailPayment = async (method: string) => {
    if (!detailOrderFull) return;
    setBusyId(detailOrderFull.id);
    const { error } = await createClient()
      .from('orders')
      .update({ status: 'completed', payment_status: 'paid', payment_method: method })
      .eq('id', detailOrderFull.id);
    setBusyId(null);
    // Order leaves the active list on the next realtime/heartbeat refresh;
    // close the popup so the table panel doesn't show a stale bill.
    if (!error) {
      setDetailOrderId(null);
      logActivity(createClient(), {
        restaurantId,
        action: ACT.PAYMENT_COLLECTED,
        entityType: 'order',
        entityId: detailOrderFull.id,
        details: { payment_method: method },
      });
      deductInventoryForOrder(createClient(), detailOrderFull.id, restaurantId);
    }
  };
  const detailOrderFull = detailOrderId ? orders.find((o) => o.id === detailOrderId) ?? null : null;
  const detailMenuById = useMemo(() => {
    const m = new Map<string, { image_url: string | null; ingredients: string | null }>();
    for (const it of detailItems) {
      if (it.menu_item_id && !m.has(it.menu_item_id)) {
        const info = menuInfoById(it.menu_item_id);
        if (info) m.set(it.menu_item_id, info);
      }
    }
    return m;
  }, [detailItems, menuInfoById]);

  return (
    <div className="space-y-6">
      {/* ── Section 1: Floor Overview (Pic 4) ── */}
      <div className="space-y-4">
        <div>
          <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">Tables</h2>
          <p className="text-[12px] font-medium text-muted">Manage table status and live occupancy</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {[
            { label: 'Occupied', count: liveCounts.seated + liveCounts.bill, total: liveTotal, bar: 'from-teal to-emerald-600', icon: '🪑' },
            { label: 'Available', count: liveCounts.free, total: liveTotal, bar: 'from-emerald-400 to-green-500', icon: '✅' },
            { label: 'Out of Service', count: outOfService, total: tables.length, bar: 'from-slate-400 to-slate-500', icon: '🚫' },
          ].map((c) => {
            const pct = c.total > 0 ? Math.round((c.count / c.total) * 100) : 0;
            return (
              <div key={c.label} className="rounded-[14px] border border-line/60 bg-[var(--c-surface-solid)] p-2.5 shadow-sm sm:rounded-[18px] sm:p-4">
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] bg-soft text-[14px] sm:h-9 sm:w-9 sm:rounded-[12px] sm:text-[17px]">{c.icon}</span>
                  <p className="truncate text-[10.5px] font-bold text-muted sm:text-[12.5px]">{c.label}</p>
                </div>
                <p className="mt-1.5 font-mono text-[18px] font-black text-ink sm:mt-2 sm:text-[22px]">
                  {c.count}
                  <span className="text-[11px] font-bold text-muted sm:text-[13px]"> / {c.total}</span>
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-soft sm:mt-2">
                  <div className={`h-full rounded-full bg-gradient-to-r ${c.bar}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-right font-mono text-[10px] font-bold text-muted sm:text-[11px]">{pct}%</p>
              </div>
            );
          })}
        </div>

        {/* Area pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['all', ...areaList].map((a) => (
            <button
              key={a}
              onClick={() => setAreaFilter(a)}
              className={`shrink-0 rounded-[12px] px-3.5 py-1.5 text-[12.5px] font-extrabold transition-all ${
                areaFilter === a
                  ? 'bg-brand text-white shadow-lift'
                  : 'border border-line/70 bg-[var(--c-surface-solid)] text-muted hover:text-ink'
              }`}
            >
              {a === 'all' ? 'All Areas' : a}
            </button>
          ))}
        </div>

        {/* Grid + detail panel */}
        <div className="grid gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            {visibleTables.length === 0 ? (
              <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-8 text-center">
                <p className="text-[13px] font-bold text-muted">No tables in this area yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleTables.map((tb) => {
                  const st = liveStates.get(tb.id) ?? 'free';
                  const isSel = selectedTableId === tb.id;
                  return (
                    <div key={tb.id} className={isSel ? 'rounded-[16px] ring-2 ring-brand/50 ring-offset-1' : ''}>
                      <TableCard table={tb} state={st} onClick={() => setSelectedTableId(tb.id)} />
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-4 px-1 text-[11.5px] font-bold text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal" /> Seated</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber" /> Bill Pending</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-soft" /> Available</span>
            </div>
          </div>

          {/* Detail panel */}
          <div className="xl:col-span-4">
            {detailTable ? (
              <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-4 shadow-sm lg:sticky lg:top-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-[16px] font-black text-ink">Table {detailTable.table_number}</h3>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${
                    detailState === 'seated' ? 'bg-teal/15 text-teal'
                    : detailState === 'bill' ? 'bg-amber/15 text-amber dark:text-amber'
                    : 'bg-soft text-muted'
                  }`}>
                    {detailState === 'seated' ? 'Occupied' : detailState === 'bill' ? 'Bill Pending' : 'Available'}
                  </span>
                </div>
                <p className="mt-1 text-[12px] font-medium text-muted">
                  {detailTable.capacity} seats · {detailArea}
                  {detailOrder && ` · Since ${new Date(detailOrder.created_at).toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })}`}
                </p>
                {detailOrder && (
                  <p className="mt-1 text-[12px] font-medium text-muted">
                    Waiter: <span className="font-bold text-ink">{detailWaiter ?? '—'}</span>
                  </p>
                )}

                {detailOrder ? (
                  <>
                    <button
                      onClick={() => setDetailOrderId(detailOrder.id)}
                      className="mt-3 w-full rounded-[13px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99]"
                    >
                      View Order #{detailOrder.order_number}
                    </button>
                    <div className="mt-3 rounded-[14px] border border-line/60 bg-soft/40 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Order Details</p>
                      <ul className="mt-2 space-y-1.5">
                        {detailItems.map((it) => (
                          <li key={it.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                            <span className="min-w-0 flex-1 truncate font-medium text-body">
                              <span className="mr-1 font-mono font-bold text-ink">{it.quantity}×</span>{it.item_name}
                            </span>
                            <span className="font-mono font-bold text-ink">{fmtPKR(it.quantity * Number(it.unit_price))}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 flex justify-between border-t border-line/12 pt-2">
                        <span className="text-[12.5px] font-extrabold text-ink">Total</span>
                        <span className="font-mono text-[14px] font-black text-ink">{fmtPKR(Number(detailOrder.total_amount))}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {detailNext && (
                        <button
                          onClick={() => advanceDetailOrder()}
                          disabled={busyId === detailOrder.id}
                          className="rounded-[12px] border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-[12px] font-extrabold text-emerald-700 dark:text-emerald-300 transition-all hover:bg-emerald-500/20 disabled:opacity-60"
                        >
                          {busyId === detailOrder.id ? '...' : detailNextLabel}
                        </button>
                      )}
                      <button
                        onClick={() => onNavigate?.('pos')}
                        className={`rounded-[12px] border border-line/70 px-3 py-2 text-[12px] font-extrabold text-ink transition-all hover:border-brand/40 ${detailNext ? '' : 'col-span-2'}`}
                      >
                        ➕ Add Items
                      </button>
                    </div>
                    {detailState === 'bill' && detailOrder.payment_status !== 'paid' && (
                      <button
                        onClick={() => setDetailOrderId(detailOrder.id)}
                        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[12px] bg-emerald-600/10 px-3 py-2.5 text-[12.5px] font-black text-emerald-700 transition-all hover:bg-emerald-600/20 dark:text-emerald-300"
                      >
                        <span>💰</span> Collect Payment · {fmtPKR(Number(detailOrder.total_amount))}
                      </button>
                    )}
                  </>
                ) : (
                  <div className="mt-3">
                    <p className="rounded-[12px] bg-soft/60 p-3 text-center text-[12.5px] font-medium text-muted">
                      Table is free — no active order.
                    </p>
                    <button
                      onClick={() => onNavigate?.('pos')}
                      className="mt-3 w-full rounded-[13px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99]"
                    >
                      ➕ New Order
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-[18px] border border-line/60 bg-[var(--c-surface-solid)] p-6 text-center">
                <p className="text-[13px] font-bold text-muted">Select a table to see details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail order modal */}
      {detailOrderFull && (
        <OrderDetailModal
          order={detailOrderFull}
          items={detailItems}
          menuById={detailMenuById}
          thumbOf={thumbOf}
          tableNo={detailTable ? String(detailTable.table_number) : null}
          waiterName={detailWaiter}
          onClose={() => setDetailOrderId(null)}
          onCollectPayment={collectDetailPayment}
          payBusy={busyId === detailOrderFull.id}
          restaurantId={restaurantId}
        />
      )}

      {/* ── Section 2: Table management ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/12 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
              Dining Tables & Floor Layout
            </h2>
            <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-[11px] font-bold text-brand">
              {tables.filter((x) => x.is_active).length} active / {tables.length} total
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            Configure dining stations, floor sections, capacity, and table QR codes
          </p>
        </div>

        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-btn bg-brand px-4 py-2 text-[13.5px] font-extrabold text-white shadow-lift transition-all hover:brightness-105 active:translate-y-0"
        >
          <span className="text-[16px] leading-none">＋</span>
          <span>Add New Table</span>
        </button>
      </div>

      {/* Section Filter Pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { key: 'all', label: 'All Tables' },
          { key: 'indoor', label: 'Indoor Hall' },
          { key: 'outdoor', label: 'Outdoor Patio' },
          { key: 'rooftop', label: 'Rooftop Terrace' },
        ].map((sec) => (
          <button
            key={sec.key}
            onClick={() => setFilterSec(sec.key)}
            className={`rounded-[12px] px-3.5 py-1.5 text-[12.5px] font-extrabold transition-all ${
              filterSec === sec.key
                ? 'bg-brand text-white shadow-sm'
                : 'border border-line/12 bg-[var(--c-surface-solid)] text-muted hover:text-ink'
            }`}
          >
            {sec.label}
          </button>
        ))}
      </div>

      {filteredTables.length === 0 ? (
        <Empty title={t('tbl_empty_title')} sub={t('tbl_empty_sub')} />
      ) : (
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
          {filteredTables.map((tb) => (
            <Card
              key={tb.id}
              className={`group p-4 transition-all duration-200 hover:-translate-y-1 ${
                tb.is_active ? 'hover:border-brand/40' : 'opacity-60 bg-soft/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="rounded-full bg-soft px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted">
                    {sectionLabel(tb, t)}
                  </span>
                  <p className="mt-1.5 font-display text-[22px] font-black tracking-tight text-ink">
                    Table {tb.table_number}
                  </p>
                  <p className="mt-0.5 font-mono text-[12px] font-bold text-muted">
                    👥 {tb.capacity} seats
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleActive(tb)}
                  title={tb.is_active ? 'Deactivate Table' : 'Activate Table'}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                    tb.is_active ? 'bg-brand shadow-sm' : 'bg-line/12'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      tb.is_active ? 'left-[22px]' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="mt-4 flex items-center gap-1.5 border-t border-line/70 pt-2.5">
                <button
                  type="button"
                  onClick={() => setQrTable(tb)}
                  className="flex-1 rounded-[10px] border border-line/12 bg-[var(--c-surface-solid)] px-2 py-1.5 text-[11.5px] font-extrabold text-ink transition-colors hover:border-brand/40 hover:text-brand shadow-xs"
                >
                  📷 QR
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(tb)}
                  className="flex-1 rounded-[10px] border border-line/12 bg-[var(--c-surface-solid)] px-2 py-1.5 text-[11.5px] font-extrabold text-ink transition-colors hover:border-brand/40 hover:text-brand shadow-xs"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => askDelete(tb)}
                  className="rounded-[10px] border border-line/12 bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-[11.5px] font-extrabold text-danger transition-colors hover:bg-danger/10 shadow-xs"
                  title="Delete Table"
                >
                  🗑
                </button>
              </div>

              {!tb.is_active && (
                <p className="mt-2 text-center text-[10.5px] font-bold text-danger">
                  {t('tbl_inactive_note')}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── add/edit modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setEditing(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-md flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line/12 p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editing === 'new' ? 'Add table' : t('tbl_modal_edit', { n: editing.table_number })}
              </h2>
              <button type="button" onClick={() => !saving && setEditing(null)} className="text-[20px] text-muted hover:text-ink">
                ×
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <Label>Table number</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  placeholder={String(nextFree)}
                />
              </div>
              <div>
                <Label>Section / location</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[...PRESET_SECTIONS, 'Custom'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, section: s }))}
                      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                        form.section === s ? 'bg-brand text-white shadow' : 'border border-line/12 text-muted hover:text-ink'
                      }`}
                    >
                      {s === 'Custom' ? t('tbl_sec_custom') : sectionName(s, t)}
                    </button>
                  ))}
                </div>
                {form.section === 'Custom' && (
                  <Input
                    className="mt-2"
                    value={form.customSection}
                    onChange={(e) => setForm((f) => ({ ...f, customSection: e.target.value }))}
                    placeholder={t('tbl_ph_section')}
                    maxLength={40}
                  />
                )}
              </div>
              <div>
                <Label>Capacity (seats)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-[14px] border border-line/12 px-3.5 py-2.5">
                <span className="text-[13.5px] font-bold text-ink">Active</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-5 w-5 accent-[var(--c-brand)]"
                />
              </label>
              {formError && <p className="rounded-btn bg-danger/10 p-3 text-[13px] font-bold text-danger">{formError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2.5 border-t border-line/12 p-4 sm:px-6">
              <Btn variant="secondary" onClick={() => !saving && setEditing(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? t('tbl_saving') : editing === 'new' ? 'Add table' : 'Save'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <DeleteConfirm
          title={t('tbl_del_title', { n: confirmDel.table_number })}
          message={t('tbl_del_msg')}
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
      {del.pending && (
        <UndoToast label={del.pending.label} seconds={del.seconds} onUndo={() => del.undo((tb) => onChange([...tables, tb]))} />
      )}
      {qrTable && <QrModal table={qrTable} slug={slug} onClose={() => setQrTable(null)} />}
    </div>
  );
}
