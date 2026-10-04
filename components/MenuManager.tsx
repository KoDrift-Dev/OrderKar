'use client';

// Menu manager for owner/manager — Cluck-N-Moo style: searchable/filterable
// grid of dish cards, add/edit with photo upload (Supabase Storage),
// availability toggle, duplicate, delete.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { categoryImage } from '@/lib/food-images';
import { cdnUrl } from '@/lib/images';
import { Btn, Card, Empty, Input, Label, Pill, Select, Textarea } from './ui';
import PhotoDropzone, { useUploadState } from './PhotoDropzone';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';

type StatusFilter = 'all' | 'available' | 'soldout' | 'popular';
type SortKey = 'name' | 'price-asc' | 'price-desc' | 'category';

const TAG_OPTIONS = [
  { key: 'bestseller', label: '★ Bestseller' },
  { key: 'spicy', label: '🌶 Spicy' },
  { key: 'veg', label: 'Veg' },
];

interface FormState {
  name: string;
  category_id: string;
  price: string;
  description: string;
  ingredients: string;
  tags: string[];
  is_available: boolean;
  image_url: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  category_id: '',
  price: '',
  description: '',
  ingredients: '',
  tags: [],
  is_available: true,
  image_url: '',
};

export default function MenuManager({ restaurantId }: { restaurantId: string }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [editing, setEditing] = useState<MenuItem | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const fUp = useUploadState(); // item photo upload tracker
  const guard = useGuard();
  const [confirmDel, setConfirmDel] = useState<MenuItem | null>(null);
  const del = useUndoDelete<MenuItem>(async (item) => {
    await createClient().from('menu_items').delete().eq('id', item.id);
  });
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: c }, { data: it }] = await Promise.all([
      supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('display_order'),
      supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
    ]);
    setCats((c ?? []) as MenuCategory[]);
    setItems((it ?? []) as MenuItem[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const catName = useMemo(() => {
    const m: Record<string, string> = {};
    cats.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [cats]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter(
      (i) =>
        (catFilter === 'all' || i.category_id === catFilter) &&
        (statusFilter === 'all' ||
          (statusFilter === 'available' && i.is_available) ||
          (statusFilter === 'soldout' && !i.is_available) ||
          (statusFilter === 'popular' && i.tags.includes('bestseller'))) &&
        (!q ||
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q) ||
          (i.ingredients ?? '').toLowerCase().includes(q)),
    );
    list = [...list].sort((a, b) => {
      if (sortBy === 'price-asc') return Number(a.price) - Number(b.price);
      if (sortBy === 'price-desc') return Number(b.price) - Number(a.price);
      if (sortBy === 'category') return (catName[a.category_id] ?? '').localeCompare(catName[b.category_id] ?? '') || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [items, search, catFilter, statusFilter, sortBy, catName]);

  const popularCount = items.filter((i) => i.tags.includes('bestseller')).length;

  const openNew = () => {
    setForm({ ...EMPTY_FORM, category_id: cats[0]?.id ?? '' });
    setEditing('new');
    setError('');
  };

  const openEdit = (item: MenuItem) => {
    setForm({
      name: item.name,
      category_id: item.category_id,
      price: String(item.price),
      description: item.description ?? '',
      ingredients: item.ingredients ?? '',
      tags: [...item.tags],
      is_available: item.is_available,
      image_url: item.image_url ?? '',
    });
    setEditing(item);
    setError('');
  };

  const toggleTag = (key: string) =>
    setForm((f) => ({ ...f, tags: f.tags.includes(key) ? f.tags.filter((t) => t !== key) : [...f.tags, key] }));

  const save = () =>
    guard(async () => {
    if (!form.name.trim() || !form.category_id || Number(form.price) < 0 || Number.isNaN(Number(form.price))) {
      setError('Name, category and a valid price are required.');
      return;
    }
    await fUp.wait(); // photo upload finish ho jaye to nayi URL save ho
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      const payload = {
        restaurant_id: restaurantId,
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        ingredients: form.ingredients.trim() || null,
        price: Number(form.price),
        tags: form.tags,
        is_available: form.is_available,
        image_url: form.image_url || null,
      };
      if (editing === 'new') {
        const { error } = await supabase.from('menu_items').insert(payload);
        if (error) throw new Error(error.message);
      } else if (editing) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', editing.id);
        if (error) throw new Error(error.message);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
    });

  const duplicate = (item: MenuItem) =>
    guard(async () => {
    const supabase = createClient();
    const { error } = await supabase.from('menu_items').insert({
      restaurant_id: restaurantId,
      category_id: item.category_id,
      name: `${item.name} (copy)`,
      description: item.description,
      ingredients: item.ingredients,
      price: item.price,
      tags: item.tags,
      is_available: false,
      image_url: item.image_url,
      prep_time_minutes: item.prep_time_minutes,
    });
    if (!error) load();
    });

  const toggleAvailable = (item: MenuItem) =>
    guard(async () => {
    const supabase = createClient();
    const { error } = await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id);
    if (!error) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, is_available: !i.is_available } : i)));
    });

  const photoFor = (item: MenuItem) =>
    cdnUrl(item.image_url || categoryImage(catName[item.category_id] ?? ''));

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-ink">Menu Items & Inventory</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            Manage dishes, pricing, photos and availability — {items.length} items.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="rounded-btn border border-line bg-[var(--c-surface-solid)] px-4 py-2.5 text-[13px] font-bold text-muted hover:text-ink">
            ⟳ Refresh
          </button>
          <Btn onClick={openNew}>+ Add New Item</Btn>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by dish name, ingredients…"
          className="input-neu w-full px-4 py-2.5 text-[14px] text-ink placeholder:text-muted"
        />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2.5">
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
            Category:
            <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="!w-auto py-1.5 text-[12.5px]">
              <option value="all">All Categories ({cats.length})</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold text-muted">
            Sort:
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} className="!w-auto py-1.5 text-[12.5px]">
              <option value="name">Name</option>
              <option value="category">Category</option>
              <option value="price-asc">Price ↑</option>
              <option value="price-desc">Price ↓</option>
            </Select>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'available', 'soldout', 'popular'] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
                  statusFilter === s ? 'btn-3d text-white' : 'glass !rounded-full text-muted hover:text-ink'
                }`}
              >
                {s === 'all' ? 'All Items' : s === 'available' ? 'Available Only' : s === 'soldout' ? 'Sold Out Only' : `★ Popular (${popularCount})`}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <Empty title="Loading menu…" />
      ) : visible.length === 0 ? (
        <Empty title="No dishes found" sub="Try another search or filter — or add a new item." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((item) => (
            <Card key={item.id} className="group flex flex-col overflow-hidden !p-0">
              <div className="relative">
                <img src={photoFor(item)} alt={item.name} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                {item.tags.includes('bestseller') && (
                  <span className="absolute left-2.5 top-2.5 rounded-md bg-amber px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow">
                    ★ Popular
                  </span>
                )}
                <span className="absolute bottom-2.5 right-2.5 rounded-md bg-ink/55 px-2 py-1 text-[10.5px] font-bold text-white backdrop-blur">
                  {catName[item.category_id] ?? ''}
                </span>
              </div>
              <div className="flex flex-1 flex-col p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-[14.5px] font-extrabold leading-snug text-ink">{item.name}</h3>
                  <span className="shrink-0 font-mono text-[14px] font-bold text-brand">{fmtPKR(item.price)}</span>
                </div>
                {item.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{item.description}</p>}
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.includes('spicy') && <Pill tone="danger">Spicy</Pill>}
                  {item.tags.includes('veg') && <Pill tone="ok">Veg</Pill>}
                  <span className="ml-auto text-[11px] font-bold text-muted">~{item.prep_time_minutes} min</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <button
                    onClick={() => toggleAvailable(item)}
                    className={`rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                      item.is_available ? 'bg-ok/10 text-ok' : 'bg-danger/10 text-danger'
                    }`}
                    title="Toggle availability"
                  >
                    {item.is_available ? '● In Stock' : '● Sold out'}
                  </button>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(item)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">✎</button>
                    <button onClick={() => duplicate(item)} title="Duplicate" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">⧉</button>
                    <button onClick={() => setConfirmDel(item)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-danger/10 hover:text-danger">🗑</button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDel && (
        <DeleteConfirm
          title="Delete this dish?"
          message={`"${confirmDel.name}" will be removed from the menu. You can undo this for 5 seconds.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const item = confirmDel;
            setConfirmDel(null);
            del.schedule(item, item.name, () => setItems((prev) => prev.filter((i) => i.id !== item.id)));
          }}
        />
      )}
      {del.pending && (
        <UndoToast
          label={del.pending.label}
          seconds={del.seconds}
          onUndo={() => del.undo((item) => setItems((prev) => [...prev, item]))}
        />
      )}

      {/* Add / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setEditing(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-xl flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editing === 'new' ? 'Add New Item' : 'Edit Item'}
              </h2>
              <button onClick={() => !saving && setEditing(null)} aria-label="Close" className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted">✕</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:px-6">
              {/* Photo */}
              <div>
                <Label>Photo</Label>
                <div className="mt-1.5">
                  <PhotoDropzone
                    bucket="menu-images"
                    folder={restaurantId}
                    value={form.image_url}
                    onChange={(url) => setForm((f) => ({ ...f, image_url: url }))}
                    onError={setError}
                    onUploadingChange={fUp.set}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Dish name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Chicken Karahi" className="mt-1.5" />
                </div>
                <div>
                  <Label>Price (PKR) *</Label>
                  <Input value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} placeholder="850" inputMode="decimal" className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={form.category_id} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))} className="mt-1.5">
                  <option value="">Select category…</option>
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} placeholder="What makes this dish special…" className="mt-1.5" />
              </div>
              <div>
                <Label>Ingredients</Label>
                <Textarea value={form.ingredients} onChange={(e) => setForm((f) => ({ ...f, ingredients: e.target.value }))} rows={2} placeholder="Chicken, tomatoes, ginger, green chillies…" className="mt-1.5" />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex gap-2">
                  {TAG_OPTIONS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => toggleTag(t.key)}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${form.tags.includes(t.key) ? 'btn-3d text-white' : 'glass !rounded-full text-muted'}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_available}
                    onClick={() => setForm((f) => ({ ...f, is_available: !f.is_available }))}
                    className={`relative h-6 w-11 rounded-full transition-colors ${form.is_available ? 'bg-ok' : 'bg-line'}`}
                  >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.is_available ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                  {form.is_available ? 'Available' : 'Sold out'}
                </label>
              </div>
              {error && <p className="text-[13px] font-bold text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-4 sm:px-6">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-btn px-4 py-2.5 text-[13.5px] font-bold text-muted hover:text-ink">
                Cancel
              </button>
              <Btn onClick={save} disabled={saving || fUp.uploading}>
                {saving ? 'Saving…' : fUp.uploading ? 'Uploading photo…' : editing === 'new' ? 'Add item' : 'Save changes'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
