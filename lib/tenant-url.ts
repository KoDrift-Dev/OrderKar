// Tenant URL helpers: subdomain parsing + subdomain-aware URL building.
// Pure functions — safe to import from middleware (edge runtime).

export function rootDomain(): string {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orderkar.pk';
}

const RESERVED = new Set([
  'www',
  'admin',
  'app',
  'api',
  'mail',
  'cdn',
  'static',
  'assets',
  'webhooks',
]);

/** Extract the tenant slug from a hostname, or null when it isn't a tenant host. */
export function tenantFromHost(host: string, root?: string): string | null {
  const r = root ?? rootDomain();
  const h = host.split(':')[0].toLowerCase().trim();
  if (!h) return null;
  if (h === 'localhost' || h === '127.0.0.1') return null;
  if (h.endsWith('.localhost')) {
    const sub = h.slice(0, -'.localhost'.length);
    return sub && !sub.includes('.') && !RESERVED.has(sub) ? sub : null;
  }
  if (h === r || h === `www.${r}`) return null;
  if (h.endsWith(`.${r}`)) {
    const sub = h.slice(0, -(r.length + 1));
    return sub && !sub.includes('.') && !RESERVED.has(sub) ? sub : null;
  }
  return null;
}

/**
 * Absolute URL for a tenant path.
 * Uses https://{slug}.{rootDomain}/path when the current origin supports
 * subdomains (root domain, tenant subdomain, or localhost dev); otherwise
 * falls back to {origin}/r/{slug}/path (e.g. *.vercel.app previews).
 */
export function tenantUrl(slug: string, path = '/', origin?: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const o = origin ?? (typeof window !== 'undefined' ? window.location.origin : '');
  if (!o) return `/r/${slug}${p}`;
  try {
    const u = new URL(o);
    const r = rootDomain();
    const h = u.hostname.toLowerCase();
    if (h === r || h === `www.${r}` || tenantFromHost(h, r) !== null) {
      return `${u.protocol}//${slug}.${r}${p}`;
    }
    if (h.endsWith('.localhost') || h === 'localhost') {
      const port = u.port ? `:${u.port}` : '';
      return `${u.protocol}//${slug}.localhost${port}${p}`;
    }
  } catch {
    // fall through to path-based URL
  }
  return `${o}/r/${slug}${p}`;
}

/** Convert a #rrggbb hex color to an "r g b" triplet for --c-brand-rgb. */
export function hexToRgbTriplet(hex: string): string | null {
  const m = hex
    .trim()
    .replace(/^#/, '')
    .match(/^([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}
