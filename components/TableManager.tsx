'use client';

// Owner table management — add/edit/delete tables with sections
// (Indoor / Outdoor / Rooftop / custom), capacity, active toggle,
// and per-table QR view/download/print.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { tableQr } from '@/lib/qr';
import { useT } from '@/lib/i18n';
import { qrSvg, downloadPng } from './QrSection';
import { Btn, Card, SectionHead, Input, Label, Empty } from './ui';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';
import type { DiningTable } from '@/lib/types';

const PRESET_SECTIONS = ['Indoor', 'Outdoor', 'Rooftop'];

interface FormState {
  number: string;
  section: string;
  customSection: string;
  capacity: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = { number: '', section: 'Indoor', customSection: '', capacity: '4', isActive: true };

type TFn = ReturnType<typeof useT>;

/** Raw section string → display label (presets translated, custom kept as-is). */
function sectionName(raw: string | undefined, tt: TFn): string {
  const s = (raw || '').trim().toLowerCase();
  if (s === 'outdoor') return tt('tbl_sec_outdoor');
  if (s === 'rooftop') return tt('tbl_sec_rooftop');
  if (s === 'indoor' || !s) return tt('tbl_sec_indoor');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function sectionLabel(t: DiningTable, tt: TFn): string {
  return sectionName(t.floor_section, tt);
}

function QrModal({ table, slug, onClose }: { table: DiningTable; slug: string; onClose: () => void }) {
  const t = useT();
  const [svg, setSvg] = useState('');
  const [busy, setBusy] = useState(false);
  const qr = tableQr(slug, table.table_number, typeof window !== 'undefined' ? window.location.origin : '');

  useEffect(() => {
    let live = true;
    qrSvg(qr.url).then((s) => {
      if (live) setSvg(s);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qr.url]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-sm flex-col items-center rounded-[24px] bg-[var(--c-surface-solid)] p-6 text-center shadow-2xl">
        <h2 className="font-display text-[18px] font-extrabold text-ink">
          Table {table.table_number} · {sectionLabel(table, t)}
        </h2>
        <p className="mt-1 text-[12px] text-muted">{t('tbl_qr_hint')}</p>
        {svg ? (
          <div
            className="mt-4 h-56 w-56 overflow-hidden rounded-[16px] border border-line bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={t('tbl_qr_aria', { n: table.table_number })}
          />
        ) : (
          <div className="mt-4 flex h-56 w-56 items-center justify-center rounded-[16px] border border-line bg-white">
            <span className="text-xs font-semibold text-muted">{t('tbl_loading')}</span>
          </div>
        )}
        <p className="mt-3 max-w-full truncate px-2 font-mono text-[11px] text-muted">{qr.url}</p>
        <div className="mt-4 grid w-full grid-cols-2 gap-2.5">
          <Btn
            variant="secondary"
            disabled={!svg || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await downloadPng(svg, `table-${table.table_number}-qr.png`);
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '…' : '⬇ PNG'}
          </Btn>
          <Btn variant="secondary" onClick={onClose}>
            {t('tbl_close')}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export default function TableManager({
  restaurantId,
  slug,
  tables,
  onChange,
}: {
  restaurantId: string;
  slug: string;
  tables: DiningTable[];
  onChange: (tables: DiningTable[]) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<DiningTable | null>(null);
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const guard = useGuard();
  const del = useUndoDelete<DiningTable>(async (tb) => {
    await createClient().from('tables').delete().eq('id', tb.id);
  });

  const sorted = useMemo(() => [...tables].sort((a, b) => a.table_number - b.table_number), [tables]);
  const usedNumbers = useMemo(() => new Set(tables.map((tb) => tb.table_number)), [tables]);

  const nextFree = useMemo(() => {
    let n = 1;
    while (usedNumbers.has(n)) n++;
    return n;
  }, [usedNumbers]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, number: String(nextFree) });
    setFormError('');
    setEditing('new');
  };

  const openEdit = (tb: DiningTable) => {
    const preset = PRESET_SECTIONS.find((p) => p.toLowerCase() === (tb.floor_section || '').toLowerCase());
    setForm({
      number: String(tb.table_number),
      section: preset ?? 'Custom',
      customSection: preset ? '' : tb.floor_section,
      capacity: String(tb.capacity),
      isActive: tb.is_active,
    });
    setFormError('');
    setEditing(tb);
  };

  const save = () =>
    guard(async () => {
      setFormError('');
      const num = parseInt(form.number, 10);
      if (!Number.isInteger(num) || num < 1 || num > 999) {
        setFormError(t('tbl_val_number'));
        return;
      }
      const editingId = editing !== 'new' && editing ? editing.id : null;
      if (tables.some((tb) => tb.table_number === num && tb.id !== editingId)) {
        setFormError(t('tbl_val_dup', { n: num }));
        return;
      }
      const section = form.section === 'Custom' ? form.customSection.trim() : form.section;
      if (!section) {
        setFormError(t('tbl_val_section'));
        return;
      }
      const cap = parseInt(form.capacity, 10);
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) {
        setFormError(t('tbl_val_capacity'));
        return;
      }
      setSaving(true);
      try {
        const supabase = createClient();
        const payload = {
          restaurant_id: restaurantId,
          table_number: num,
          qr_code: `${slug.toUpperCase().replace(/[^A-Z0-9]/g, '')}-T${num}`,
          capacity: cap,
          floor_section: section.toLowerCase(),
          is_active: form.isActive,
        };
        if (editing === 'new') {
          const { data, error } = await supabase.from('tables').insert(payload).select().single();
          if (error) throw error;
          onChange([...tables, data as DiningTable]);
        } else if (editing) {
          const { data, error } = await supabase.from('tables').update(payload).eq('id', editing.id).select().single();
          if (error) throw error;
          onChange(tables.map((tb) => (tb.id === editing.id ? (data as DiningTable) : tb)));
        }
        setEditing(null);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : t('tbl_err_save'));
      } finally {
        setSaving(false);
      }
    });

  const toggleActive = (tb: DiningTable) =>
    guard(async () => {
      const { data, error } = await createClient()
        .from('tables')
        .update({ is_active: !tb.is_active })
        .eq('id', tb.id)
        .select()
        .single();
      if (!error && data) onChange(tables.map((x) => (x.id === tb.id ? (data as DiningTable) : x)));
    });

  const askDelete = (tb: DiningTable) => setConfirmDel(tb);
  const doDelete = () =>
    guard(async () => {
      if (!confirmDel) return;
      const gone = confirmDel;
      setConfirmDel(null);
      del.schedule(gone, t('tbl_undo_label', { n: gone.table_number }), () =>
        onChange(tables.filter((x) => x.id !== gone.id)),
      );
    });

  return (
    <div>
      <SectionHead
        title="Tables"
        sub={t('tbl_sub', { n: tables.length, active: tables.filter((x) => x.is_active).length })}
        action={
          <Btn size="sm" onClick={openNew}>
            ＋ Add table
          </Btn>
        }
      />

      {tables.length === 0 ? (
        <Empty title={t('tbl_empty_title')} sub={t('tbl_empty_sub')} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((tb) => (
            <Card key={tb.id} className={`p-4 ${tb.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[20px] font-extrabold text-ink">Table {tb.table_number}</p>
                  <p className="mt-0.5 text-[12px] font-bold text-muted">
                    {sectionLabel(tb, t)} · {tb.capacity} seats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(tb)}
                  title={tb.is_active ? 'Deactivate' : 'Activate'}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${tb.is_active ? 'bg-brand' : 'bg-line'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${tb.is_active ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQrTable(tb)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink hover:bg-soft"
                >
                  📷 QR
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(tb)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink hover:bg-soft"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => askDelete(tb)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-danger hover:bg-danger/10"
                >
                  🗑
                </button>
              </div>
              {!tb.is_active && (
                <p className="mt-2 text-center text-[11px] font-bold text-muted">{t('tbl_inactive_note')}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* ── add/edit modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setEditing(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-md flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editing === 'new' ? 'Add table' : t('tbl_modal_edit', { n: editing.table_number })}
              </h2>
              <button type="button" onClick={() => !saving && setEditing(null)} className="text-[20px] text-muted hover:text-ink">
                ×
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-4 sm:p-6">
              <div>
                <Label>Table number</Label>
                <Input
                  type="number"
                  min={1}
                  max={999}
                  value={form.number}
                  onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))}
                  placeholder={String(nextFree)}
                />
              </div>
              <div>
                <Label>Section / location</Label>
                <div className="flex flex-wrap gap-1.5">
                  {[...PRESET_SECTIONS, 'Custom'].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, section: s }))}
                      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition-all ${
                        form.section === s ? 'bg-brand text-white shadow' : 'border border-line text-muted hover:text-ink'
                      }`}
                    >
                      {s === 'Custom' ? t('tbl_sec_custom') : sectionName(s, t)}
                    </button>
                  ))}
                </div>
                {form.section === 'Custom' && (
                  <Input
                    className="mt-2"
                    value={form.customSection}
                    onChange={(e) => setForm((f) => ({ ...f, customSection: e.target.value }))}
                    placeholder={t('tbl_ph_section')}
                    maxLength={40}
                  />
                )}
              </div>
              <div>
                <Label>Capacity (seats)</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-[14px] border border-line px-3.5 py-2.5">
                <span className="text-[13.5px] font-bold text-ink">Active</span>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="h-5 w-5 accent-[var(--c-brand)]"
                />
              </label>
              {formError && <p className="rounded-btn bg-danger/10 p-3 text-[13px] font-bold text-danger">{formError}</p>}
            </div>
            <div className="grid grid-cols-2 gap-2.5 border-t border-line p-4 sm:px-6">
              <Btn variant="secondary" onClick={() => !saving && setEditing(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn onClick={save} disabled={saving}>
                {saving ? t('tbl_saving') : editing === 'new' ? 'Add table' : 'Save'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <DeleteConfirm
          title={t('tbl_del_title', { n: confirmDel.table_number })}
          message={t('tbl_del_msg')}
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
      {del.pending && (
        <UndoToast label={del.pending.label} seconds={del.seconds} onUndo={() => del.undo((tb) => onChange([...tables, tb]))} />
      )}
      {qrTable && <QrModal table={qrTable} slug={slug} onClose={() => setQrTable(null)} />}
    </div>
  );
}
