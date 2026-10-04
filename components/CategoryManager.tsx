'use client';

// Category management: list, add, edit, reorder, activate/deactivate.
// Deleting a category with dishes is blocked (move/delete dishes first).

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MenuCategory } from '@/lib/types';
import { Btn, Card, Empty, Input, Label } from './ui';

export default function CategoryManager({ restaurantId }: { restaurantId: string }) {
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<MenuCategory | 'new' | null>(null);
  const [name, setName] = useState('');
  const [order, setOrder] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: c }, { data: items }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
      supabase.from('menu_items').select('id, category_id').eq('restaurant_id', restaurantId),
    ]);
    setCats((c ?? []) as MenuCategory[]);
    const m: Record<string, number> = {};
    (items ?? []).forEach((i: { category_id: string }) => {
      m[i.category_id] = (m[i.category_id] ?? 0) + 1;
    });
    setCounts(m);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const openNew = () => {
    setName('');
    setOrder(String(Math.max(0, ...cats.map((c) => c.display_order)) + 1));
    setActive(true);
    setEditing('new');
    setError('');
  };

  const openEdit = (c: MenuCategory) => {
    setName(c.name);
    setOrder(String(c.display_order));
    setActive(c.is_active);
    setEditing(c);
    setError('');
  };

  const save = async () => {
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const payload = {
        restaurant_id: restaurantId,
        name: name.trim(),
        display_order: Number(order) || 0,
        is_active: active,
      };
      if (editing === 'new') {
        const { error } = await supabase.from('menu_categories').insert(payload);
        if (error) throw new Error(error.message);
      } else if (editing) {
        const { error } = await supabase.from('menu_categories').update(payload).eq('id', editing.id);
        if (error) throw new Error(error.message);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const move = async (c: MenuCategory, dir: -1 | 1) => {
    const sorted = [...cats].sort((a, b) => a.display_order - b.display_order);
    const i = sorted.findIndex((x) => x.id === c.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    const supabase = createClient();
    const a = sorted[i];
    const b = sorted[j];
    await supabase.from('menu_categories').update({ display_order: b.display_order }).eq('id', a.id);
    await supabase.from('menu_categories').update({ display_order: a.display_order }).eq('id', b.id);
    load();
  };

  const toggleActive = async (c: MenuCategory) => {
    const supabase = createClient();
    const { error } = await supabase.from('menu_categories').update({ is_active: !c.is_active }).eq('id', c.id);
    if (!error) setCats((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: !c.is_active } : x)));
  };

  const remove = async (c: MenuCategory) => {
    if ((counts[c.id] ?? 0) > 0) {
      alert(`"${c.name}" has ${counts[c.id]} dish(es). Move or delete them first.`);
      return;
    }
    if (!window.confirm(`Delete category "${c.name}"?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from('menu_categories').delete().eq('id', c.id);
    if (!error) load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-ink">Menu Categories</h1>
          <p className="mt-0.5 text-[13px] text-muted">{cats.length} categories · order controls the customer menu.</p>
        </div>
        <Btn onClick={openNew}>+ Add Category</Btn>
      </div>

      {loading ? (
        <Empty title="Loading categories…" />
      ) : cats.length === 0 ? (
        <Empty title="No categories yet" sub="Add your first category to organize the menu." />
      ) : (
        <div className="space-y-2.5">
          {cats.map((c, i) => (
            <Card key={c.id} className={`flex items-center gap-3 p-3.5 ${c.is_active ? '' : 'opacity-60'}`}>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => move(c, -1)} disabled={i === 0} className="px-1 text-[13px] text-muted disabled:opacity-25 hover:text-brand" title="Move up">▲</button>
                <button onClick={() => move(c, 1)} disabled={i === cats.length - 1} className="px-1 text-[13px] text-muted disabled:opacity-25 hover:text-brand" title="Move down">▼</button>
              </div>
              <div className="btn-3d flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] font-mono text-[14px] font-bold text-white">
                {c.display_order}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-[14.5px] font-extrabold text-ink">{c.name}</p>
                <p className="text-[12px] text-muted">
                  {counts[c.id] ?? 0} dish{(counts[c.id] ?? 0) === 1 ? '' : 'es'} · {c.is_active ? 'Visible' : 'Hidden'}
                </p>
              </div>
              <button
                onClick={() => toggleActive(c)}
                className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${c.is_active ? 'bg-ok/10 text-ok' : 'bg-line/60 text-muted'}`}
              >
                {c.is_active ? '● On' : '● Off'}
              </button>
              <button onClick={() => openEdit(c)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">✎</button>
              <button onClick={() => remove(c)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-danger/10 hover:text-danger">🗑</button>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setEditing(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-md flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editing === 'new' ? 'Add Category' : 'Edit Category'}
              </h2>
              <button onClick={() => !saving && setEditing(null)} aria-label="Close" className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted">✕</button>
            </div>
            <div className="space-y-4 p-4 sm:px-6">
              <div>
                <Label>Category name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="BBQ" className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Display order</Label>
                  <Input value={order} onChange={(e) => setOrder(e.target.value)} inputMode="numeric" className="mt-1.5" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      onClick={() => setActive((a) => !a)}
                      className={`relative h-6 w-11 rounded-full transition-colors ${active ? 'bg-ok' : 'bg-line'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    {active ? 'Visible' : 'Hidden'}
                  </label>
                </div>
              </div>
              {error && <p className="text-[13px] font-bold text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-4 sm:px-6">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-btn px-4 py-2.5 text-[13.5px] font-bold text-muted hover:text-ink">
                Cancel
              </button>
              <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add category' : 'Save changes'}</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
