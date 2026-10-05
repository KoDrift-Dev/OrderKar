'use client';

// Owner table management — add/edit/delete tables with sections
// (Indoor / Outdoor / Rooftop / custom), capacity, active toggle,
// and per-table QR view/download/print.

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { tableQr } from '@/lib/qr';
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

function sectionLabel(t: DiningTable): string {
  const s = (t.floor_section || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Indoor';
}

function QrModal({ table, slug, onClose }: { table: DiningTable; slug: string; onClose: () => void }) {
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
          Table {table.table_number} · {sectionLabel(table)}
        </h2>
        <p className="mt-1 text-[12px] text-muted">Scan karke is table ka menu khulega</p>
        {svg ? (
          <div
            className="mt-4 h-56 w-56 overflow-hidden rounded-[16px] border border-line bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
            dangerouslySetInnerHTML={{ __html: svg }}
            role="img"
            aria-label={`QR code for table ${table.table_number}`}
          />
        ) : (
          <div className="mt-4 flex h-56 w-56 items-center justify-center rounded-[16px] border border-line bg-white">
            <span className="text-xs font-semibold text-muted">Loading…</span>
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
            Close
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
  const [editing, setEditing] = useState<DiningTable | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState<DiningTable | null>(null);
  const [qrTable, setQrTable] = useState<DiningTable | null>(null);
  const guard = useGuard();
  const del = useUndoDelete<DiningTable>(async (t) => {
    await createClient().from('tables').delete().eq('id', t.id);
  });

  const sorted = useMemo(() => [...tables].sort((a, b) => a.table_number - b.table_number), [tables]);
  const usedNumbers = useMemo(() => new Set(tables.map((t) => t.table_number)), [tables]);

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

  const openEdit = (t: DiningTable) => {
    const preset = PRESET_SECTIONS.find((p) => p.toLowerCase() === (t.floor_section || '').toLowerCase());
    setForm({
      number: String(t.table_number),
      section: preset ?? 'Custom',
      customSection: preset ? '' : t.floor_section,
      capacity: String(t.capacity),
      isActive: t.is_active,
    });
    setFormError('');
    setEditing(t);
  };

  const save = () =>
    guard(async () => {
      setFormError('');
      const num = parseInt(form.number, 10);
      if (!Number.isInteger(num) || num < 1 || num > 999) {
        setFormError('Table number 1–999 ke darmiyan hona chahiye.');
        return;
      }
      const editingId = editing !== 'new' && editing ? editing.id : null;
      if (tables.some((t) => t.table_number === num && t.id !== editingId)) {
        setFormError(`Table ${num} pehle se maujood hai — koi aur number chuno.`);
        return;
      }
      const section = form.section === 'Custom' ? form.customSection.trim() : form.section;
      if (!section) {
        setFormError('Section ka naam likho (jaise "Family Hall").');
        return;
      }
      const cap = parseInt(form.capacity, 10);
      if (!Number.isInteger(cap) || cap < 1 || cap > 50) {
        setFormError('Capacity 1–50 ke darmiyan honi chahiye.');
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
          onChange(tables.map((t) => (t.id === editing.id ? (data as DiningTable) : t)));
        }
        setEditing(null);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Save nahi ho saka.');
      } finally {
        setSaving(false);
      }
    });

  const toggleActive = (t: DiningTable) =>
    guard(async () => {
      const { data, error } = await createClient()
        .from('tables')
        .update({ is_active: !t.is_active })
        .eq('id', t.id)
        .select()
        .single();
      if (!error && data) onChange(tables.map((x) => (x.id === t.id ? (data as DiningTable) : x)));
    });

  const askDelete = (t: DiningTable) => setConfirmDel(t);
  const doDelete = () =>
    guard(async () => {
      if (!confirmDel) return;
      const gone = confirmDel;
      setConfirmDel(null);
      del.schedule(gone, `Table ${gone.table_number} deleted`, () =>
        onChange(tables.filter((t) => t.id !== gone.id)),
      );
    });

  return (
    <div>
      <SectionHead
        title="Tables"
        sub={`${tables.length} tables · ${tables.filter((t) => t.is_active).length} active — har table ka apna QR code`}
        action={
          <Btn size="sm" onClick={openNew}>
            ＋ Add table
          </Btn>
        }
      />

      {tables.length === 0 ? (
        <Empty title="Koi table nahi" sub="Add table dabaa ke pehli table banao." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sorted.map((t) => (
            <Card key={t.id} className={`p-4 ${t.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-[20px] font-extrabold text-ink">Table {t.table_number}</p>
                  <p className="mt-0.5 text-[12px] font-bold text-muted">
                    {sectionLabel(t)} · {t.capacity} seats
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleActive(t)}
                  title={t.is_active ? 'Deactivate' : 'Activate'}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${t.is_active ? 'bg-brand' : 'bg-line'}`}
                >
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${t.is_active ? 'left-[22px]' : 'left-0.5'}`}
                  />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setQrTable(t)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink hover:bg-soft"
                >
                  📷 QR
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-ink hover:bg-soft"
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  onClick={() => askDelete(t)}
                  className="flex-1 rounded-btn border border-line bg-[var(--c-surface-solid)] px-2 py-1.5 text-[12px] font-bold text-danger hover:bg-danger/10"
                >
                  🗑
                </button>
              </div>
              {!t.is_active && (
                <p className="mt-2 text-center text-[11px] font-bold text-muted">Inactive — QR kaam nahi karega</p>
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
                {editing === 'new' ? 'Add table' : `Edit table ${editing.table_number}`}
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
                      {s}
                    </button>
                  ))}
                </div>
                {form.section === 'Custom' && (
                  <Input
                    className="mt-2"
                    value={form.customSection}
                    onChange={(e) => setForm((f) => ({ ...f, customSection: e.target.value }))}
                    placeholder="Jaise: Family Hall, Basement…"
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
                {saving ? 'Saving…' : editing === 'new' ? 'Add table' : 'Save'}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {confirmDel && (
        <DeleteConfirm
          title={`Delete table ${confirmDel.table_number}?`}
          message="Is table ka QR code kaam karna band kar dega. Purane orders pe koi asar nahi parega."
          onCancel={() => setConfirmDel(null)}
          onConfirm={doDelete}
        />
      )}
      {del.pending && (
        <UndoToast label={del.pending.label} seconds={del.seconds} onUndo={() => del.undo((t) => onChange([...tables, t]))} />
      )}
      {qrTable && <QrModal table={qrTable} slug={slug} onClose={() => setQrTable(null)} />}
    </div>
  );
}
