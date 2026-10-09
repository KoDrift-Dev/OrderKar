'use client';

// Sales & POS Register — High-speed counter & table checkout.
// Designed with 2-in-row cards, categories pills, real-time discount,
// cash/online payment calculation, and direct database persistence.

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useT, useLang } from '@/lib/i18n';
import { cdnUrl } from '@/lib/images';
import { categoryImage, categoryEmoji } from '@/lib/food-images';
import { fmtPKR } from '@/lib/format';
import { Btn, Card, Input, Empty } from './ui';
import { ReceiptPreview, printReceipt, type ReceiptData } from './Receipt';
import { tableState } from './TableCard';
import type { DiningTable, MenuCategory, MenuItem, Order } from '@/lib/types';

type PosOrderType = 'dine_in' | 'takeaway' | 'delivery';
type DiscountType = 'none' | 'rs' | 'percent';
type PaymentMode = 'cash' | 'online';
type OnlineSubMethod = 'card' | 'bank' | 'wallet';

export type PosPaletteId = 'amber' | 'emerald' | 'teal' | 'sapphire' | 'crimson';

export interface PosPaletteConfig {
  id: PosPaletteId;
  name: string;
  nameUrdu: string;
  dotColor: string;
  brand: string;
  brandRgb: string;
  brandDeep: string;
  brandSoft: string;
  line: string;
  lineStrong: string;
  shadowLift: string;
  shadowGlow: string;
}

export const POS_PALETTES: Record<PosPaletteId, PosPaletteConfig> = {
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    nameUrdu: 'وارم امبر (آرینج)',
    dotColor: '#ea580c',
    brand: '#ea580c',
    brandRgb: '234 88 12',
    brandDeep: '#c2410c',
    brandSoft: 'rgba(234, 88, 12, 0.12)',
    line: 'rgba(234, 88, 12, 0.16)',
    lineStrong: 'rgba(234, 88, 12, 0.28)',
    shadowLift: '0 2px 4px rgba(234, 88, 12, 0.14), 0 12px 32px rgba(234, 88, 12, 0.20)',
    shadowGlow: '0 0 24px rgba(234, 88, 12, 0.35)',
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald Jade',
    nameUrdu: 'زمرد سبز (گرین)',
    dotColor: '#059669',
    brand: '#059669',
    brandRgb: '5 150 105',
    brandDeep: '#047857',
    brandSoft: 'rgba(5, 150, 105, 0.12)',
    line: 'rgba(5, 150, 105, 0.16)',
    lineStrong: 'rgba(5, 150, 105, 0.28)',
    shadowLift: '0 2px 4px rgba(5, 150, 105, 0.14), 0 12px 32px rgba(5, 150, 105, 0.20)',
    shadowGlow: '0 0 24px rgba(5, 150, 105, 0.35)',
  },
  teal: {
    id: 'teal',
    name: 'Ocean Teal',
    nameUrdu: 'اوشن ٹیل',
    dotColor: '#0d9488',
    brand: '#0d9488',
    brandRgb: '13 148 136',
    brandDeep: '#0f766e',
    brandSoft: 'rgba(13, 148, 136, 0.12)',
    line: 'rgba(13, 148, 136, 0.16)',
    lineStrong: 'rgba(13, 148, 136, 0.28)',
    shadowLift: '0 2px 4px rgba(13, 148, 136, 0.14), 0 12px 32px rgba(13, 148, 136, 0.20)',
    shadowGlow: '0 0 24px rgba(13, 148, 136, 0.35)',
  },
  sapphire: {
    id: 'sapphire',
    name: 'Sapphire Blue',
    nameUrdu: 'نیلم نیلا (بلو)',
    dotColor: '#2563eb',
    brand: '#2563eb',
    brandRgb: '37 99 235',
    brandDeep: '#1d4ed8',
    brandSoft: 'rgba(37, 99, 235, 0.12)',
    line: 'rgba(37, 99, 235, 0.16)',
    lineStrong: 'rgba(37, 99, 235, 0.28)',
    shadowLift: '0 2px 4px rgba(37, 99, 235, 0.14), 0 12px 32px rgba(37, 99, 235, 0.20)',
    shadowGlow: '0 0 24px rgba(37, 99, 235, 0.35)',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Ruby',
    nameUrdu: 'یاقوت سرخ (ریڈ)',
    dotColor: '#e11d48',
    brand: '#e11d48',
    brandRgb: '225 29 72',
    brandDeep: '#be123c',
    brandSoft: 'rgba(225, 29, 72, 0.12)',
    line: 'rgba(225, 29, 72, 0.16)',
    lineStrong: 'rgba(225, 29, 72, 0.28)',
    shadowLift: '0 2px 4px rgba(225, 29, 72, 0.14), 0 12px 32px rgba(225, 29, 72, 0.20)',
    shadowGlow: '0 0 24px rgba(225, 29, 72, 0.35)',
  },
};

interface CartLine {
  item: MenuItem;
  qty: number;
}

