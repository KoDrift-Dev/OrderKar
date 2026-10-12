import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';

const PLANS = [
  { tier: 'starter', price: 4999, features: ['Up to 50 menu items', '2 staff accounts', 'Basic reports'] },
  { tier: 'pro', price: 9999, features: ['Unlimited menu items', '10 staff accounts', 'Advanced analytics', 'Inventory management'] },
  { tier: 'enterprise', price: 24999, features: ['Everything in Pro', 'Multi-branch (coming)', 'Priority support', 'Custom integrations'] },
];

export default async function AdminSettings() {
  const supabase = createClient();
  const { data: restaurants } = await supabase.from('restaurants').select('subscription_tier');

  const tierCounts = new Map<string, number>();
  for (const r of restaurants ?? []) {
    const t = r?.subscription_tier ?? 'starter';
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
  }
  const mrr = [...tierCounts.entries()].reduce((s, [tier, count]) => {
    const plan = PLANS.find((p) => p.tier === tier);
    return s + (plan ? plan.price * count : 0);
  }, 0);

  return (
    <div>
      <PageHeader title="Platform Settings" sub="Pricing tiers, plan distribution and platform info" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-luxury p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">Monthly Recurring Revenue</p>
          <p className="mt-2 font-display text-[26px] font-black tracking-tight text-ink">{fmtPKR(mrr)}</p>
          <p className="mt-1 text-[13px] font-bold text-muted">estimated from active tiers</p>
        </Card>
        {PLANS.map((p) => (
          <Card key={p.tier} className="stat-card-luxury p-5">
            <p className="text-[12px] font-bold uppercase tracking-wider text-brand">{p.tier}</p>
            <p className="mt-2 font-display text-[26px] font-black tracking-tight text-ink">{fmtPKR(p.price)}<span className="text-[14px] font-bold text-muted">/mo</span></p>
            <p className="mt-1 text-[13px] font-bold text-muted">{tierCounts.get(p.tier) ?? 0} restaurants</p>
          </Card>
        ))}
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-4 font-display text-[16px] font-extrabold text-ink">Plan Features Reference</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.tier} className="rounded-[12px] border border-line/12 p-4">
              <p className="text-[14px] font-extrabold uppercase tracking-wider text-ink">{p.tier}</p>
              <p className="mt-1 font-display text-[20px] font-black text-brand">{fmtPKR(p.price)}/mo</p>
              <ul className="mt-3 space-y-1.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px] font-medium text-muted">
                    <span className="text-brand">✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-2 font-display text-[16px] font-extrabold text-ink">Platform Info</h3>
        <div className="grid gap-2 text-[13.5px] sm:grid-cols-2">
          <div className="flex justify-between border-b border-line/8 py-2">
            <span className="font-bold text-muted">Production URL</span>
            <span className="font-mono font-bold text-ink">orderkarr.vercel.app</span>
          </div>
          <div className="flex justify-between border-b border-line/8 py-2">
            <span className="font-bold text-muted">Version</span>
            <span className="font-bold text-ink">v1.0</span>
          </div>
          <div className="flex justify-between border-b border-line/8 py-2">
            <span className="font-bold text-muted">Trial Period</span>
            <span className="font-bold text-ink">14 days</span>
          </div>
          <div className="flex justify-between border-b border-line/8 py-2">
            <span className="font-bold text-muted">Currency</span>
            <span className="font-bold text-ink">PKR (₨)</span>
          </div>
        </div>
      </Card>
    </div>
  );
}
