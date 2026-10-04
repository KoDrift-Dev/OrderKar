'use client';

// Rule-based "smart summary": auto-written highlights from today's data.
// Not AI — deterministic rules, so it's always accurate.

import { useMemo } from 'react';
import type { Order, OrderItem, Profile } from '@/lib/types';
import { fmtPKR } from '@/lib/format';
import { Card, SectionHead } from './ui';

export default function OwnerSmartSummary({
  orders,
  items,
  staff,
  itemOrderDate,
}: {
  orders: Order[];
  items: OrderItem[];
  staff: Profile[];
  itemOrderDate: Map<string, string>;
}) {
  const lines = useMemo(() => {
    const out: { icon: string; text: string; tone: 'good' | 'warn' | 'info' }[] = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const yStart = new Date(start);
    yStart.setDate(yStart.getDate() - 1);

    const today = orders.filter((o) => new Date(o.created_at) >= start && o.status !== 'cancelled');
    const yday = orders.filter((o) => new Date(o.created_at) >= yStart && new Date(o.created_at) < start && o.status !== 'cancelled');
    const revT = today.reduce((s, o) => s + Number(o.total_amount), 0);
    const revY = yday.reduce((s, o) => s + Number(o.total_amount), 0);

    if (today.length === 0) {
      return [{ icon: '📊', text: 'Aaj abhi tak koi order nahi — summary orders aane par banega.', tone: 'info' as const }];
    }

    // Revenue vs yesterday
    if (revY > 0) {
      const pct = Math.round(((revT - revY) / revY) * 100);
      out.push({
        icon: pct >= 0 ? '📈' : '📉',
        text: `Revenue ${pct >= 0 ? 'up' : 'down'} ${Math.abs(pct)}% vs yesterday (${fmtPKR(revT)} vs ${fmtPKR(revY)})`,
        tone: pct >= 0 ? 'good' : 'warn',
      });
    } else {
      out.push({ icon: '💰', text: `Aaj ka revenue ${fmtPKR(revT)} (${today.length} orders)`, tone: 'info' });
    }

    // Top item today
    const qty = new Map<string, number>();
    for (const i of items) {
      const d = itemOrderDate.get(i.order_id);
      if (d && new Date(d) >= start) qty.set(i.item_name, (qty.get(i.item_name) ?? 0) + i.quantity);
    }
    const top = [...qty.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top) out.push({ icon: '🔥', text: `Top item: ${top[0]} (${top[1]} sold today)`, tone: 'info' });

    // Void rate
    const cancelledToday = orders.filter((o) => new Date(o.created_at) >= start && o.status === 'cancelled');
    const voidRate = (cancelledToday.length / Math.max(1, today.length + cancelledToday.length)) * 100;
    if (cancelledToday.length > 0) {
      const reasons = new Map<string, number>();
      for (const o of cancelledToday) reasons.set(o.cancel_reason ?? 'no reason', (reasons.get(o.cancel_reason ?? 'no reason') ?? 0) + 1);
      const topReason = [...reasons.entries()].sort((a, b) => b[1] - a[1])[0][0];
      out.push({
        icon: '⚠️',
        text: `${cancelledToday.length} orders cancelled (void rate ${voidRate.toFixed(1)}%${voidRate > 2 ? ' — target se zyada!' : ''}, top reason: ${topReason})`,
        tone: voidRate > 2 ? 'warn' : 'info',
      });
    }

    // Fulfillment
    const done = today.filter((o) => (o.status === 'ready' || o.status === 'completed') && o.updated_at);
    if (done.length > 0) {
      const avgMin = done.reduce((s, o) => s + (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()), 0) / done.length / 60000;
      out.push({
        icon: '⏱️',
        text: `Avg order-to-ready ${Math.round(avgMin)} min${avgMin > 25 ? ' — kitchen slow hai, check karo' : ''}`,
        tone: avgMin > 25 ? 'warn' : 'good',
      });
    }

    // Best waiter today
    const wRev = new Map<string, number>();
    const nameOf = new Map(staff.map((s) => [s.id, s.name]));
    for (const o of today) {
      if (o.waiter_id) wRev.set(o.waiter_id, (wRev.get(o.waiter_id) ?? 0) + Number(o.total_amount));
    }
    const best = [...wRev.entries()].sort((a, b) => b[1] - a[1])[0];
    if (best) out.push({ icon: '🏅', text: `Top waiter: ${nameOf.get(best[0]) ?? 'Unknown'} (${fmtPKR(best[1])} sales today)`, tone: 'good' });

    return out;
  }, [orders, items, staff, itemOrderDate]);

  return (
    <div>
      <SectionHead title="Smart summary" sub="Aaj ki highlights — auto-generated" />
      <Card className="p-5">
        <ul className="space-y-2.5">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed">
              <span className="text-[16px]">{l.icon}</span>
              <span className={`font-semibold ${l.tone === 'warn' ? 'text-danger' : l.tone === 'good' ? 'text-ink' : 'text-body'}`}>
                {l.text}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

