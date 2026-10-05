'use client';

// Shared menu + cart + checkout — mobile-first for QR customers.
// Used by the customer QR page (/r/[slug]/table/[id]) and the waiter app.
// Compact item cards with photos, tap for a detail bottom-sheet
// (ingredients, instructions), sticky safe-area cart bar.
// Writes orders through the anon-safe RLS policies.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem, DiningTable } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { categoryEmoji, categoryImage } from '@/lib/food-images';
import { cdnUrl } from '@/lib/images';
import { useT } from '@/lib/i18n';
import { Btn, Card, Empty, Pill, Textarea } from './ui';

// Real uploaded photo first, bundled category photo as fallback.
function itemPhoto(item: MenuItem, catName: Record<string, string>): string {
  const origin = item.image_url || categoryImage(catName[item.category_id] ?? '');
  return cdnUrl(origin);
}

export interface CartLine {
  item: MenuItem;
  qty: number;
  notes: string;
}



// Single menu item card — photo, name, price, add/stepper.
function ItemCard({
  item,
  line,
  img,
  onOpen,
  onDec,
  onInc,
  onAdd,
}: {
  item: MenuItem;
  line: CartLine | undefined;
  img: string;
  onOpen: () => void;
  onDec: () => void;
  onInc: () => void;
  onAdd: () => void;
}) {
  const t = useT();
  return (
    <div
      onClick={onOpen}
      className="group relative cursor-pointer overflow-hidden rounded-[18px] shadow-lift transition-transform active:scale-[0.98]"
    >
      <img src={img} alt={item.name} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[rgba(8,10,18,0.92)] via-[rgba(8,10,18,0.30)] to-transparent" />
      <div className="absolute left-2 top-2 flex gap-1">
        {item.tags.includes('bestseller') && (
          <span className="rounded-full bg-amber px-2 py-0.5 text-[9.5px] font-extrabold text-white shadow">★</span>
        )}
        {item.tags.includes('spicy') && (
          <span className="rounded-full bg-danger px-2 py-0.5 text-[9.5px] font-extrabold text-white shadow">🌶</span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 p-2.5">
        <h3 className="truncate font-display text-[12.5px] font-extrabold leading-tight text-white">{item.name}</h3>
        <div className="mt-1 flex items-center justify-between gap-1">
          <span className="font-mono text-[13px] font-bold text-white">{fmtPKR(item.price)}</span>
          {line ? (
            <div className="flex items-center gap-0.5 rounded-full bg-white/20 p-0.5 backdrop-blur" onClick={(e) => e.stopPropagation()}>
              <button aria-label={t('mnu_decrease')} onClick={onDec} className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold text-white">−</button>
              <span className="min-w-4 text-center font-mono text-[12px] font-bold text-white">{line.qty}</span>
              <button aria-label={t('mnu_increase')} onClick={onInc} className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold text-white">+</button>
            </div>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              aria-label={t('mnu_add_item', { name: item.name })}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[17px] font-bold text-brand shadow-lift transition-transform active:scale-90"
            >
              +
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MenuOrder({
  restaurantId,
  table,
  waiterId,
  customerName,
  onPlaced,
  stickyTop,
}: {
  restaurantId: string;
  table: DiningTable;
  waiterId?: string;
  customerName?: string;
  onPlaced: (orderId: string, trackingToken: string) => void;
  stickyTop?: string;
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
  const top = stickyTop ?? '0px';
  const t = useT();

  // Scroll-spy plumbing: section elements + pill bar.
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const pillsRef = useRef<HTMLDivElement>(null);
  const jumpLock = useRef<string | null>(null);

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

  // Categories in display_order, each with its available items —
  // the whole menu renders as one scrolling page.
  const grouped = useMemo(
    () => cats.map((c) => ({ cat: c, items: items.filter((i) => i.category_id === c.id) })),
    [cats, items],
  );

  const searching = query.trim().length > 0;
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q),
    );
  }, [items, query]);

  // Scroll-spy: the pill of the section sitting in the middle of the
  // screen lights up, and the pill bar follows it.
  useEffect(() => {
    if (searching) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const id = e.target.getAttribute('data-cat');
          if (!id || jumpLock.current === id) continue;
          setActiveCat(id);
          pillsRef.current
            ?.querySelector(`[data-pill="${id}"]`)
            ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
        }
      },
      { rootMargin: '-35% 0px -55% 0px' },
    );
    const els = [...sectionRefs.current.values()];
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [grouped, searching]);

  const jumpTo = (id: string) => {
    setActiveCat(id);
    jumpLock.current = id;
    window.setTimeout(() => {
      jumpLock.current = null;
    }, 900);
    const go = () => sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (searching) {
      setQuery('');
      window.setTimeout(go, 80); // let sections render first
    } else {
      go();
    }
  };

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
      // id + tracking_token are generated client-side: anon can no longer
      // SELECT orders back (tracking goes through the track_order RPC), so we
      // must already know both values after the insert.
      const orderId = crypto.randomUUID();
      const trackingToken = crypto.randomUUID();
      const { error: oErr } = await supabase.from('orders').insert({
        id: orderId,
        tracking_token: trackingToken,
        restaurant_id: restaurantId,
        table_id: table.id,
        waiter_id: waiterId ?? null,
        customer_name: customerName?.trim() || null,
        status: 'pending',
        total_amount: total,
      });
      if (oErr) throw new Error(oErr.message);
      const lines = cart.map((l) => ({
        order_id: orderId,
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
      onPlaced(orderId, trackingToken);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('mnu_order_failed'));
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

  const cardProps = (item: MenuItem) => ({
    line: lineFor(item.id),
    img: itemPhoto(item, catName),
    onOpen: () => openDetail(item),
    onDec: () => setQty(item.id, (lineFor(item.id)?.qty ?? 1) - 1),
    onInc: () => setQty(item.id, (lineFor(item.id)?.qty ?? 0) + 1),
    onAdd: () => addToCart(item, 1, ''),
  });

  return (
    <div>
      {/* Sticky search + emoji category pills */}
      <div
        style={{ top }}
        className="sticky z-30 -mx-4 bg-[var(--c-surface)] px-4 pb-2 pt-2 backdrop-blur-xl sm:-mx-6 sm:px-6"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('mnu_search')}
          className="input-neu mb-2 w-full px-4 py-2.5 text-[14px] text-ink placeholder:text-muted"
        />
        <div
          ref={pillsRef}
          className="flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cats.map((c) => (
            <button
              key={c.id}
              data-pill={c.id}
              onClick={() => jumpTo(c.id)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                activeCat === c.id ? 'btn-3d text-white' : 'glass !rounded-full text-muted hover:text-ink'
              }`}
            >
              <span className="text-[14px] leading-none">{categoryEmoji(c.name)}</span>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Search mode: flat results across all categories */}
      {searching ? (
        searchResults.length === 0 ? (
          <Empty title={t('mnu_no_results')} sub={t('mnu_no_results_sub')} />
        ) : (
          <>
            <p className="mb-2.5 mt-3 text-[12.5px] font-bold text-muted">
              {searchResults.length} result{searchResults.length > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {searchResults.map((item) => (
                <ItemCard key={item.id} item={item} {...cardProps(item)} />
              ))}
            </div>
          </>
        )
      ) : (
        /* Whole menu, one scrolling page — sections per category */
        grouped.map((g) => (
          <section
            key={g.cat.id}
            data-cat={g.cat.id}
            ref={(el) => {
              if (el) sectionRefs.current.set(g.cat.id, el);
              else sectionRefs.current.delete(g.cat.id);
            }}
            style={{ scrollMarginTop: `calc(${top} + 112px)` }}
          >
            <div className="mb-2.5 mt-6 flex items-center gap-2">
              <span className="text-[22px] leading-none">{categoryEmoji(g.cat.name)}</span>
              <h2 className="font-display text-[17px] font-extrabold text-ink">{g.cat.name}</h2>
              <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] font-bold text-muted">{g.items.length}</span>
              <div className="ml-1 h-px flex-1 bg-line" />
            </div>
            {g.items.length === 0 ? (
              <p className="mb-6 text-[12.5px] text-muted">{t('mnu_no_items')}</p>
            ) : (
              <div className="mb-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {g.items.map((item) => (
                  <ItemCard key={item.id} item={item} {...cardProps(item)} />
                ))}
              </div>
            )}
          </section>
        ))
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
                {placing ? t('mnu_placing') : t('mnu_place_order')}
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
          <div className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-t-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="px-4 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-[16px] font-extrabold text-ink">
                  {t('mnu_your_order', { table: table.table_number })}
                </h2>
                <button onClick={() => setCartOpen(false)} className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted" aria-label={t('mnu_close')}>
                  ✕
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-4">
              {cart.map((l) => (
                <div key={l.item.id} className="glass flex gap-3 !rounded-[14px] p-2.5">
                  <img
                    src={itemPhoto(l.item, catName)}
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
            <div className="border-t border-line bg-[var(--c-surface-solid)] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[16px] font-bold text-ink">{fmtPKR(total)}</p>
                <Btn size="lg" onClick={placeOrder} disabled={placing} className="!rounded-full px-7">
                  {placing ? t('mnu_placing') : t('mnu_place_order_count', { n: count })}
                </Btn>
              </div>
              {error && <p className="mt-2 text-center text-[12.5px] font-bold text-danger">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Item detail bottom-sheet */}
      {detail && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => setDetail(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex-1 overflow-y-auto">
              <div className="relative">
                <img
                  src={itemPhoto(detail, catName)}
                  alt={detail.name}
                  className="h-48 w-full rounded-t-[24px] object-cover"
                />
                <button
                  onClick={() => setDetail(null)}
                  aria-label={t('mnu_close')}
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
                <p className="mt-3 text-[12px] font-bold text-muted">{t('mnu_prep_time', { n: detail.prep_time_minutes })}</p>
                <div className="mt-4">
                  <label className="text-[12px] font-extrabold text-ink">Special instructions <span className="font-bold text-muted">(optional)</span></label>
                  <Textarea
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value)}
                    rows={2}
                    placeholder={t('mnu_notes_ph')}
                    className="mt-1.5 w-full text-[13.5px]"
                  />
                </div>
              </div>
            </div>
            <div className="rounded-b-[24px] border-t border-line bg-[var(--c-surface-solid)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-3">
                <div className="glass flex items-center gap-1 !rounded-full p-1">
                  <button
                    aria-label={t('mnu_decrease')}
                    onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[17px] font-bold text-brand"
                  >
                    −
                  </button>
                  <span className="min-w-7 text-center font-mono text-[15px] font-bold text-ink">{detailQty}</span>
                  <button
                    aria-label={t('mnu_increase')}
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
