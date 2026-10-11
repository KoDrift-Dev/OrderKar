'use client';

// Owner "Inventory" tab — Pic 5 (Restora) layout, OrderKar purple theme.
// 100% real data from inventory_items: stock levels, units, low-stock alerts,
// stock valuation. No expiry tracking (no expiry column), no purchase orders.
// Deletes use centered confirm + 5s Undo per house rules.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { fmtPKR, fmtNum } from '@/lib/format';
import { exportAsCsv } from '@/lib/report-export';
import { Card, Empty, Input, Label } from './ui';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';

interface InvItem {
  id: string;
  restaurant_id: string;
  name: string;
  category: string | null;
  unit: string;
  current_stock: number;
  par_level: number;
  cost_per_unit: number;
}

type StockStatus = 'in' | 'low' | 'critical' | 'out';

function stockStatus(it: InvItem): StockStatus {
  const s = Number(it.current_stock);
  const par = Number(it.par_level);
  if (s <= 0) return 'out';
  if (par > 0 && s <= par * 0.5) return 'critical';
  if (par > 0 && s <= par) return 'low';
  return 'in';
}

const STATUS_META: Record<StockStatus, { label: string; cls: string; dot: string }> = {
  in: { label: 'In Stock', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  low: { label: 'Low Stock', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  critical: { label: 'Critical', cls: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
  out: { label: 'Out of Stock', cls: 'bg-slate-500/10 text-slate-600 dark:text-slate-300', dot: 'bg-slate-400' },
};

const EMPTY_FORM = { name: '', category: '', unit: 'kg', current_stock: '', par_level: '', cost_per_unit: '' };

function Donut({ parts }: { parts: { label: string; count: number; color: string }[] }) {
  const total = parts.reduce((s, p) => s + p.count, 0) || 1;
  const R = 54;
  const C = 2 * Math.PI * R;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <div className="relative h-[132px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-90">
          <circle cx="66" cy="66" r={R} fill="none" strokeWidth="16" className="stroke-soft" />
          {parts.map((p) => {
            const frac = p.count / total;
            const el = (
              <circle
                key={p.label}
                cx="66"
                cy="66"
                r={R}
                fill="none"
                stroke={p.color}
                strokeWidth="16"
                strokeDasharray={`${(frac * C).toFixed(1)} ${C.toFixed(1)}`}
                strokeDashoffset={(-acc * C).toFixed(1)}
                strokeLinecap="butt"
              />
            );
            acc += frac;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-mono text-[24px] font-black text-ink">{total === 0 ? 0 : parts.reduce((s, p) => s + p.count, 0)}</p>
          <p className="text-[10.5px] font-bold text-muted">Total Items</p>
        </div>
      </div>
      <ul className="flex-1 space-y-2">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center justify-between gap-2 text-[12.5px]">
            <span className="flex items-center gap-2 font-bold text-body">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
              {p.label}
            </span>
            <span className="font-mono font-bold text-muted">
              {p.count} ({total ? Math.round((p.count / total) * 100) : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OwnerInventoryTab({ restaurantId }: { restaurantId: string }) {
  const [rows, setRows] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>('all');
  const [q, setQ] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<InvItem | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [adjusting, setAdjusting] = useState<InvItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [confirmDel, setConfirmDel] = useState<InvItem | null>(null);
  const guard = useGuard();
  const del = useUndoDelete<InvItem>(async (it) => {
    await createClient().from('inventory_items').delete().eq('id', it.id);
  });

  const load = async () => {
    const { data } = await createClient()
      .from('inventory_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    if (data) setRows(data as InvItem[]);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    load();
    const supabase = createClient();
    const ch = supabase
      .channel(`owner-inv-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'inventory_items', filter: `restaurant_id=eq.${restaurantId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const cats = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category?.trim() || 'Uncategorized', (m.get(r.category?.trim() || 'Uncategorized') ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [rows]);

  const withStatus = useMemo(() => rows.map((r) => ({ ...r, st: stockStatus(r) })), [rows]);

  const stats = useMemo(() => {
    const low = withStatus.filter((r) => r.st === 'low' || r.st === 'critical').length;
    const out = withStatus.filter((r) => r.st === 'out').length;
    const value = withStatus.reduce((s, r) => s + Number(r.current_stock) * Number(r.cost_per_unit), 0);
    return { total: rows.length, low, out, value };
  }, [withStatus, rows.length]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return withStatus.filter((r) => {
      if (cat !== 'all' && (r.category?.trim() || 'Uncategorized') !== cat) return false;
      if (needle && !r.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [withStatus, cat, q]);

  const actionNeeded = useMemo(
    () => withStatus.filter((r) => r.st === 'critical' || r.st === 'out' || r.st === 'low').slice(0, 5),
    [withStatus]
  );

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
    setFormError('');
  };
  const openEdit = (it: InvItem) => {
    setEditing(it);
    setForm({
      name: it.name,
      category: it.category ?? '',
      unit: it.unit,
      current_stock: String(it.current_stock),
      par_level: String(it.par_level),
      cost_per_unit: String(it.cost_per_unit),
    });
    setFormError('');
    setMenuOpenId(null);
  };

  const saveForm = () =>
    guard(async () => {
      const name = form.name.trim();
      if (!name) {
        setFormError('Item name is required.');
        return;
      }
      const payload = {
        restaurant_id: restaurantId,
        name,
        category: form.category.trim() || null,
        unit: form.unit.trim() || 'pcs',
        current_stock: Number(form.current_stock) || 0,
        par_level: Number(form.par_level) || 0,
        cost_per_unit: Number(form.cost_per_unit) || 0,
      };
      setSaving(true);
      const supabase = createClient();
      const { error } =
        editing && editing !== 'new'
          ? await supabase.from('inventory_items').update(payload).eq('id', editing.id)
          : await supabase.from('inventory_items').insert(payload);
      setSaving(false);
      if (error) {
        setFormError(error.message);
        return;
      }
      setEditing(null);
      load();
    });

  const saveAdjust = () =>
    guard(async () => {
      if (!adjusting) return;
      const delta = Number(adjustQty);
      if (!adjustQty.trim() || Number.isNaN(delta)) return;
      setSaving(true);
      const { error } = await createClient()
        .from('inventory_items')
        .update({ current_stock: Number(adjusting.current_stock) + delta })
        .eq('id', adjusting.id);
      setSaving(false);
      if (!error) {
        setAdjusting(null);
        setAdjustQty('');
        load();
      }
    });

  const downloadCsv = () => {
    exportAsCsv(
      `inventory_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Item', 'Category', 'Current Stock', 'Unit', 'Status', 'Par Level', 'Cost/Unit', 'Stock Value'],
      visible.map((r) => [
        r.name,
        r.category ?? '',
        String(r.current_stock),
        r.unit,
        STATUS_META[r.st].label,
        String(r.par_level),
        String(r.cost_per_unit),
        (Number(r.current_stock) * Number(r.cost_per_unit)).toFixed(2),
      ])
    );
  };

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-amber-500 to-orange-600 text-[22px] text-white shadow-sm">
            📦
          </span>
          <div>
            <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">Inventory</h2>
            <p className="text-[12px] font-medium text-muted">Track stock, monitor usage and avoid waste</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadCsv}
            className="inline-flex items-center gap-2 rounded-[13px] border border-line/70 bg-[var(--c-surface-solid)] px-4 py-2 text-[13px] font-extrabold text-ink shadow-sm transition-all hover:border-brand/40"
          >
            <span>⬇️</span> Download Report
          </button>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 rounded-[13px] bg-brand px-4 py-2 text-[13px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99]"
          >
            <span className="text-[15px]">＋</span> Add Item
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Total Items', value: fmtNum(stats.total), icon: '📦', tone: 'text-brand' },
          { label: 'Low Stock', value: fmtNum(stats.low), icon: '⚠️', tone: 'text-amber-600 dark:text-amber-400' },
          { label: 'Out of Stock', value: fmtNum(stats.out), icon: '🚫', tone: 'text-rose-600 dark:text-rose-400' },
          { label: 'Total Stock Value', value: fmtPKR(stats.value), icon: '💰', tone: 'text-emerald-600 dark:text-emerald-400' },
        ].map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2.5">
              <span className="text-[20px]">{c.icon}</span>
              <p className="text-[12px] font-bold text-muted">{c.label}</p>
            </div>
            <p className={`mt-1.5 font-mono text-[22px] font-black ${c.tone}`}>{c.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        {/* Items table */}
        <div className="xl:col-span-8">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h3 className="font-display text-[15px] font-extrabold text-ink">Inventory Items</h3>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search items..."
                className="w-44 rounded-full border border-line/70 bg-soft/60 px-3.5 py-1.5 text-[12px] font-medium text-ink outline-none placeholder:text-muted/70 focus:border-brand/50"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto border-b border-line px-4 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                onClick={() => setCat('all')}
                className={`shrink-0 rounded-[12px] px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                  cat === 'all' ? 'bg-brand text-white shadow-lift' : 'border border-line/70 text-muted hover:text-ink'
                }`}
              >
                All Items ({rows.length})
              </button>
              {cats.map(([name, n]) => (
                <button
                  key={name}
                  onClick={() => setCat(name)}
                  className={`shrink-0 rounded-[12px] px-3 py-1.5 text-[12px] font-extrabold transition-all ${
                    cat === name ? 'bg-brand text-white shadow-lift' : 'border border-line/70 text-muted hover:text-ink'
                  }`}
                >
                  {name} ({n})
                </button>
              ))}
            </div>

            {loading ? (
              <p className="p-8 text-center text-[13px] font-medium text-muted">Loading inventory...</p>
            ) : visible.length === 0 ? (
              <div className="p-6">
                <Empty
                  title={rows.length === 0 ? 'No inventory items yet' : 'No items match'}
                  sub={rows.length === 0 ? 'Add your first stock item to start tracking.' : 'Try a different search or category.'}
                />
                {rows.length === 0 && (
                  <div className="mt-3 text-center">
                    <button onClick={openNew} className="rounded-[12px] bg-brand px-4 py-2 text-[13px] font-black text-white shadow-lift">
                      ＋ Add First Item
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="hidden grid-cols-12 gap-2 border-b border-line px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted md:grid">
                  <p className="col-span-4">Item</p>
                  <p className="col-span-2">Category</p>
                  <p className="col-span-2">Current Stock</p>
                  <p className="col-span-2">Status</p>
                  <p className="col-span-1 text-right">Value</p>
                  <p className="col-span-1" />
                </div>
                <div className="max-h-[520px] divide-y divide-line/50 overflow-y-auto">
                  {visible.map((r) => {
                    const meta = STATUS_META[r.st];
                    return (
                      <div key={r.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                        <div className="col-span-8 md:col-span-4">
                          <p className="truncate text-[13.5px] font-extrabold text-ink">{r.name}</p>
                          <p className="text-[11px] font-medium text-muted">
                            {fmtPKR(Number(r.cost_per_unit))} / {r.unit}
                          </p>
                        </div>
                        <p className="hidden text-[12.5px] font-medium text-muted md:col-span-2 md:block">
                          {r.category || '—'}
                        </p>
                        <p className="col-span-4 font-mono text-[13px] font-extrabold text-ink md:col-span-2">
                          {fmtNum(Number(r.current_stock))} <span className="text-[11px] font-bold text-muted">{r.unit}</span>
                        </p>
                        <div className="col-span-6 md:col-span-2">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${meta.cls}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                        </div>
                        <p className="hidden text-right font-mono text-[12.5px] font-bold text-ink md:col-span-1 md:block">
                          {fmtPKR(Number(r.current_stock) * Number(r.cost_per_unit))}
                        </p>
                        <div className="col-span-6 flex justify-end md:col-span-1">
                          <div className="relative">
                            <button
                              onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                              className="rounded-[10px] p-1.5 text-[16px] font-black text-muted transition-colors hover:bg-soft hover:text-ink"
                              aria-label="Item actions"
                            >
                              ⋮
                            </button>
                            {menuOpenId === r.id && (
                              <>
                                <div className="fixed inset-0 z-30" onClick={() => setMenuOpenId(null)} />
                                <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-1 shadow-xl">
                                  <button
                                    onClick={() => { setMenuOpenId(null); setAdjusting(r); setAdjustQty(''); }}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-ink hover:bg-brand/10 hover:text-brand"
                                  >
                                    <span>📊</span> Adjust Stock
                                  </button>
                                  <button
                                    onClick={() => openEdit(r)}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-ink hover:bg-brand/10 hover:text-brand"
                                  >
                                    <span>✏️</span> Edit
                                  </button>
                                  <button
                                    onClick={() => { setMenuOpenId(null); setConfirmDel(r); }}
                                    className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[12.5px] font-bold text-rose-600 hover:bg-rose-500/10"
                                  >
                                    <span>🗑️</span> Delete
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4 xl:col-span-4">
          <Card className="p-4">
            <h3 className="font-display text-[14px] font-extrabold text-ink">Stock Overview</h3>
            <div className="mt-3">
              <Donut
                parts={[
                  { label: 'In Stock', count: withStatus.filter((r) => r.st === 'in').length, color: '#10b981' },
                  { label: 'Low Stock', count: withStatus.filter((r) => r.st === 'low').length, color: '#f59e0b' },
                  { label: 'Critical', count: withStatus.filter((r) => r.st === 'critical').length, color: '#f43f5e' },
                  { label: 'Out of Stock', count: withStatus.filter((r) => r.st === 'out').length, color: '#94a3b8' },
                ]}
              />
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-display text-[14px] font-extrabold text-ink">Action Needed</h3>
            {actionNeeded.length === 0 ? (
              <p className="mt-2 text-[12.5px] font-medium text-muted">All stocked up. Nothing needs attention.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {actionNeeded.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 rounded-[12px] bg-amber-500/[0.07] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-extrabold text-ink">{r.name}</p>
                      <p className="text-[11px] font-medium text-muted">
                        {fmtNum(Number(r.current_stock))} {r.unit} left
                        {Number(r.par_level) > 0 && ` · par ${fmtNum(Number(r.par_level))}`}
                      </p>
                    </div>
                    <button
                      onClick={() => { setAdjusting(r); setAdjustQty(''); }}
                      className="shrink-0 rounded-[10px] bg-brand px-2.5 py-1.5 text-[11.5px] font-black text-white"
                    >
                      Restock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Add/Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md rounded-[20px] border border-line bg-[var(--c-surface-solid)] p-5 shadow-2xl">
            <h3 className="font-display text-[16px] font-black text-ink">
              {editing === 'new' ? 'Add Inventory Item' : 'Edit Item'}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Item name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chicken Breast" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Produce" list="inv-cats" />
                  <datalist id="inv-cats">
                    {cats.map(([n]) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="kg" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Current stock</Label>
                  <Input type="number" value={form.current_stock} onChange={(e) => setForm({ ...form, current_stock: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Par level</Label>
                  <Input type="number" value={form.par_level} onChange={(e) => setForm({ ...form, par_level: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <Label>Cost / unit (Rs)</Label>
                  <Input type="number" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} placeholder="0" />
                </div>
              </div>
              {formError && <p className="text-[12.5px] font-bold text-rose-600">{formError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-[12px] border border-line/70 px-4 py-2.5 text-[13px] font-extrabold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={saveForm}
                  disabled={saving}
                  className="flex-1 rounded-[12px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing === 'new' ? 'Add Item' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Adjust stock modal */}
      {adjusting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAdjusting(null)} />
          <div className="relative w-full max-w-xs rounded-[20px] border border-line bg-[var(--c-surface-solid)] p-5 shadow-2xl">
            <h3 className="font-display text-[16px] font-black text-ink">Adjust Stock</h3>
            <p className="mt-1 text-[12.5px] font-medium text-muted">
              {adjusting.name} · currently {fmtNum(Number(adjusting.current_stock))} {adjusting.unit}
            </p>
            <div className="mt-3">
              <Label>Quantity change (use − for usage)</Label>
              <Input
                type="number"
                value={adjustQty}
                onChange={(e) => setAdjustQty(e.target.value)}
                placeholder="+10 or -5"
                autoFocus
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setAdjusting(null)}
                className="flex-1 rounded-[12px] border border-line/70 px-4 py-2.5 text-[13px] font-extrabold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={saveAdjust}
                disabled={saving}
                className="flex-1 rounded-[12px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm + undo */}
      {confirmDel && (
        <DeleteConfirm
          title="Delete inventory item?"
          message={`"${confirmDel.name}" will be removed from inventory.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const it = confirmDel;
            setConfirmDel(null);
            del.schedule(it, `"${it.name}" deleted`, () =>
              setRows((prev) => prev.filter((r) => r.id !== it.id))
            );
          }}
        />
      )}
      {del.pending && (
        <UndoToast
          label={del.pending.label}
          seconds={del.seconds}
          onUndo={() => del.undo((it) => setRows((prev) => [...prev, it].sort((a, b) => a.name.localeCompare(b.name))))}
        />
      )}
    </div>
  );
}
