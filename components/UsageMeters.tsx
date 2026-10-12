'use client';

// Fair-use usage meters: shows current usage vs limits for a restaurant.
// Used by superadmin (per-restaurant) and owner (own restaurant).

import { FAIR_USE_LIMITS, type UsageMetric } from '@/lib/subscription';

export default function UsageMeters({ metrics }: { metrics: UsageMetric[] }) {
  return (
    <div className="space-y-3">
      {metrics.map((m) => {
        const pct = m.limit > 0 ? Math.min(100, Math.round((m.used / m.limit) * 100)) : 0;
        const over = m.used > m.limit;
        const near = !over && pct >= 80;
        return (
          <div key={m.key}>
            <div className="flex items-center justify-between text-[13px] font-bold">
              <span className="text-ink">{m.label}</span>
              <span className={over ? 'text-red-500' : near ? 'text-amber-500' : 'text-muted'}>
                {m.used.toLocaleString('en-PK')} / {m.limit.toLocaleString('en-PK')} {m.unit}
                {over && ' — over limit'}
                {near && !over && ' — near limit'}
              </span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line/20">
              <div
                className={`h-full rounded-full transition-all ${
                  over
                    ? 'bg-red-500'
                    : near
                      ? 'bg-amber-500'
                      : 'bg-gradient-to-r from-brand to-brand-deep'
                }`}
                style={{ width: `${Math.max(3, Math.min(100, pct))}%` }}
              />
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[12px] text-muted">
        Storage covers menu photos, staff photos & uploads (Cloudinary + Supabase). Track exact
        bytes in those dashboards; this meter counts uploaded files.
      </p>
    </div>
  );
}

/** Build metrics from raw counts. Storage is file count (see note above). */
export function buildUsageMetrics(counts: {
  tables: number;
  ordersThisMonth: number;
  menuItems: number;
  staff: number;
  files: number;
}): UsageMetric[] {
  return [
    { key: 'tables', label: 'Tables', used: counts.tables, limit: FAIR_USE_LIMITS.tables, unit: '' },
    { key: 'ordersPerMonth', label: 'Orders this month', used: counts.ordersThisMonth, limit: FAIR_USE_LIMITS.ordersPerMonth, unit: '' },
    { key: 'menuItems', label: 'Menu items', used: counts.menuItems, limit: FAIR_USE_LIMITS.menuItems, unit: '' },
    { key: 'staff', label: 'Staff accounts', used: counts.staff, limit: FAIR_USE_LIMITS.staff, unit: '' },
    { key: 'storageGB', label: 'Uploaded files', used: counts.files, limit: FAIR_USE_LIMITS.storageGB * 1000, unit: 'files*' },
  ];
}
