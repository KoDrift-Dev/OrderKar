'use client';

// QR definitions. URLs are built from window.location.origin at runtime so
// QRs always point at the live deployment (no hardcoded domain to rot).

export interface QrDef {
  id: string;
  label: string;
  sub: string;
  url: string;
}

export function tableQr(slug: string, n: number, origin: string): QrDef {
  const url = `${origin}/r/${slug}/table/${n}`;
  return { id: `table-${n}`, label: `Table ${n}`, sub: url, url };
}

export function reviewsQr(slug: string, origin: string): QrDef {
  const url = `${origin}/r/${slug}/feedback`;
  return { id: 'reviews', label: 'Reviews', sub: url, url };
}

export function allQrs(slug: string, tableCount: number, origin: string): QrDef[] {
  const qrs: QrDef[] = [];
  for (let n = 1; n <= tableCount; n++) qrs.push(tableQr(slug, n, origin));
  qrs.push(reviewsQr(slug, origin));
  return qrs;
}
