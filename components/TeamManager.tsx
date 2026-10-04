'use client';

// Team management for owner/manager: list staff, link a new staff member
// (auth user is created in Supabase Dashboard > Authentication > Users —
// paste their UUID here), edit role / details, activate / deactivate.

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Role } from '@/lib/types';
import { Btn, Card, Empty, Input, Label, Select, Textarea } from './ui';

const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Super Admin',
  owner: 'Owner',
  manager: 'Manager',
  kitchen: 'Kitchen',
  waiter: 'Waiter',
};

const ROLE_STYLE: Record<string, string> = {
  owner: 'bg-brand/10 text-brand',
  manager: 'bg-teal/10 text-teal',
  kitchen: 'bg-amber/15 text-amber',
  waiter: 'bg-ok/10 text-ok',
  super_admin: 'bg-danger/10 text-danger',
};

const EDITABLE_ROLES: Role[] = ['owner', 'manager', 'kitchen', 'waiter'];

interface FormState {
  auth_id: string;
  name: string;
  phone: string;
  address: string;
  role: Role;
  is_active: boolean;
}

const EMPTY_FORM: FormState = { auth_id: '', name: '', phone: '', address: '', role: 'waiter', is_active: true };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function TeamManager({ restaurantId, meId }: { restaurantId: string; meId: string }) {
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Profile | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at');
    setStaff((data ?? []) as Profile[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditing('new');
    setError('');
  };

  const openEdit = (p: Profile) => {
    setForm({ auth_id: p.id, name: p.name, phone: p.phone ?? '', address: p.address ?? '', role: p.role, is_active: p.is_active });
    setEditing(p);
    setError('');
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    if (editing === 'new' && !UUID_RE.test(form.auth_id.trim())) {
      setError('Paste a valid auth UUID (Dashboard > Authentication > Users > copy UID).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const supabase = createClient();
      if (editing === 'new') {
        const { error } = await supabase.from('profiles').insert({
          id: form.auth_id.trim(),
          restaurant_id: restaurantId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          role: form.role,
          is_active: form.is_active,
        });
        if (error) throw new Error(error.message);
      } else if (editing) {
        if (editing.id === meId && !form.is_active) {
          setError('You cannot deactivate your own account.');
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from('profiles')
          .update({
            name: form.name.trim(),
            phone: form.phone.trim() || null,
            address: form.address.trim() || null,
            role: form.role,
            is_active: form.is_active,
          })
          .eq('id', editing.id);
        if (error) throw new Error(error.message);
      }
      setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Profile) => {
    if (p.id === meId) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id);
    if (!error) setStaff((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)));
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-ink">Team Members</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {staff.length} staff · roles control what each person can open.
          </p>
        </div>
        <Btn onClick={openNew}>+ Add Staff</Btn>
      </div>

      {loading ? (
        <Empty title="Loading team…" />
      ) : staff.length === 0 ? (
        <Empty title="No staff yet" sub="Add your first team member to get started." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((p) => (
            <Card key={p.id} className={`p-4 ${p.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <div className="btn-3d flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] font-display text-[17px] font-extrabold text-white">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-[14.5px] font-extrabold text-ink">{p.name}</p>
                    {p.id === meId && <span className="shrink-0 text-[10.5px] font-bold text-muted">(you)</span>}
                  </div>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLE[p.role] ?? 'bg-soft text-muted'}`}>
                    {ROLE_LABEL[p.role] ?? p.role}
                  </span>
                </div>
                <button onClick={() => openEdit(p)} title="Edit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">
                  ✎
                </button>
              </div>
              <div className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
                {p.phone && <p className="text-body">📞 <span className="font-bold text-ink">{p.phone}</span></p>}
                {p.address && <p className="truncate text-muted">📍 {p.address}</p>}
                <div className="flex items-center justify-between pt-1">
                  <span className={`text-[11.5px] font-bold ${p.is_active ? 'text-ok' : 'text-danger'}`}>
                    {p.is_active ? '● Active' : '● Deactivated'}
                  </span>
                  {p.id !== meId && (
                    <button onClick={() => toggleActive(p)} className="text-[11.5px] font-bold text-brand hover:underline">
                      {p.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {editing && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={() => !saving && setEditing(null)} />
          <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
              <h2 className="font-display text-[17px] font-extrabold text-ink">
                {editing === 'new' ? 'Add Staff Member' : 'Edit Staff Member'}
              </h2>
              <button onClick={() => !saving && setEditing(null)} aria-label="Close" className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted">✕</button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:px-6">
              {editing === 'new' && (
                <div className="rounded-btn bg-amber/15 p-3 text-[12.5px] leading-relaxed text-body">
                  <span className="font-bold text-ink">Two quick steps:</span> 1) create the login in
                  Supabase Dashboard → Authentication → Users (copy their UID), 2) paste the UID below
                  to link them to this restaurant.
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Full name *</Label>
                  <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ali Raza" className="mt-1.5" />
                </div>
                <div>
                  <Label>Role *</Label>
                  <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))} className="mt-1.5">
                    {EDITABLE_ROLES.map((r) => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </Select>
                </div>
              </div>
              {editing === 'new' ? (
                <div>
                  <Label>Auth UID *</Label>
                  <Input value={form.auth_id} onChange={(e) => setForm((f) => ({ ...f, auth_id: e.target.value }))} placeholder="paste UID from Dashboard" className="mt-1.5 font-mono !text-[12.5px]" />
                </div>
              ) : (
                <div>
                  <Label>Auth UID</Label>
                  <p className="mt-1.5 truncate font-mono text-[12px] text-muted">{form.auth_id}</p>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0300-1234567" className="mt-1.5" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.is_active}
                      onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                      className={`relative h-6 w-11 rounded-full transition-colors ${form.is_active ? 'bg-ok' : 'bg-line'}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${form.is_active ? 'left-[22px]' : 'left-0.5'}`} />
                    </button>
                    {form.is_active ? 'Active' : 'Deactivated'}
                  </label>
                </div>
              </div>
              <div>
                <Label>Address <span className="font-bold text-muted">(optional)</span></Label>
                <Textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} placeholder="House, street, area…" className="mt-1.5" />
              </div>
              {error && <p className="text-[13px] font-bold text-danger">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 border-t border-line p-4 sm:px-6">
              <button onClick={() => setEditing(null)} disabled={saving} className="rounded-btn px-4 py-2.5 text-[13.5px] font-bold text-muted hover:text-ink">
                Cancel
              </button>
              <Btn onClick={save} disabled={saving}>
                {saving ? 'Saving…' : editing === 'new' ? 'Add staff' : 'Save changes'}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
