'use client';

// Owner settings — restaurant/company details, owner account,
// and login security (email + password change).

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/lib/i18n';
import { Btn, Card, SectionHead, Input, Label } from './ui';
import { useGuard } from './DeleteFlow';

function msg(text: string, ok: boolean) {
  return (
    <p className={`rounded-btn p-3 text-[13px] font-bold ${ok ? 'bg-emerald-500/10 text-emerald-600' : 'bg-danger/10 text-danger'}`}>
      {text}
    </p>
  );
}

export default function OwnerSettings({
  restaurantId,
  slug,
  onNameChange,
}: {
  restaurantId: string;
  slug: string;
  onNameChange: (name: string) => void;
}) {
  const t = useT();
  const [loading, setLoading] = useState(true);
  const guard = useGuard();
  const [saving, setSaving] = useState<string | null>(null);

  // ── restaurant ──
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [tier, setTier] = useState('');
  const [themeCfg, setThemeCfg] = useState<Record<string, string>>({});
  const [rMsg, setRMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── my account ──
  const [fullName, setFullName] = useState('');
  const [myPhone, setMyPhone] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [aMsg, setAMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── security ──
  const [newEmail, setNewEmail] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [sMsg, setSMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const [{ data: r }, { data: p }] = await Promise.all([
        supabase
          .from('restaurants')
          .select('name,slug,theme_config,subscription_tier')
          .eq('id', restaurantId)
          .single(),
        user ? supabase.from('profiles').select('name,phone').eq('id', user.id).single() : Promise.resolve({ data: null as { name?: string; phone?: string } | null }),
      ]);
      if (!live) return;
      if (r) {
        const tc = (r.theme_config ?? {}) as Record<string, string>;
        setName(r.name ?? '');
        setThemeCfg(tc);
        setAddress(tc.address ?? '');
        setPhone(tc.phone ?? '');
        setContactEmail(tc.email ?? '');
        setTier(r.subscription_tier ?? '');
      }
      if (p) {
        setFullName(p.name ?? '');
        setMyPhone(p.phone ?? '');
      }
      if (user?.email) setLoginEmail(user.email);
      setLoading(false);
    })();
    return () => {
      live = false;
    };
  }, [restaurantId]);

  const saveRestaurant = () =>
    guard(async () => {
      setRMsg(null);
      if (!name.trim()) {
        setRMsg({ text: t('set_val_name'), ok: false });
        return;
      }
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
        setRMsg({ text: t('set_val_email'), ok: false });
        return;
      }
      setSaving('rest');
      try {
        const { error } = await createClient()
          .from('restaurants')
          .update({
            name: name.trim(),
            theme_config: { ...themeCfg, address: address.trim(), phone: phone.trim(), email: contactEmail.trim() },
          })
          .eq('id', restaurantId);
        if (error) throw error;
        onNameChange(name.trim());
        setRMsg({ text: t('set_saved_rest'), ok: true });
      } catch (err) {
        setRMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_default')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  const saveAccount = () =>
    guard(async () => {
      setAMsg(null);
      if (!fullName.trim()) {
        setAMsg({ text: t('set_val_fullname'), ok: false });
        return;
      }
      setSaving('acct');
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error(t('set_err_session'));
        const { error } = await supabase.from('profiles').update({ name: fullName.trim(), phone: myPhone.trim() || null }).eq('id', user.id);
        if (error) throw error;
        setAMsg({ text: t('set_saved_acct'), ok: true });
      } catch (err) {
        setAMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_default')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  const changeEmail = () =>
    guard(async () => {
      setSMsg(null);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
        setSMsg({ text: t('set_val_newemail'), ok: false });
        return;
      }
      setSaving('email');
      try {
        const { error } = await createClient().auth.updateUser({ email: newEmail.trim() });
        if (error) throw error;
        setSMsg({ text: t('set_email_sent'), ok: true });
        setNewEmail('');
      } catch (err) {
        setSMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_email')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  const changePassword = () =>
    guard(async () => {
      setSMsg(null);
      if (newPass.length < 6) {
        setSMsg({ text: t('set_val_passlen'), ok: false });
        return;
      }
      if (newPass !== confirmPass) {
        setSMsg({ text: t('set_val_passmatch'), ok: false });
        return;
      }
      setSaving('pass');
      try {
        const { error } = await createClient().auth.updateUser({ password: newPass });
        if (error) throw error;
        setSMsg({ text: t('set_pass_changed'), ok: true });
        setNewPass('');
        setConfirmPass('');
      } catch (err) {
        setSMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_pass')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  if (loading) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm font-bold text-muted">{t('set_loading')}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHead title="Settings" sub={t('set_sub')} />

      {/* ── restaurant ── */}
      <Card className="p-5 sm:p-6">
        <h3 className="font-display text-[16px] font-extrabold text-ink">🏪 Restaurant details</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">{t('set_rest_info')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Restaurant name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spice Villa" maxLength={80} />
          </div>
          <div>
            <Label>Contact email</Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@restaurant.pk" maxLength={120} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" maxLength={30} />
          </div>
          <div>
            <Label>Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Road, Kharian" maxLength={160} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-soft px-3 py-1 text-[12px] font-bold text-muted">slug: {slug}</span>
          {tier && <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-bold text-brand">Plan: {tier}</span>}
        </div>
        <p className="mt-2 text-[11.5px] text-muted">{t('set_slug_note')}</p>
        {rMsg && <div className="mt-3">{msg(rMsg.text, rMsg.ok)}</div>}
        <div className="mt-4">
          <Btn onClick={saveRestaurant} disabled={saving === 'rest'}>
            {saving === 'rest' ? t('set_saving') : 'Save restaurant details'}
          </Btn>
        </div>
      </Card>

      {/* ── my account ── */}
      <Card className="p-5 sm:p-6">
        <h3 className="font-display text-[16px] font-extrabold text-ink">👤 My account</h3>
        <p className="mt-0.5 text-[12.5px] text-muted">{t('set_acct_info')}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tahseen Alam" maxLength={80} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="0300 1234567" maxLength={30} />
          </div>
        </div>
        <div className="mt-3">
          <Label>Login email</Label>
          <Input value={loginEmail} disabled className="opacity-60" />
          <p className="mt-1 text-[11.5px] text-muted">{t('set_email_note')}</p>
        </div>
        {aMsg && <div className="mt-3">{msg(aMsg.text, aMsg.ok)}</div>}
        <div className="mt-4">
          <Btn onClick={saveAccount} disabled={saving === 'acct'}>
            {saving === 'acct' ? t('set_saving') : 'Save my details'}
          </Btn>
        </div>
      </Card>

      {/* ── security ── */}
      <Card className="p-5 sm:p-6">
        <h3 className="font-display text-[16px] font-extrabold text-ink">🔐 Login & security</h3>
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div>
            <Label>{t('set_new_email')}</Label>
            <div className="flex gap-2">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.pk" className="flex-1" maxLength={120} />
              <Btn variant="secondary" onClick={changeEmail} disabled={saving === 'email'}>
                {saving === 'email' ? '…' : 'Change'}
              </Btn>
            </div>
          </div>
          <div>
            <Label>{t('set_new_pass')}</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t('set_ph_pass')} maxLength={72} />
            <div className="mt-2">
              <Label>{t('set_pass_confirm')}</Label>
              <div className="flex gap-2">
                <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="••••••••" className="flex-1" maxLength={72} />
                <Btn variant="secondary" onClick={changePassword} disabled={saving === 'pass'}>
                  {saving === 'pass' ? '…' : 'Change'}
                </Btn>
              </div>
            </div>
          </div>
        </div>
        {sMsg && <div className="mt-4">{msg(sMsg.text, sMsg.ok)}</div>}
      </Card>
    </div>
  );
}
