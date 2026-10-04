'use client';

// Live order status tracker. Subscribes to realtime updates on the order so
// the customer sees pending -> preparing -> ready without refreshing.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { OrderStatus } from '@/lib/types';
import { Card } from './ui';
import StatusPill from './StatusPill';

const STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Received' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'ready', label: 'Ready' },
];

function stepIndex(s: OrderStatus): number {
  if (s === 'completed') return 3;
  return STEPS.findIndex((x) => x.key === s);
}

export default function OrderTracker({ orderId, orderNumber }: { orderId: string; orderNumber?: number }) {
  const [status, setStatus] = useState<OrderStatus>('pending');

  useEffect(() => {
    const supabase = createClient();
    let live = true;
    (async () => {
      const { data } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
      if (live && data) setStatus(data.status as OrderStatus);
    })();
    const ch = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, (payload) => {
        const next = (payload.new as { status: OrderStatus }).status;
        if (next) setStatus(next);
      })
      .subscribe();
    return () => {
      live = false;
      supabase.removeChannel(ch);
    };
  }, [orderId]);

  const idx = stepIndex(status);

  return (
    <Card deep className="p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Order status</p>
          {orderNumber != null && (
            <p className="mt-0.5 font-mono text-xl font-bold text-ink">#{orderNumber}</p>
          )}
        </div>
        <StatusPill status={status} size="lg" />
      </div>
      <div className="mt-5">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <div key={s.key} className={`flex items-center ${i < STEPS.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 font-bold transition-all ${
                    i < idx
                      ? 'border-ok bg-ok text-white'
                      : i === idx
                        ? 'border-brand bg-brand text-white shadow-glow'
                        : 'border-line bg-soft text-muted'
                  }`}
                >
                  {i < idx ? '✓' : i + 1}
                </div>
                <span className={`text-[12px] font-bold ${i <= idx ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mx-2 mb-6 h-1 flex-1 rounded-full ${i < idx ? 'bg-ok' : 'bg-soft'}`} />
              )}
            </div>
          ))}
        </div>
        {status === 'ready' && (
          <p className="mt-4 rounded-btn bg-ok/10 p-3 text-center text-sm font-bold text-ok">
            Your order is ready — it&apos;s on its way to your table! 🎉
          </p>
        )}
        {status === 'completed' && (
          <p className="mt-4 rounded-btn bg-teal/10 p-3 text-center text-sm font-bold text-teal">
            Enjoy your meal! Don&apos;t forget to leave a review. ⭐
          </p>
        )}
      </div>
    </Card>
  );
}
