'use client';

// Shared menu + cart + checkout — mobile-first for QR customers.
// Used by the customer QR page (/r/[slug]/table/[id]) and the waiter app.
// Compact item cards with photos, tap for a detail bottom-sheet
// (ingredients, instructions), sticky safe-area cart bar.
// Writes orders through the anon-safe RLS policies.

import { useEffect, useMemo, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem, DiningTable } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { categoryImage } from '@/lib/food-images';
import { Btn, Card, Empty, Pill, Textarea } from './ui';

export interface CartLine {
  item: MenuItem;
  qty: number;
  notes: string;
}

export default function MenuOrder({
  restaurantId,
  table,
  waiterId,
  customerName,
  onPlaced,
}: {
  restaurantId: string;
  table: DiningTable;
  waiterId?: string;
  customerName?: string;
  onPlaced: (orderId: string) => void;
}) {
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [activeCat, setActiveCat] = useState<string>('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!configured) return;
    const supabase = createClient();
    (async () => {
      const [{ data: c }, { data: it }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('display_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true).order('name'),
      ]);
      const cats = (c ?? []) as MenuCategory[];
      setCats(cats);
      setItems((it ?? []) as MenuItem[]);
      if (cats.length > 0) setActiveCat(cats[0].id);
    })();
  }, [restaurantId, configured]);

  const catName = useMemo(() => {
    const m: Record<string, string> = {};
    cats.forEach((c) => (m[c.id] = c.name));
    return m;
  }, [cats]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!activeCat || i.category_id === activeCat) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)),
    );
  }, [items, activeCat, query]);

  // Lock body scroll when a sheet is open; close on Escape.
  useEffect(() => {
    if (!detail && !cartOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDetail(null);
        setCartOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [detail, cartOpen]);

  const addToCart = (item: MenuItem, qty: number, notes: string) =>
    setCart((prev) => {
      const ex = prev.find((l) => l.item.id === item.id);
      if (ex)
        return prev.map((l) =>
          l.item.id === item.id
            ? { ...l, qty: l.qty + qty, notes: notes.trim() ? notes.trim() : l.notes }
            : l,
        );
      return [...prev, { item, qty, notes: notes.trim() }];
    });

  const setQty = (id: string, qty: number) =>
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l)),
    );

  const openDetail = (item: MenuItem) => {
    setDetail(item);
    setDetailQty(1);
    setDetailNotes('');
  };

  const total = cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);
  const count = cart.reduce((s, l) => s + l.qty, 0);

  const placeOrder = async () => {
    if (cart.length === 0 || placing) return;
    setPlacing(true);
    setError('');
    try {
      const supabase = createClient();
      const { data: order, error: oErr } = await supabase
        .from('orders')
        .insert({
          restaurant_id: restaurantId,
          table_id: table.id,
          waiter_id: waiterId ?? null,
          customer_name: customerName?.trim() || null,
          status: 'pending',
          total_amount: total,
        })
        .select('id')
        .single();
      if (oErr || !order) throw new Error(oErr?.message ?? 'Could not create order');
      const lines = cart.map((l) => ({
        order_id: order.id,
        menu_item_id: l.item.id,
        item_name: l.item.name,
        quantity: l.qty,
        unit_price: l.item.price,
        notes: l.notes.trim() || null,
      }));
      const { error: iErr } = await supabase.from('order_items').insert(lines);
      if (iErr) throw new Error(iErr.message);
      setCart([]);
      setCartOpen(false);
      onPlaced(order.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setPlacing(false);
    }
  };

  if (!configured) {
    return (
      <Empty
        title="Supabase not configured"
        sub="Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local, then run schema.sql + seed.sql."
      />
    );
  }

  const lineFor = (id: string) => cart.find((l) => l.item.id === id);

  return (
    <div>
      {/* Search */}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the menu…"
        className="input-neu mb-2.5 w-full px-4 py-2.5 text-[14px] text-ink placeholder:text-muted"
      />
      {/* Category pills — small, horizontally scrollable, display_order sorted */}
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6">
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
              activeCat === c.id ? 'btn-3d text-white' : 'glass !rounded-full text-muted hover:text-ink'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Compact item cards */}
      {visible.length === 0 ? (
        <Empty title="Nothing here yet" sub="Try another category or search." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const line = lineFor(item.id);
            return (
              <div
                key={item.id}
                onClick={() => openDetail(item)}
                className="glass flex cursor-pointer gap-3 !rounded-[16px] p-2.5 text-left transition-transform active:scale-[0.99]"
              >
                <img
                  src={categoryImage(catName[item.category_id] ?? '')}
                  alt={item.name}
                  loading="lazy"
                  className="h-16 w-16 shrink-0 rounded-[12px] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-display text-[13.5px] font-extrabold text-ink">{item.name}</h3>
                    <span className="shrink-0 font-mono text-[13px] font-bold text-brand">{fmtPKR(item.price)}</span>
                  </div>
                  {item.description && (
                    <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-muted">{item.description}</p>
                  )}
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5 text-[10.5px] font-bold text-muted">
                      {item.tags.includes('bestseller') && <span className="text-amber">★</span>}
                      {item.tags.includes('spicy') && <span className="text-danger">🌶</span>}
                      <span className="truncate">~{item.prep_time_minutes} min</span>
                    </span>
                    {line ? (
                      <div
                        className="flex items-center gap-0.5 rounded-full bg-brand-soft p-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          aria-label="Decrease"
                          onClick={() => setQty(item.id, line.qty - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold text-brand"
                        >
                          −
                        </button>
                        <span className="min-w-5 text-center font-mono text-[13px] font-bold text-ink">{line.qty}</span>
                        <button
                          aria-label="Increase"
                          onClick={() => setQty(item.id, line.qty + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-[15px] font-bold text-brand"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          addToCart(item, 1, '');
                        }}
                        className="btn-3d shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white"
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky cart bar — compact, safe-area aware */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-2xl">
            <button
              onClick={() => setCartOpen(true)}
              className="glass flex w-full items-center justify-between !rounded-[18px] px-4 py-3 text-left"
            >
              <div>
                <p className="font-display text-[13.5px] font-extrabold text-ink">
                  {count} item{count > 1 ? 's' : ''} · Table {table.table_number}
                </p>
                <p className="font-mono text-[15px] font-bold text-brand">{fmtPKR(total)}</p>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  placeOrder();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    placeOrder();
                  }
                }}
                className={`btn-3d rounded-full px-5 py-2.5 text-[13.5px] font-bold text-white ${
                  placing ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                {placing ? 'Placing…' : 'Place order'}
              </span>
            </button>
            {error && <p className="mt-2 text-center text-[12.5px] font-bold text-danger">{error}</p>}
          </div>
        </div>
      )}

      {/* Cart sheet */}
      {cartOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-[24px] bg-[var(--c-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-[16px] font-extrabold text-ink">
                Your order · Table {table.table_number}
              </h2>
              <button onClick={() => setCartOpen(false)} className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              {cart.map((l) => (
                <div key={l.item.id} className="glass flex gap-3 !rounded-[14px] p-2.5">
                  <img
                    src={categoryImage(catName[l.item.category_id] ?? '')}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] font-bold text-ink">{l.item.name}</p>
                      <button onClick={() => setQty(l.item.id, 0)} className="shrink-0 text-[11px] font-bold text-danger" aria-label="Remove">
                        Remove
                      </button>
                    </div>
                    {l.notes && <p className="mt-0.5 line-clamp-1 text-[11px] italic text-muted">“{l.notes}”</p>}
                    <div className="mt-1.5 flex items-center justify-between">
                      <div className="flex items-center gap-0.5 rounded-full bg-brand-soft p-0.5">
                        <button onClick={() => setQty(l.item.id, l.qty - 1)} className="flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold text-brand">−</button>
                        <span className="min-w-5 text-center font-mono text-[12.5px] font-bold text-ink">{l.qty}</span>
                        <button onClick={() => setQty(l.item.id, l.qty + 1)} className="flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold text-brand">+</button>
                      </div>
                      <span className="font-mono text-[13px] font-bold text-ink">{fmtPKR(Number(l.item.price) * l.qty)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
              <p className="font-mono text-[16px] font-bold text-ink">{fmtPKR(total)}</p>
              <Btn size="lg" onClick={placeOrder} disabled={placing} className="!rounded-full px-7">
                {placing ? 'Placing…' : `Place order · ${count}`}
              </Btn>
            </div>
            {error && <p className="mt-2 text-center text-[12.5px] font-bold text-danger">{error}</p>}
          </div>
        </div>
      )}

      {/* Item detail bottom-sheet */}
      {detail && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setDetail(null)} />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[24px] bg-[var(--c-surface)] pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:inset-0 sm:m-auto sm:h-fit sm:rounded-[24px]">
            <div className="relative">
              <img
                src={categoryImage(catName[detail.category_id] ?? '')}
                alt={detail.name}
                className="h-48 w-full object-cover sm:rounded-t-[24px]"
              />
              <button
                onClick={() => setDetail(null)}
                aria-label="Close"
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-ink/55 text-[15px] font-bold text-white backdrop-blur"
              >
                ✕
              </button>
              <div className="absolute bottom-3 left-4 flex gap-1.5">
                {detail.tags.includes('bestseller') && <Pill tone="amber">★ Bestseller</Pill>}
                {detail.tags.includes('spicy') && <Pill tone="danger">🌶 Spicy</Pill>}
                {detail.tags.includes('veg') && <Pill tone="ok">Veg</Pill>}
              </div>
            </div>
            <div className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-[19px] font-extrabold leading-tight text-ink">{detail.name}</h2>
                <span className="shrink-0 font-mono text-[17px] font-bold text-brand">{fmtPKR(detail.price)}</span>
              </div>
              {detail.description && (
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{detail.description}</p>
              )}
              {detail.ingredients && (
                <div className="mt-3">
                  <p className="text-[11.5px] font-extrabold uppercase tracking-wide text-muted">Ingredients</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink">{detail.ingredients}</p>
                </div>
              )}
              <p className="mt-3 text-[12px] font-bold text-muted">⏱ ~{detail.prep_time_minutes} min preparation</p>
              <div className="mt-4">
                <label className="text-[12px] font-extrabold text-ink">Special instructions <span className="font-bold text-muted">(optional)</span></label>
                <Textarea
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. less spicy, no onions…"
                  className="mt-1.5 w-full text-[13.5px]"
                />
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="glass flex items-center gap-1 !rounded-full p-1">
                  <button
                    aria-label="Decrease"
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-bold text-brand"
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center font-mono text-[15px] font-bold text-ink">{detailQty}</span>
                  <button
                    aria-label="Increase"
                    onClick={() => setDetailQty((q) => Math.min(20, q + 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-bold text-brand"
                  >
                    +
                  </button>
                </div>
                <Btn
                  size="lg"
                  className="flex-1 !rounded-full"
                  onClick={() => {
                    addToCart(detail, detailQty, detailNotes);
                    setDetail(null);
                  }}
                >
                  Add · {fmtPKR(Number(detail.price) * detailQty)}
                </Btn>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
