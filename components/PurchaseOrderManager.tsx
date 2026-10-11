'use client';

// Purchase order management (Phase 2): create/send/receive/cancel POs,
// auto-generate restock POs from low-stock inventory, and receive stock
// into inventory on PO receipt. All data is real; RLS tenant-isolated.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logActivity, ACT } from '@/lib/activity';
import { fmtPKR } from '@/lib/format';
import { Btn, Card, Empty, Input, Label } from './ui';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';

type POStatus = 'draft' | 'pending' | 'received' | 'cancelled';

interface POItem {
  inventory_item_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
}

interface PurchaseOrder {
  id: string;
  restaurant_id: string;
  supplier_id: string | null;
  status: POStatus;
  items: POItem[];
  total_amount: number;
  notes: string | null;
  created_at: string;
  received_at: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface InvItem {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  par_level: number;
  cost_per_unit: number;
  supplier_id?: string | null;
}

type LineDraft = {
  key: number;
  inventory_item_id: string;
  quantity: string;
  unit_cost: string;
};

const FILTERS: { key: POStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Pending' },
  { key: 'received', label: 'Received' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLE: Record<POStatus, string> = {
  draft: 'bg-line/60 text-muted',
  pending: 'bg-amber/15 text-amber dark:text-amber',
  received: 'bg-ok/10 text-ok',
  cancelled: 'bg-danger/10 text-danger',
};

function statusLabel(s: POStatus): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function poNumber(po: PurchaseOrder): string {
  return `#${po.id.slice(0, 8).toUpperCase()}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

let lineKey = 1;
const blankLine = (): LineDraft => ({ key: lineKey++, inventory_item_id: '', quantity: '', unit_cost: '' });

export default function PurchaseOrderManager({ restaurantId }: { restaurantId: string }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<POStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const guard = useGuard();

  // New-PO modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete (drafts only) with 5s undo
  const [confirmDel, setConfirmDel] = useState<PurchaseOrder | null>(null);
  const del = useUndoDelete<PurchaseOrder>(async (po) => {
    await createClient().from('purchase_orders').delete().eq('id', po.id);
    logActivity(createClient(), {
      restaurantId,
      action: ACT.PO_STATUS_CHANGED,
      entityType: 'purchase_order',
      entityId: po.id,
      details: { from: 'draft', to: 'deleted' },
    });
  });

  const supplierMap = useMemo(() => {
    const m: Record<string, string> = {};
    suppliers.forEach((s) => {
      m[s.id] = s.name;
    });
    return m;
  }, [suppliers]);

  const itemMap = useMemo(() => {
    const m: Record<string, InvItem> = {};
    items.forEach((i) => {
      m[i.id] = i;
    });
    return m;
  }, [items]);

  const load = async () => {
    setLoading(true);
    setError('');
    const supabase = createClient();
    try {
      const [{ data: p, error: pErr }, { data: inv, error: invErr }] = await Promise.all([
        supabase
          .from('purchase_orders')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('created_at', { ascending: false }),
        supabase
          .from('inventory_items')
          .select('id, name, unit, current_stock, par_level, cost_per_unit, supplier_id')
          .eq('restaurant_id', restaurantId)
          .order('name'),
      ]);
      if (pErr) throw new Error(pErr.message);
      setPos(((p ?? []) as PurchaseOrder[]).map((po) => ({ ...po, items: po.items ?? [] })));
      // supplier_id may not exist yet if the phase-2 migration hasn't run —
      // fall back to a supplier-less item list instead of failing the page.
      let invItems: InvItem[];
      if (invErr) {
        const { data: inv2, error: inv2Err } = await supabase
          .from('inventory_items')
          .select('id, name, unit, current_stock, par_level, cost_per_unit')
          .eq('restaurant_id', restaurantId)
          .order('name');
        if (inv2Err) throw new Error(inv2Err.message);
        invItems = ((inv2 ?? []) as InvItem[]).map((i) => ({ ...i, supplier_id: null }));
      } else {
        invItems = (inv ?? []) as InvItem[];
      }
      setItems(invItems);
      // Suppliers are optional: if the table/SQL isn't there yet, POs still work supplier-less.
      try {
        const { data: sup } = await supabase
          .from('suppliers')
          .select('id, name')
          .eq('restaurant_id', restaurantId)
          .order('name');
        setSuppliers((sup ?? []) as Supplier[]);
      } catch {
        setSuppliers([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load purchase orders.');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const filtered = useMemo(
    () => (filter === 'all' ? pos : pos.filter((p) => p.status === filter)),
    [pos, filter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: pos.length };
    pos.forEach((p) => {
      c[p.status] = (c[p.status] ?? 0) + 1;
    });
    return c;
  }, [pos]);

  const modalTotal = useMemo(
    () =>
      lines.reduce((s, l) => {
        const q = Number(l.quantity);
        const u = Number(l.unit_cost);
        return s + (Number.isFinite(q) && Number.isFinite(u) && q > 0 && u >= 0 ? q * u : 0);
      }, 0),
    [lines]
  );

  const openNew = () => {
    setSupplierId('');
    setLines([blankLine()]);
    setNotes('');
    setModalError('');
    setModalOpen(true);
  };

  const setLine = (key: number, patch: Partial<LineDraft>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const onLineItem = (key: number, itemId: string) => {
    const it = itemMap[itemId];
    setLine(key, {
      inventory_item_id: itemId,
      unit_cost: it ? String(it.cost_per_unit ?? 0) : '',
    });
  };

  const buildPayload = (): { items: POItem[]; total: number } | null => {
    const built: POItem[] = [];
    for (const l of lines) {
      const it = itemMap[l.inventory_item_id];
      const q = Number(l.quantity);
      const u = Number(l.unit_cost);
      if (!it || !Number.isFinite(q) || q <= 0 || !Number.isFinite(u) || u < 0) continue;
      built.push({
        inventory_item_id: it.id,
        item_name: it.name,
        quantity: q,
        unit_cost: u,
      });
    }
    if (built.length === 0) {
      setModalError('Add at least one line with an item, quantity and unit cost.');
      return null;
    }
    return { items: built, total: built.reduce((s, i) => s + i.quantity * i.unit_cost, 0) };
  };

  const savePO = (status: 'draft' | 'pending') =>
    guard(async () => {
      const payload = buildPayload();
      if (!payload) return;
      setSaving(true);
      setModalError('');
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert({
            restaurant_id: restaurantId,
            supplier_id: supplierId || null,
            status,
            items: payload.items,
            total_amount: payload.total,
            notes: notes.trim() || null,
            created_by: user?.id ?? null,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        logActivity(supabase, {
          restaurantId,
          action: ACT.PO_CREATED,
          entityType: 'purchase_order',
          entityId: data.id,
          details: {
            supplier: supplierId ? supplierMap[supplierId] ?? supplierId : null,
            lines: payload.items.length,
            total: payload.total,
            status,
          },
        });
        setModalOpen(false);
        setNotice(status === 'pending' ? 'Purchase order sent.' : 'Draft purchase order saved.');
        await load();
      } catch (e) {
        setModalError(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    });

  const changeStatus = (po: PurchaseOrder, to: POStatus, extra: Record<string, unknown> = {}) =>
    guard(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: to, ...(to === 'received' ? { received_at: new Date().toISOString() } : {}), ...extra })
        .eq('id', po.id);
      if (error) {
        setError(error.message);
        return;
      }
      logActivity(supabase, {
        restaurantId,
        action: ACT.PO_STATUS_CHANGED,
        entityType: 'purchase_order',
        entityId: po.id,
        details: { from: po.status, to },
      });
      setPos((prev) => prev.map((x) => (x.id === po.id ? { ...x, status: to } : x)));
    });

  const markReceived = (po: PurchaseOrder) =>
    guard(async () => {
      const supabase = createClient();
      // Receive stock line by line, re-reading current stock first so we never
      // add onto a stale value.
      for (const line of po.items ?? []) {
        const { data: row, error: rErr } = await supabase
          .from('inventory_items')
          .select('current_stock')
          .eq('id', line.inventory_item_id)
          .maybeSingle();
        if (rErr) {
          setError(`Could not receive stock: ${rErr.message}`);
          return;
        }
        if (!row) continue; // item was deleted since the PO was created
        const { error: uErr } = await supabase
          .from('inventory_items')
          .update({ current_stock: Number(row.current_stock) + Number(line.quantity) })
          .eq('id', line.inventory_item_id);
        if (uErr) {
          setError(`Could not receive stock: ${uErr.message}`);
          return;
        }
      }
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'received', received_at: new Date().toISOString() })
        .eq('id', po.id);
      if (error) {
        setError(error.message);
        return;
      }
      logActivity(supabase, {
        restaurantId,
        action: ACT.PO_STATUS_CHANGED,
        entityType: 'purchase_order',
        entityId: po.id,
        details: { from: po.status, to: 'received', lines: (po.items ?? []).length },
      });
      setNotice('Purchase order received — stock updated.');
      setPos((prev) => prev.map((x) => (x.id === po.id ? { ...x, status: 'received' as POStatus } : x)));
    });

  const autoGenerate = () =>
    guard(async () => {
      setError('');
      setNotice('');
      const supabase = createClient();
      // 1. Low-stock items: par_level set and stock below it.
      const low = items.filter((i) => Number(i.par_level) > 0 && Number(i.current_stock) < Number(i.par_level));
      if (low.length === 0) {
        setNotice('No low-stock items — everything is at or above par level.');
        return;
      }
      // 2. Skip items already covered by an open (draft/pending) PO.
      const covered = new Set<string>();
      pos.forEach((po) => {
        if (po.status === 'draft' || po.status === 'pending') {
          (po.items ?? []).forEach((l) => covered.add(l.inventory_item_id));
        }
      });
      const todo = low.filter((i) => !covered.has(i.id));
      if (todo.length === 0) {
        setNotice('All low-stock items are already on an open purchase order.');
        return;
      }
      // 3. Group by supplier (items without one go into a supplier-less PO).
      const groups = new Map<string | null, InvItem[]>();
      todo.forEach((i) => {
        const key = i.supplier_id ?? null;
        const arr = groups.get(key) ?? [];
        arr.push(i);
        groups.set(key, arr);
      });
      // 4. One draft PO per supplier group.
      const {
        data: { user: autoUser },
      } = await supabase.auth.getUser();
      let created = 0;
      for (const [supId, group] of groups) {
        const poItems: POItem[] = group.map((i) => ({
          inventory_item_id: i.id,
          item_name: i.name,
          quantity: Math.ceil(Number(i.par_level) - Number(i.current_stock)),
          unit_cost: Number(i.cost_per_unit) || 0,
        }));
        const total = poItems.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
        const { data, error } = await supabase
          .from('purchase_orders')
          .insert({
            restaurant_id: restaurantId,
            supplier_id: supId,
            status: 'draft',
            items: poItems,
            total_amount: total,
            notes: 'Auto-generated from low stock',
            created_by: autoUser?.id ?? null,
          })
          .select()
          .single();
        if (error) {
          setError(`Auto-generate failed: ${error.message}`);
          break;
        }
        created += 1;
        logActivity(supabase, {
          restaurantId,
          action: ACT.PO_CREATED,
          entityType: 'purchase_order',
          entityId: data.id,
          details: {
            supplier: supId ? supplierMap[supId] ?? supId : null,
            lines: poItems.length,
            total,
            status: 'draft',
            auto: true,
          },
        });
      }
      if (created > 0) {
        setNotice(
          `Created ${created} draft purchase order${created === 1 ? '' : 's'} from low stock. Review and send them when ready.`
        );
        await load();
      }
    });

  const selectedItemIds = useMemo(() => new Set(lines.map((l) => l.inventory_item_id).filter(Boolean)), [lines]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-ink">Purchase Orders</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {pos.length} order{pos.length === 1 ? '' : 's'} · restock inventory from suppliers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="secondary" onClick={autoGenerate}>
            ⚡ Auto-generate from low stock
          </Btn>
          <Btn onClick={openNew}>+ New Purchase Order</Btn>
        </div>
      </div>

      {error && <p className="mb-3 text-[13px] font-bold text-danger">{error}</p>}
      {notice && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok/10 px-4 py-2.5 text-[13px] font-bold text-ok">
          <span aria-hidden>✓</span> {notice}
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
              filter === f.key ? 'bg-brand text-white' : 'bg-soft text-muted hover:text-ink'
            }`}
          >
            {f.label} · {counts[f.key] ?? 0}
          </button>
        ))}
      </div>

      {loading ? (
        <Empty title="Loading purchase orders…" />
      ) : filtered.length === 0 ? (
        <Empty
          title={filter === 'all' ? 'No purchase orders yet' : `No ${filter} orders`}
          sub="Create one manually, or auto-generate from low stock."
        />
      ) : (
        <div className="space-y-2.5">
          {filtered.map((po) => {
            const lineCount = (po.items ?? []).length;
            const expanded = expandedId === po.id;
            return (
              <Card key={po.id} className="overflow-hidden p-0">
                <button
                  onClick={() => setExpandedId(expanded ? null : po.id)}
                  className="flex w-full items-center gap-3 p-3.5 text-left"
                >
                  <div className="btn-3d flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-mono text-[13px] font-bold text-white">
                    🧾
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-[14.5px] font-extrabold text-ink">
                      {poNumber(po)}
                      <span className="ml-2 font-sans text-[12px] font-medium text-muted">
                        {supplierMap[po.supplier_id ?? ''] ?? (po.supplier_id ? 'Unknown supplier' : 'No supplier')}
                      </span>
                    </p>
                    <p className="text-[12px] text-muted">
                      {fmtDate(po.created_at)} · {lineCount} line{lineCount === 1 ? '' : 's'} ·{' '}
                      <span className="font-bold text-ink">{fmtPKR(Number(po.total_amount))}</span>
                    </p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${STATUS_STYLE[po.status]}`}>
                    ● {statusLabel(po.status)}
                  </span>
                  <span className="text-muted text-[13px]">{expanded ? '▴' : '▾'}</span>
                </button>

                {expanded && (
                  <div className="border-t border-line px-4 py-3">
                    {(po.items ?? []).length === 0 ? (
                      <p className="text-[12.5px] text-muted">No lines on this order.</p>
                    ) : (
                      <div className="mb-3 space-y-1.5">
                        {(po.items ?? []).map((l, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[13px]">
                            <span className="min-w-0 flex-1 truncate font-bold text-ink">{l.item_name}</span>
                            <span className="shrink-0 text-muted">
                              {l.quantity} × {fmtPKR(Number(l.unit_cost))}
                            </span>
                            <span className="w-24 shrink-0 text-right font-bold text-ink">
                              {fmtPKR(Number(l.quantity) * Number(l.unit_cost))}
                            </span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between border-t border-line pt-2 text-[13.5px]">
                          <span className="font-bold text-muted">Total</span>
                          <span className="font-display text-[15px] font-extrabold text-ink">
                            {fmtPKR(Number(po.total_amount))}
                          </span>
                        </div>
                      </div>
                    )}
                    {po.notes && <p className="mb-3 text-[12.5px] italic text-muted">“{po.notes}”</p>}
                    <div className="flex flex-wrap gap-2">
                      {po.status === 'draft' && (
                        <>
                          <Btn size="sm" onClick={() => changeStatus(po, 'pending')}>
                            Send to supplier
                          </Btn>
                          <Btn size="sm" variant="danger" onClick={() => setConfirmDel(po)}>
                            Delete
                          </Btn>
                        </>
                      )}
                      {po.status === 'pending' && (
                        <>
                          <Btn size="sm" onClick={() => markReceived(po)}>
                            ✓ Mark Received
                          </Btn>
                          <Btn size="sm" variant="secondary" onClick={() => changeStatus(po, 'cancelled')}>
                            Cancel
                          </Btn>
                        </>
                      )}
                      {(po.status === 'received' || po.status === 'cancelled') && (
                        <p className="text-[12.5px] text-muted">
                          {po.status === 'received' && po.received_at
                            ? `Received ${fmtDate(po.received_at)}`
                            : 'This order is closed.'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {confirmDel && (
        <DeleteConfirm
          title="Delete this purchase order?"
          message={`${poNumber(confirmDel)} will be removed. You can undo this for 5 seconds.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const po = confirmDel;
            setConfirmDel(null);
            del.schedule(po, poNumber(po), () => {
              setPos((prev) => prev.filter((x) => x.id !== po.id));
            });
          }}
        />
      )}
      {del.pending && (
        <UndoToast label={del.pending.label} seconds={del.seconds} onUndo={() => del.undo((po) => setPos((prev) => [...prev, po].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))))} />
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setModalOpen(false)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">New Purchase Order</h2>
              <button onClick={() => !saving && setModalOpen(false)} aria-label="Close" className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted">
                ✕
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 sm:px-6">
              <div>
                <Label>Supplier (optional)</Label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  aria-label="Supplier"
                  className="mt-1.5 w-full rounded-btn border border-line bg-[var(--c-surface-solid)] px-3 py-2.5 text-[13.5px] text-ink"
                >
                  <option value="">No supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {suppliers.length === 0 && (
                  <p className="mt-1 text-[12px] text-muted">
                    No suppliers yet — add them in Inventory → Suppliers first, or leave this order supplier-less.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Order lines</Label>
                  <button
                    onClick={() => setLines((prev) => [...prev, blankLine()])}
                    className="text-[12.5px] font-bold text-brand hover:underline"
                  >
                    + Add line
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((l) => (
                    <div key={l.key} className="grid grid-cols-12 items-end gap-2 rounded-[14px] border border-line p-2.5">
                      <div className="col-span-12 sm:col-span-5">
                        <Label>Item</Label>
                        <select
                          value={l.inventory_item_id}
                          onChange={(e) => onLineItem(l.key, e.target.value)}
                          aria-label="Inventory item"
                          className="mt-1 w-full rounded-btn border border-line bg-[var(--c-surface-solid)] px-2.5 py-2 text-[13px] text-ink"
                        >
                          <option value="">Select item…</option>
                          {items
                            .filter((i) => i.id === l.inventory_item_id || !selectedItemIds.has(i.id))
                            .map((i) => (
                              <option key={i.id} value={i.id}>
                                {i.name} ({i.unit})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label>Qty</Label>
                        <Input
                          value={l.quantity}
                          onChange={(e) => setLine(l.key, { quantity: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label="Quantity"
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label>Unit cost</Label>
                        <Input
                          value={l.unit_cost}
                          onChange={(e) => setLine(l.key, { unit_cost: e.target.value })}
                          inputMode="decimal"
                          placeholder="0"
                          aria-label="Unit cost"
                          className="mt-1"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right text-[13px] font-bold text-ink">
                        {fmtPKR(
                          Number(l.quantity) > 0 && Number(l.unit_cost) >= 0
                            ? Number(l.quantity) * Number(l.unit_cost)
                            : 0
                        )}
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : prev))}
                          aria-label="Remove line"
                          title="Remove line"
                          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          🗑
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery instructions…"
                  aria-label="Order notes"
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center justify-between rounded-[14px] bg-soft px-4 py-3">
                <span className="text-[13px] font-bold text-muted">Order total</span>
                <span className="font-display text-[18px] font-extrabold text-ink">{fmtPKR(modalTotal)}</span>
              </div>

              {modalError && <p className="text-[13px] font-bold text-danger">{modalError}</p>}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-line p-4 sm:px-6">
              <button
                onClick={() => setModalOpen(false)}
                disabled={saving}
                className="rounded-btn px-4 py-2.5 text-[13.5px] font-bold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <Btn variant="secondary" onClick={() => savePO('draft')} disabled={saving}>
                {saving ? 'Saving…' : 'Save as Draft'}
              </Btn>
              <Btn onClick={() => savePO('pending')} disabled={saving}>
                {saving ? 'Saving…' : 'Save & Send'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