export default function PosTab({
  restaurantId,
  restaurant,
  tables: initialTables,
  orders: initialOrders,
  onOrderPlaced,
}: {
  restaurantId: string;
  restaurant?: { name: string; address?: string; phone?: string; email?: string };
  tables?: DiningTable[];
  orders?: Order[];
  onOrderPlaced?: () => void;
}) {
  const t = useT();
  const lang = useLang();

  // Color Palette state (Defaults to Warm Amber #ea580c — no more purple)
  const [activePalette, setActivePalette] = useState<PosPaletteId>('amber');
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('orderkar_pos_palette') as PosPaletteId | null;
      if (saved && POS_PALETTES[saved]) {
        setActivePalette(saved);
      }
    } catch {}
  }, []);

  const handlePaletteChange = (pid: PosPaletteId) => {
    setActivePalette(pid);
    try {
      localStorage.setItem('orderkar_pos_palette', pid);
    } catch {}
  };

  const curPal = POS_PALETTES[activePalette] ?? POS_PALETTES.amber;

  // Data states
  const [cats, setCats] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [tables, setTables] = useState<DiningTable[]>(initialTables ?? []);
  const [orders, setOrders] = useState<Order[]>(initialOrders ?? []);
  const [bizInfo, setBizInfo] = useState(restaurant ?? { name: 'Restaurant POS' });
  const [cashier, setCashier] = useState('');

  // Filter states
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'cards' | 'list'>('grid');
  const catScrollRef = useRef<HTMLDivElement>(null);

  const scrollCats = (dir: 'left' | 'right') => {
    if (catScrollRef.current) {
      const scrollAmount = dir === 'left' ? -220 : 220;
      catScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  // Order Details
  const [orderType, setOrderType] = useState<PosOrderType>('dine_in');
  const [tableId, setTableId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [address, setAddress] = useState('');

  // Cart & Payment states
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountVal, setDiscountVal] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [onlineMethod, setOnlineMethod] = useState<OnlineSubMethod>('card');
  const [onlineRef, setOnlineRef] = useState('');
  const [cashGiven, setCashGiven] = useState('');

  // Processing states
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Load menu items, categories, and tables
  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const [
        { data: c },
        { data: it },
        { data: { user } },
        { data: rData },
      ] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('restaurant_id', restaurantId).order('display_order'),
        supabase.from('menu_items').select('*').eq('restaurant_id', restaurantId).order('name'),
        supabase.auth.getUser(),
        restaurant ? Promise.resolve({ data: null }) : supabase.from('restaurants').select('name, theme_config').eq('id', restaurantId).single(),
      ]);

      const list = (c ?? []) as MenuCategory[];
      setCats(list);
      setItems((it ?? []) as MenuItem[]);

      if (rData && 'data' in rData && rData.data) {
        const d = rData.data as { name?: string; theme_config?: Record<string, unknown> };
        const tc = d.theme_config ?? {};
        if (tc.pos_palette && typeof tc.pos_palette === 'string' && POS_PALETTES[tc.pos_palette as PosPaletteId]) {
          setActivePalette(tc.pos_palette as PosPaletteId);
        }
        setBizInfo({
          name: d.name ?? 'Restaurant POS',
          address: typeof tc.address === 'string' ? tc.address : undefined,
          phone: typeof tc.phone === 'string' ? tc.phone : undefined,
          email: typeof tc.email === 'string' ? tc.email : undefined,
        });
      }

      if (user) {
        const { data: p } = await supabase.from('profiles').select('name').eq('id', user.id).single();
        if (p?.name) setCashier(p.name);
      }

      // If tables weren't passed in props, load them
      if (!initialTables || initialTables.length === 0) {
        const { data: tb } = await supabase.from('tables').select('*').eq('restaurant_id', restaurantId).eq('is_active', true).order('table_number');
        if (tb) setTables(tb as DiningTable[]);
      }

      // If orders weren't passed, load active orders for table status
      if (!initialOrders) {
        const { data: ords } = await supabase.from('orders').select('*').eq('restaurant_id', restaurantId).in('status', ['pending', 'preparing', 'ready']).limit(100);
        if (ords) setOrders(ords as Order[]);
      }
    })();
  }, [restaurantId, restaurant, initialTables, initialOrders]);

  // Filtered menu items
  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((i) => {
      const matchesCat = activeCat === 'all' || i.category_id === activeCat;
      const matchesQuery = !q || i.name.toLowerCase().includes(q) || (i.category_id && cats.find((c) => c.id === i.category_id)?.name.toLowerCase().includes(q));
      return matchesCat && matchesQuery;
    });
  }, [items, activeCat, query, cats]);

  // Cart Management
  const addItem = (item: MenuItem) => {
    setCart((prev) => {
      const ex = prev.find((l) => l.item.id === item.id);
      if (ex) return prev.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { item, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((prev) => (qty <= 0 ? prev.filter((l) => l.item.id !== id) : prev.map((l) => (l.item.id === id ? { ...l, qty } : l))));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountVal('');
    setCashGiven('');
    setError('');
  };

  // Financial Calculations
  const subtotal = useMemo(() => {
    return cart.reduce((s, l) => s + Number(l.item.price) * l.qty, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (discountType === 'none' || !discountVal) return 0;
    const num = parseFloat(discountVal) || 0;
    if (num <= 0) return 0;
    if (discountType === 'rs') {
      return Math.min(subtotal, num);
    }
    if (discountType === 'percent') {
      return Math.min(subtotal, (subtotal * num) / 100);
    }
    return 0;
  }, [discountType, discountVal, subtotal]);

  const netPayable = useMemo(() => {
    return Math.max(0, Math.round(subtotal - discountAmount));
  }, [subtotal, discountAmount]);

  const cashGivenNum = parseFloat(cashGiven) || 0;
  const change = paymentMode === 'cash' && cashGiven.trim() !== '' ? Math.max(0, cashGivenNum - netPayable) : 0;
  const isCashShort = paymentMode === 'cash' && cashGiven.trim() !== '' && cashGivenNum < netPayable;

  const totalItemsCount = useMemo(() => {
    return cart.reduce((s, l) => s + l.qty, 0);
  }, [cart]);

  // Reset after order
  const resetOrder = () => {
    setCart([]);
    setDiscountType('none');
    setDiscountVal('');
    setCashGiven('');
    setCustomerName('');
    setCustomerPhone('');
    setAddress('');
    setTableId('');
    setOnlineRef('');
    setError('');
    setReceipt(null);
  };

  // Charge and save order directly to database
  const handleCharge = async () => {
    setError('');
    if (cart.length === 0) {
      setError('Cart is empty. Tap items to build customer order.');
      return;
    }
    if (orderType === 'dine_in' && !tableId) {
      setError('Please select a dining table for Dine-In order.');
      return;
    }
    if (orderType === 'delivery' && (!customerPhone.trim() || !address.trim())) {
      setError('Customer phone number and delivery address are required.');
      return;
    }
    if (paymentMode === 'cash' && cashGiven.trim() !== '' && cashGivenNum < netPayable) {
      setError(`Cash given (Rs ${cashGivenNum}) is less than net payable amount (${fmtPKR(netPayable)}).`);
      return;
    }

    setPlacing(true);
    try {
      const supabase = createClient();
      const orderId = crypto.randomUUID();

      // Database payment_method mapping: 'cash' | 'card' | 'jazzcash' | 'easypaisa'
      let dbMethod = 'cash';
      if (paymentMode === 'online') {
        if (onlineMethod === 'wallet') dbMethod = 'jazzcash';
        else dbMethod = 'card';
      }

      // Notes string with discount & payment details
      const notesParts: string[] = [];
      if (discountAmount > 0) {
        notesParts.push(`Discount: -Rs ${Math.round(discountAmount)} (${discountType === 'percent' ? `${discountVal}%` : 'Flat PKR'})`);
      }
      if (paymentMode === 'online') {
        const methodLabel = onlineMethod === 'card' ? 'Card' : onlineMethod === 'bank' ? 'Bank Account' : 'JazzCash / EasyPaisa';
        notesParts.push(`Paid Online via ${methodLabel}${onlineRef.trim() ? ` [Ref: ${onlineRef.trim()}]` : ''}`);
      } else if (cashGiven.trim()) {
        notesParts.push(`Cash Given: Rs ${cashGivenNum} | Change: Rs ${change}`);
      }
      if (orderType === 'delivery' && address.trim()) {
        notesParts.push(`Delivery Address: ${address.trim()}`);
      }

      // 1. Insert into orders table
      const { error: oErr } = await supabase.from('orders').insert({
        id: orderId,
        tracking_token: crypto.randomUUID(),
        restaurant_id: restaurantId,
        table_id: orderType === 'dine_in' ? tableId : null,
        order_type: orderType,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        notes: notesParts.length > 0 ? notesParts.join(' • ') : null,
        status: 'completed',
        total_amount: netPayable,
        payment_status: 'paid',
        payment_method: dbMethod,
      });

      if (oErr) throw oErr;

      // 2. Insert into order_items table
      const lines = cart.map((l) => ({
        order_id: orderId,
        menu_item_id: l.item.id,
        item_name: l.item.name,
        quantity: l.qty,
        unit_price: l.item.price,
      }));

      const { error: iErr } = await supabase.from('order_items').insert(lines);
      if (iErr) throw iErr;

      // 3. Fetch saved order sequence number
      const { data: ord } = await supabase.from('orders').select('order_number, created_at').eq('id', orderId).single();

      const selectedTable = tables.find((t) => t.id === tableId);

      // 4. Construct receipt preview
      setReceipt({
        lang,
        restaurant: bizInfo,
        orderNo: ord?.order_number ?? 0,
        date: ord?.created_at ? new Date(ord.created_at) : new Date(),
        orderType,
        tableLabel: selectedTable ? `T${selectedTable.table_number}` : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        deliveryAddress: orderType === 'delivery' ? address.trim() || undefined : undefined,
        cashier: cashier || undefined,
        items: cart.map((l) => ({ name: l.item.name, qty: l.qty, price: Number(l.item.price) })),
        paymentMethod: dbMethod,
        tendered: paymentMode === 'cash' && cashGiven.trim() ? cashGivenNum : null,
      });

      if (onOrderPlaced) onOrderPlaced();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save order to database.');
    } finally {
      setPlacing(false);
    }
  };

  const activeTables = useMemo(() => tables.filter((t) => t.is_active), [tables]);

  return (
    <div
      className="w-full h-full flex flex-col lg:max-h-[calc(100vh-84px)]"
      style={{
        ['--c-brand' as any]: curPal.brand,
        ['--c-brand-rgb' as any]: curPal.brandRgb,
        ['--c-brand-deep' as any]: curPal.brandDeep,
        ['--c-brand-soft' as any]: curPal.brandSoft,
        ['--c-line' as any]: curPal.line,
        ['--c-line-strong' as any]: curPal.lineStrong,
        ['--shadow-lift' as any]: curPal.shadowLift,
        ['--shadow-glow' as any]: curPal.shadowGlow,
      }}
    >
      {/* ── Top Header Banner ── */}
      <div className="shrink-0 mb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2.5">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-ink flex items-center gap-2">
            SALES &amp; POS
          </h1>
          <p className="text-xs text-muted font-medium mt-0.5">
            Tap items to build a cart and process customer checkout.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* POS Settings Button */}
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="flex h-9 items-center gap-1.5 rounded-2xl border border-line bg-[var(--c-surface-solid)] px-3 text-xs font-bold text-muted hover:text-ink hover:border-brand/40 shadow-xs transition-all active:scale-95"
            title="POS Settings & Color Palette"
          >
            <span>⚙️</span>
            <span className="hidden sm:inline">Settings</span>
          </button>

          {/* Order Type Tabs: Dine-In, Takeaway, Delivery */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-[var(--c-surface-solid)] p-1 shadow-xs">
            {[
              { id: 'dine_in' as const, label: '🍽️ Dine-In' },
              { id: 'takeaway' as const, label: '🛍️ Takeaway' },
              { id: 'delivery' as const, label: '🛵 Delivery' },
            ].map((ot) => (
              <button
                key={ot.id}
                type="button"
                onClick={() => setOrderType(ot.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                  orderType === ot.id
                    ? 'bg-brand text-white shadow-lift'
                    : 'text-muted hover:text-ink hover:bg-soft'
                }`}
              >
                {ot.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Optional Table / Customer details ── */}
      {orderType === 'dine_in' ? (
        <div className="shrink-0 mb-3 rounded-2xl border border-line bg-[var(--c-surface)] px-3 py-2 shadow-xs flex items-center gap-2.5 overflow-x-auto no-scrollbar">
          <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">
            Table:
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {activeTables.map((tb) => {
              const st = tableState(tb.id, orders);
              const isSelected = tableId === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTableId(tb.id)}
                  className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-brand text-white shadow-lift ring-2 ring-brand/30'
                      : st === 'free'
                        ? 'border border-line bg-[var(--c-surface-solid)] text-ink hover:border-brand/40'
                        : 'border border-line/40 bg-soft text-muted cursor-not-allowed opacity-60'
                  }`}
                  disabled={st !== 'free'}
                  title={st !== 'free' ? `Table ${tb.table_number} is occupied` : `Table ${tb.table_number}`}
                >
                  T{tb.table_number}
                </button>
              );
            })}
            {activeTables.length === 0 && (
              <span className="text-xs text-muted">No tables configured.</span>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 mb-3 grid gap-2 sm:grid-cols-2 rounded-2xl border border-line bg-[var(--c-surface)] p-2.5">
          <Input
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Customer name (optional)"
            className="text-xs h-8"
          />
          <Input
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="Phone number"
            className="text-xs h-8"
          />
          {orderType === 'delivery' && (
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Delivery drop-off address"
              className="sm:col-span-2 text-xs h-8"
            />
          )}
        </div>
      )}

      {/* ── Main Layout: Items (col-span-7) & Current Bill (col-span-5) ── */}
      <div className="grid gap-4 lg:grid-cols-12 flex-1 min-h-0 items-start">
        {/* ── Left Column: Items (col-span-7: Search Bar & Toggle, Categories, Items Scroll) ── */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 space-y-2">
          {/* Row 1: Barcode / Search Input bar + View Mode Toggle in single top row */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="flex-1 relative flex items-center rounded-2xl border border-line bg-[var(--c-surface-solid)] px-3 py-1.5 shadow-xs focus-within:border-brand/60 focus-within:ring-2 focus-within:ring-brand/10 transition-all">
              <span className="text-muted mr-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 5v14" />
                  <path d="M8 5v14" />
                  <path d="M12 5v14" />
                  <path d="M17 5v14" />
                  <path d="M21 5v14" />
                </svg>
              </span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && visibleItems.length > 0) {
                    addItem(visibleItems[0]);
                    setQuery('');
                  }
                }}
                placeholder="Scan barcode, short code, or search..."
                className="flex-1 bg-transparent text-xs font-semibold text-ink placeholder:text-muted outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  if (visibleItems.length > 0) {
                    addItem(visibleItems[0]);
                    setQuery('');
                  }
                }}
                className="rounded-lg bg-ink px-2.5 py-1 text-[10.5px] font-black uppercase text-page hover:opacity-90 transition-opacity"
              >
                ENTER ⏎
              </button>
            </div>

            {/* View Mode Toggle: Grid, Cards, List */}
            <div className="shrink-0 flex items-center rounded-xl border border-line bg-[var(--c-surface-solid)] p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Compact Square Grid (Half Size)"
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <rect width="7" height="7" x="3" y="3" rx="1.5" />
                  <rect width="7" height="7" x="14" y="3" rx="1.5" />
                  <rect width="7" height="7" x="14" y="14" rx="1.5" />
                  <rect width="7" height="7" x="3" y="14" rx="1.5" />
                </svg>
                <span className="hidden sm:inline">Grid</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cards')}
                title="Cards View"
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                  viewMode === 'cards'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <rect width="18" height="8" x="3" y="3" rx="1.5" />
                  <rect width="18" height="8" x="3" y="13" rx="1.5" />
                </svg>
                <span className="hidden sm:inline">Cards</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="Dense List View"
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                  viewMode === 'list'
                    ? 'bg-brand text-white shadow-xs'
                    : 'text-muted hover:text-ink'
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
          </div>

          {/* Row 2: Categories Pills (Directly below search/toggle, scrollable Left-to-Right with arrow buttons) */}
          <div className="shrink-0 flex items-center gap-1.5 relative">
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={() => scrollCats('left')}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink hover:border-brand/40 shadow-xs transition-all active:scale-95"
              title="Scroll Categories Left"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            {/* Horizontal Scrollable Categories Container */}
            <div
              ref={catScrollRef}
              className="no-scrollbar flex items-center gap-1.5 overflow-x-auto scroll-smooth flex-1 py-0.5"
            >
              {/* All Items Pill */}
              <button
                type="button"
                onClick={() => setActiveCat('all')}
                className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-tight transition-all ${
                  activeCat === 'all'
                    ? 'bg-brand text-white shadow-lift ring-2 ring-brand/30'
                    : 'border border-line bg-[var(--c-surface-solid)] text-ink/80 hover:text-ink hover:border-brand/40'
                }`}
              >
                <span>✨ All Items</span>
                <span
                  className={`font-mono text-[10px] rounded-full px-1.5 py-0.2 ${
                    activeCat === 'all' ? 'bg-white/20 text-white' : 'bg-soft text-muted'
                  }`}
                >
                  {items.length}
                </span>
              </button>

              {/* Dynamic Category Pills */}
              {cats.map((c) => {
                const catItemCount = items.filter((i) => i.category_id === c.id).length;
                const isActive = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-tight transition-all ${
                      isActive
                        ? 'bg-brand text-white shadow-lift ring-2 ring-brand/30'
                        : 'border border-line bg-[var(--c-surface-solid)] text-ink/80 hover:text-ink hover:border-brand/40'
                    }`}
                  >
                    <span className="text-sm leading-none">{categoryEmoji(c.name)}</span>
                    <span>{c.name}</span>
                    <span
                      className={`font-mono text-[10px] rounded-full px-1.5 py-0.2 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-soft text-muted'
                      }`}
                    >
                      {catItemCount}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={() => scrollCats('right')}
              className="shrink-0 flex h-7 w-7 items-center justify-center rounded-xl border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink hover:border-brand/40 shadow-xs transition-all active:scale-95"
              title="Scroll Categories Right"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Row 3: Scrollable Items Container (Fixed-area scroll) */}
          <div className="pos-items-scroll flex-1 min-h-[360px] lg:max-h-[calc(100vh-230px)] overflow-y-auto pr-1.5 pb-2">
            {visibleItems.length === 0 ? (
              <Empty title="No items found" sub="Try a different search term or category." />
            ) : viewMode === 'grid' ? (
              /* ── 1. Compact Grid View: Half Size, 3 to 4 in row Square Tiles ── */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
                {visibleItems.map((item) => {
                  const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                  const catName = cats.find((c) => c.id === item.category_id)?.name ?? '';
                  const realImg = cdnUrl(item.image_url || categoryImage(catName));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={`group relative flex flex-col justify-between aspect-square w-full overflow-hidden rounded-[16px] sm:rounded-[18px] border p-2 sm:p-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] ${
                        inCart > 0
                          ? 'border-brand/70 bg-brand/[0.04] ring-2 ring-brand/20 shadow-xs'
                          : 'border-line/70 bg-[var(--c-surface-solid)] hover:border-brand/40'
                      }`}
                    >
                      {/* Cart quantity badge */}
                      {inCart > 0 && (
                        <span className="absolute top-2 right-2 z-10 rounded-full bg-brand px-1.5 py-0.2 font-mono text-[10px] font-black text-white shadow-md animate-in zoom-in-75">
                          ×{inCart}
                        </span>
                      )}

                      {/* Real Dish Photo Container */}
                      <div className="relative flex-1 w-full min-h-0 overflow-hidden rounded-xl bg-soft shadow-inner">
                        <img
                          src={realImg}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = categoryImage(catName);
                          }}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
                      </div>

                      {/* Dish Info: Bold Name and Bold Price */}
                      <div className="mt-1.5 w-full shrink-0">
                        <p className="truncate font-display text-[11px] sm:text-[12px] font-black uppercase tracking-tight text-ink" title={item.name}>
                          {item.name}
                        </p>
                        <div className="mt-0.5 flex items-baseline justify-between gap-1">
                          <p className="font-mono text-[11.5px] sm:text-[12.5px] font-black text-brand">
                            {fmtPKR(item.price)}
                          </p>
                          <span className="hidden sm:inline truncate text-[9.5px] font-bold text-muted max-w-[55px]">
                            {catName || 'Available'}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : viewMode === 'cards' ? (
              /* ── 2. Cards View: Compact Horizontal Cards ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
                {visibleItems.map((item) => {
                  const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                  const catName = cats.find((c) => c.id === item.category_id)?.name ?? '';
                  const realImg = cdnUrl(item.image_url || categoryImage(catName));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={`group relative flex items-center gap-2.5 rounded-[18px] border p-2 sm:p-2.5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs active:scale-[0.98] ${
                        inCart > 0
                          ? 'border-brand/70 bg-brand/[0.04] ring-2 ring-brand/20 shadow-xs'
                          : 'border-line/70 bg-[var(--c-surface-solid)] hover:border-brand/40'
                      }`}
                    >
                      {/* Photo Thumbnail */}
                      <div className="relative h-14 w-14 sm:h-16 sm:w-16 shrink-0 overflow-hidden rounded-xl bg-soft shadow-inner">
                        <img
                          src={realImg}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = categoryImage(catName);
                          }}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[12px] sm:text-[13px] font-black uppercase tracking-tight text-ink" title={item.name}>
                          {item.name}
                        </p>
                        <p className="truncate text-[10px] font-bold text-muted mt-0.5">
                          {catName || 'Available'}
                        </p>
                        <p className="font-mono text-xs sm:text-[13px] font-black text-brand mt-1">
                          {fmtPKR(item.price)}
                        </p>
                      </div>

                      {/* Quick Add or Cart Badge */}
                      <div className="shrink-0 flex items-center">
                        {inCart > 0 ? (
                          <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] font-black text-white shadow-xs">
                            ×{inCart}
                          </span>
                        ) : (
                          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-soft text-xs font-black text-ink group-hover:bg-brand group-hover:text-white transition-colors">
                            +
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* ── 3. List View: Dense Table Rows ── */
              <div className="flex flex-col gap-1.5">
                {visibleItems.map((item) => {
                  const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                  const catName = cats.find((c) => c.id === item.category_id)?.name ?? '';
                  const realImg = cdnUrl(item.image_url || categoryImage(catName));

                  return (
                    <div
                      key={item.id}
                      onClick={() => addItem(item)}
                      className={`group flex items-center justify-between gap-3 rounded-xl border px-3 py-2 cursor-pointer transition-all hover:bg-soft/70 active:scale-[0.99] ${
                        inCart > 0
                          ? 'border-brand/60 bg-brand/[0.04] ring-1 ring-brand/20'
                          : 'border-line/60 bg-[var(--c-surface-solid)] hover:border-brand/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={realImg}
                          alt=""
                          className="h-9 w-9 rounded-lg object-cover shrink-0 bg-soft shadow-xs"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = categoryImage(catName);
                          }}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black uppercase text-ink tracking-tight">{item.name}</p>
                          <p className="text-[10px] font-bold text-muted">{catName || 'Available'}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-xs sm:text-[13px] font-black text-brand">
                          {fmtPKR(item.price)}
                        </span>
                        {inCart > 0 ? (
                          <span className="rounded-full bg-brand px-2 py-0.5 font-mono text-[11px] font-black text-white shadow-xs">
                            ×{inCart}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="rounded-lg bg-soft px-2.5 py-1 text-[11px] font-black text-ink group-hover:bg-brand group-hover:text-white transition-colors"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: CURRENT BILL (col-span-5) ── */}
        <div className="lg:col-span-5 flex flex-col h-full min-h-0">
          <Card className="flex flex-col h-full min-h-0 rounded-[26px] border border-line bg-[var(--c-surface)] p-4 sm:p-5 shadow-lift lg:max-h-[calc(100vh-140px)]">
            {/* Bill Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-line pb-2.5">
              <h3 className="font-display text-sm sm:text-base font-black tracking-tight text-ink flex items-center gap-2">
                <span>🛒</span> CURRENT BILL
              </h3>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-soft px-2 py-0.5 text-[10.5px] font-bold text-muted border border-line">
                  Items: {totalItemsCount}
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-xs text-muted hover:text-rose-600 transition-colors"
                    title="Clear cart"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="my-2.5 flex-1 min-h-[90px] max-h-[26vh] lg:max-h-none overflow-y-auto space-y-2 pr-1 pos-items-scroll">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-soft text-2xl mb-2 text-muted">
                    🧾
                  </div>
                  <p className="text-xs font-bold text-ink">Cart is empty.</p>
                  <p className="text-[11px] text-muted">Scan items to start billing.</p>
                </div>
              ) : (
                cart.map((line) => {
                  const lineCat = cats.find((c) => c.id === line.item.category_id)?.name ?? '';
                  const lineImg = cdnUrl(line.item.image_url || categoryImage(lineCat));
                  return (
                    <div
                      key={line.item.id}
                      className="flex items-center justify-between gap-2.5 rounded-xl bg-[var(--c-surface-solid)] p-2.5 border border-line/60"
                    >
                      <img
                        src={lineImg}
                        alt=""
                        className="h-9 w-9 rounded-lg object-cover shrink-0 bg-soft shadow-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-ink uppercase tracking-tight">{line.item.name}</p>
                        <p className="font-mono text-[11.5px] font-bold text-brand">
                          {fmtPKR(Number(line.item.price) * line.qty)}
                        </p>
                      </div>

                      {/* Stepper − / + */}
                      <div className="flex items-center gap-1 rounded-lg bg-soft p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(line.item.id, line.qty - 1)}
                          className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-ink hover:bg-[var(--c-surface-solid)]"
                        >
                          −
                        </button>
                        <span className="min-w-4 text-center font-mono text-xs font-bold text-ink">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.item.id, line.qty + 1)}
                          className="flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-ink hover:bg-[var(--c-surface-solid)]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Bill Controls: Discount & Payment ── */}
            <div className="shrink-0 space-y-2.5 border-t border-line pt-2.5">
              {/* Overall Discount */}
              <div>
                <label className="block text-[10.5px] uppercase font-bold text-muted">
                  OVERALL DISCOUNT
                </label>
                <div className="mt-1 flex gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => {
                      setDiscountType(e.target.value as DiscountType);
                      if (e.target.value === 'none') setDiscountVal('');
                    }}
                    className="rounded-xl border border-line bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-xs font-bold text-ink outline-none"
                  >
                    <option value="none">None</option>
                    <option value="rs">Rs (Flat)</option>
                    <option value="percent">% (Percent)</option>
                  </select>

                  {discountType !== 'none' && (
                    <input
                      type="number"
                      min={0}
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      placeholder={discountType === 'percent' ? 'e.g. 10%' : 'e.g. 200'}
                      className="flex-1 rounded-xl border border-line bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-xs font-bold text-ink outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Payment Mode (Cash vs Online) */}
              <div>
                <label className="block text-[10.5px] uppercase font-bold text-muted">
                  PAYMENT MODE
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode('cash')}
                    className={`rounded-xl py-2 text-xs font-extrabold transition-all ${
                      paymentMode === 'cash'
                        ? 'bg-brand text-white shadow-lift ring-2 ring-brand/30'
                        : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                    }`}
                  >
                    💵 Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode('online')}
                    className={`rounded-xl py-2 text-xs font-extrabold transition-all ${
                      paymentMode === 'online'
                        ? 'bg-brand text-white shadow-lift ring-2 ring-brand/30'
                        : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                    }`}
                  >
                    💳 Online
                  </button>
                </div>
              </div>

              {/* Cash Given Row (If Cash) */}
              {paymentMode === 'cash' ? (
                <div>
                  <label className="block text-[10.5px] uppercase font-bold text-muted">
                    💵 CASH GIVEN
                  </label>
                  <div className="mt-1 flex items-center rounded-xl border border-line bg-[var(--c-surface-solid)] px-3 py-1.5">
                    <input
                      type="number"
                      min={0}
                      value={cashGiven}
                      onChange={(e) => setCashGiven(e.target.value)}
                      placeholder={netPayable > 0 ? String(netPayable) : '0.00'}
                      className="w-full bg-transparent font-mono text-xs font-black text-ink outline-none"
                    />
                  </div>
                  {/* Quick tender pills */}
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[
                      { label: 'Exact', val: netPayable },
                      { label: 'Rs 500', val: 500 },
                      { label: 'Rs 1,000', val: 1000 },
                      { label: 'Rs 5,000', val: 5000 },
                    ].map((qp) => (
                      <button
                        key={qp.label}
                        type="button"
                        onClick={() => setCashGiven(String(qp.val))}
                        className="rounded-lg bg-soft px-2 py-0.5 text-[10.5px] font-bold text-muted hover:text-ink hover:bg-line transition-all"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Online Sub-options (Card, Bank, Wallet) */
                <div className="space-y-2">
                  <label className="block text-[10.5px] uppercase font-bold text-muted">
                    ONLINE PAYMENT CHANNEL
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'card' as const, label: '💳 Card' },
                      { id: 'bank' as const, label: '🏦 Bank' },
                      { id: 'wallet' as const, label: '📱 Wallet' },
                    ].map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOnlineMethod(m.id)}
                        className={`rounded-lg py-1 text-[11px] font-bold transition-all ${
                          onlineMethod === m.id
                            ? 'bg-ink text-page font-extrabold'
                            : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={onlineRef}
                    onChange={(e) => setOnlineRef(e.target.value)}
                    placeholder="Transaction ID / Approval Code (optional)"
                    className="w-full rounded-xl border border-line bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-xs text-ink outline-none"
                  />
                </div>
              )}

              {/* Totals Summary */}
              <div className="rounded-2xl bg-soft/70 p-3 space-y-1.5 border border-line/60">
                <div className="flex justify-between text-xs font-semibold text-muted">
                  <span>Subtotal:</span>
                  <span className="font-mono">{fmtPKR(subtotal)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs font-semibold text-ok">
                    <span>Discount:</span>
                    <span className="font-mono">- {fmtPKR(discountAmount)}</span>
                  </div>
                )}

                {paymentMode === 'cash' && (
                  <div className="flex justify-between text-xs font-semibold text-muted">
                    <span>Change:</span>
                    <span className={`font-mono ${isCashShort ? 'text-rose-600 font-bold' : 'text-ok font-bold'}`}>
                      {isCashShort ? 'Short Cash' : fmtPKR(change)}
                    </span>
                  </div>
                )}

                <div className="border-t border-dashed border-line pt-2 flex items-baseline justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-ink">
                    NET PAYABLE
                  </span>
                  <span className="font-display text-xl font-black text-brand">
                    {fmtPKR(netPayable)}
                  </span>
                </div>
              </div>

              {/* Error warning */}
              {error && (
                <p className="rounded-xl bg-danger/10 p-2.5 text-xs font-bold text-danger">
                  {error}
                </p>
              )}

              {/* Charge Button */}
              <button
                type="button"
                onClick={handleCharge}
                disabled={placing || cart.length === 0}
                className="w-full rounded-2xl bg-gradient-to-r from-brand to-brand-deep py-3.5 text-center text-sm font-black text-white shadow-lift transition-all hover:opacity-95 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {placing ? 'Processing Order...' : `Charge ${fmtPKR(netPayable)} →`}
              </button>
            </div>
          </Card>
        </div>
      </div>

      {/* ── Receipt Modal Preview ── */}
      {receipt && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-xs" />
          <div className="relative mx-auto my-6 w-[calc(100%-2rem)] max-w-md rounded-[26px] bg-[var(--c-surface-solid)] p-6 shadow-2xl border border-line animate-in zoom-in-95">
            <h2 className="mb-4 text-center font-display text-lg font-black text-ink">
              ✅ Payment Processed Successfully
            </h2>
            <ReceiptPreview data={receipt} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Btn variant="secondary" onClick={() => printReceipt(receipt, 'browser')}>
                🖨️ Browser Print
              </Btn>
              <Btn variant="secondary" onClick={() => printReceipt(receipt, 'thermal')}>
                🧾 80mm Thermal
              </Btn>
            </div>
            <Btn className="mt-2.5 w-full" onClick={resetOrder}>
              Start New Sale
            </Btn>
          </div>
        </div>
      )}

      {/* ── POS Settings Modal ── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-xs transition-opacity"
            onClick={() => setShowSettingsModal(false)}
          />
          <div className="relative w-full max-w-md rounded-[26px] bg-[var(--c-surface-solid)] p-5 sm:p-6 shadow-2xl border border-line animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-line pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand text-base">
                  ⚙️
                </span>
                <div>
                  <h3 className="font-display text-base font-black text-ink">POS Register Settings</h3>
                  <p className="text-[11.5px] text-muted">Customize register appearance and colors</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-soft transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-wider text-muted mb-2">
                  Theme Color Palette
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(POS_PALETTES) as PosPaletteId[]).map((pid) => {
                    const pal = POS_PALETTES[pid];
                    const isSelected = activePalette === pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => {
                          handlePaletteChange(pid);
                        }}
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                          isSelected
                            ? 'border-brand bg-brand/[0.06] shadow-xs ring-2 ring-brand/20'
                            : 'border-line hover:border-brand/40 bg-[var(--c-surface)]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-5 w-5 rounded-full shadow-xs shrink-0 flex items-center justify-center text-[10px] text-white font-bold"
                            style={{ backgroundColor: pal.dotColor }}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <div>
                            <p className="text-xs font-bold text-ink">{pal.name}</p>
                            <p className="text-[11px] text-muted">{pal.nameUrdu}</p>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10.5px] font-bold text-brand">
                            Active
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-line pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="rounded-xl bg-ink px-4 py-2 text-xs font-bold text-page hover:opacity-90 transition-opacity"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
