'use client';

// Analytics guide: plain-language FAQ explaining every owner-dashboard metric
// — what it means and exactly how it's calculated.

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Btn } from './ui';
import { useT, type TKey } from '@/lib/i18n';

const SECTIONS: { id: string; title: string; rows: { metric: string; w: TKey; h: TKey }[] }[] = [
  {
    id: 'dashboard',
    title: '📊 Core Dashboard',
    rows: [
      { metric: 'Gross Revenue', w: 'gde_revenue_w', h: 'gde_revenue_h' },
      { metric: 'Total Orders', w: 'gde_orders_w', h: 'gde_orders_h' },
      { metric: 'Avg Order Value (AOV)', w: 'gde_aov_w', h: 'gde_aov_h' },
      { metric: 'Dishes Sold', w: 'gde_items_w', h: 'gde_items_h' },
      { metric: 'Void & Cancel Rate', w: 'gde_void_w', h: 'gde_void_h' },
      { metric: 'Smart Summary', w: 'gde_smart_w', h: 'gde_smart_h' },
      { metric: 'Revenue Trend', w: 'gde_trend_w', h: 'gde_trend_h' },
    ],
  },
  {
    id: 'sales',
    title: '💰 Sales & Revenue Breakdown',
    rows: [
      { metric: 'Rush-Hour Heatmap', w: 'gde_rush_w', h: 'gde_rush_h' },
      { metric: 'Weekday Distribution', w: 'gde_weekday_w', h: 'gde_weekday_h' },
      { metric: 'Top Performing Items', w: 'gde_top_w', h: 'gde_top_h' },
      { metric: 'Payment Methods Mix', w: 'gde_pay_w', h: 'gde_pay_h' },
      { metric: 'Order Channels / Types', w: 'gde_otypes_w', h: 'gde_otypes_h' },
      { metric: 'Cancellations & Voids', w: 'gde_cancels_w', h: 'gde_cancels_h' },
    ],
  },
  {
    id: 'ops',
    title: '⚙️ Kitchen & Operational Velocity',
    rows: [
      { metric: 'Live Kitchen Flow', w: 'gde_live_w', h: 'gde_live_h' },
      { metric: 'Table Performance', w: 'gde_tableperf_w', h: 'gde_tableperf_h' },
      { metric: 'Avg Order-to-Ready Time', w: 'gde_avgready_w', h: 'gde_avgready_h' },
    ],
  },
  {
    id: 'staff',
    title: '👥 Staff & Waiter Analytics',
    rows: [
      { metric: 'Waiter Sales Leaderboard', w: 'gde_leader_w', h: 'gde_leader_h' },
      { metric: 'Waiter Active Shifts', w: 'gde_activity_w', h: 'gde_activity_h' },
    ],
  },
  {
    id: 'customers',
    title: '⭐ Guest Reviews & Satisfaction',
    rows: [
      { metric: 'Average Rating', w: 'gde_avgrating_w', h: 'gde_avgrating_h' },
      { metric: 'Rating Distribution', w: 'gde_dist_w', h: 'gde_dist_h' },
      { metric: 'Critical Reviews Alert', w: 'gde_low_w', h: 'gde_low_h' },
    ],
  },
];

export default function OwnerGuide() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeSection, setActiveSection] = useState('all');
  const t = useT();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const filteredSections =
    activeSection === 'all'
      ? SECTIONS
      : SECTIONS.filter((s) => s.id === activeSection);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-[14px] border-2 border-brand/30 bg-brand/10 hover:bg-brand hover:text-white px-4 py-2 text-[13px] font-black text-brand shadow-sm transition-all duration-200 active:scale-95 group"
      >
        <span className="text-[14px] transition-transform group-hover:scale-110">💡</span>
        <span className="tracking-tight">Analytics Guide</span>
      </button>

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
            role="dialog"
            aria-modal="true"
          >
            {/* Backdrop with full screen blur */}
            <div
              className="fixed inset-0 bg-ink/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
              onClick={() => setOpen(false)}
            />

            {/* Centered Modal Window */}
            <div className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col rounded-[28px] border border-line bg-[var(--c-surface-solid)] shadow-2xl backdrop-blur-2xl animate-in zoom-in-95 fade-in duration-200 overflow-hidden">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between border-b border-line px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/10 text-brand text-xl shadow-inner">
                    💡
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-black text-ink">Analytics Guide</h2>
                    <p className="text-[12.5px] font-medium text-muted">{t('gde_sub')}</p>
                  </div>
                </div>

                <button
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-soft/50 text-muted hover:bg-soft hover:text-ink transition-colors"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Category Filter Pills */}
              <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-soft/30 px-6 py-2.5 no-scrollbar">
                <button
                  onClick={() => setActiveSection('all')}
                  className={`rounded-full px-3 py-1 text-[12px] font-black transition-all ${
                    activeSection === 'all'
                      ? 'bg-brand text-white shadow-xs'
                      : 'text-muted hover:text-ink hover:bg-soft'
                  }`}
                >
                  All Metrics
                </button>
                {SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-black transition-all ${
                      activeSection === s.id
                        ? 'bg-brand text-white shadow-xs'
                        : 'text-muted hover:text-ink hover:bg-soft'
                    }`}
                  >
                    {s.title.split(' ')[0]} {s.title.split(' ')[1]}
                  </button>
                ))}
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8 space-y-6">
                {filteredSections.map((s) => (
                  <div key={s.id} className="space-y-2.5">
                    <p className="font-display text-[14px] font-black text-ink">{s.title}</p>
                    <div className="space-y-2">
                      {s.rows.map((r) => (
                        <div
                          key={r.metric}
                          className="rounded-[16px] border border-line bg-soft/40 p-4 transition-colors hover:border-brand/40"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-[13.5px] font-black text-brand">{r.metric}</p>
                            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black text-brand">
                              Formula
                            </span>
                          </div>
                          <p className="mt-1 text-[13px] font-medium leading-relaxed text-body">
                            {t(r.w)}
                          </p>
                          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-[var(--c-surface-solid)] px-2.5 py-1.5 border border-line/60">
                            <span className="text-[12px]">🧮</span>
                            <p className="font-mono text-[11.5px] font-bold text-muted truncate">
                              {t(r.h)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="shrink-0 border-t border-line bg-soft/20 px-6 py-4 sm:px-8">
                <Btn className="w-full justify-center" onClick={() => setOpen(false)}>
                  {t('gde_gotit')}
                </Btn>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
