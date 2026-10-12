import { describe, expect, it, vi, beforeEach } from 'vitest';
import { rateLimit, clientIp } from './rate-limit';

describe('rateLimit', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows hits up to the limit, then denies', () => {
    const key = `t1:${Date.now()}`;
    const opts = { limit: 3, windowMs: 60_000 };
    expect(rateLimit(key, opts)).toMatchObject({ allowed: true, remaining: 2 });
    expect(rateLimit(key, opts)).toMatchObject({ allowed: true, remaining: 1 });
    expect(rateLimit(key, opts)).toMatchObject({ allowed: true, remaining: 0 });
    const denied = rateLimit(key, opts);
    expect(denied.allowed).toBe(false);
    expect(denied.remaining).toBe(0);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets after the window expires', () => {
    vi.useFakeTimers();
    const key = `t2:${Date.now()}`;
    const opts = { limit: 1, windowMs: 1_000 };
    expect(rateLimit(key, opts).allowed).toBe(true);
    expect(rateLimit(key, opts).allowed).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, opts)).toMatchObject({ allowed: true, remaining: 0 });
  });

  it('tracks different keys independently', () => {
    const base = `t3:${Date.now()}`;
    const opts = { limit: 1, windowMs: 60_000 };
    expect(rateLimit(`${base}:a`, opts).allowed).toBe(true);
    expect(rateLimit(`${base}:b`, opts).allowed).toBe(true);
    expect(rateLimit(`${base}:a`, opts).allowed).toBe(false);
  });
});

describe('clientIp', () => {
  it('prefers the first x-forwarded-for entry', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(clientIp(req)).toBe('1.2.3.4');
  });

  it('falls back to x-real-ip then unknown', () => {
    const withReal = new Request('https://x.test', { headers: { 'x-real-ip': '9.9.9.9' } });
    expect(clientIp(withReal)).toBe('9.9.9.9');
    const bare = new Request('https://x.test');
    expect(clientIp(bare)).toBe('unknown');
  });
});
