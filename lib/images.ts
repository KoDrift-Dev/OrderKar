// Image CDN helper: rewrites Supabase Storage public URLs to the Cloudflare
// Worker CDN when NEXT_PUBLIC_IMAGE_CDN is set. The database always stores
// the Supabase origin URL; display goes through the edge cache.
// Without the env var, the original URL is used (zero-config fallback).

const CDN = (process.env.NEXT_PUBLIC_IMAGE_CDN ?? '').replace(/\/$/, '');

export function cdnUrl(url: string | null | undefined): string {
  if (!url) return '';
  if (!CDN) return url;
  const m = url.match(/\/storage\/v1\/object\/public\/menu-images(\/.*)$/);
  if (m) return `${CDN}${m[1]}`;
  return url;
}
