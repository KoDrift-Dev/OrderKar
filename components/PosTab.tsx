'use client';

// Counter POS — dine-in / takeaway / delivery. Fast item entry,
// cart, immediate payment, receipt (browser + 80mm thermal).

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { categoryEmoji } from '@/lib/food-images';
import { fmtPKR } from '@/lib/format';
import { Btn, Card, SectionHead, Input, Label, Empty } from './ui';
import { useGuard } from './DeleteFlow';
import { ReceiptPreview, printReceipt, type ReceiptData } from './Receipt';
import { tableState } from './TableCard';
import type { DiningTable, MenuCategory, MenuItem, Order } from '@/lib/types';

type PosOrderType = 'dine_in' | 'takeaway' | 'delivery';

const TYPE_TABS: { id: PosOrderType; label: string }[] = [
  { id: 'dine_in', label: '🍽️ Dine-in' },
  { id: 'takeaway', label: '🛍️ Takeaway' },
  { id: 'delivery', label: '🛵 Delivery' },
];

const PAY_METHODS = [
  { id: 'cash', label: '💵 Cash' },
  { id: 'card', label: '💳 Card' },
  { id: 'jazzcash', label: '📱 JazzCash' },
  { id: 'easypaisa', label: '📱 EasyPaisa' },
];

interface CartLine {
  item: MenuItem;
  qty: number;
}

