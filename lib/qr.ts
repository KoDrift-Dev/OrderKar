'use client';

// QR definitions. URLs are built from window.location.origin at runtime so
// QRs always point at the live deployment (no hardcoded domain to rot).
// On the root domain / localhost, table QRs use the short tenant subdomain:
// https://{slug}.orderkar.pk/table/5

import { tenantUrl } from './tenant-url';

export interface QrDef {
  id: string;
  label: string;
  sub: string;
  url: string;
}

export function tableQr(slug: string, n: number, origin: string): QrDef {
  const url = tenantUrl(slug, `/table/${n}`, origin);
  return { id: `table-${n}`, label: `Table ${n}`, sub: url, url };
}

export function reviewsQr(slug: string, origin: string): QrDef {
  const url = tenantUrl(slug, '/feedback', origin);
  return { id: 'reviews', label: 'Reviews', sub: url, url };
}

export function allQrs(slug: string, tableCount: number, origin: string): QrDef[] {
  const qrs: QrDef[] = [];
  for (let n = 1; n <= tableCount; n++) qrs.push(tableQr(slug, n, origin));
  qrs.push(reviewsQr(slug, origin));
  return qrs;
}
