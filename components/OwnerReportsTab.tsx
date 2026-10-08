'use client';

// Owner "Reports" tab: Comprehensive operational & financial reports hub
// Features: Date-grouped sheets (Today, Yesterday, etc.), in-place row item expansion,
// zebra-striped rows, column-by-column sorting, search/filters, and Download Report (Excel/CSV + Executive PDF).

import React, { useState, useMemo, Fragment } from 'react';
import type { Order, OrderItem } from '@/lib/types';
import type { DiningTable, Profile, MenuCategory, MenuItem } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { exportAsCsv, printExecutivePdf } from '@/lib/report-export';
import { Card } from './ui';

export type ReportSubTab = 'orders' | 'dishes' | 'revenue';

interface OwnerReportsTabProps {
  orders: Order[];
  items: OrderItem[];
  tables: DiningTable[];
  staff: Profile[];
  categories: MenuCategory[];
  menu: MenuItem[];
  rangeLabel: string;
  restaurantName?: string;
  logoUrl?: string;
  activeSubTab?: ReportSubTab;
  onSubTabChange?: (tab: ReportSubTab) => void;
}

type OrderSortField = 'number' | 'time' | 'table' | 'staff' | 'status' | 'payment' | 'amount';
type DishSortField = 'rank' | 'name' | 'category' | 'qty' | 'price' | 'revenue' | 'share';
type RevenueSortField = 'date' | 'orders' | 'gross' | 'net' | 'lost' | 'cash' | 'card' | 'aov';