export default function PosTab({
  restaurantId,
  restaurant,
  tables,
  orders,
  onOrderPlaced,
}: {
  restaurantId: string;
  restaurant: { name: string; address?: string; phone?: string; email?: string };
  tables: DiningTable[];
  orders: Order[];
  onOrderPlaced: () => void;
}) {
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('');

  const [orderType, setOrderType] = useState<PosOrderType>('dine_in');
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');

  const [cart, setCart] = useState<CartLine[]>([]);
  const [payMethod, setPayMethod] = useState('cash');
  const [tendered, setTendered] = useState('');
  const [cashier, setCashier] = useState('');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const guard = useGuard();

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [{ data: c }, { data: it }, { data: { user } }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('display_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).eq('is_available', true).order('name'),
        supabase.auth.getUser(),
      ]);
      const list = (c ?? []) as MenuCategory[];
      setCats(list);
      setItems((it ?? []) as MenuItem[]);
      if (list.length > 0) setActiveCat(list[0].id);
      if (user) {
        const { data: p } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        if (p?.name) setCashier(p.name);
      }
    })();
  }, [restaurantId]);

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!activeCat || i.category_id === activeCat) &&
        (!q || i.name.toLowerCase().includes(q)),
    );
  }, [items, activeCat, query]);

  const addItem = (item: MenuItem) =>
    setCart((prev) => {
      const ex = prev.find((l) => l.item.id === item.id);
      if (ex) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item, qty: 1 }];
    });

  const setQty = (id: string, qty: number) =>
    setCart((prev) => (qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l))));

  const total = cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);
  const tenderedNum = parseFloat(tendered);
  const change = payMethod === 'cash' && !isNaN(tenderedNum) ? tenderedNum - total : null;

  const reset = () => {
    setCart([]);
    setTendered('');
    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setTableId('');
    setError('');
    setReceipt(null);
  };

  const charge = () =>
    guard(async () => {
      setError('');
      if (cart.length === 0) {
        setError('Cart khaali hai — pehle items add karo.');
        return;
      }
      if (orderType === 'dine_in' && !tableId) {
        setError('Table select karo.');
        return;
      }
      if (orderType === 'delivery' && (!customerPhone.trim() || !address.trim())) {
        setError('Delivery ke liye phone aur address zaroori hai.');
        return;
      }
      if (payMethod === 'cash' && (isNaN(tenderedNum) || tenderedNum < total)) {
        setError(`Cash kam hai — kam az kam ${fmtPKR(total)} lo.`);
        return;
      }
      setPlacing(true);
      try {
        const supabase = createClient();
        const orderId = crypto.randomUUID();
        const { error: oErr } = await supabase.from('orders').insert({
          id: orderId,
          tracking_token: crypto.randomUUID(),
          restaurant_id: restaurantId,
          table_id: orderType === 'dine_in' ? tableId : null,
          order_type: orderType,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          notes: orderType === 'delivery' && address.trim() ? `Delivery: ${address.trim()}` : null,
          status: 'pending',
          total_amount: total,
          payment_status: 'paid',
          payment_method: payMethod,
        });
        if (oErr) throw oErr;
        const lines = cart.map((l) => ({
          order_id: orderId,
          menu_item_id: l.item.id,
          item_name: l.item.name,
          quantity: l.qty,
          unit_price: l.item.price,
        }));
        const { error: iErr } = await supabase.from('order_items').insert(lines);
        if (iErr) throw iErr;
        const { data: ord } = await supabase.from('orders').select('order_number, created_at').eq('id', orderId).single();

        const table = tables.find((t) => t.id === tableId);
        setReceipt({
          restaurant,
          orderNo: ord?.order_number ?? 0,
          date: ord?.created_at ? new Date(ord.created_at) : new Date(),
          orderType,
          tableLabel: table ? `T${table.table_number}` : undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined,
          deliveryAddress: orderType === 'delivery' ? address.trim() || undefined : undefined,
          cashier: cashier || undefined,
          items: cart.map((l) => ({ name: l.item.name, qty: l.qty, price: Number(l.item.price) })),
          paymentMethod: payMethod,
          tendered: payMethod === 'cash' ? tenderedNum : null,
        });
        onOrderPlaced();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Order failed.');
      } finally {
        setPlacing(false);
      }
    });

  const activeTables = useMemo(() => tables.filter((t) => t.is_active), [tables]);

  return (
    <div>
      <SectionHead title="POS" sub="Counter sale — tez billing, foran receipt." />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ── left: menu ── */}
        <div className="lg:col-span-2">
          {/* order type */}
          <div className="mb-3 flex gap-1.5">
            {TYPE_TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setOrderType(t.id)}
                className={`flex-1 rounded-btn px-3 py-2.5 text-[13px] font-extrabold transition-all ${
                  orderType === t.id ? 'btn-3d text-white' : 'glass !rounded-btn text-muted hover:text-ink'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* table select / customer fields */}
          {orderType === 'dine_in' ? (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {activeTables.map((t) => {
                const st = tableState(t.id, orders);
                return (
                  <button
                    key={t.id}
                    onClick={() => setTableId(t.id)}
                    className={`rounded-btn px-3.5 py-2 text-[13px] font-extrabold transition-all ${
                      tableId === t.id
                        ? 'btn-3d text-white'
                        : st === 'free'
                          ? 'glass !rounded-btn text-ink'
                          : 'cursor-not-allowed rounded-btn bg-soft px-3.5 py-2 text-[13px] font-extrabold text-muted opacity-60'
                    }`}
                    disabled={st !== 'free'}
                    title={st !== 'free' ? `${st} — koi free table lo` : `Table ${t.table_number}`}
                  >
                    T{t.table_number}
                  </button>
                );
              })}
              {activeTables.length === 0 && <p className="text-[13px] text-muted">Koi active table nahi.</p>}
            </div>
          ) : (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Customer name" maxLength={60} />
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone (delivery ke liye zaroori)" maxLength={20} />
              {orderType === 'delivery' && (
                <Input className="sm:col-span-2" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Delivery address" maxLength={160} />
              )}
            </div>
          )}

          {/* search + categories */}
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search items…" className="mb-2" />
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {cats.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCat(c.id)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition-all ${
                  activeCat === c.id ? 'btn-3d text-white' : 'glass !rounded-full text-muted hover:text-ink'
                }`}
              >
                <span className="text-[14px] leading-none">{categoryEmoji(c.name)}</span>
                {c.name}
              </button>
            ))}
          </div>

          {/* fast item tiles */}
          {visibleItems.length === 0 ? (
            <Empty title="Koi item nahi" sub="Search ya category badlo." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {visibleItems.map((item) => {
                const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                return (
                  <button
                    key={item.id}
                    onClick={() => addItem(item)}
                    className="group rounded-[16px] border border-line bg-[var(--c-surface-solid)] p-3 text-left shadow-lift transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                  >
                    <p className="truncate text-[13px] font-extrabold text-ink">{item.name}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[13px] font-bold text-brand">{fmtPKR(item.price)}</span>
                      {inCart > 0 && (
                        <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] font-extrabold text-white">
                          ×{inCart}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── right: cart + payment ── */}
        <div>
          <Card className="sticky top-4 p-5">
            <h3 className="font-display text-[16px] font-extrabold text-ink">🧾 Current sale</h3>
            <div className="mt-3 max-h-[38vh] space-y-2 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="py-6 text-center text-[13px] text-muted">Items tap karo — yahan ayenge.</p>
              ) : (
                cart.map((l) => (
                  <div key={l.item.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-bold text-ink">{l.item.name}</p>
                      <p className="font-mono text-[12px] text-muted">{fmtPKR(Number(l.item.price) * l.qty)}</p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full bg-soft p-0.5">
                      <button onClick={() => setQty(l.item.id, l.qty - 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold text-ink">−</button>
                      <span className="min-w-5 text-center font-mono text-[12.5px] font-bold text-ink">{l.qty}</span>
                      <button onClick={() => setQty(l.item.id, l.qty + 1)} className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold text-ink">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="my-3 border-t border-dashed border-line" />
            <div className="flex justify-between font-display text-[18px] font-extrabold text-ink">
              <span>Total</span>
              <span className="font-mono">{fmtPKR(total)}</span>
            </div>

            <div className="mt-4">
              <Label>Payment method</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PAY_METHODS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setPayMethod(m.id)}
                    className={`rounded-btn px-2 py-2 text-[12.5px] font-extrabold transition-all ${
                      payMethod === m.id ? 'btn-3d text-white' : 'glass !rounded-btn text-muted hover:text-ink'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {payMethod === 'cash' && (
              <div className="mt-3">
                <Label>Cash received</Label>
                <Input type="number" min={0} value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(Math.ceil(total))} />
                {change != null && (
                  <p className={`mt-1.5 text-[13px] font-extrabold ${change >= 0 ? 'text-ok' : 'text-danger'}`}>
                    Change: {fmtPKR(Math.max(0, change))}
                    {change < 0 && ' — cash kam hai!'}
                  </p>
                )}
              </div>
            )}

            {error && <p className="mt-3 rounded-btn bg-danger/10 p-2.5 text-[12.5px] font-bold text-danger">{error}</p>}

            <Btn className="mt-4 w-full" size="lg" onClick={charge} disabled={placing || cart.length === 0}>
              {placing ? 'Processing…' : `Charge ${fmtPKR(total)}`}
            </Btn>
          </Card>
        </div>
      </div>

      {/* ── receipt modal ── */}
      {receipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" />
          <div className="relative mx-auto my-6 w-[calc(100%-2rem)] max-w-md rounded-[24px] bg-[var(--c-surface-solid)] p-5 shadow-2xl">
            <h2 className="mb-4 text-center font-display text-[17px] font-extrabold text-ink">✅ Payment done!</h2>
            <ReceiptPreview data={receipt} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Btn variant="secondary" onClick={() => printReceipt(receipt, 'browser')}>
                🖨️ Print
              </Btn>
              <Btn variant="secondary" onClick={() => printReceipt(receipt, 'thermal')}>
                🧾 80mm
              </Btn>
            </div>
            <Btn className="mt-2 w-full" onClick={reset}>
              New sale
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}
