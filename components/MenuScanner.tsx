'use client';

// AI menu scanner: upload a photo of a paper menu -> AI extracts
// items/prices/categories -> review & edit -> bulk import into the menu.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logActivity, ACT } from '@/lib/activity';
import { Btn, Card, Input, Label } from './ui';
import PhotoDropzone, { useUploadState } from './PhotoDropzone';
import { useGuard } from './DeleteFlow';
import type { ExtractedItem } from '@/lib/vision';

type Row = ExtractedItem & { key: number; include: boolean };

export default function MenuScanner({
  restaurantId,
  onClose,
  onImported,
}: {
  restaurantId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const guard = useGuard();
  const fUp = useUploadState();
  const [imageUrl, setImageUrl] = useState('');
  const [step, setStep] = useState<'upload' | 'scanning' | 'review' | 'importing'>('upload');
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [notConfigured, setNotConfigured] = useState(false);

  const scan = () =>
    guard(async () => {
      if (!imageUrl) {
        setError('Please upload a menu photo first.');
        return;
      }
      setError('');
      setNotConfigured(false);
      setStep('scanning');
      try {
        const res = await fetch('/api/menu/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ restaurantId, imageUrl }),
        });
        const j = (await res.json().catch(() => ({}))) as {
          items?: ExtractedItem[];
          error?: string;
        };
        if (res.status === 503) {
          setNotConfigured(true);
          setStep('upload');
          return;
        }
        if (!res.ok || !j.items) throw new Error(j.error || 'Scan failed');
        if (j.items.length === 0) throw new Error('No items found — try a clearer, well-lit photo.');
        setRows(j.items.map((it, i) => ({ ...it, key: i, include: true })));
        setStep('review');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Scan failed');
        setStep('upload');
      }
    });

  const setRow = (key: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const importRows = () =>
    guard(async () => {
      const kept = rows.filter((r) => r.include && r.name.trim() && r.price >= 0);
      if (kept.length === 0) {
        setError('Select at least one item to import.');
        return;
      }
      setError('');
      setStep('importing');
      try {
        const supabase = createClient();
        const { data: cats } = await supabase
          .from('menu_categories')
          .select('id, name')
          .eq('restaurant_id', restaurantId);
        const catMap = new Map<string, string>();
        for (const c of (cats as { id: string; name: string }[] | null) ?? []) {
          catMap.set(c.name.trim().toLowerCase(), c.id);
        }
        // Create categories that don't exist yet.
        const needed = [...new Set(kept.map((r) => r.category.trim() || 'General'))].filter(
          (n) => !catMap.has(n.toLowerCase()),
        );
        for (const name of needed) {
          const { data, error } = await supabase
            .from('menu_categories')
            .insert({ restaurant_id: restaurantId, name })
            .select('id')
            .single();
          if (error) throw new Error('Could not create category: ' + name);
          catMap.set(name.toLowerCase(), (data as { id: string }).id);
        }
        const payload = kept.map((r) => ({
          restaurant_id: restaurantId,
          category_id: catMap.get((r.category.trim() || 'General').toLowerCase()) as string,
          name: r.name.trim(),
          description: r.description,
          price: r.price,
          is_available: true,
        }));
        const { error } = await supabase.from('menu_items').insert(payload);
        if (error) throw error;
        logActivity(supabase, {
          restaurantId,
          action: ACT.MENU_BULK_IMPORTED,
          entityType: 'menu',
          details: { count: payload.length, source: 'menu_scan' },
        });
        onImported();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Import failed');
        setStep('review');
      }
    });

  const selected = rows.filter((r) => r.include).length;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/60 p-4" onClick={onClose}>
      <Card
        className="flex max-h-[92vh] w-full max-w-3xl flex-col p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[17px] font-extrabold text-ink">📷 AI Menu Scanner</h2>
            <p className="text-[12px] text-muted">Snap a paper menu — we&apos;ll digitize it for you.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close scanner"
            className="rounded-lg px-2.5 py-1.5 text-[18px] text-muted hover:bg-soft"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {notConfigured && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-[13px] text-amber-700 dark:text-amber-300">
              <p className="font-bold">AI scanning isn&apos;t connected yet.</p>
              <p className="mt-1">
                Add these environment variables (Vercel → Settings → Environment Variables), then redeploy:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 font-mono text-[12px]">
                <li>VISION_API_URL — e.g. https://api.openai.com/v1</li>
                <li>VISION_API_KEY — your API key</li>
                <li>VISION_MODEL — e.g. gpt-4o-mini</li>
              </ul>
              <p className="mt-2">
                Works with OpenAI, Azure OpenAI, or OpenRouter (any OpenAI-compatible endpoint).
              </p>
            </div>
          )}

          {error && (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-[13px] font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {step === 'upload' && (
            <div className="space-y-4">
              <div>
                <Label>Menu photo</Label>
                <div className="mt-1.5">
                  <PhotoDropzone
                    bucket="menu-images"
                    folder={`${restaurantId}/scans`}
                    value={imageUrl}
                    onChange={setImageUrl}
                    onError={setError}
                    onUploadingChange={fUp.set}
                  />
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  Tip: flat, well-lit photo, whole menu visible. One page at a time works best.
                </p>
              </div>
              <Btn onClick={scan} disabled={!imageUrl || fUp.uploading} className="w-full sm:w-auto">
                {fUp.uploading ? 'Uploading…' : '✨ Extract items with AI'}
              </Btn>
            </div>
          )}

          {step === 'scanning' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="text-4xl animate-pulse" aria-hidden>🔍</span>
              <p className="text-[14px] font-bold text-ink">Reading your menu…</p>
              <p className="max-w-xs text-[12.5px] text-muted">Detecting dishes, prices and categories.</p>
            </div>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <span className="text-4xl animate-pulse" aria-hidden>📥</span>
              <p className="text-[14px] font-bold text-ink">Importing to your menu…</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[13.5px] font-bold text-ink">
                  {rows.length} items found — {selected} selected
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setRows((p) => p.map((r) => ({ ...r, include: true })))}
                    className="text-[12px] font-bold text-brand underline"
                  >
                    Select all
                  </button>
                  <button
                    onClick={() => setRows((p) => p.map((r) => ({ ...r, include: false })))}
                    className="text-[12px] font-bold text-muted underline"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {rows.map((r) => (
                  <div
                    key={r.key}
                    className={`grid grid-cols-[auto_1fr] gap-2 rounded-xl border p-3 sm:grid-cols-[auto_1fr_110px_130px_auto] sm:items-center ${
                      r.include ? 'border-line bg-soft/40' : 'border-line/60 opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={r.include}
                      onChange={(e) => setRow(r.key, { include: e.target.checked })}
                      aria-label={`Include ${r.name}`}
                      className="mt-1 h-5 w-5 accent-[var(--c-brand)] sm:mt-0"
                    />
                    <Input
                      value={r.name}
                      onChange={(e) => setRow(r.key, { name: e.target.value })}
                      placeholder="Dish name"
                      aria-label="Dish name"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={String(r.price)}
                      onChange={(e) => setRow(r.key, { price: Number(e.target.value) })}
                      placeholder="Price"
                      aria-label="Price"
                    />
                    <Input
                      value={r.category}
                      onChange={(e) => setRow(r.key, { category: e.target.value })}
                      placeholder="Category"
                      aria-label="Category"
                    />
                    <button
                      onClick={() => setRows((p) => p.filter((x) => x.key !== r.key))}
                      aria-label={`Remove ${r.name}`}
                      className="justify-self-start rounded-lg px-2 py-1 text-[15px] text-rose-500 hover:bg-rose-500/10 sm:justify-self-auto"
                    >
                      🗑
                    </button>
                    <Input
                      value={r.description ?? ''}
                      onChange={(e) => setRow(r.key, { description: e.target.value || null })}
                      placeholder="Description (optional)"
                      aria-label="Description"
                      className="col-span-2 sm:col-span-5"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {step === 'review' && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-4">
            <button onClick={() => setStep('upload')} className="text-[13px] font-bold text-muted underline">
              ← Scan another photo
            </button>
            <Btn onClick={importRows} disabled={selected === 0}>
              📥 Import {selected} item{selected === 1 ? '' : 's'}
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}
