// In-memory fixed-window rate limiter for Next.js API routes.
//
// Usage:
//   import { rateLimit, clientIp } from '@/lib/rate-limit';
//   const rl = rateLimit(`scan:${user.id}`, { limit: 10, windowMs: 10 * 60 * 1000 });
//   if (!rl.allowed) {
//     return NextResponse.json({ error: 'Too many requests' }, {
//       status: 429,
//       headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
//     });
//   }
//
// NOTE: state lives in process memory, so it resets on serverless cold start
// and is per-instance on multi-instance deploys. That is acceptable for
// abuse mitigation (order spam, API spend) but NOT for strict quotas —
// if strict per-tenant quotas are ever needed, move the buckets to Redis or
// a Postgres table.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Lazy sweep so the map can never grow without bound: at most one sweep
// per minute, each deleting only expired buckets.
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitOpts {
  /** Max allowed hits inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Hits left in the current window (0 when denied). */
  remaining: number;
  /** Milliseconds until the window resets (0 when allowed). */
  retryAfterMs: number;
}

/**
 * Records one hit for `key` (format: `route:identifier`, e.g.
 * `anon-order:1.2.3.4:<tableId>`) and reports whether it is within the limit.
 */
export function rateLimit(key: string, opts: RateLimitOpts): RateLimitResult {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { allowed: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }
  if (bucket.count < opts.limit) {
    bucket.count += 1;
    return { allowed: true, remaining: opts.limit - bucket.count, retryAfterMs: 0 };
  }
  return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, bucket.resetAt - now) };
}

/** Best-effort client IP for rate-limit keys behind proxies/CDNs. */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}
