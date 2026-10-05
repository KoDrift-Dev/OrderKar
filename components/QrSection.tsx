'use client';

// QR code grid — per-table + reviews QRs. URLs are built from
// window.location.origin at runtime, so QRs always point at the live
// deployment. QRs render as inline SVG (qrcode package); PNG download goes
// through canvas client-side. Print-all prints a clean sheet.

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { allQrs, tableQr, reviewsQr, type QrDef } from '@/lib/qr';
import { useT, useLang } from '@/lib/i18n';
import { Btn, Card, SectionHead } from './ui';
import type { DiningTable } from '@/lib/types';

export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: 'svg', margin: 2, width: 360 });
}

export async function downloadPng(svg: string, filename: string): Promise<void> {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('qr render failed'));
      img.src = url;
    });
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    const png: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png'),
    );
    if (!png) return;
    const a = document.createElement('a');
    const dl = URL.createObjectURL(png);
    a.href = dl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(dl), 4000);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function QrCard({ qr, svg, restaurantName }: { qr: QrDef; svg?: string; restaurantName: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex flex-col items-center p-4 text-center">
      {svg ? (
        <div
          className="h-36 w-36 overflow-hidden rounded-[12px] border border-line bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={t('qr_aria', { label: qr.label })}
        />
      ) : (
        <div className="flex h-36 w-36 items-center justify-center rounded-[12px] border border-line bg-white">
          <span className="text-xs font-semibold text-muted">{t('qr_loading')}</span>
        </div>
      )}
      <p className="mt-3 font-display text-[15px] font-extrabold text-ink">{qr.label}</p>
      <p className="mt-0.5 max-w-full truncate text-[11px] text-muted">{qr.sub}</p>
      <button
        type="button"
        disabled={!svg || busy}
        onClick={async () => {
          if (!svg) return;
          setBusy(true);
          try {
            await downloadPng(svg, `${restaurantName}-${qr.id}.png`);
          } finally {
            setBusy(false);
          }
        }}
        className="mt-3 inline-flex select-none items-center gap-1.5 rounded-btn bg-[var(--c-surface-solid)] px-3.5 py-1.5 text-[12.5px] font-bold text-ink border border-line shadow-lift hover:-translate-y-px active:translate-y-0 transition-all disabled:opacity-50"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 20h16" />
        </svg>
        {busy ? '…' : 'PNG'}
      </button>
    </Card>
  );
}

export default function QrSection({
  slug,
  tables,
  restaurantName,
}: {
  slug: string;
  tables: DiningTable[];
  restaurantName: string;
}) {
  const t = useT();
  const lang = useLang();
  const [svgs, setSvgs] = useState<Record<string, string>>({});
  const [qrs, setQrs] = useState<QrDef[]>([]);

  useEffect(() => {
    const sectionName = (raw: string): string => {
      if (raw === 'outdoor') return t('qr_sec_outdoor');
      if (raw === 'rooftop') return t('qr_sec_rooftop');
      if (raw === 'indoor') return t('qr_sec_indoor');
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };
    const origin = window.location.origin;
    const active = [...tables]
      .filter((tb) => tb.is_active)
      .sort((a, b) => a.table_number - b.table_number);
    const defs: QrDef[] = active.map((tb) => {
      const raw = (tb.floor_section || '').trim().toLowerCase();
      const section = raw ? sectionName(raw) : '';
      const label = raw && raw !== 'indoor' ? `Table ${tb.table_number} · ${section}` : `Table ${tb.table_number}`;
      const qr = tableQr(slug, tb.table_number, origin);
      return { ...qr, label, sub: section ? `${section} · ${qr.url}` : qr.url };
    });
    defs.push(reviewsQr(slug, origin));
    // Back-compat: if no table rows exist yet, fall back to 6 generic tables.
    const finalDefs = defs.length > 1 ? defs : allQrs(slug, 6, origin);
    setQrs(finalDefs);
    let live = true;
    (async () => {
      const entries = await Promise.all(defs.map(async (qr) => [qr.id, await qrSvg(qr.url)] as const));
      if (live) setSvgs(Object.fromEntries(entries));
    })();
    return () => {
      live = false;
    };
  }, [slug, tables, lang]);

  return (
    <section>
      <SectionHead
        title="QR codes"
        sub={t('qr_sub')}
        action={
          <Btn size="sm" variant="secondary" onClick={() => window.print()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2m-12-3h12v6H6z" />
            </svg>
            {t('qr_print_all')}
          </Btn>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {qrs.map((qr) => (
          <QrCard key={qr.id} qr={qr} svg={svgs[qr.id]} restaurantName={slug} />
        ))}
      </div>

      <div id="qr-print-sheet" className="hidden bg-white p-8 print:block">
        <h1 style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 800, fontSize: 28, color: '#1F2937' }}>
          OrderKar — Table QR codes
        </h1>
        <p style={{ color: '#6B7280', marginBottom: 24 }}>{t('qr_print_sub', { name: restaurantName })}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          {qrs.map((qr) => (
            <div key={qr.id} style={{ textAlign: 'center', breakInside: 'avoid' }}>
              {svgs[qr.id] && (
                <div style={{ width: 260, height: 260, margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: svgs[qr.id] }} />
              )}
              <p style={{ fontWeight: 800, fontSize: 20, color: '#1F2937', marginTop: 8 }}>{qr.label}</p>
              <p style={{ color: '#6B7280', fontSize: 13 }}>{qr.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