export default function OwnerReportsTab({
  orders,
  items,
  tables,
  staff,
  categories,
  menu,
  rangeLabel,
  restaurantName = 'Spice Villa',
  logoUrl = '',
  activeSubTab = 'orders',
  onSubTabChange,
}: OwnerReportsTabProps) {
  const [currentTab, setCurrentTab] = useState<ReportSubTab>(activeSubTab);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  // Sync state if external activeSubTab changes
  const tab = onSubTabChange ? activeSubTab : currentTab;
  const setTab = (t: ReportSubTab) => {
    setCurrentTab(t);
    onSubTabChange?.(t);
  };

  // Helper maps for quick lookups
  const tableMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const tbl of tables) m.set(tbl.id, tbl.table_number);
    return m;
  }, [tables]);

  const staffMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of staff) m.set(s.id, s.name);
    return m;
  }, [staff]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);

  const itemToCatMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const mi of menu) m.set(mi.id, mi.category_id);
    return m;
  }, [menu]);

  const itemsByOrder = useMemo(() => {
    const m = new Map<string, OrderItem[]>();
    for (const it of items) {
      const list = m.get(it.order_id) ?? [];
      list.push(it);
      m.set(it.order_id, list);
    }
    return m;
  }, [items]);

  /* ─────────────────────────────────────────────────────────────
     SUB-TAB 1: RECENT ORDERS (Date Sheets, Column Sort, Row Expand)
  ───────────────────────────────────────────────────────────── */
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | 'completed' | 'active' | 'cancelled'>('all');
  const [orderPaymentFilter, setOrderPaymentFilter] = useState<string>('all');
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Column-level sorting
  const [orderSortField, setOrderSortField] = useState<OrderSortField>('time');
  const [orderSortAsc, setOrderSortAsc] = useState<boolean>(false);

  const toggleOrderSort = (field: OrderSortField) => {
    if (orderSortField === field) {
      setOrderSortAsc(!orderSortAsc);
    } else {
      setOrderSortField(field);
      setOrderSortAsc(false);
    }
  };

  const toggleExpandOrder = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter and sort all orders
  const sortedFilteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (orderStatusFilter === 'completed' && o.status !== 'completed') return false;
        if (orderStatusFilter === 'cancelled' && o.status !== 'cancelled') return false;
        if (orderStatusFilter === 'active' && (o.status === 'completed' || o.status === 'cancelled')) return false;

        if (orderPaymentFilter !== 'all') {
          const pay = (o.payment_method ?? 'cash').toLowerCase();
          if (pay !== orderPaymentFilter) return false;
        }

        if (orderSearch.trim()) {
          const q = orderSearch.toLowerCase();
          const numStr = `#${o.order_number}`;
          const tblNum = o.table_id ? `table ${tableMap.get(o.table_id)}` : 'takeaway';
          const staffName = (o.waiter_id ? staffMap.get(o.waiter_id) : '')?.toLowerCase() ?? '';
          const orderItems = itemsByOrder.get(o.id) ?? [];
          const hasItemMatch = orderItems.some((it) => it.item_name.toLowerCase().includes(q));

          return (
            numStr.includes(q) ||
            tblNum.includes(q) ||
            staffName.includes(q) ||
            (o.customer_name?.toLowerCase().includes(q) ?? false) ||
            hasItemMatch
          );
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (orderSortField === 'number') cmp = a.order_number - b.order_number;
        else if (orderSortField === 'time') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        else if (orderSortField === 'amount') cmp = Number(a.total_amount) - Number(b.total_amount);
        else if (orderSortField === 'status') cmp = a.status.localeCompare(b.status);
        else if (orderSortField === 'payment') cmp = (a.payment_method ?? '').localeCompare(b.payment_method ?? '');
        else if (orderSortField === 'staff') {
          const sA = (a.waiter_id && staffMap.get(a.waiter_id)) || '';
          const sB = (b.waiter_id && staffMap.get(b.waiter_id)) || '';
          cmp = sA.localeCompare(sB);
        } else if (orderSortField === 'table') {
          const tA = (a.table_id && tableMap.get(a.table_id)) || 0;
          const tB = (b.table_id && tableMap.get(b.table_id)) || 0;
          cmp = tA - tB;
        }
        return orderSortAsc ? cmp : -cmp;
      });
  }, [orders, orderStatusFilter, orderPaymentFilter, orderSearch, orderSortField, orderSortAsc, tableMap, staffMap, itemsByOrder]);

  // Group sorted orders into date sheets: Today, Yesterday, then date by date
  const dateSheets = useMemo(() => {
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA');
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toLocaleDateString('en-CA');

    const groupsMap = new Map<
      string,
      {
        key: string;
        label: string;
        badge: string;
        date: string;
        orders: Order[];
        totalAmount: number;
        completedCount: number;
      }
    >();

    for (const o of sortedFilteredOrders) {
      const d = new Date(o.created_at);
      const dateKey = d.toLocaleDateString('en-CA');

      let label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      if (dateKey === todayStr) {
        label = `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      } else if (dateKey === yestStr) {
        label = `Yesterday, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }

      const existing = groupsMap.get(dateKey) ?? {
        key: dateKey,
        label,
        badge: '',
        date: dateKey,
        orders: [],
        totalAmount: 0,
        completedCount: 0,
      };

      existing.orders.push(o);
      existing.totalAmount += Number(o.total_amount) || 0;
      if (o.status === 'completed') existing.completedCount += 1;
      groupsMap.set(dateKey, existing);
    }

    return Array.from(groupsMap.values());
  }, [sortedFilteredOrders]);

  const ordersTotalRevenue = useMemo(
    () => sortedFilteredOrders.filter((o) => o.status === 'completed').reduce((s, o) => s + Number(o.total_amount), 0),
    [sortedFilteredOrders]
  );

  /* ─────────────────────────────────────────────────────────────
     SUB-TAB 2: DISHES SOLD (Column Sort)
  ───────────────────────────────────────────────────────────── */
  const [dishSearch, setDishSearch] = useState('');
  const [dishCategoryFilter, setDishCategoryFilter] = useState('all');
  const [dishSortField, setDishSortField] = useState<DishSortField>('qty');
  const [dishSortAsc, setDishSortAsc] = useState<boolean>(false);

  const toggleDishSort = (field: DishSortField) => {
    if (dishSortField === field) setDishSortAsc(!dishSortAsc);
    else {
      setDishSortField(field);
      setDishSortAsc(false);
    }
  };

  const dishSales = useMemo(() => {
    const completedOrderIds = new Set(orders.filter((o) => o.status === 'completed').map((o) => o.id));
    const map = new Map<string, { id: string; name: string; categoryId: string; qty: number; revenue: number; price: number }>();

    for (const it of items) {
      if (!completedOrderIds.has(it.order_id)) continue;
      const catId = (it.menu_item_id && itemToCatMap.get(it.menu_item_id)) || 'other';
      const existing = map.get(it.item_name) ?? {
        id: it.menu_item_id ?? it.item_name,
        name: it.item_name,
        categoryId: catId,
        qty: 0,
        revenue: 0,
        price: Number(it.unit_price) || 0,
      };
      existing.qty += it.quantity;
      existing.revenue += it.quantity * Number(it.unit_price);
      map.set(it.item_name, existing);
    }

    return Array.from(map.values());
  }, [items, orders, itemToCatMap]);

  const totalFoodRevenue = useMemo(() => dishSales.reduce((s, d) => s + d.revenue, 0) || 1, [dishSales]);
  const totalUnitsSold = useMemo(() => dishSales.reduce((s, d) => s + d.qty, 0), [dishSales]);

  const sortedFilteredDishes = useMemo(() => {
    return dishSales
      .filter((d) => {
        if (dishCategoryFilter !== 'all' && d.categoryId !== dishCategoryFilter) return false;
        if (dishSearch.trim() && !d.name.toLowerCase().includes(dishSearch.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (dishSortField === 'name') cmp = a.name.localeCompare(b.name);
        else if (dishSortField === 'category') {
          const cA = categoryMap.get(a.categoryId) ?? '';
          const cB = categoryMap.get(b.categoryId) ?? '';
          cmp = cA.localeCompare(cB);
        } else if (dishSortField === 'qty') cmp = a.qty - b.qty;
        else if (dishSortField === 'price') cmp = a.price - b.price;
        else if (dishSortField === 'revenue' || dishSortField === 'share') cmp = a.revenue - b.revenue;
        return dishSortAsc ? cmp : -cmp;
      });
  }, [dishSales, dishCategoryFilter, dishSearch, dishSortField, dishSortAsc, categoryMap]);

  /* ─────────────────────────────────────────────────────────────
     SUB-TAB 3: REVENUE RECORD (Column Sort)
  ───────────────────────────────────────────────────────────── */
  const [revenueSortField, setRevenueSortField] = useState<RevenueSortField>('date');
  const [revenueSortAsc, setRevenueSortAsc] = useState<boolean>(false);

  const toggleRevenueSort = (field: RevenueSortField) => {
    if (revenueSortField === field) setRevenueSortAsc(!revenueSortAsc);
    else {
      setRevenueSortField(field);
      setRevenueSortAsc(false);
    }
  };

  const revenueRecords = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        displayDate: string;
        completedOrders: number;
        cancelledOrders: number;
        grossRevenue: number;
        netRevenue: number;
        lostSales: number;
        cashRevenue: number;
        cardRevenue: number;
      }
    >();

    for (const o of orders) {
      const d = new Date(o.created_at);
      const dateKey = d.toLocaleDateString('en-CA');
      const displayDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

      const entry = map.get(dateKey) ?? {
        date: dateKey,
        displayDate,
        completedOrders: 0,
        cancelledOrders: 0,
        grossRevenue: 0,
        netRevenue: 0,
        lostSales: 0,
        cashRevenue: 0,
        cardRevenue: 0,
      };

      const amt = Number(o.total_amount) || 0;
      entry.grossRevenue += amt;

      if (o.status === 'completed') {
        entry.completedOrders += 1;
        entry.netRevenue += amt;
        const pay = (o.payment_method ?? 'cash').toLowerCase();
        if (pay === 'cash') entry.cashRevenue += amt;
        else entry.cardRevenue += amt;
      } else if (o.status === 'cancelled') {
        entry.cancelledOrders += 1;
        entry.lostSales += amt;
      }

      map.set(dateKey, entry);
    }

    return Array.from(map.values()).sort((a, b) => {
      let cmp = 0;
      if (revenueSortField === 'date') cmp = a.date.localeCompare(b.date);
      else if (revenueSortField === 'orders') cmp = a.completedOrders - b.completedOrders;
      else if (revenueSortField === 'gross') cmp = a.grossRevenue - b.grossRevenue;
      else if (revenueSortField === 'net') cmp = a.netRevenue - b.netRevenue;
      else if (revenueSortField === 'lost') cmp = a.lostSales - b.lostSales;
      else if (revenueSortField === 'cash') cmp = a.cashRevenue - b.cashRevenue;
      else if (revenueSortField === 'card') cmp = a.cardRevenue - b.cardRevenue;
      else if (revenueSortField === 'aov') {
        const aovA = a.completedOrders > 0 ? a.netRevenue / a.completedOrders : 0;
        const aovB = b.completedOrders > 0 ? b.netRevenue / b.completedOrders : 0;
        cmp = aovA - aovB;
      }
      return revenueSortAsc ? cmp : -cmp;
    });
  }, [orders, revenueSortField, revenueSortAsc]);

  const totalLedgerNet = useMemo(() => revenueRecords.reduce((s, r) => s + r.netRevenue, 0), [revenueRecords]);
  const totalLedgerGross = useMemo(() => revenueRecords.reduce((s, r) => s + r.grossRevenue, 0), [revenueRecords]);
  const totalLedgerLost = useMemo(() => revenueRecords.reduce((s, r) => s + r.lostSales, 0), [revenueRecords]);
  const totalLedgerCompletedOrders = useMemo(() => revenueRecords.reduce((s, r) => s + r.completedOrders, 0), [revenueRecords]);

  /* ─────────────────────────────────────────────────────────────
     DOWNLOAD EXPORT ACTIONS (Excel CSV vs Executive PDF)
  ───────────────────────────────────────────────────────────── */
  const handleDownloadExcel = () => {
    setDownloadMenuOpen(false);
    if (tab === 'orders') {
      const header = ['Order #', 'Date & Time', 'Status', 'Table', 'Channel', 'Staff', 'Payment', 'Amount (PKR)'];
      const rows = sortedFilteredOrders.map((o) => {
        const tbl = o.table_id ? `Table ${tableMap.get(o.table_id) ?? '?'}` : 'Direct';
        const waiter = o.waiter_id ? staffMap.get(o.waiter_id) ?? 'Staff' : 'Counter';
        return [
          `#${o.order_number}`,
          new Date(o.created_at).toLocaleString('en-PK'),
          o.status,
          tbl,
          o.order_type,
          waiter,
          o.payment_method ?? 'Cash',
          o.total_amount,
        ];
      });
      exportAsCsv(`orders_report_${rangeLabel}.csv`, header, rows);
    } else if (tab === 'dishes') {
      const header = ['Dish Name', 'Category', 'Units Sold', 'Unit Price (PKR)', 'Total Revenue (PKR)', 'Sales Contribution %'];
      const rows = sortedFilteredDishes.map((d) => {
        const catName = categoryMap.get(d.categoryId) ?? 'General';
        const share = ((d.revenue / totalFoodRevenue) * 100).toFixed(1) + '%';
        return [d.name, catName, d.qty, d.price, d.revenue, share];
      });
      exportAsCsv(`dishes_sold_report_${rangeLabel}.csv`, header, rows);
    } else {
      const header = ['Date', 'Completed Orders', 'Gross Billed (PKR)', 'Net Collected (PKR)', 'Lost / Voids (PKR)', 'Cash (PKR)', 'Card (PKR)', 'Avg Ticket (PKR)'];
      const rows = revenueRecords.map((r) => {
        const aov = r.completedOrders > 0 ? Math.round(r.netRevenue / r.completedOrders) : 0;
        return [r.displayDate, r.completedOrders, r.grossRevenue, r.netRevenue, r.lostSales, r.cashRevenue, r.cardRevenue, aov];
      });
      exportAsCsv(`revenue_ledger_${rangeLabel}.csv`, header, rows);
    }
  };

  const handleDownloadPdf = () => {
    setDownloadMenuOpen(false);
    if (tab === 'orders') {
      const headers = ['Order #', 'Time / Date', 'Table', 'Staff', 'Status', 'Payment', 'Amount'];
      const rows = sortedFilteredOrders.map((o) => {
        const tbl = o.table_id ? `Table ${tableMap.get(o.table_id) ?? '?'}` : o.order_type;
        const waiter = o.waiter_id ? staffMap.get(o.waiter_id) ?? 'Staff' : 'Counter';
        return [
          `#${o.order_number}`,
          new Date(o.created_at).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }),
          tbl,
          waiter,
          o.status.toUpperCase(),
          o.payment_method ?? 'Cash',
          fmtPKR(Number(o.total_amount)),
        ];
      });
      printExecutivePdf({
        title: 'Recent Orders Audit Report',
        restaurantName,
        logoUrl,
        dateRange: rangeLabel,
        kpis: [
          { label: 'Total Orders', value: fmtNum(sortedFilteredOrders.length) },
          { label: 'Completed Volume', value: fmtPKR(ordersTotalRevenue) },
          { label: 'Cancelled Orders', value: fmtNum(sortedFilteredOrders.filter((o) => o.status === 'cancelled').length) },
          { label: 'Average Ticket', value: sortedFilteredOrders.length > 0 ? fmtPKR(ordersTotalRevenue / sortedFilteredOrders.length) : 'Rs 0' },
        ],
        headers,
        rows,
      });
    } else if (tab === 'dishes') {
      const headers = ['Rank', 'Dish Name', 'Category', 'Units Sold', 'Price', 'Gross Sales', 'Share %'];
      const rows = sortedFilteredDishes.map((d, idx) => {
        const catName = categoryMap.get(d.categoryId) ?? 'General';
        const share = ((d.revenue / totalFoodRevenue) * 100).toFixed(1) + '%';
        return [`#${idx + 1}`, d.name, catName, fmtNum(d.qty), fmtPKR(d.price), fmtPKR(d.revenue), share];
      });
      printExecutivePdf({
        title: 'Dishes Sold & Kitchen Output Report',
        restaurantName,
        logoUrl,
        dateRange: rangeLabel,
        kpis: [
          { label: 'Units Sold', value: fmtNum(totalUnitsSold) },
          { label: 'Food Revenue', value: fmtPKR(totalFoodRevenue) },
          { label: 'Active Dishes', value: fmtNum(dishSales.length) },
          { label: 'Top Item', value: dishSales[0]?.name || 'N/A' },
        ],
        headers,
        rows,
      });
    } else {
      const headers = ['Date / Period', 'Orders', 'Gross Billed', 'Net Collected', 'Lost / Voids', 'Cash Share', 'Card / Digital', 'Avg Ticket'];
      const rows = revenueRecords.map((r) => {
        const aov = r.completedOrders > 0 ? Math.round(r.netRevenue / r.completedOrders) : 0;
        return [
          r.displayDate,
          r.completedOrders,
          fmtPKR(r.grossRevenue),
          fmtPKR(r.netRevenue),
          r.lostSales > 0 ? fmtPKR(r.lostSales) : 'Rs 0',
          fmtPKR(r.cashRevenue),
          fmtPKR(r.cardRevenue),
          fmtPKR(aov),
        ];
      });
      printExecutivePdf({
        title: 'Executive Financial & Revenue Ledger',
        restaurantName,
        logoUrl,
        dateRange: rangeLabel,
        kpis: [
          { label: 'Net Collected', value: fmtPKR(totalLedgerNet) },
          { label: 'Gross Billed', value: fmtPKR(totalLedgerGross) },
          { label: 'Lost to Cancellations', value: fmtPKR(totalLedgerLost) },
          { label: 'Completed Orders', value: fmtNum(totalLedgerCompletedOrders) },
        ],
        headers,
        rows,
      });
    }
  };

  const renderSortIndicator = (field: string, currentField: string, isAsc: boolean) => {
    if (field !== currentField) {
      return <span className="opacity-30 ml-1 text-[10px]">⇅</span>;
    }
    return <span className="text-brand font-black ml-1 text-[11px]">{isAsc ? '▲' : '▼'}</span>;
  };

  return (
    <div className="space-y-4 -mt-2 sm:-mt-3">
      {/* ── 1. Compact Header Bar (Eliminated Extra Empty Space) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-line pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </span>
            <h1 className="font-display text-lg sm:text-xl font-black text-ink">
              Detailed Reports & Intelligence
            </h1>
          </div>
          <p className="text-[12px] font-medium text-muted mt-0.5">
            Audited records for <span className="font-bold text-ink">{rangeLabel}</span> &middot; {orders.length} total orders
          </p>
        </div>

        {/* Global Download Dropdown (PDF & Excel/CSV Options) */}
        <div className="relative">
          <button
            onClick={() => setDownloadMenuOpen(!downloadMenuOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-[var(--c-surface-solid)] px-4 py-2 text-[13px] font-black text-ink shadow-sm hover:border-brand/50 hover:text-brand transition-all active:scale-95"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Download Report</span>
            <span className="text-[10px] text-muted">▼</span>
          </button>

          {downloadMenuOpen && (
            <div className="absolute right-0 top-full mt-1.5 z-40 w-56 rounded-2xl border border-line bg-[var(--c-surface-solid)] p-2 shadow-xl backdrop-blur-xl animate-in zoom-in-95 fade-in duration-150">
              <button
                onClick={handleDownloadPdf}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-ink hover:bg-brand hover:text-white transition-colors group"
              >
                <span className="text-base">📄</span>
                <div>
                  <p className="leading-tight">Download PDF (Print)</p>
                  <p className="text-[10.5px] opacity-75 group-hover:text-white">With logo & company details</p>
                </div>
              </button>

              <button
                onClick={handleDownloadExcel}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-bold text-ink hover:bg-brand hover:text-white transition-colors group"
              >
                <span className="text-base">📊</span>
                <div>
                  <p className="leading-tight">Download Excel / CSV</p>
                  <p className="text-[10.5px] opacity-75 group-hover:text-white">Standard spreadsheet data</p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── 2. Segmented Report Type Tabs ── */}
      <div className="flex items-center gap-2 border-b border-line/60 pb-1 overflow-x-auto no-scrollbar">
        {[
          { key: 'orders' as const, label: 'Recent Orders', icon: '📋', count: orders.length },
          { key: 'dishes' as const, label: 'Dishes Sold', icon: '🍲', count: totalUnitsSold },
          { key: 'revenue' as const, label: 'Revenue Record', icon: '📈', count: fmtPKR(totalLedgerNet) },
        ].map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2.5 rounded-[14px] px-4 py-2 text-[13px] font-black transition-all ${
                active
                  ? 'bg-brand text-white shadow-lift ring-1 ring-brand/40'
                  : 'text-muted hover:text-ink hover:bg-soft'
              }`}
            >
              <span className="text-[13px]">{t.icon}</span>
              <span>{t.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                  active ? 'bg-white/20 text-white' : 'bg-soft text-muted'
                }`}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          VIEW 1: RECENT ORDERS (Date Sheets + Row Expansion + Zebra)
      ───────────────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <div className="space-y-4">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Filtered Orders</p>
              <p className="mt-1 font-mono text-xl font-black text-ink">{fmtNum(sortedFilteredOrders.length)}</p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Completed Volume</p>
              <p className="mt-1 font-mono text-xl font-black text-emerald-600">
                {fmtPKR(ordersTotalRevenue)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Completed Rate</p>
              <p className="mt-1 font-mono text-xl font-black text-brand">
                {sortedFilteredOrders.length > 0
                  ? ((sortedFilteredOrders.filter((o) => o.status === 'completed').length / sortedFilteredOrders.length) * 100).toFixed(0) + '%'
                  : '100%'}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Cancellations</p>
              <p className="mt-1 font-mono text-xl font-black text-rose-600">
                {fmtNum(sortedFilteredOrders.filter((o) => o.status === 'cancelled').length)}
              </p>
            </div>
          </div>

          {/* Filters & Search Toolbar */}
          <Card className="p-3.5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[13px]">🔍</span>
                <input
                  type="text"
                  placeholder="Search order #, table, staff, dish..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full rounded-xl border border-line bg-soft/50 pl-10 pr-4 py-2 text-[12.5px] font-bold text-ink outline-none focus:border-brand transition-colors"
                />
                {orderSearch && (
                  <button
                    onClick={() => setOrderSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink text-xs font-black"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-[12px]">
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value as any)}
                  className="rounded-xl border border-line bg-[var(--c-surface-solid)] px-3 py-2 font-bold text-ink outline-none focus:border-brand"
                >
                  <option value="all">All Statuses</option>
                  <option value="completed">Completed Only</option>
                  <option value="active">Active (Kitchen/Prep)</option>
                  <option value="cancelled">Cancelled Only</option>
                </select>

                <select
                  value={orderPaymentFilter}
                  onChange={(e) => setOrderPaymentFilter(e.target.value)}
                  className="rounded-xl border border-line bg-[var(--c-surface-solid)] px-3 py-2 font-bold text-ink outline-none focus:border-brand"
                >
                  <option value="all">All Payments</option>
                  <option value="cash">💵 Cash</option>
                  <option value="card">💳 Card</option>
                  <option value="jazzcash">📱 JazzCash</option>
                  <option value="easypaisa">📲 EasyPaisa</option>
                </select>
              </div>
            </div>
          </Card>

          {/* DATE-WISE SHEETS */}
          {dateSheets.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-4xl">🧾</p>
              <h3 className="mt-3 font-display text-base font-black text-ink">No orders found</h3>
              <p className="mt-1 text-sm text-muted">Try adjusting your search criteria or date filter</p>
            </Card>
          ) : (
            <div className="space-y-5">
              {dateSheets.map((sheet) => (
                <Card key={sheet.key} className="overflow-hidden p-0 border border-line/80 shadow-sm">
                  {/* Sheet Header */}
                  <div className="flex flex-wrap items-center justify-between border-b border-line bg-soft/50 px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] text-muted">📅</span>
                      <h3 className="font-display text-[14.5px] font-black text-ink">
                        {sheet.label}
                      </h3>
                    </div>
                    <div className="flex items-center gap-3 text-[12px] font-bold text-muted">
                      <span>{sheet.orders.length} orders</span>
                      <span>&middot;</span>
                      <span className="font-mono text-ink font-black">{fmtPKR(sheet.totalAmount)} volume</span>
                    </div>
                  </div>

                  {/* Orders Table with Column Sort & Zebra Striping */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[13px]">
                      <thead className="border-b border-line bg-soft/40 text-[11px] font-black uppercase tracking-wider text-muted">
                        <tr>
                          <th
                            onClick={() => toggleOrderSort('number')}
                            className="px-5 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Order {renderSortIndicator('number', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('time')}
                            className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Time {renderSortIndicator('time', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('table')}
                            className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Table / Channel {renderSortIndicator('table', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('staff')}
                            className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Staff {renderSortIndicator('staff', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('status')}
                            className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Status {renderSortIndicator('status', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('payment')}
                            className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                          >
                            Payment {renderSortIndicator('payment', orderSortField, orderSortAsc)}
                          </th>
                          <th
                            onClick={() => toggleOrderSort('amount')}
                            className="px-5 py-3 text-right cursor-pointer select-none hover:text-brand"
                          >
                            Total Amount {renderSortIndicator('amount', orderSortField, orderSortAsc)}
                          </th>
                          <th className="px-4 py-3 text-center">Items</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.orders.map((o, idx) => {
                          const isExpanded = expandedOrderIds.has(o.id);
                          const orderItems = itemsByOrder.get(o.id) ?? [];
                          const tbl = o.table_id
                            ? `Table ${tableMap.get(o.table_id) ?? '?'}`
                            : o.order_type === 'takeaway'
                            ? 'Takeaway'
                            : 'Delivery';
                          const waiterName = o.waiter_id ? staffMap.get(o.waiter_id) ?? 'Staff' : 'Self/Counter';

                          const statusColor =
                            o.status === 'completed'
                              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                              : o.status === 'cancelled'
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

                          // Ultra subtle alternating row tint (not dark grey, just barely distinct)
                          const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-500/[0.025] dark:bg-white/[0.02]';

                          return (
                            <Fragment key={o.id}>
                              <tr
                                onClick={() => toggleExpandOrder(o.id)}
                                className={`cursor-pointer transition-colors border-b border-line/50 hover:bg-brand/5 ${rowBg}`}
                              >
                                <td className="px-5 py-3.5 font-mono font-black text-ink">
                                  #{o.order_number}
                                </td>
                                <td className="px-4 py-3.5 font-medium text-muted whitespace-nowrap">
                                  {new Date(o.created_at).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="px-4 py-3.5 font-bold text-ink whitespace-nowrap">
                                  {tbl}
                                </td>
                                <td className="px-4 py-3.5 font-medium text-muted">
                                  {waiterName}
                                </td>
                                <td className="px-4 py-3.5">
                                  <span
                                    className={`inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-black uppercase ${statusColor}`}
                                  >
                                    {o.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3.5 font-medium text-muted capitalize">
                                  {o.payment_method ?? 'Cash'}
                                </td>
                                <td className="px-5 py-3.5 text-right font-mono font-black text-ink whitespace-nowrap">
                                  {fmtPKR(Number(o.total_amount))}
                                </td>
                                <td className="px-4 py-3.5 text-center">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleExpandOrder(o.id);
                                    }}
                                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition-all ${
                                      isExpanded
                                        ? 'bg-brand text-white border-brand'
                                        : 'bg-[var(--c-surface-solid)] border-line text-brand hover:bg-brand hover:text-white'
                                    }`}
                                  >
                                    {isExpanded ? 'Hide ▲' : `${orderItems.length} items ▾`}
                                  </button>
                                </td>
                              </tr>

                              {/* IN-PLACE ACCORDION EXPANSION ROW DIRECTLY UNDER THE CURRENT ORDER */}
                              {isExpanded && (
                                <tr className="bg-brand/5 border-b border-brand/20">
                                  <td colSpan={8} className="p-4 sm:p-5">
                                    <div className="rounded-2xl border border-brand/25 bg-[var(--c-surface-solid)] p-4 shadow-sm animate-in fade-in duration-150">
                                      <div className="flex items-center justify-between pb-3 border-b border-line">
                                        <div className="flex items-center gap-2">
                                          <span className="text-base">🍲</span>
                                          <p className="font-display text-[13.5px] font-black text-ink">
                                            Order #{o.order_number} Items Breakdown ({orderItems.length} items)
                                          </p>
                                        </div>
                                        <span className="font-mono text-[12px] font-bold text-muted">
                                          Total: {fmtPKR(Number(o.total_amount))}
                                        </span>
                                      </div>

                                      {orderItems.length === 0 ? (
                                        <p className="py-3 text-center text-xs font-bold text-muted">
                                          No item records attached to this order.
                                        </p>
                                      ) : (
                                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                          {orderItems.map((it, itemIdx) => (
                                            <div
                                              key={itemIdx}
                                              className="flex items-center justify-between rounded-xl bg-soft/50 p-2.5 border border-line text-xs"
                                            >
                                              <div>
                                                <p className="font-black text-ink text-[12.5px]">{it.item_name}</p>
                                                <p className="font-medium text-muted mt-0.5">
                                                  Qty: <span className="font-bold text-ink">{it.quantity}</span> &times; {fmtPKR(Number(it.unit_price))}
                                                </p>
                                              </div>
                                              <span className="font-mono font-black text-ink text-[12.5px]">
                                                {fmtPKR(it.quantity * Number(it.unit_price))}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 2: DISHES SOLD (Column Sort & Zebra Striping)
      ───────────────────────────────────────────────────────────── */}
      {tab === 'dishes' && (
        <div className="space-y-4">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Total Units Sold</p>
              <p className="mt-1 font-mono text-xl font-black text-teal">
                {fmtNum(totalUnitsSold)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Food Revenue</p>
              <p className="mt-1 font-mono text-xl font-black text-emerald-600">
                {fmtPKR(totalFoodRevenue)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Active Menu Dishes</p>
              <p className="mt-1 font-mono text-xl font-black text-ink">
                {fmtNum(dishSales.length)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Top Performer</p>
              <p className="mt-1 font-display text-[14px] font-black text-brand truncate">
                {dishSales[0]?.name ?? 'N/A'}
              </p>
            </div>
          </div>

          {/* Filters Toolbar */}
          <Card className="p-3.5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 min-w-[220px]">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-[13px]">🔍</span>
                <input
                  type="text"
                  placeholder="Search dish by name..."
                  value={dishSearch}
                  onChange={(e) => setDishSearch(e.target.value)}
                  className="w-full rounded-xl border border-line bg-soft/50 pl-10 pr-4 py-2 text-[12.5px] font-bold text-ink outline-none focus:border-brand transition-colors"
                />
              </div>

              <div className="flex items-center gap-2 text-[12px]">
                <select
                  value={dishCategoryFilter}
                  onChange={(e) => setDishCategoryFilter(e.target.value)}
                  className="rounded-xl border border-line bg-[var(--c-surface-solid)] px-3 py-2 font-bold text-ink outline-none focus:border-brand"
                >
                  <option value="all">All Categories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Dishes Table with Column Sort & Zebra Striping */}
          <Card className="overflow-hidden p-0 border border-line/80 shadow-sm">
            {sortedFilteredDishes.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl">🍲</p>
                <h3 className="mt-3 font-display text-base font-black text-ink">No dish sales found</h3>
                <p className="mt-1 text-sm text-muted">No completed orders containing these items in the selected timeframe</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-line bg-soft/50 text-[11px] font-black uppercase tracking-wider text-muted">
                    <tr>
                      <th
                        onClick={() => toggleDishSort('rank')}
                        className="px-5 py-3 cursor-pointer select-none hover:text-brand"
                      >
                        # Rank {renderSortIndicator('rank', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('name')}
                        className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                      >
                        Dish Item {renderSortIndicator('name', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('category')}
                        className="px-4 py-3 cursor-pointer select-none hover:text-brand"
                      >
                        Category {renderSortIndicator('category', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('qty')}
                        className="px-4 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Units Sold {renderSortIndicator('qty', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('price')}
                        className="px-4 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Unit Price {renderSortIndicator('price', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('revenue')}
                        className="px-5 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Gross Sales {renderSortIndicator('revenue', dishSortField, dishSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleDishSort('share')}
                        className="px-5 py-3 cursor-pointer select-none hover:text-brand"
                      >
                        Share % {renderSortIndicator('share', dishSortField, dishSortAsc)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedFilteredDishes.map((d, index) => {
                      const sharePercent = ((d.revenue / totalFoodRevenue) * 100).toFixed(1);
                      const catName = categoryMap.get(d.categoryId) ?? 'General';
                      const rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-500/[0.025] dark:bg-white/[0.02]';

                      return (
                        <tr key={d.name} className={`border-b border-line/50 hover:bg-brand/5 transition-colors ${rowBg}`}>
                          <td className="px-5 py-3 font-mono font-bold text-muted">
                            #{index + 1}
                          </td>
                          <td className="px-4 py-3 font-bold text-ink">
                            {d.name}
                          </td>
                          <td className="px-4 py-3">
                            <span className="rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">
                              {catName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-black text-teal">
                            {fmtNum(d.qty)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-muted">
                            {fmtPKR(d.price)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-black text-ink">
                            {fmtPKR(d.revenue)}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 rounded-full bg-soft overflow-hidden min-w-[50px]">
                                <div
                                  className="h-full rounded-full bg-brand"
                                  style={{ width: `${Math.min(100, Math.max(4, Number(sharePercent)))}%` }}
                                />
                              </div>
                              <span className="font-mono text-[11.5px] font-bold text-muted w-9 text-right">
                                {sharePercent}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          VIEW 3: REVENUE RECORD (Column Sort & Zebra Striping)
      ───────────────────────────────────────────────────────────── */}
      {tab === 'revenue' && (
        <div className="space-y-4">
          {/* Top Quick Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-[18px] border-2 border-emerald-500/30 bg-emerald-500/5 p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-emerald-700">Net Realized Revenue</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-emerald-600">
                {fmtPKR(totalLedgerNet)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Total Gross Billed</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-ink">
                {fmtPKR(totalLedgerGross)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Lost to Cancellations</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-rose-600">
                {fmtPKR(totalLedgerLost)}
              </p>
            </div>
            <div className="rounded-[18px] border border-line bg-[var(--c-surface-solid)] p-3.5 shadow-xs">
              <p className="text-[11px] font-extrabold uppercase text-muted">Avg Daily Ticket (AOV)</p>
              <p className="mt-1 font-mono text-xl sm:text-2xl font-black text-amber-600">
                {totalLedgerCompletedOrders > 0
                  ? fmtPKR(Math.round(totalLedgerNet / totalLedgerCompletedOrders))
                  : fmtPKR(0)}
              </p>
            </div>
          </div>

          {/* Revenue Ledger Table with Column Sort & Zebra Striping */}
          <Card className="overflow-hidden p-0 border border-line/80 shadow-sm">
            {revenueRecords.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl">📈</p>
                <h3 className="mt-3 font-display text-base font-black text-ink">No financial records</h3>
                <p className="mt-1 text-sm text-muted">No transactions registered in this selected timeframe</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b border-line bg-soft/50 text-[11px] font-black uppercase tracking-wider text-muted">
                    <tr>
                      <th
                        onClick={() => toggleRevenueSort('date')}
                        className="px-5 py-3 cursor-pointer select-none hover:text-brand"
                      >
                        Date / Period {renderSortIndicator('date', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('orders')}
                        className="px-4 py-3 text-center cursor-pointer select-none hover:text-brand"
                      >
                        Fulfilled Orders {renderSortIndicator('orders', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('gross')}
                        className="px-4 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Gross Billed {renderSortIndicator('gross', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('net')}
                        className="px-5 py-3 text-right text-emerald-600 cursor-pointer select-none hover:text-brand"
                      >
                        Net Collected {renderSortIndicator('net', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('lost')}
                        className="px-4 py-3 text-right text-rose-600 cursor-pointer select-none hover:text-brand"
                      >
                        Lost to Voids {renderSortIndicator('lost', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('cash')}
                        className="px-4 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Cash Share {renderSortIndicator('cash', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('card')}
                        className="px-4 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Card / Digital {renderSortIndicator('card', revenueSortField, revenueSortAsc)}
                      </th>
                      <th
                        onClick={() => toggleRevenueSort('aov')}
                        className="px-5 py-3 text-right cursor-pointer select-none hover:text-brand"
                      >
                        Avg Ticket {renderSortIndicator('aov', revenueSortField, revenueSortAsc)}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueRecords.map((r, idx) => {
                      const dailyAov = r.completedOrders > 0 ? Math.round(r.netRevenue / r.completedOrders) : 0;
                      const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-500/[0.025] dark:bg-white/[0.02]';

                      return (
                        <tr key={r.date} className={`border-b border-line/50 hover:bg-brand/5 transition-colors ${rowBg}`}>
                          <td className="px-5 py-3 font-bold text-ink whitespace-nowrap">
                            {r.displayDate}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-ink">
                            {r.completedOrders}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-muted whitespace-nowrap">
                            {fmtPKR(r.grossRevenue)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-black text-emerald-600 whitespace-nowrap">
                            {fmtPKR(r.netRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-500 whitespace-nowrap">
                            {r.lostSales > 0 ? fmtPKR(r.lostSales) : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-muted whitespace-nowrap">
                            {fmtPKR(r.cashRevenue)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-medium text-muted whitespace-nowrap">
                            {fmtPKR(r.cardRevenue)}
                          </td>
                          <td className="px-5 py-3 text-right font-mono font-black text-ink whitespace-nowrap">
                            {fmtPKR(dailyAov)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
