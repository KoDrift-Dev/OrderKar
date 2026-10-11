'use client';

// Super-admin manual subscription override: set plan tier / status or extend
// the trial. Used for bank-transfer / manual billing (no Stripe needed).

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminPlanEditor({
  restaurantId,
  initialTier,
}: {
  restaurantId: string;
  initialTier: string;
}) {
  const [tier, setTier] = useState(initialTier);
  const [status, setStatus] = useState('active');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const apply = async (extendTrial: boolean) => {
    setBusy(true);
    setMsg('');
    try {
      const supabase = createClient();
      const { error: rErr } = await supabase
        .from('restaurants')
        .update({ subscription_tier: tier })
        .eq('id', restaurantId);
      if (rErr) throw rErr;

      const patch: Record<string, unknown> = { plan_type: tier, status };
      if (extendTrial) {
        patch.status = 'trial';
        patch.trial_ends_at = new Date(Date.now() + 14 * 86400000).toISOString();
      }
      // Update the latest subscription row for this restaurant.
      const { data: latest } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const lid = (latest as { id?: string } | null)?.id;
      if (lid) {
        const { error: sErr } = await supabase.from('subscriptions').update(patch).eq('id', lid);
        if (sErr) throw sErr;
      } else {
        const { error: sErr } = await supabase.from('subscriptions').insert({
          restaurant_id: restaurantId,
          plan_type: tier,
          status: patch.status,
          trial_ends_at: patch.trial_ends_at ?? null,
        });
        if (sErr) throw sErr;
      }
      setMsg(extendTrial ? 'Trial extended by 14 days.' : `Plan set to ${tier} (${status}).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line/12 bg-soft/50 p-3">
      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">
        💳 Subscription (manual)
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          aria-label="Plan tier"
          disabled={busy}
          className="rounded-lg border border-line/12 bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink"
        >
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Subscription status"
          disabled={busy}
          className="rounded-lg border border-line/12 bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink"
        >
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="past_due">Past due</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button
          onClick={() => apply(false)}
          disabled={busy}
          className="rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
        >
          Apply
        </button>
        <button
          onClick={() => apply(true)}
          disabled={busy}
          className="rounded-lg border border-line/12 px-2.5 py-1.5 text-[12px] font-bold text-ink disabled:opacity-50"
        >
          +14d trial
        </button>
      </div>
      {msg && <p className="mt-1.5 text-[11.5px] text-muted">{msg}</p>}
    </div>
  );
}
