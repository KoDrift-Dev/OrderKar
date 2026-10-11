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
      {/* ── Top Header Banner (Exact 2nd picture header) ── */}
      <div className="shrink-0 mb-2 sm:mb-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-black tracking-tight text-[#154a48] dark:text-emerald-400">
              SALES &amp; POS
            </h1>
            <p className="text-[11.5px] sm:text-xs text-muted font-medium mt-0.5">
              Tap items to build a cart and process customer checkout.
            </p>
          </div>

          {/* Compact Order Type & Settings on top-right */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center rounded-xl border border-line bg-[var(--c-surface-solid)] p-0.5 shadow-xs text-xs">
              {[
                { id: 'dine_in' as const, label: '🍽️ Dine', title: 'Dine-In' },
                { id: 'takeaway' as const, label: '🛍️ Take', title: 'Takeaway' },
                { id: 'delivery' as const, label: '🛵 Del', title: 'Delivery' },
              ].map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => setOrderType(ot.id)}
                  title={ot.title}
                  className={`rounded-lg px-2 py-1 text-[10.5px] sm:text-xs font-bold transition-all ${
                    orderType === ot.id
                      ? 'bg-[#154a48] text-white shadow-xs'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {ot.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(true)}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink shadow-xs transition-all active:scale-95"
              title="Settings"
            >
              ⚙️
            </button>
          </div>
        </div>

        {/* If Dine-In & tables available: Compact single-line table pill row */}
        {orderType === 'dine_in' && activeTables.length > 0 && (
          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">
              Table:
            </span>
            {activeTables.map((tb) => {
              const st = tableState(tb.id, orders);
              const isSelected = tableId === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => setTableId(tb.id)}
                  disabled={st !== 'free'}
                  className={`shrink-0 rounded-lg px-2 py-0.5 text-[10.5px] font-bold transition-all ${
                    isSelected
                      ? 'bg-[#154a48] text-white shadow-xs ring-1 ring-[#154a48]'
                      : st === 'free'
                        ? 'border border-line bg-[var(--c-surface-solid)] text-ink hover:border-[#154a48]'
                        : 'bg-soft text-muted cursor-not-allowed opacity-50'
                  }`}
                >
                  T{tb.table_number}
                </button>
              );
            })}
          </div>
        )}

        {/* Customer fields for Takeaway / Delivery (compact) */}
        {orderType !== 'dine_in' && (
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2 rounded-xl border border-line bg-[var(--c-surface)] p-2">
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name (optional)"
              className="text-xs h-7 sm:h-8"
            />
            <Input
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number"
              className="text-xs h-7 sm:h-8"
            />
            {orderType === 'delivery' && (
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Delivery drop-off address"
                className="sm:col-span-2 text-xs h-7 sm:h-8"
              />
            )}
          </div>
        )}
      </div>

      {/* ── Main Layout: Items (col-span-7) & Current Bill (col-span-5) ── */}
      <div className="grid gap-3 sm:gap-4 lg:grid-cols-12 flex-1 min-h-0 items-start">
        {/* ── Left Column: Items (col-span-7: Search Bar, Categories, 2-Column Square Grid) ── */}
        <div className="lg:col-span-7 flex flex-col h-full min-h-0 space-y-2">
          {/* Row 1: Search Bar (Exact 2nd picture style: Barcode, placeholder, dark ENTER button) */}
          <div className="shrink-0">
            <div className="relative flex items-center rounded-2xl border border-line/80 bg-[var(--c-surface-solid)] px-3.5 py-1.5 sm:py-2 shadow-xs focus-within:border-[#154a48] focus-within:ring-2 focus-within:ring-[#154a48]/10 transition-all">
              <span className="text-[#154a48] dark:text-emerald-400 mr-2.5 shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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
                placeholder="Scan barcode, short code"
                className="w-full min-w-0 bg-transparent text-xs sm:text-sm font-medium text-ink placeholder:text-muted/80 outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-muted hover:text-ink text-xs px-1.5"
                >
                  ✕
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (visibleItems.length > 0) {
                    addItem(visibleItems[0]);
                    setQuery('');
                  }
                }}
                className="rounded-xl bg-[#154a48] text-white px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wider shadow-xs hover:bg-[#0f3a38] active:scale-95 transition-all shrink-0 ml-1.5"
              >
                ENTER ⏎
              </button>
            </div>
          </div>

          {/* Row 2: Categories Pills (Compact horizontal scroll) */}
          <div className="shrink-0 hidden sm:flex items-center gap-1.5 relative">
            <button
              type="button"
              onClick={() => scrollCats('left')}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink shadow-xs"
              title="Scroll Left"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div
              ref={catScrollRef}
              className="no-scrollbar flex items-center gap-1.5 overflow-x-auto scroll-smooth flex-1 py-0.5"
            >
              <button
                type="button"
                onClick={() => setActiveCat('all')}
                className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-tight transition-all ${
                  activeCat === 'all'
                    ? 'bg-[#154a48] text-white shadow-xs'
                    : 'border border-line bg-[var(--c-surface-solid)] text-ink/80 hover:text-ink'
                }`}
              >
                <span>✨ All Items</span>
                <span className={`font-mono text-[9px] rounded-full px-1.5 py-0.2 ${activeCat === 'all' ? 'bg-white/20 text-white' : 'bg-soft text-muted'}`}>
                  {items.length}
                </span>
              </button>

              {cats.map((c) => {
                const catItemCount = items.filter((i) => i.category_id === c.id).length;
                const isActive = activeCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-tight transition-all ${
                      isActive
                        ? 'bg-[#154a48] text-white shadow-xs'
                        : 'border border-line bg-[var(--c-surface-solid)] text-ink/80 hover:text-ink'
                    }`}
                  >
                    <span>{categoryEmoji(c.name)}</span>
                    <span>{c.name}</span>
                    <span className={`font-mono text-[9px] rounded-full px-1.5 py-0.2 ${isActive ? 'bg-white/20 text-white' : 'bg-soft text-muted'}`}>
                      {catItemCount}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => scrollCats('right')}
              className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink shadow-xs"
              title="Scroll Right"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Row 3: Scrollable Items Container (2-Column Square Grid matching 2nd Reference Picture) */}
          <div className="pos-items-scroll flex-1 max-h-[290px] sm:max-h-[340px] lg:max-h-[calc(100vh-230px)] overflow-y-auto pr-1 pb-1">
            {visibleItems.length === 0 ? (
              <Empty title="No items found" sub="Try a different search term or category." />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-3">
                {visibleItems.map((item) => {
                  const inCart = cart.find((l) => l.item.id === item.id)?.qty ?? 0;
                  const catName = cats.find((c) => c.id === item.category_id)?.name ?? '';
                  const realImg = cdnUrl(item.image_url || categoryImage(catName));

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItem(item)}
                      className={`group relative flex flex-col items-center justify-between rounded-2xl border p-3 text-center transition-all duration-150 hover:shadow-md active:scale-[0.98] cursor-pointer bg-[var(--c-surface-solid)] ${
                        inCart > 0
                          ? 'border-[#154a48] ring-2 ring-[#154a48]/20 shadow-xs'
                          : 'border-line/70 hover:border-[#154a48]/40 shadow-2xs'
                      }`}
                    >
                      {/* Cart quantity badge */}
                      {inCart > 0 && (
                        <span className="absolute top-2 right-2 rounded-full bg-[#154a48] px-1.5 py-0.2 font-mono text-[9.5px] font-black text-white shadow-xs">
                          ×{inCart}
                        </span>
                      )}

                      {/* Center Icon/Image in rounded soft box */}
                      <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-[#faf5ec] dark:bg-amber-500/10 text-amber-900 dark:text-amber-400 flex items-center justify-center overflow-hidden mb-1.5 shadow-2xs shrink-0 border border-amber-900/5">
                        {item.image_url ? (
                          <img
                            src={realImg}
                            alt={item.name}
                            loading="lazy"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = categoryImage(catName);
                            }}
                            className="h-full w-full object-cover rounded-2xl transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <span className="text-xl sm:text-2xl">{categoryEmoji(catName)}</span>
                        )}
                      </div>

                      {/* Item Name (bold uppercase) */}
                      <p className="w-full truncate font-display text-[11px] sm:text-[12px] font-black uppercase tracking-tight text-ink" title={item.name}>
                        {item.name}
                      </p>

                      {/* Price (amber font) */}
                      <p className="font-mono text-[12px] sm:text-[13px] font-black text-[#b45309] dark:text-amber-500 mt-0.5">
                        {fmtPKR(item.price)}
                      </p>

                      {/* Stock / Subtitle */}
                      <p className="text-[9.5px] sm:text-[10px] font-bold text-muted/70 mt-0.5">
                        Stock: {(item as any).stock_quantity ?? (item as any).stock ?? 24}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column: CURRENT BILL (col-span-5, directly below on mobile, matching 2nd picture) ── */}
        <div id="pos-current-bill" className="lg:col-span-5 flex flex-col h-full min-h-0 w-full">
          <div className="flex flex-col h-full min-h-0 rounded-2xl border border-line bg-[var(--c-surface-solid)] p-3.5 sm:p-4 shadow-sm">
            {/* Bill Header */}
            <div className="shrink-0 flex items-center justify-between border-b border-line/60 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🛒</span>
                <h2 className="font-display text-xs sm:text-sm font-black italic tracking-tight text-[#154a48] dark:text-emerald-400 uppercase">
                  CURRENT BILL
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-line px-2 py-0.5 text-[10px] font-bold text-muted">
                  Items: {totalItemsCount}
                </span>
                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={clearCart}
                    className="text-[10.5px] text-muted hover:text-rose-600 transition-colors"
                    title="Clear cart"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="my-2 flex-1 min-h-[50px] max-h-[140px] lg:max-h-[220px] overflow-y-auto space-y-1.5 pr-1 pos-items-scroll">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-3 text-center">
                  <p className="text-xs font-semibold text-muted">Cart is empty.</p>
                  <p className="text-[10.5px] text-muted/70 mt-0.5">Scan items to start billing.</p>
                </div>
              ) : (
                cart.map((line) => {
                  return (
                    <div
                      key={line.item.id}
                      className="flex items-center justify-between gap-2 rounded-xl bg-soft/50 p-2 border border-line/50"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-ink uppercase tracking-tight">{line.item.name}</p>
                        <p className="font-mono text-[11px] font-bold text-[#b45309]">
                          {fmtPKR(Number(line.item.price) * line.qty)}
                        </p>
                      </div>

                      {/* Stepper − / + */}
                      <div className="flex items-center gap-1 rounded-lg bg-[var(--c-surface-solid)] border border-line p-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setQty(line.item.id, line.qty - 1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-ink hover:bg-soft"
                        >
                          −
                        </button>
                        <span className="min-w-4 text-center font-mono text-[11px] font-bold text-ink">
                          {line.qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(line.item.id, line.qty + 1)}
                          className="flex h-5 w-5 items-center justify-center rounded text-xs font-bold text-ink hover:bg-soft"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ── Bill Controls: Discount & Payment (Exact 2-column side-by-side like 2nd picture) ── */}
            <div className="shrink-0 space-y-2 border-t border-line/60 pt-2">
              {/* 2-column: OVERALL DISCOUNT (left) | PAYMENT MODE (right) */}
              <div className="grid grid-cols-2 gap-2">
                {/* Left: Overall Discount */}
                <div>
                  <label className="block text-[9.5px] uppercase font-bold tracking-wider text-muted mb-1">
                    OVERALL DISCOUNT
                  </label>
                  <div className="flex gap-1">
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setDiscountType(e.target.value as DiscountType);
                        if (e.target.value === 'none') setDiscountVal('');
                      }}
                      className="w-full rounded-xl border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-xs font-semibold text-ink outline-none"
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
                        placeholder={discountType === 'percent' ? '%' : 'Rs'}
                        className="w-16 rounded-xl border border-line bg-[var(--c-surface-solid)] px-1.5 py-1.5 text-xs font-bold text-ink outline-none"
                      />
                    )}
                  </div>
                </div>

                {/* Right: Payment Mode */}
                <div>
                  <label className="block text-[9.5px] uppercase font-bold tracking-wider text-muted mb-1">
                    PAYMENT MODE
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('cash')}
                      className={`rounded-xl py-1.5 px-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                        paymentMode === 'cash'
                          ? 'border-2 border-[#154a48] bg-[#f0f9f8] text-[#154a48] dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-300 font-black'
                          : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                      }`}
                    >
                      <span>💵</span>
                      <span>Cash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('online')}
                      className={`rounded-xl py-1.5 px-1 text-[11px] font-bold flex items-center justify-center gap-1 transition-all ${
                        paymentMode === 'online'
                          ? 'border-2 border-[#154a48] bg-[#f0f9f8] text-[#154a48] dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-emerald-300 font-black'
                          : 'border border-line bg-[var(--c-surface-solid)] text-muted hover:text-ink'
                      }`}
                    >
                      <span>💳</span>
                      <span>Online</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* CASH GIVEN Row (Exact 2nd picture style: 💵 CASH GIVEN on left, [ 0.00 ] on right) */}
              {paymentMode === 'cash' ? (
                <div className="rounded-xl border border-line bg-[#faf8f4] dark:bg-soft/40 px-3 py-1.5 sm:py-2 flex items-center justify-between">
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wide text-ink flex items-center gap-1.5">
                    <span>💵</span>
                    <span>CASH GIVEN</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={cashGiven}
                    onChange={(e) => setCashGiven(e.target.value)}
                    placeholder={netPayable > 0 ? String(netPayable) : '0.00'}
                    className="rounded-lg border border-line bg-[var(--c-surface-solid)] px-2.5 py-1 font-mono text-xs sm:text-sm font-black text-ink text-right w-24 sm:w-28 outline-none focus:border-[#154a48]"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-line bg-soft/40 p-2 space-y-1.5">
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
                        className={`rounded-lg py-1 text-[10.5px] font-bold transition-all ${
                          onlineMethod === m.id
                            ? 'bg-[#154a48] text-white font-black'
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
                    placeholder="Transaction Ref (optional)"
                    className="w-full rounded-lg border border-line bg-[var(--c-surface-solid)] px-2 py-1 text-xs text-ink outline-none"
                  />
                </div>
              )}

              {/* Totals Row: SUBTOTAL on left, NET PAYABLE on right (Exact 2nd picture layout) */}
              <div className="flex items-center justify-between pt-2 border-t border-dashed border-line">
                <div>
                  <span className="block text-[9.5px] uppercase font-bold tracking-wider text-muted">
                    SUBTOTAL: RS {subtotal}
                  </span>
                  {paymentMode === 'cash' && (
                    <span className="block text-[11px] font-bold text-muted mt-0.5">
                      Change: Rs {isCashShort ? 0 : change}
                    </span>
                  )}
                </div>

                <div className="text-right">
                  <span className="block text-[9.5px] uppercase font-bold tracking-wider text-muted">
                    NET PAYABLE
                  </span>
                  <span className="font-display font-black text-xl sm:text-2xl text-[#154a48] dark:text-emerald-400 italic block leading-tight">
                    RS {netPayable}
                  </span>
                </div>
              </div>

              {/* Error warning */}
              {error && (
                <p className="rounded-xl bg-danger/10 p-2 text-xs font-bold text-danger">
                  {error}
                </p>
              )}

              {/* Charge Button (Warm dusty terracotta/peach #c89280 from 2nd picture) */}
              <button
                type="button"
                onClick={handleCharge}
                disabled={placing || cart.length === 0}
                className="w-full rounded-xl sm:rounded-2xl bg-[#c89280] hover:bg-[#b8806e] text-white py-3 text-center text-sm font-black shadow-md flex items-center justify-center gap-2 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Charge Rs {netPayable}</span>
                <span>➔</span>
              </button>
            </div>
          </div>
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
