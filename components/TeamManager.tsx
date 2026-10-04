'use client';

// Team management for owner/manager.
// Tab 1 — Login accounts: create real auth accounts in-app (email+password),
//   edit role / details, activate / deactivate. No Dashboard needed.
// Tab 2 — Staff: people without login (helpers, dishwashers…) — name, job
//   title, contact, gender, photo.

import { useEffect, useState } from 'react';
import { createClient as createRawClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Role, StaffMember } from '@/lib/types';
import { Btn, Card, Empty, Input, Label, Select, Textarea } from './ui';
import PhotoDropzone, { useUploadState } from './PhotoDropzone';
import Avatar from './Avatar';
import { useGuard, useUndoDelete, DeleteConfirm, UndoToast } from './DeleteFlow';

const ROLE_LABEL: Record<string, string> = {
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
};

type Gender = 'male' | 'female' | '';

// Which roles the current user may assign.
function assignableRoles(myRole: Role): Role[] {
  if (myRole === 'owner' || myRole === 'super_admin') return ['owner', 'manager', 'kitchen', 'waiter'];
  return ['kitchen', 'waiter']; // manager
}

// Temp client with isolated session storage — signUp here never touches the
// owner's own login session.
function signupClient() {
  return createRawClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { storageKey: 'orderkar-tmp-signup', persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

const GENDER_OPTIONS: { v: Gender; label: string }[] = [
  { v: '', label: 'Not specified' },
  { v: 'male', label: 'Male' },
  { v: 'female', label: 'Female' },
];

export default function TeamManager({
  restaurantId,
  meId,
  myRole,
}: {
  restaurantId: string;
  meId: string;
  myRole: Role;
}) {
  const [tab, setTab] = useState<'accounts' | 'staff'>('accounts');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const guard = useGuard();
  const [confirmDel, setConfirmDel] = useState<StaffMember | null>(null);
  const del = useUndoDelete<StaffMember>(async (s) => {
    await createClient().from('staff_members').delete().eq('id', s.id);
  });

  // create-account modal
  const [creating, setCreating] = useState(false);
  const [cName, setCName] = useState('');
  const [cEmail, setCEmail] = useState('');
  const [cPass, setCPass] = useState('');
  const [cRole, setCRole] = useState<Role>('waiter');
  const [cPhone, setCPhone] = useState('');
  const [cAddress, setCAddress] = useState('');
  const [cGender, setCGender] = useState<Gender>('');
  const [cPhoto, setCPhoto] = useState('');
  const cUp = useUploadState();
  const eUp = useUploadState();
  const sUp = useUploadState();
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // edit-profile modal
  const [editing, setEditing] = useState<Profile | null>(null);
  const [eRole, setERole] = useState<Role>('waiter');
  const [ePhone, setEPhone] = useState('');
  const [eAddress, setEAddress] = useState('');
  const [eGender, setEGender] = useState<Gender>('');
  const [ePhoto, setEPhoto] = useState('');
  const [eActive, setEActive] = useState(true);
  const [eSaving, setESaving] = useState(false);
  const [eError, setEError] = useState('');

  // staff (no-login) modal
  const [sEditing, setSEditing] = useState<StaffMember | 'new' | null>(null);
  const [sName, setSName] = useState('');
  const [sTitle, setSTitle] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sAddress, setSAddress] = useState('');
  const [sGender, setSGender] = useState<Gender>('');
  const [sPhoto, setSPhoto] = useState('');
  const [sActive, setSActive] = useState(true);
  const [sSaving, setSSaving] = useState(false);
  const [sError, setSError] = useState('');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const [{ data: p }, { data: s }] = await Promise.all([
      supabase.from('profiles').select('*').eq('restaurant_id', restaurantId).order('created_at'),
      supabase.from('staff_members').select('*').eq('restaurant_id', restaurantId).order('created_at'),
    ]);
    setProfiles((p ?? []) as Profile[]);
    setStaff((s ?? []) as StaffMember[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const canManageRole = (targetRole: Role) =>
    myRole === 'owner' || myRole === 'super_admin' || targetRole === 'kitchen' || targetRole === 'waiter';

  // ── create account ──────────────────────────────────────────────────────
  const openCreate = () => {
    setCName(''); setCEmail(''); setCPass(''); setCRole('waiter');
    setCPhone(''); setCAddress(''); setCGender(''); setCPhoto('');
    setCError(''); setCreating(true);
  };

  const createAccount = () =>
    guard(async () => {
    const problems: string[] = [];
    if (!cName.trim()) problems.push('Full name is required.');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cEmail.trim())) problems.push('Enter a valid email address.');
    if (cPass.length < 6) problems.push(`Password must be at least 6 characters (currently ${cPass.length}).`);
    if (problems.length > 0) {
      setCError(problems.join(' '));
      return;
    }
    await cUp.wait(); // photo upload finish ho jaye to nayi URL save ho
    setCSaving(true);
    setCError('');
    const tmp = signupClient();
    try {
      const { data, error } = await tmp.auth.signUp({ email: cEmail.trim(), password: cPass });
      if (error) throw new Error(error.message);
      const userId = data.user?.id;
      if (!userId) throw new Error('Signup failed — please try again.');
      const supabase = createClient();
      const { error: pErr } = await supabase.from('profiles').insert({
        id: userId,
        restaurant_id: restaurantId,
        name: cName.trim(),
        phone: cPhone.trim() || null,
        address: cAddress.trim() || null,
        gender: cGender || null,
        photo_url: cPhoto || null,
        role: cRole,
        is_active: true,
      });
      if (pErr) throw new Error(pErr.message);
      setCreating(false);
      await load();
    } catch (e) {
      setCError(e instanceof Error ? e.message : 'Failed to create account');
    } finally {
      try { await tmp.auth.signOut(); } catch { /* cleanup only */ }
      setCSaving(false);
    }
    });

  // ── edit profile ────────────────────────────────────────────────────────
  const openEdit = (p: Profile) => {
    setEditing(p);
    setERole(p.role);
    setEPhone(p.phone ?? '');
    setEAddress(p.address ?? '');
    setEGender((p.gender ?? '') as Gender);
    setEPhoto(p.photo_url ?? '');
    setEActive(p.is_active);
    setEError('');
  };

  const saveProfile = () =>
    guard(async () => {
    if (!editing) return;
    await eUp.wait();
    if (editing.id === meId && !eActive) {
      setEError('You cannot deactivate your own account.');
      return;
    }
    setESaving(true);
    setEError('');
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          role: eRole,
          phone: ePhone.trim() || null,
          address: eAddress.trim() || null,
          gender: eGender || null,
          photo_url: ePhoto || null,
          is_active: eActive,
        })
        .eq('id', editing.id);
      if (error) throw new Error(error.message);
      setEditing(null);
      await load();
    } catch (e) {
      setEError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setESaving(false);
    }
    });

  const toggleProfileActive = (p: Profile) =>
    guard(async () => {
    if (p.id === meId) return;
    const supabase = createClient();
    const { error } = await supabase.from('profiles').update({ is_active: !p.is_active }).eq('id', p.id);
    if (!error) setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
    });

  // ── staff (no login) ────────────────────────────────────────────────────
  const openNewStaff = () => {
    setSName(''); setSTitle(''); setSPhone(''); setSAddress('');
    setSGender(''); setSPhoto(''); setSActive(true);
    setSError(''); setSEditing('new');
  };

  const openEditStaff = (s: StaffMember) => {
    setSName(s.name); setSTitle(s.job_title ?? ''); setSPhone(s.phone ?? '');
    setSAddress(s.address ?? ''); setSGender((s.gender ?? '') as Gender);
    setSPhoto(s.photo_url ?? ''); setSActive(s.is_active);
    setSError(''); setSEditing(s);
  };

  const saveStaff = () =>
    guard(async () => {
    if (!sName.trim()) {
      setSError('Name is required.');
      return;
    }
    await sUp.wait(); // photo upload finish ho jaye to nayi URL save ho
    setSSaving(true);
    setSError('');
    try {
      const supabase = createClient();
      const payload = {
        restaurant_id: restaurantId,
        name: sName.trim(),
        job_title: sTitle.trim() || null,
        phone: sPhone.trim() || null,
        address: sAddress.trim() || null,
        gender: sGender || null,
        photo_url: sPhoto || null,
        is_active: sActive,
      };
      if (sEditing === 'new') {
        const { error } = await supabase.from('staff_members').insert(payload);
        if (error) throw new Error(error.message);
      } else if (sEditing) {
        const { error } = await supabase.from('staff_members').update(payload).eq('id', sEditing.id);
        if (error) throw new Error(error.message);
      }
      setSEditing(null);
      await load();
    } catch (e) {
      setSError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSSaving(false);
    }
    });

  // (actual delete runs through the confirm modal + undo flow below)

  const switchCls = (on: boolean, color: string) =>
    `relative h-6 w-11 rounded-full transition-colors ${on ? color : 'bg-line'}`;

  const knobCls = (on: boolean) =>
    `absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold text-ink">Team Members</h1>
          <p className="mt-0.5 text-[13px] text-muted">
            {profiles.length} login accounts · {staff.length} staff
          </p>
        </div>
        {tab === 'accounts' ? <Btn onClick={openCreate}>+ Create Account</Btn> : <Btn onClick={openNewStaff}>+ Add Staff</Btn>}
      </div>

      <div className="mb-5 flex gap-1.5">
        {(
          [
            { key: 'accounts', label: '🔑 Login Accounts' },
            { key: 'staff', label: '👥 Staff (no login)' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-[12px] px-4 py-2 text-[13.5px] font-bold transition-all ${
              tab === t.key ? 'btn-3d text-white' : 'glass text-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Empty title="Loading team…" />
      ) : tab === 'accounts' ? (
        profiles.length === 0 ? (
          <Empty title="No accounts yet" sub="Create the first login account for your team." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {profiles.map((p) => (
              <Card key={p.id} className={`p-4 ${p.is_active ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={p.name} photoUrl={p.photo_url} gender={p.gender} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-display text-[14.5px] font-extrabold text-ink">{p.name}</p>
                      {p.id === meId && <span className="shrink-0 text-[10.5px] font-bold text-muted">(you)</span>}
                    </div>
                    <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ROLE_STYLE[p.role] ?? 'bg-soft text-muted'}`}>
                      {ROLE_LABEL[p.role] ?? p.role}
                    </span>
                  </div>
                  <button onClick={() => openEdit(p)} title="Edit" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">✎</button>
                </div>
                <div className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
                  {p.phone && <p className="text-body">📞 <span className="font-bold text-ink">{p.phone}</span></p>}
                  {p.address && <p className="truncate text-muted">📍 {p.address}</p>}
                  <div className="flex items-center justify-between pt-1">
                    <span className={`text-[11.5px] font-bold ${p.is_active ? 'text-ok' : 'text-danger'}`}>
                      {p.is_active ? '● Active' : '● Deactivated'}
                    </span>
                    {p.id !== meId && (
                      <button onClick={() => toggleProfileActive(p)} className="text-[11.5px] font-bold text-brand hover:underline">
                        {p.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      ) : staff.length === 0 ? (
        <Empty title="No staff yet" sub="Add helpers, dishwashers and others who don't need a login." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <Card key={s.id} className={`p-4 ${s.is_active ? '' : 'opacity-60'}`}>
              <div className="flex items-start gap-3">
                <Avatar name={s.name} photoUrl={s.photo_url} gender={s.gender} size={46} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-[14.5px] font-extrabold text-ink">{s.name}</p>
                  {s.job_title && (
                    <span className="mt-1 inline-block rounded-full bg-soft px-2.5 py-0.5 text-[11px] font-bold text-muted">
                      {s.job_title}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button onClick={() => openEditStaff(s)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-brand-soft hover:text-brand">✎</button>
                  <button onClick={() => setConfirmDel(s)} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-[9px] text-muted hover:bg-danger/10 hover:text-danger">🗑</button>
                </div>
              </div>
              <div className="mt-3 space-y-1 border-t border-line pt-3 text-[12.5px]">
                {s.phone && <p className="text-body">📞 <span className="font-bold text-ink">{s.phone}</span></p>}
                {s.address && <p className="truncate text-muted">📍 {s.address}</p>}
                <p className={`pt-1 text-[11.5px] font-bold ${s.is_active ? 'text-ok' : 'text-danger'}`}>
                  {s.is_active ? '● Active' : '● Inactive'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Delete confirmation (staff, no login) ── */}
      {confirmDel && (
        <DeleteConfirm
          title="Remove this staff member?"
          message={`"${confirmDel.name}" will be removed from the staff list. You can undo this for 5 seconds.`}
          onCancel={() => setConfirmDel(null)}
          onConfirm={() => {
            const s = confirmDel;
            setConfirmDel(null);
            del.schedule(s, s.name, () => setStaff((prev) => prev.filter((x) => x.id !== s.id)));
          }}
        />
      )}
      {del.pending && (
        <UndoToast label={del.pending.label} seconds={del.seconds} onUndo={() => del.undo((s) => setStaff((prev) => [...prev, s]))} />
      )}

      {/* ── Create account modal ── */}
      {creating && (
        <Modal title="Create Login Account" onClose={() => !cSaving && setCreating(false)}
          footer={<ModalFooter onCancel={() => setCreating(false)} onSave={createAccount} saving={cSaving} saveLabel="Create account" />}>
          <div className="space-y-4">
            <div>
              <Label>Photo</Label>
              <div className="mt-1.5">
                <PhotoDropzone bucket="staff-photos" folder={restaurantId} value={cPhoto} onChange={setCPhoto} onError={setCError} onUploadingChange={cUp.set} hint="Optional — otherwise a gender avatar shows" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Full name *</Label>
                <Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Ali Raza" className="mt-1.5" />
              </div>
              <div>
                <Label>Role *</Label>
                <Select value={cRole} onChange={(e) => setCRole(e.target.value as Role)} className="mt-1.5">
                  {assignableRoles(myRole).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Email (login) *</Label>
                <Input value={cEmail} onChange={(e) => setCEmail(e.target.value)} placeholder="ali@spicevilla.pk" inputMode="email" className="mt-1.5" />
              </div>
              <div>
                <Label>Password *</Label>
                <div className="relative mt-1.5">
                  <Input value={cPass} onChange={(e) => setCPass(e.target.value)} type={showPass ? 'text' : 'password'} placeholder="min 6 characters" className="!pr-12" />
                  <button type="button" onClick={() => setShowPass((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[15px] text-muted" title={showPass ? 'Hide' : 'Show'}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Phone</Label>
                <Input value={cPhone} onChange={(e) => setCPhone(e.target.value)} placeholder="0300-1234567" className="mt-1.5" />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={cGender} onChange={(e) => setCGender(e.target.value as Gender)} className="mt-1.5">
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.v} value={g.v}>{g.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Address <span className="font-bold text-muted">(optional)</span></Label>
              <Textarea value={cAddress} onChange={(e) => setCAddress(e.target.value)} rows={2} placeholder="House, street, area…" className="mt-1.5" />
            </div>
            <p className="rounded-btn bg-brand-soft/60 p-3 text-[12px] leading-relaxed text-muted">
              Account seedha Supabase mein banega — ye shakhs isi email/password se login kar sakega. Tumhara apna session mehfooz rahega.
            </p>
            {cError && <p className="text-[13px] font-bold text-danger">{cError}</p>}
          </div>
        </Modal>
      )}

      {/* ── Edit profile modal ── */}
      {editing && (
        <Modal title="Edit Account" onClose={() => !eSaving && setEditing(null)}
          footer={<ModalFooter onCancel={() => setEditing(null)} onSave={saveProfile} saving={eSaving} saveLabel="Save changes" />}>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar name={editing.name} photoUrl={ePhoto} gender={(eGender || editing.gender) as 'male' | 'female' | null} size={52} />
              <div>
                <p className="font-display text-[15px] font-extrabold text-ink">{editing.name}</p>
                <p className="text-[12px] text-muted">{ROLE_LABEL[editing.role] ?? editing.role}</p>
              </div>
            </div>
            <div>
              <Label>Photo</Label>
              <div className="mt-1.5">
                <PhotoDropzone bucket="staff-photos" folder={restaurantId} value={ePhoto} onChange={setEPhoto} onError={setEError} onUploadingChange={eUp.set} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Role *</Label>
                <Select
                  value={eRole}
                  onChange={(e) => setERole(e.target.value as Role)}
                  disabled={editing.id === meId || !canManageRole(editing.role)}
                  className="mt-1.5"
                >
                  {assignableRoles(myRole).map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={eGender} onChange={(e) => setEGender(e.target.value as Gender)} className="mt-1.5">
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.v} value={g.v}>{g.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Phone</Label>
                <Input value={ePhone} onChange={(e) => setEPhone(e.target.value)} placeholder="0300-1234567" className="mt-1.5" />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink">
                  <button type="button" role="switch" aria-checked={eActive} disabled={editing.id === meId}
                    onClick={() => setEActive((a) => !a)} className={switchCls(eActive, 'bg-ok')}>
                    <span className={knobCls(eActive)} />
                  </button>
                  {eActive ? 'Active' : 'Deactivated'}
                </label>
              </div>
            </div>
            <div>
              <Label>Address <span className="font-bold text-muted">(optional)</span></Label>
              <Textarea value={eAddress} onChange={(e) => setEAddress(e.target.value)} rows={2} className="mt-1.5" />
            </div>
            {eError && <p className="text-[13px] font-bold text-danger">{eError}</p>}
          </div>
        </Modal>
      )}

      {/* ── Staff (no login) modal ── */}
      {sEditing && (
        <Modal title={sEditing === 'new' ? 'Add Staff' : 'Edit Staff'} onClose={() => !sSaving && setSEditing(null)}
          footer={<ModalFooter onCancel={() => setSEditing(null)} onSave={saveStaff} saving={sSaving || sUp.uploading} saveLabel={sUp.uploading ? 'Uploading photo…' : sEditing === 'new' ? 'Add staff' : 'Save changes'} />}>
          <div className="space-y-4">
            <div className="rounded-btn bg-amber/15 p-3 text-[12.5px] text-body">
              Login ke baghair — helpers, dishwashers waghera ke liye. Inhein app ka access <span className="font-bold">nahi</span> milega.
            </div>
            <div>
              <Label>Photo</Label>
              <div className="mt-1.5">
                <PhotoDropzone bucket="staff-photos" folder={restaurantId} value={sPhoto} onChange={setSPhoto} onError={setSError} onUploadingChange={sUp.set} hint="Optional — otherwise a gender avatar shows" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Full name *</Label>
                <Input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Bilal Ahmed" className="mt-1.5" />
              </div>
              <div>
                <Label>Job title</Label>
                <Input value={sTitle} onChange={(e) => setSTitle(e.target.value)} placeholder="Dishwasher" className="mt-1.5" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Phone</Label>
                <Input value={sPhone} onChange={(e) => setSPhone(e.target.value)} placeholder="0300-1234567" className="mt-1.5" />
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={sGender} onChange={(e) => setSGender(e.target.value as Gender)} className="mt-1.5">
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g.v} value={g.v}>{g.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Address <span className="font-bold text-muted">(optional)</span></Label>
              <Textarea value={sAddress} onChange={(e) => setSAddress(e.target.value)} rows={2} className="mt-1.5" />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] font-bold text-ink">
              <button type="button" role="switch" aria-checked={sActive} onClick={() => setSActive((a) => !a)} className={switchCls(sActive, 'bg-ok')}>
                <span className={knobCls(sActive)} />
              </button>
              {sActive ? 'Active' : 'Inactive'}
            </label>
            {sError && <p className="text-[13px] font-bold text-danger">{sError}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}

// Shared modal chrome.
function Modal({ title, onClose, footer, children }: { title: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="absolute inset-0 m-auto flex h-fit max-h-[92dvh] w-[calc(100%-2rem)] max-w-lg flex-col rounded-[24px] bg-[var(--c-surface-solid)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4 sm:px-6">
          <h2 className="font-display text-[17px] font-extrabold text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="glass flex h-8 w-8 items-center justify-center !rounded-full text-muted">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:px-6">{children}</div>
        {footer}
      </div>
    </div>
  );
}

function ModalFooter({ onCancel, onSave, saving, saveLabel }: { onCancel: () => void; onSave: () => void; saving: boolean; saveLabel: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-line p-4 sm:px-6">
      <button onClick={onCancel} disabled={saving} className="rounded-btn px-4 py-2.5 text-[13.5px] font-bold text-muted hover:text-ink">
        Cancel
      </button>
      <Btn onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saveLabel}</Btn>
    </div>
  );
}
