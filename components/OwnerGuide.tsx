'use client';

// Analytics guide: plain-language FAQ explaining every owner-dashboard metric
// — what it means and exactly how it's calculated.

import { useState } from 'react';
import { Btn } from './ui';

const SECTIONS: { title: string; rows: { metric: string; what: string; how: string }[] }[] = [
  {
    title: '📊 Dashboard',
    rows: [
      { metric: 'Revenue', what: 'Is period mein kamaye gaye paise (cancelled orders ke baghair).', how: 'Sab non-cancelled orders ke total_amount ka sum.' },
      { metric: 'Orders', what: 'Kitne orders aaye (cancelled ke baghair).', how: 'Non-cancelled orders ki ginti.' },
      { metric: 'Avg order value', what: 'Ek order pe average kharcha.', how: 'Revenue ÷ Orders.' },
      { metric: 'Items sold', what: 'Kitni dishes biki.', how: 'Sab order_items ki quantity ka sum.' },
      { metric: 'Void rate', what: 'Kitne % orders cancel hue. 2% se zyada = problem.', how: 'Cancelled orders ÷ Total orders × 100.' },
      { metric: 'Smart summary', what: 'Aaj ki auto-highlights.', how: 'Rules se banta hai: aaj vs kal revenue, top item, void alerts, avg prep time, best waiter. AI nahi — fixed formulas.' },
      { metric: 'Revenue trend', what: 'Time ke saath revenue ka graph.', how: 'Har din (ya month) ke orders ka sum. Khaali din 0 dikhte hain.' },
    ],
  },
  {
    title: '💰 Sales',
    rows: [
      { metric: 'Rush-hour heatmap', what: 'Din ke kis hour mein sab se zyada orders.', how: 'Har order ke created_at hour ki ginti (24 boxes).' },
      { metric: 'Weekday bars', what: 'Hafte ke kis din kitne orders.', how: 'Orders ki weekday-wise ginti (Mon–Sun).' },
      { metric: 'Top items', what: 'Sab se zyada bikne wali dishes.', how: 'Quantity ke hisaab se ranking + unki revenue.' },
      { metric: 'Payment methods', what: 'Cash / Card / JazzCash / EasyPaisa ka share.', how: 'Har method ki revenue ka total revenue se %. "Not recorded" = waiter ne payment record nahi ki.' },
      { metric: 'Order types', what: 'Dine-in vs takeaway vs delivery.', how: 'Orders ki order_type wise ginti.' },
      { metric: 'Cancellations', what: 'Cancel hue orders, unki value aur reasons.', how: 'Status=cancelled wale orders. Reason kitchen se cancel karte waqt select hota hai.' },
    ],
  },
  {
    title: '⚙️ Operations',
    rows: [
      { metric: 'Live kitchen', what: 'Is waqt kitchen mein kya chal raha — sirf dekhne ke liye.', how: 'Realtime: pending / preparing / ready orders. Status sirf kitchen staff change kar sakta hai.' },
      { metric: 'Table performance', what: 'Kaunsi table kitna kamati hai.', how: 'Har table ke orders ka sum. Green = top third, red = bottom third.' },
      { metric: 'Avg order-to-ready', what: 'Order lagne se ready hone tak average time.', how: 'Ready/completed orders ka (updated_at − created_at) ka average. Estimate hai — beech wali status changes ka exact time record nahi hota.' },
    ],
  },
  {
    title: '👥 Staff',
    rows: [
      { metric: 'Waiter leaderboard', what: 'Waiters ki sales ranking.', how: 'Har waiter ke orders (waiter_id se) → orders count, sales sum, avg = sales ÷ orders.' },
      { metric: 'Waiter activity', what: 'Aaj kaun waiter kitna laya.', how: 'Aaj ke orders waiter-wise: count + revenue.' },
    ],
  },
  {
    title: '⭐ Customers',
    rows: [
      { metric: 'Avg rating', what: 'Sab reviews ki average rating.', how: 'Ratings ka sum ÷ reviews ki ginti (1–5 stars).' },
      { metric: 'Rating distribution', what: 'Kitne 5★, kitne 1★…', how: 'Har star level ki ginti.' },
      { metric: 'Low ratings', what: '2★ ya kam wale reviews — foran action lo.', how: 'Rating ≤ 2 wale reviews ki ginti.' },
    ],
  },
];

export default function OwnerGuide() {
  const [open, setOpen] = useState(false);
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
                <p className="mt-0.5 text-[13px] text-muted">Har metric ka matlab aur uska formula — simple zubaan mein.</p>
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
                        <p className="mt-1 text-[13px] leading-relaxed text-body">{r.what}</p>
                        <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">🧮 {r.how}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <Btn className="mt-6 w-full" onClick={() => setOpen(false)}>Samajh gaya ✓</Btn>
          </div>
        </div>
      )}
    </>
  );
}
