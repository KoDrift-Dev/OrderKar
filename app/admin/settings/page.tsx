import { createClient } from '@/lib/supabase/server';
import { Card, PageHeader } from '@/components/ui';
import { fmtPKR } from '@/lib/format';
import { BILLING_PERIODS, PLAN_FEATURES, TRIAL_DAYS, type BillingPeriod } from '@/lib/subscription';

const PERIOD_ORDER: BillingPeriod[] = ['monthly', '6month', 'yearly'];

export default async function AdminSettings() {
  const supabase = createClient();
  const { data: restaurants } = await supabase.from('restaurants').select('subscription_tier');

  const periodCounts = new Map<string, number>();
  for (const r of restaurants ?? []) {
    const t = (r as { subscription_tier?: string })?.subscription_tier ?? 'monthly';
    periodCounts.set(t, (periodCounts.get(t) ?? 0) + 1);
  }
  const mrr = [...periodCounts.entries()].reduce((s, [period, count]) => {
    const p = BILLING_PERIODS[period as BillingPeriod];
    if (!p) return s;
    // Normalize to monthly equivalent for MRR estimate.
    return s + Math.round((p.pricePKR / p.months) * count);
  }, 0);

  return (
    <div>
      <PageHeader title="Platform Settings" sub="Billing periods, distribution and platform info" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card-luxury p-5">
          <p className="text-[12px] font-bold uppercase tracking-wider text-muted">Est. Monthly Revenue</p>
          <p className="mt-2 font-display text-[26px] font-black tracking-tight text-ink">{fmtPKR(mrr)}</p>
          <p className="mt-1 text-[13px] font-bold text-muted">normalized from billing periods</p>
        </Card>
        {PERIOD_ORDER.map((key) => {
          const p = BILLING_PERIODS[key];
          return (
            <Card key={key} className="stat-card-luxury p-5">
              <p className="text-[12px] font-bold uppercase tracking-wider text-brand">{p.name}</p>
              <p className="mt-2 font-display text-[26px] font-black tracking-tight text-ink">
                {fmtPKR(p.pricePKR)}
                <span className="text-[14px] font-bold text-muted">
                  {key === 'monthly' ? '/mo' : key === '6month' ? ' /6mo' : ' /yr'}
                </span>
              </p>
              <p className="mt-1 text-[13px] font-bold text-muted">{periodCounts.get(key) ?? 0} restaurants</p>
            </Card>
          );
        })}
      </div>

      <Card className="mt-6 p-5">
        <h3 className="mb-2 font-display text-[16px] font-extrabold text-ink">
          Plan Features <span className="text-[13px] font-bold text-muted">(same for everyone)</span>
        </h3>
        <p className="mb-4 text-[13px] text-muted">
          {TRIAL_DAYS}-day free trial included. One fixed fee — no tiers.
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_FEATURES.map((f) => (
            <div key={f} className="flex items-start gap-2 rounded-[10px] border border-line/12 px-3 py-2.5">
              <span className="text-emerald-500" aria-hidden>✓</span>
              <span className="text-[13px] font-medium text-ink">{f}</span>
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
            <span className="font-bold text-ink">{TRIAL_DAYS} days</span>
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
