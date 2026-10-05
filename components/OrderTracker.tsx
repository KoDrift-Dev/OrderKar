'use client';

// Live order status tracker. Polls the track_order() RPC with the order's
// private tracking token — anon cannot read the orders table directly, so the
// token is the only key. Poll every 3s: pending -> preparing -> ready.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';
import type { OrderStatus } from '@/lib/types';
import { Card } from './ui';
import StatusPill from './StatusPill';

const STEP_KEYS: OrderStatus[] = ['pending', 'preparing', 'ready'];

function stepIndex(s: OrderStatus): number {
  if (s === 'completed') return 3;
  return STEP_KEYS.indexOf(s);
}

export default function OrderTracker({
  orderId,
  trackingToken,
  orderNumber,
  tableNumber,
  onDismiss,
}: {
  orderId: string;
  trackingToken?: string | null;
  orderNumber?: number;
  tableNumber?: number;
  onDismiss?: () => void;
}) {
  const t = useT();
  const [status, setStatus] = useState<OrderStatus>('pending');
  const [notFound, setNotFound] = useState(false);

  const steps: { key: OrderStatus; label: string; icon: string }[] = [
    { key: 'pending', label: t('trk_step_pending'), icon: '🧾' },
    { key: 'preparing', label: t('trk_step_preparing'), icon: '👨‍🍳' },
    { key: 'ready', label: t('trk_step_ready'), icon: '🔔' },
  ];

  useEffect(() => {
    if (!trackingToken) {
      setNotFound(true);
      return;
    }
    const supabase = createClient();
    let live = true;
    const poll = async () => {
      const { data } = await supabase.rpc('track_order', { p_token: trackingToken });
      if (!live) return;
      const row = data as { status?: OrderStatus } | null;
      if (row?.status) {
        setStatus(row.status);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    };
    poll();
    const t = window.setInterval(poll, 3000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, [trackingToken]);

  const idx = stepIndex(status);

  if (notFound) {
    return (
      <Card deep className="relative p-5">
        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-muted hover:bg-soft hover:text-ink"
          >
            ✕
          </button>
        )}
        <p className="text-[13.5px] font-bold text-muted">{t('trk_unavailable')}</p>
      </Card>
    );
  }

  return (
    <Card deep className="relative p-5">
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold text-muted hover:bg-soft hover:text-ink"
        >
          ✕
        </button>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold uppercase tracking-wide text-muted">Order status</p>
          <p className="mt-0.5 font-mono text-xl font-bold text-ink">
            {orderNumber != null && <>#{orderNumber}</>}
            {tableNumber != null && <span className="ml-2 text-[13px] font-bold text-muted">· 🍽️ Table {tableNumber}</span>}
          </p>
        </div>
        <StatusPill status={status} size="lg" />
      </div>
      <div className="mt-5">
        <div className="flex items-center">
          {steps.map((s, i) => (
            <div key={s.key} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border-2 text-[19px] transition-all ${
                    i < idx
                      ? 'border-ok bg-ok text-white'
                      : i === idx
                        ? 'border-brand bg-brand shadow-glow'
                        : 'border-line bg-soft grayscale opacity-60'
                  }`}
                >
                  {i < idx ? <span className="text-[16px] font-bold text-white">✓</span> : <span className={i === idx ? 'animate-bounce' : ''}>{s.icon}</span>}
                </div>
                <span className={`text-[12px] font-bold ${i <= idx ? 'text-ink' : 'text-muted'}`}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`mx-2 mb-6 h-1 flex-1 rounded-full ${i < idx ? 'bg-ok' : 'bg-soft'}`} />
              )}
            </div>
          ))}
        </div>
        {status === 'ready' && (
          <p className="mt-4 rounded-btn bg-ok/10 p-3 text-center text-sm font-bold text-ok">
            {t('trk_ready_msg')}
          </p>
        )}
        {status === 'completed' && (
          <p className="mt-4 rounded-btn bg-teal/10 p-3 text-center text-sm font-bold text-teal">
            {t('trk_completed_msg')}
          </p>
        )}
      </div>
    </Card>
  );
}
