'use client';

// Shared menu + cart + checkout. Used by the customer QR page and the
// waiter app. Writes orders through the anon-safe RLS policies.

import { useEffect, useMemo, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { MenuCategory, MenuItem, DiningTable } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { Btn, Card, Empty, Pill } from './ui';

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

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!activeCat || i.category_id === activeCat) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)),
    );
  }, [items, activeCat, query]);

  const add = (item: MenuItem) =>
    setCart((prev) => {
      const ex = prev.find((l) => l.item.id === item.id);
      if (ex) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item, qty: 1, notes: '' }];
    });

  const setQty = (id: string, qty: number) =>
    setCart((prev) =>
      qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l)),
    );

  const total = cart.reduce((s, l) => s + l.item.price * l.qty, 0);

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
      onPlaced(order.id);
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

  return (
    <div>
      {/* Search + categories */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the menu…"
          className="input-neu max-w-sm px-4 py-2.5 text-[15px] text-ink placeholder:text-muted"
        />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-[13.5px] font-bold transition-all ${
                activeCat === c.id ? 'btn-3d text-white' : 'glass !rounded-full text-muted hover:text-ink'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Items */}
      {visible.length === 0 ? (
        <Empty title="Nothing here yet" sub="Try another category or search." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
            <Card key={item.id} className="flex flex-col p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-[15.5px] font-extrabold leading-snug text-ink">{item.name}</h3>
                <span className="shrink-0 font-mono text-[15px] font-bold text-brand">{fmtPKR(item.price)}</span>
              </div>
              {item.description && (
                <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{item.description}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {item.tags.includes('bestseller') && <Pill tone="amber">★ Bestseller</Pill>}
                {item.tags.includes('spicy') && <Pill tone="danger">Spicy</Pill>}
                {item.tags.includes('veg') && <Pill tone="ok">Veg</Pill>}
                <span className="ml-auto self-center text-[11.5px] font-bold text-muted">~{item.prep_time_minutes} min</span>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                {(() => {
                  const line = cart.find((l) => l.item.id === item.id);
                  if (!line)
                    return (
                      <Btn size="sm" onClick={() => add(item)} className="w-full">
                        Add to order
                      </Btn>
                    );
                  return (
                    <div className="flex w-full items-center justify-between">
                      <div className="glass flex items-center gap-1 !rounded-[12px] p-1">
                        <button onClick={() => setQty(item.id, line.qty - 1)} className="flex h-8 w-8 items-center justify-center rounded-[9px] text-lg font-bold text-brand hover:bg-brand-soft">−</button>
                        <span className="min-w-7 text-center font-mono text-[15px] font-bold text-ink">{line.qty}</span>
                        <button onClick={() => setQty(item.id, line.qty + 1)} className="flex h-8 w-8 items-center justify-center rounded-[9px] text-lg font-bold text-brand hover:bg-brand-soft">+</button>
                      </div>
                      <span className="font-mono text-[14px] font-bold text-ink">{fmtPKR(item.price * line.qty)}</span>
                    </div>
                  );
                })()}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-4 pb-4 sm:px-6">
          <Card deep className="mx-auto flex max-w-2xl items-center justify-between gap-3 p-4">
            <div>
              <p className="font-display text-[15px] font-extrabold text-ink">
                {cart.reduce((s, l) => s + l.qty, 0)} items · Table {table.table_number}
              </p>
              <p className="font-mono text-lg font-bold text-brand">{fmtPKR(total)}</p>
            </div>
            <Btn size="lg" onClick={placeOrder} disabled={placing}>
              {placing ? 'Placing…' : 'Place order'}
            </Btn>
          </Card>
          {error && <p className="mx-auto mt-2 max-w-2xl text-center text-sm font-bold text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
