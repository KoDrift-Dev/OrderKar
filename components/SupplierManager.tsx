'use client';

// Supplier directory: full CRUD per restaurant.
// Deletes use centered confirm + 5s Undo per house rules.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logActivity, ACT } from '@/lib/activity';
import { Card, Empty, Input, Label } from './ui';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';

interface Supplier {
  id: string;
  restaurant_id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SupplierManager({ restaurantId }: { restaurantId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const guard = useGuard();
  const [confirmDel, setConfirmDel] = useState<Supplier | null>(null);
  const del = useUndoDelete<Supplier>(async (s) => {
    await createClient().from('suppliers').delete().eq('id', s.id);
    logActivity(createClient(), {
      restaurantId,
      action: ACT.SUPPLIER_DELETED,
      entityType: 'supplier',
      entityId: s.id,
      details: { name: s.name },
    });
  });

  const load = async () => {
    setLoading(true);
    const { data } = await createClient()
      .from('suppliers')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('name');
    setSuppliers((data ?? []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const openNew = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setActive(true);
    setEditing('new');
    setError('');
  };

  const openEdit = (s: Supplier) => {
    setName(s.name);
    setPhone(s.phone ?? '');
    setEmail(s.email ?? '');
    setAddress(s.address ?? '');
    setActive(s.is_active);
    setEditing(s);
    setError('');
  };

  const save = () =>
    guard(async () => {
      if (!name.trim()) {
        setError('Supplier name is required.');
        return;
      }
      setSaving(true);
      setError('');
      try {
        const supabase = createClient();
        const payload = {
          restaurant_id: restaurantId,
          name: name.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          is_active: active,
        };
        if (editing === 'new') {
          const { error } = await supabase.from('suppliers').insert(payload);
          if (error) throw new Error(error.message);
          logActivity(supabase, {
            restaurantId,
            action: ACT.SUPPLIER_ADDED,
            entityType: 'supplier',
            details: { name: payload.name },
          });
        } else if (editing) {
          const { error } = await supabase.from('suppliers').update(payload).eq('id', editing.id);
          if (error) throw new Error(error.message);
          logActivity(supabase, {
            restaurantId,
            action: ACT.SUPPLIER_UPDATED,
            entityType: 'supplier',
            entityId: editing.id,
            details: { name: payload.name },
          });
        }
        setEditing(null);
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Save failed');
      } finally {
        setSaving(false);
      }
    });

  const toggleActive = (s: Supplier) =>
    guard(async () => {
      const supabase = createClient();
      const { error } = await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id);
      if (!error) {
        setSuppliers((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: !s.is_active } : x)));
        logActivity(supabase, {
          restaurantId,
          action: ACT.SUPPLIER_UPDATED,
          entityType: 'supplier',
          entityId: s.id,
          details: { name: s.name, is_active: !s.is_active },
        });
      }
    });

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-blue-600 text-[22px] text-white shadow-sm">
            🚚
          </span>
          <div>
            <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">Suppliers</h2>
            <p className="text-[12px] font-medium text-muted">Manage your ingredient and stock suppliers</p>
          </div>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-2 rounded-[13px] bg-brand px-4 py-2 text-[13px] font-black text-white shadow-lift transition-all hover:bg-brand-deep active:scale-[0.99]"
        >
          <span className="text-[15px]">＋</span> Add Supplier
        </button>
      </div>

      <Card className="overflow-hidden p-0">
        {loading ? (
          <p className="p-8 text-center text-[13px] font-medium text-muted">Loading suppliers...</p>
        ) : suppliers.length === 0 ? (
          <div className="p-6">
            <Empty
              title="No suppliers yet"
              sub="Add your first supplier to link them to inventory items and purchase orders."
            />
            <div className="mt-3 text-center">
              <button
                onClick={openNew}
                className="rounded-[12px] bg-brand px-4 py-2 text-[13px] font-black text-white shadow-lift"
              >
                ＋ Add First Supplier
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="hidden grid-cols-12 gap-2 border-b border-line px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted md:grid">
              <p className="col-span-4">Name</p>
              <p className="col-span-3">Phone</p>
              <p className="col-span-3">Email</p>
              <p className="col-span-1">Status</p>
              <p className="col-span-1" />
            </div>
            <div className="divide-y divide-line/50">
              {suppliers.map((s) => (
                <div key={s.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3">
                  <div className="col-span-8 md:col-span-4">
                    <p className="truncate text-[13.5px] font-extrabold text-ink">{s.name}</p>
                    {s.address && (
                      <p className="truncate text-[11px] font-medium text-muted">{s.address}</p>
                    )}
                  </div>
                  <p className="hidden text-[12.5px] font-medium text-muted md:col-span-3 md:block">{s.phone || '—'}</p>
                  <p className="hidden truncate text-[12.5px] font-medium text-muted md:col-span-3 md:block">{s.email || '—'}</p>
                  <div className="col-span-3 md:col-span-1">
                    <button
                      onClick={() => toggleActive(s)}
                      title={s.is_active ? 'Deactivate' : 'Activate'}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${
                        s.is_active
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${s.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <div className="col-span-1 flex justify-end gap-1">
                    <button
                      onClick={() => openEdit(s)}
                      className="rounded-[10px] p-1.5 text-[15px] text-muted transition-colors hover:bg-soft hover:text-ink"
                      aria-label={`Edit ${s.name}`}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setConfirmDel(s)}
                      className="rounded-[10px] p-1.5 text-[15px] text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                      aria-label={`Delete ${s.name}`}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Add/Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setEditing(null)} />
          <div className="relative w-full max-w-md rounded-[20px] border border-line bg-[var(--c-surface-solid)] p-5 shadow-2xl">
            <h3 className="font-display text-[16px] font-black text-ink">
              {editing === 'new' ? 'Add Supplier' : 'Edit Supplier'}
            </h3>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Supplier name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fresh Foods Ltd" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="03XX-XXXXXXX" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="supplier@example.com"
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Shop address" />
              </div>
              <div className="flex items-center justify-between rounded-[12px] border border-line/70 px-3.5 py-2.5">
                <span className="text-[13px] font-extrabold text-ink">Active</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label="Supplier active"
                  onClick={() => setActive(!active)}
                  className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
              {error && <p className="text-[12.5px] font-bold text-rose-600">{error}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setEditing(null)}
                  className="flex-1 rounded-[12px] border border-line/70 px-4 py-2.5 text-[13px] font-extrabold text-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex-1 rounded-[12px] bg-brand px-4 py-2.5 text-[13px] font-black text-white shadow-lift disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editing === 'new' ? 'Add Supplier' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm + undo */}
      {confirmDel && (
        <DeleteConfirm
          title="Delete supplier?"
          message={`"${confirmDel.name}" will be removed. Inventory items linked to it will keep their stock but lose the supplier link.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const s = confirmDel;
            setConfirmDel(null);
            del.schedule(s, `"${s.name}" deleted`, () =>
              setSuppliers((prev) => prev.filter((r) => r.id !== s.id))
            );
          }}
        />
      )}
      {del.pending && (
        <UndoToast
          label={del.pending.label}
          seconds={del.seconds}
          onUndo={() => del.undo((s) => setSuppliers((prev) => [...prev, s].sort((a, b) => a.name.localeCompare(b.name))))}
        />
      )}
    </div>
  );
}
