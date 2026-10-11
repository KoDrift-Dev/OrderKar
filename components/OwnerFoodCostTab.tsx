'use client';

// Owner "Food Cost & Profit" tab — Pic 7 (Restora) layout, OrderKar purple theme.
// 100% REAL: per-dish food cost = SUM(recipe qty × inventory cost_per_unit).
// Margins, waste % (from waste_logs) and insights are computed, never faked.
// Labor / overhead / packaging are NOT tracked → not shown (would be fake).

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { MenuItem, Order, OrderItem } from '@/lib/types';
import { fmtPKR, fmtNum } from '@/lib/format';
import { exportAsCsv } from '@/lib/report-export';
import { Card, Empty, Input, Label } from './ui';
import { useSectionData, RangePills, type Range } from './useRangeAnalytics';

interface InvItem {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  cost_per_unit: number;
  current_stock: number;
}

interface RecipeRow {
  id: string;
  menu_item_id: string;
  ingredient_id: string;
  quantity_required: number;
  unit: string;
}

interface WasteRow {
  id: string;
  item_name: string;
  quantity: number;
  estimated_cost: number;
  reason: string;
  logged_at: string;
}

type SubTab = 'overview' | 'items' | 'ingredients';

export default function OwnerFoodCostTab({
  restaurantId,
  orders,
  items,
  menu,
}: {
  restaurantId: string;
  orders: Order[];
  items: OrderItem[];
  menu: MenuItem[];
}) {
  const [range, setRange] = useState<Range>('7d');
  const [sub, setSub] = useState<SubTab>('overview');
  const [inv, setInv] = useState<InvItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [waste, setWaste] = useState<WasteRow[]>([]);
  const [recipeFor, setRecipeFor] = useState<string | null>(null);
  const [newIng, setNewIng] = useState('');
  const [newQty, setNewQty] = useState('');
  const [saving, setSaving] = useState(false);

  const emptyCatName = useMemo(() => ({ map: new Map<string, string>(), itemToCat: new Map<string, string>() }), []);
  const sec = useSectionData(orders, items, emptyCatName, range);
  const { currentOrders, currentItems } = sec;

  const loadRefs = async () => {
    const supabase = createClient();
    const [{ data: iv }, { data: rc }, { data: wl }] = await Promise.all([
      supabase.from('inventory_items').select('id,name,category,unit,cost_per_unit,current_stock').eq('restaurant_id', restaurantId).order('name'),
      supabase.from('recipes').select('*').eq('restaurant_id', restaurantId),
      supabase.from('waste_logs').select('id,item_name,quantity,estimated_cost,reason,logged_at').eq('restaurant_id', restaurantId).order('logged_at', { ascending: false }).limit(200),
    ]);
    if (iv) setInv(iv as InvItem[]);
    if (rc) setRecipes(rc as RecipeRow[]);
    if (wl) setWaste(wl as WasteRow[]);
  };

  useEffect(() => {
    loadRefs();
    const supabase = createClient();
    const ch = supabase
      .channel(`owner-foodcost-${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recipes', filter: `restaurant_id=eq.${restaurantId}` }, () => loadRefs())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items', filter: `restaurant_id=eq.${restaurantId}` }, () => loadRefs())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line/12 react-hooks/exhaustive-deps
  }, [restaurantId]);

  const invById = useMemo(() => new Map(inv.map((i) => [i.id, i])), [inv]);

  // Per-dish food cost from recipes
  const dishCost = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of recipes) {
      const ing = invById.get(r.ingredient_id);
      if (!ing) continue;
      m.set(r.menu_item_id, (m.get(r.menu_item_id) ?? 0) + Number(r.quantity_required) * Number(ing.cost_per_unit));
    }
    return m;
  }, [recipes, invById]);

  const recipesByDish = useMemo(() => {
    const m = new Map<string, RecipeRow[]>();
    for (const r of recipes) {
      const arr = m.get(r.menu_item_id) ?? [];
      arr.push(r);
      m.set(r.menu_item_id, arr);
    }
    return m;
  }, [recipes]);

  // Item performance in range
  const perf = useMemo(() => {
    const agg = new Map<string, { name: string; qty: number; revenue: number; cost: number; hasRecipe: boolean }>();
    for (const it of currentItems) {
      const key = it.menu_item_id ?? `name:${it.item_name}`;
      const e = agg.get(key) ?? { name: it.item_name, qty: 0, revenue: 0, cost: 0, hasRecipe: false };
      e.qty += it.quantity;
      e.revenue += it.quantity * Number(it.unit_price);
      const dc = it.menu_item_id ? dishCost.get(it.menu_item_id) : undefined;
      if (dc != null) {
        e.cost += it.quantity * dc;
        e.hasRecipe = true;
      }
      agg.set(key, e);
    }
    return [...agg.values()]
      .map((e) => ({ ...e, margin: e.revenue > 0 ? ((e.revenue - e.cost) / e.revenue) * 100 : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [currentItems, dishCost]);

  const withRecipe = perf.filter((p) => p.hasRecipe);
  const totalFoodSales = withRecipe.reduce((s, p) => s + p.revenue, 0);
  const totalFoodCost = withRecipe.reduce((s, p) => s + p.cost, 0);
  const overallMargin = totalFoodSales > 0 ? ((totalFoodSales - totalFoodCost) / totalFoodSales) * 100 : 0;
  const missingRecipes = perf.filter((p) => !p.hasRecipe).length;

  // Waste in range
  const wasteInRange = useMemo(() => {
    const { start, end } = sec;
    return waste.filter((w) => {
      const d = new Date(w.logged_at);
      return d >= start && d <= end;
    });
  }, [waste, sec]);
  const wasteCost = wasteInRange.reduce((s, w) => s + Number(w.estimated_cost), 0);
  const wastePct = totalFoodSales > 0 ? (wasteCost / totalFoodSales) * 100 : 0;

  // Daily series: revenue vs food cost
  const daily = useMemo(() => {
    const { start, end } = sec;
    const days: string[] = [];
    const rev = new Map<string, number>();
    const cost = new Map<string, number>();
    const d = new Date(start);
    d.setHours(0, 0, 0, 0);
    const stop = new Date(end);
    stop.setHours(0, 0, 0, 0);
    while (d <= stop) {
      const k = d.toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      days.push(k);
      rev.set(k, 0);
      cost.set(k, 0);
      d.setDate(d.getDate() + 1);
    }
    const costByOrder = new Map<string, number>();
    for (const it of currentItems) {
      const dc = it.menu_item_id ? dishCost.get(it.menu_item_id) : undefined;
      if (dc == null) continue;
      costByOrder.set(it.order_id, (costByOrder.get(it.order_id) ?? 0) + it.quantity * dc);
    }
    for (const o of currentOrders) {
      if (o.status === 'cancelled') continue;
      const k = new Date(o.created_at).toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
      if (!rev.has(k)) continue;
      rev.set(k, (rev.get(k) ?? 0) + Number(o.total_amount));
      cost.set(k, (cost.get(k) ?? 0) + (costByOrder.get(o.id) ?? 0));
    }
    return { days, rev: days.map((k) => rev.get(k) ?? 0), cost: days.map((k) => cost.get(k) ?? 0) };
  }, [sec, currentOrders, currentItems, dishCost]);

  // Top cost ingredients (from sold items' recipes)
  const topIngredients = useMemo(() => {
    const m = new Map<string, { name: string; cost: number }>();
    for (const it of currentItems) {
      if (!it.menu_item_id) continue;
      const rows = recipesByDish.get(it.menu_item_id) ?? [];
      for (const r of rows) {
        const ing = invById.get(r.ingredient_id);
        if (!ing) continue;
        const c = it.quantity * Number(r.quantity_required) * Number(ing.cost_per_unit);
        const e = m.get(ing.id) ?? { name: ing.name, cost: 0 };
        e.cost += c;
        m.set(ing.id, e);
      }
    }
    const arr = [...m.values()].sort((a, b) => b.cost - a.cost).slice(0, 6);
    const total = arr.reduce((s, x) => s + x.cost, 0) || 1;
    return arr.map((x) => ({ ...x, pct: Math.round((x.cost / total) * 100) }));
  }, [currentItems, recipesByDish, invById]);


  const insights = useMemo(() => {
    const out: { icon: string; title: string; body: string }[] = [];
    const lowMargin = withRecipe.filter((p) => p.margin < 25).sort((a, b) => a.margin - b.margin).slice(0, 2);
    for (const p of lowMargin) {
      out.push({
        icon: '⚠️',
        title: 'Low Margin Alert',
        body: `${p.name} has a profit margin of ${Math.round(p.margin)}%, below the 25% target.`,
      });
    }
    if (missingRecipes > 0) {
      out.push({
        icon: '📝',
        title: 'Missing Recipes',
        body: `${missingRecipes} sold item${missingRecipes > 1 ? 's have' : ' has'} no recipe — food cost can't be calculated for them.`,
      });
    }
    if (wastePct > 3) {
      out.push({
        icon: '🗑️',
        title: 'Food Waste Opportunity',
        body: `Waste is ${wastePct.toFixed(1)}% of food sales. Review prep quantities.`,
      });
    }
    if (overallMargin >= 60 && withRecipe.length > 0) {
      out.push({ icon: '✅', title: 'Healthy Margins', body: `Overall margin of ${Math.round(overallMargin)}% is strong.` });
    }
    return out.slice(0, 4);
  }, [withRecipe, missingRecipes, wastePct, overallMargin]);

  const addRecipeRow = async () => {
    if (!recipeFor || !newIng || !newQty.trim() || Number(newQty) <= 0) return;
    setSaving(true);
    const { error } = await createClient().from('recipes').insert({
      restaurant_id: restaurantId,
      menu_item_id: recipeFor,
      ingredient_id: newIng,
      quantity_required: Number(newQty),
      unit: invById.get(newIng)?.unit ?? 'pcs',
    });
    setSaving(false);
    if (!error) {
      setNewIng('');
      setNewQty('');
      loadRefs();
    }
  };

  const removeRecipeRow = async (id: string) => {
    await createClient().from('recipes').delete().eq('id', id);
    loadRefs();
  };

  const exportCsv = () => {
    exportAsCsv(
      `food_cost_${new Date().toISOString().slice(0, 10)}.csv`,
      ['Item', 'Qty Sold', 'Revenue', 'Food Cost', 'Margin %', 'Has Recipe'],
      perf.map((p) => [p.name, String(p.qty), p.revenue.toFixed(2), p.cost.toFixed(2), p.margin.toFixed(1), p.hasRecipe ? 'yes' : 'no'])
    );
  };

  const recipeDishes = useMemo(
    () => menu.filter((m) => m.is_available !== false).sort((a, b) => a.name.localeCompare(b.name)),
    [menu]
  );

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-[19px] sm:text-[21px] font-black tracking-tight text-ink">Food Cost & Profit</h2>
          <p className="text-[12px] font-medium text-muted">Track food cost, analyze profit margins and make smarter menu decisions.</p>
        </div>
        <div className="flex items-center gap-2">
          <RangePills value={range} onChange={setRange} small />
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-[13px] border border-line/70 bg-[var(--c-surface-solid)] px-4 py-2 text-[13px] font-extrabold text-ink shadow-sm transition-all hover:border-brand/40"
          >
            <span>⬇️</span> Export Report
          </button>
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex gap-2">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'items', label: 'Menu Items & Recipes' },
          { key: 'ingredients', label: 'Ingredients' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key as SubTab)}
            className={`rounded-[12px] px-4 py-1.5 text-[12.5px] font-extrabold transition-all ${
              sub === t.key ? 'bg-brand text-white shadow-lift' : 'border border-line/70 text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'overview' && (
        <>
          {recipes.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-[26px]">🧾</p>
              <h3 className="mt-2 font-display text-[16px] font-black text-ink">No recipes yet</h3>
              <p className="mx-auto mt-1 max-w-md text-[13px] font-medium text-muted">
                Add ingredient quantities per dish to unlock real food-cost and margin analytics. Ingredient costs come
                from your inventory.
              </p>
              <button
                onClick={() => setSub('items')}
                className="mt-4 rounded-[12px] bg-brand px-5 py-2.5 text-[13px] font-black text-white shadow-lift"
              >
                Add Recipes
              </button>
            </Card>
          ) : (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: 'Total Food Sales', value: fmtPKR(totalFoodSales), icon: '🏷️', tone: 'text-brand' },
                  { label: 'Total Food Cost', value: fmtPKR(totalFoodCost), icon: '🧾', tone: 'text-amber dark:text-amber' },
                  { label: 'Overall Profit Margin', value: `${Math.round(overallMargin)}%`, icon: '%', tone: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Total Food Waste', value: `${wastePct.toFixed(1)}%`, icon: '🗑️', tone: 'text-rose-600 dark:text-rose-400' },
                ].map((c) => (
                  <Card key={c.label} className="p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-soft text-[16px] font-black text-muted">{c.icon}</span>
                      <p className="text-[12px] font-bold text-muted">{c.label}</p>
                    </div>
                    <p className={`mt-1.5 font-mono text-[22px] font-black ${c.tone}`}>{c.value}</p>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 xl:grid-cols-12">
                <div className="xl:col-span-8">
                  <Card className="p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-display text-[15px] font-extrabold text-ink">Sales vs. Food Cost</h3>
                      <div className="flex items-center gap-3 text-[11.5px] font-bold text-muted">
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand" /> Food Sales</span>
                        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Food Cost</span>
                      </div>
                    </div>
                    <DualLine days={daily.days} rev={daily.rev} cost={daily.cost} />
                  </Card>

                  {/* Menu item performance */}
                  <Card className="mt-4 overflow-hidden p-0">
                    <div className="border-b border-line/12 px-4 py-3">
                      <h3 className="font-display text-[15px] font-extrabold text-ink">Menu Item Performance</h3>
                    </div>
                    <div className="hidden grid-cols-12 gap-2 border-b border-line/12 px-4 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-muted md:grid">
                      <p className="col-span-4">Item</p>
                      <p className="col-span-2 text-right">Food Cost</p>
                      <p className="col-span-2 text-right">Selling Price</p>
                      <p className="col-span-2 text-right">Profit Margin</p>
                      <p className="col-span-2 text-right">Sold</p>
                    </div>
                    <div className="max-h-[420px] divide-y divide-line/50 overflow-y-auto">
                      {perf.slice(0, 30).map((p) => (
                        <div key={p.name} className="grid grid-cols-12 items-center gap-2 px-4 py-2.5">
                          <div className="col-span-7 md:col-span-4">
                            <p className="truncate text-[13px] font-extrabold text-ink">{p.name}</p>
                            {!p.hasRecipe && <p className="text-[10.5px] font-bold text-amber">No recipe</p>}
                          </div>
                          <p className="hidden text-right font-mono text-[12.5px] font-bold text-muted md:col-span-2 md:block">
                            {p.hasRecipe ? fmtPKR(p.qty ? p.cost / p.qty : 0) : '—'}
                          </p>
                          <p className="hidden text-right font-mono text-[12.5px] font-bold text-muted md:col-span-2 md:block">
                            {fmtPKR(p.qty ? p.revenue / p.qty : 0)}
                          </p>
                          <div className="col-span-3 text-right md:col-span-2">
                            {p.hasRecipe ? (
                              <span className={`rounded-full px-2.5 py-1 font-mono text-[11.5px] font-extrabold ${
                                p.margin < 25 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : p.margin < 50 ? 'bg-amber/10 text-amber dark:text-amber'
                                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              }`}>
                                {Math.round(p.margin)}%
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-muted">—</span>
                            )}
                          </div>
                          <p className="col-span-2 text-right font-mono text-[12.5px] font-bold text-ink">{fmtNum(p.qty)}</p>
                        </div>
                      ))}
                      {perf.length === 0 && (
                        <p className="p-6 text-center text-[13px] font-medium text-muted">No sales in this period.</p>
                      )}
                    </div>
                  </Card>
                </div>

                {/* Right rail */}
                <div className="space-y-4 xl:col-span-4">
                  <Card className="p-4">
                    <h3 className="font-display text-[14px] font-extrabold text-ink">💡 Smart Insights</h3>
                    <ul className="mt-3 space-y-3">
                      {insights.length === 0 && (
                        <p className="text-[12.5px] font-medium text-muted">Not enough data for insights yet.</p>
                      )}
                      {insights.map((ins, i) => (
                        <li key={i} className="rounded-[12px] bg-soft/50 p-3">
                          <p className="flex items-center gap-1.5 text-[12.5px] font-extrabold text-ink">
                            <span>{ins.icon}</span> {ins.title}
                          </p>
                          <p className="mt-1 text-[12px] font-medium leading-relaxed text-muted">{ins.body}</p>
                        </li>
                      ))}
                    </ul>
                  </Card>

                  <Card className="p-4">
                    <h3 className="font-display text-[14px] font-extrabold text-ink">Top Cost Ingredients</h3>
                    <ul className="mt-3 space-y-2.5">
                      {topIngredients.length === 0 && (
                        <p className="text-[12.5px] font-medium text-muted">No ingredient usage in this period.</p>
                      )}
                      {topIngredients.map((t) => (
                        <li key={t.name}>
                          <div className="flex items-center justify-between text-[12.5px]">
                            <span className="font-bold text-body">{t.name}</span>
                            <span className="font-mono font-bold text-muted">{fmtPKR(t.cost)} · {t.pct}%</span>
                          </div>
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-soft">
                            <div className="h-full rounded-full bg-gradient-to-r from-amber to-orange-500" style={{ width: `${t.pct}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {sub === 'items' && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line/12 px-4 py-3">
            <h3 className="font-display text-[15px] font-extrabold text-ink">Recipes per Dish</h3>
            <p className="text-[12px] font-medium text-muted">Add ingredient quantities — food cost is calculated from inventory rates.</p>
          </div>
          <div className="divide-y divide-line/50">
            {recipeDishes.map((m) => {
              const rows = recipesByDish.get(m.id) ?? [];
              const cost = dishCost.get(m.id) ?? 0;
              const open = recipeFor === m.id;
              return (
                <div key={m.id} className="px-4 py-3">
                  <button
                    onClick={() => { setRecipeFor(open ? null : m.id); setNewIng(''); setNewQty(''); }}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-extrabold text-ink">{m.name}</p>
                      <p className="text-[11.5px] font-medium text-muted">
                        {rows.length} ingredient{rows.length !== 1 ? 's' : ''} · food cost {fmtPKR(cost)}
                      </p>
                    </div>
                    <span className="text-[16px] text-muted">{open ? '▾' : '▸'}</span>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-2 rounded-[12px] bg-soft/40 p-3">
                      {rows.map((r) => {
                        const ing = invById.get(r.ingredient_id);
                        return (
                          <div key={r.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                            <span className="font-bold text-body">{ing?.name ?? 'Unknown'}</span>
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-muted">{fmtNum(Number(r.quantity_required))} {r.unit}</span>
                              <button
                                onClick={() => removeRecipeRow(r.id)}
                                className="rounded-full px-2 py-0.5 text-[12px] font-bold text-rose-600 hover:bg-rose-500/10"
                              >
                                ✕
                              </button>
                            </span>
                          </div>
                        );
                      })}
                      {rows.length === 0 && (
                        <p className="text-[12px] font-medium text-muted">No ingredients yet.</p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <select
                          value={newIng}
                          onChange={(e) => setNewIng(e.target.value)}
                          className="min-w-0 flex-1 rounded-[10px] border border-line/70 bg-[var(--c-surface-solid)] px-2.5 py-1.5 text-[12.5px] font-medium text-ink outline-none"
                        >
                          <option value="">Select ingredient...</option>
                          {inv.map((i) => (
                            <option key={i.id} value={i.id}>{i.name} ({fmtPKR(Number(i.cost_per_unit))}/{i.unit})</option>
                          ))}
                        </select>
                        <Input
                          type="number"
                          value={newQty}
                          onChange={(e) => setNewQty(e.target.value)}
                          placeholder="Qty"
                          className="w-20"
                        />
                        <button
                          onClick={addRecipeRow}
                          disabled={saving || !newIng || !newQty}
                          className="shrink-0 rounded-[10px] bg-brand px-3 py-1.5 text-[12.5px] font-black text-white disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {sub === 'ingredients' && (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-line/12 px-4 py-3">
            <h3 className="font-display text-[15px] font-extrabold text-ink">Ingredients</h3>
            <p className="text-[12px] font-medium text-muted">Unit costs from inventory — edit them in the Inventory tab.</p>
          </div>
          {inv.length === 0 ? (
            <div className="p-6">
              <Empty title="No ingredients yet" sub="Add stock items in the Inventory tab first." />
            </div>
          ) : (
            <div className="divide-y divide-line/50">
              {inv.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-extrabold text-ink">{i.name}</p>
                    <p className="text-[11px] font-medium text-muted">{i.category ?? '—'}</p>
                  </div>
                  <p className="font-mono text-[12.5px] font-bold text-ink">{fmtPKR(Number(i.cost_per_unit))} <span className="text-muted">/ {i.unit}</span></p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function DualLine({ days, rev, cost }: { days: string[]; rev: number[]; cost: number[] }) {
  const W = 560;
  const H = 220;
  const PL = 64;
  const PR = 12;
  const PT = 14;
  const PB = 30;
  const iw = W - PL - PR;
  const ih = H - PT - PB;
  const max = Math.max(1, ...rev, ...cost);
  const step = days.length > 1 ? iw / (days.length - 1) : 0;
  const pts = (vals: number[]) => vals.map((v, i) => [PL + i * step, PT + ih - (v / max) * ih] as const);
  const line = (p: readonly (readonly [number, number])[]) =>
    p.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const rp = pts(rev);
  const cp = pts(cost);
  const area = `${line(rp)} L ${(W - PR).toFixed(1)},${(PT + ih).toFixed(1)} L ${PL.toFixed(1)},${(PT + ih).toFixed(1)} Z`;
  const ticks = [0, 0.5, 1].map((f) => ({ v: max * f, y: PT + ih - f * ih }));
  const n = days.length;
  const showIdx = n <= 8 ? days.map((_, i) => i) : days.map((_, i) => i).filter((_, i) => i % Math.ceil(n / 8) === 0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PL} x2={W - PR} y1={t.y} y2={t.y} className="stroke-line/12" strokeWidth="1" opacity="0.5" />
          <text x={PL - 8} y={t.y + 4} textAnchor="end" fontSize="10" className="fill-muted font-mono">
            {t.v >= 1000 ? `${Math.round(t.v / 1000)}k` : Math.round(t.v)}
          </text>
        </g>
      ))}
      <path d={area} fill="var(--c-brand)" opacity="0.08" />
      <path d={line(rp)} fill="none" stroke="var(--c-brand)" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={line(cp)} fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinejoin="round" />
      {showIdx.map((i) => (
        <text key={i} x={PL + i * step} y={H - 10} textAnchor="middle" fontSize="10" className="fill-muted">
          {days[i]}
        </text>
      ))}
    </svg>
  );
}
