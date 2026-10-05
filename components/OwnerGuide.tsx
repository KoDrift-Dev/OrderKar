'use client';

// Analytics guide: plain-language FAQ explaining every owner-dashboard metric
// — what it means and exactly how it's calculated.

import { useState } from 'react';
import { Btn } from './ui';
import { useT, type TKey } from '@/lib/i18n';

const SECTIONS: { title: string; rows: { metric: string; w: TKey; h: TKey }[] }[] = [
  {
    title: '📊 Dashboard',
    rows: [
      { metric: 'Revenue', w: 'gde_revenue_w', h: 'gde_revenue_h' },
      { metric: 'Orders', w: 'gde_orders_w', h: 'gde_orders_h' },
      { metric: 'Avg order value', w: 'gde_aov_w', h: 'gde_aov_h' },
      { metric: 'Items sold', w: 'gde_items_w', h: 'gde_items_h' },
      { metric: 'Void rate', w: 'gde_void_w', h: 'gde_void_h' },
      { metric: 'Smart summary', w: 'gde_smart_w', h: 'gde_smart_h' },
      { metric: 'Revenue trend', w: 'gde_trend_w', h: 'gde_trend_h' },
    ],
  },
  {
    title: '💰 Sales',
    rows: [
      { metric: 'Rush-hour heatmap', w: 'gde_rush_w', h: 'gde_rush_h' },
      { metric: 'Weekday bars', w: 'gde_weekday_w', h: 'gde_weekday_h' },
      { metric: 'Top items', w: 'gde_top_w', h: 'gde_top_h' },
      { metric: 'Payment methods', w: 'gde_pay_w', h: 'gde_pay_h' },
      { metric: 'Order types', w: 'gde_otypes_w', h: 'gde_otypes_h' },
      { metric: 'Cancellations', w: 'gde_cancels_w', h: 'gde_cancels_h' },
    ],
  },
  {
    title: '⚙️ Operations',
    rows: [
      { metric: 'Live kitchen', w: 'gde_live_w', h: 'gde_live_h' },
      { metric: 'Table performance', w: 'gde_tableperf_w', h: 'gde_tableperf_h' },
      { metric: 'Avg order-to-ready', w: 'gde_avgready_w', h: 'gde_avgready_h' },
    ],
  },
  {
    title: '👥 Staff',
    rows: [
      { metric: 'Waiter leaderboard', w: 'gde_leader_w', h: 'gde_leader_h' },
      { metric: 'Waiter activity', w: 'gde_activity_w', h: 'gde_activity_h' },
    ],
  },
  {
    title: '⭐ Customers',
    rows: [
      { metric: 'Avg rating', w: 'gde_avgrating_w', h: 'gde_avgrating_h' },
      { metric: 'Rating distribution', w: 'gde_dist_w', h: 'gde_dist_h' },
      { metric: 'Low ratings', w: 'gde_low_w', h: 'gde_low_h' },
    ],
  },
];

export default function OwnerGuide() {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      <Btn size="sm" onClick={() => setOpen(true)} className="!rounded-full">
        ⓘ Guide
      </Btn>
      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-[var(--c-surface-solid)] p-6 shadow-2xl sm:p-8">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-extrabold text-ink">Analytics guide</h2>
                <p className="mt-0.5 text-[13px] text-muted">{t('gde_sub')}</p>
              </div>
              <button onClick={() => setOpen(false)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-soft hover:text-ink" aria-label="Close">
                ✕
              </button>
            </div>
            <div className="space-y-6">
              {SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="mb-2 font-display text-[15px] font-extrabold text-ink">{s.title}</p>
                  <div className="space-y-2">
                    {s.rows.map((r) => (
                      <div key={r.metric} className="rounded-[14px] border border-line p-3.5">
                        <p className="text-[13.5px] font-extrabold text-brand">{r.metric}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-body">{t(r.w)}</p>
                        <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">🧮 {t(r.h)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Btn className="mt-6 w-full" onClick={() => setOpen(false)}>{t('gde_gotit')}</Btn>
          </div>
        </div>
      )}
    </>
  );
}
