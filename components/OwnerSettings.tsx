'use client';

// Owner settings — restaurant/company details, owner account,
// and login security (email + password change).

import { useEffect, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { logActivity, ACT } from '@/lib/activity';
import { useT } from '@/lib/i18n';
import { Btn, Card, SectionHead, Input, Label } from './ui';
import { useGuard } from './DeleteFlow';
import { POS_PALETTES, type PosPaletteId } from './PosTab';
import SmartImage from './SmartImage';
import SubscriptionCard from './SubscriptionCard';
import { rootDomain, brandThemeVars } from '@/lib/tenant-url';

// 8 preset brand colors (restaurant-friendly palette)
const BRAND_PRESETS = [
  '#6D28D9', // OrderKar purple (default)
  '#0D9488', // teal
  '#F59E0B', // amber
  '#DC2626', // chili red
  '#16A34A', // fresh green
  '#2563EB', // royal blue
  '#DB2777', // magenta
  '#1F2937', // charcoal
];

const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v.trim());

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
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const guard = useGuard();
  const [saving, setSaving] = useState<string | null>(null);

  // ── restaurant ──
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [tier, setTier] = useState('');
  const [themeCfg, setThemeCfg] = useState<Record<string, string>>({});
  const [posPalette, setPosPalette] = useState<PosPaletteId>('amber');
  const [brandColor, setBrandColor] = useState('');
  const [brandColor2, setBrandColor2] = useState('');
  const [brandMode, setBrandMode] = useState<'single' | 'dual'>('single');
  const [brandMsg, setBrandMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [rMsg, setRMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // ── billing (receipt tax + service charges) ──
  const [taxValue, setTaxValue] = useState('');
  const [taxType, setTaxType] = useState<'rs' | 'pct'>('pct');
  const [svcValue, setSvcValue] = useState('');
  const [svcType, setSvcType] = useState<'rs' | 'pct'>('pct');
  const [fbrValue, setFbrValue] = useState('');
  const [ntn, setNtn] = useState('');
  const [strn, setStrn] = useState('');
  const [bMsg, setBMsg] = useState<{ text: string; ok: boolean } | null>(null);

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
        setTaxValue(tc.tax_value ?? '');
        setTaxType(tc.tax_type === 'rs' ? 'rs' : 'pct');
        setSvcValue(tc.svc_value ?? '');
        setSvcType(tc.svc_type === 'rs' ? 'rs' : 'pct');
        setFbrValue(tc.fbr_value ?? '');
        setNtn(tc.ntn ?? '');
        setStrn(tc.strn ?? '');
        setPhone(tc.phone ?? '');
        setContactEmail(tc.email ?? '');
        setLogoUrl(tc.logo_url ?? '');
        setBrandColor(typeof tc.brand_color === 'string' ? tc.brand_color : '');
        const bc2 = typeof tc.brand_color_2 === 'string' ? tc.brand_color_2 : '';
        setBrandColor2(bc2);
        setBrandMode(bc2.trim() ? 'dual' : 'single');
        setTier(r.subscription_tier ?? '');
        if (tc.pos_palette && POS_PALETTES[tc.pos_palette as PosPaletteId]) {
          setPosPalette(tc.pos_palette as PosPaletteId);
        } else {
          try {
            const local = localStorage.getItem('orderkar_pos_palette') as PosPaletteId | null;
            if (local && POS_PALETTES[local]) setPosPalette(local);
          } catch {}
        }
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
            theme_config: {
              ...themeCfg,
              address: address.trim(),
              phone: phone.trim(),
              email: contactEmail.trim(),
              logo_url: logoUrl.trim(),
              pos_palette: posPalette,
              brand_color: brandColor.trim(),
              brand_color_2: brandMode === 'dual' ? brandColor2.trim() : '',
            },
          })
          .eq('id', restaurantId);
        if (error) throw error;
        try {
          localStorage.setItem('orderkar_pos_palette', posPalette);
        } catch {}
        onNameChange(name.trim());
        setRMsg({ text: t('set_saved_rest'), ok: true });
        logActivity(createClient(), {
          restaurantId,
          action: ACT.SETTINGS_UPDATED,
          entityType: 'restaurant',
          entityId: restaurantId,
          details: { section: 'profile', name: name.trim() },
        });
      } catch (err) {
        setRMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_default')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  const saveBrand = () =>
    guard(async () => {
      setBrandMsg(null);
      const c1 = brandColor.trim();
      const c2 = brandMode === 'dual' ? brandColor2.trim() : '';
      if (c1 && !isHex(c1)) {
        setBrandMsg({ text: 'Color 1 must be a valid hex like #6D28D9', ok: false });
        return;
      }
      if (c2 && !isHex(c2)) {
        setBrandMsg({ text: 'Color 2 must be a valid hex like #0D9488', ok: false });
        return;
      }
      setSaving('brand');
      try {
        const { error } = await createClient()
          .from('restaurants')
          .update({
            theme_config: {
              ...themeCfg,
              brand_color: c1,
              brand_color_2: c2,
            },
          })
          .eq('id', restaurantId);
        if (error) throw error;
        setThemeCfg((prev) => ({ ...prev, brand_color: c1, brand_color_2: c2 }));
        setBrandMsg({ text: '✓ Brand color saved', ok: true });
        logActivity(createClient(), {
          restaurantId,
          action: ACT.SETTINGS_UPDATED,
          entityType: 'restaurant',
          entityId: restaurantId,
          details: { section: 'brand-color', color1: c1, color2: c2 || undefined },
        });
        // Re-run server components so the new brand applies across the whole console instantly
        router.refresh();
      } catch (err) {
        setBrandMsg({ text: `❌ ${err instanceof Error ? err.message : t('set_err_default')}`, ok: false });
      } finally {
        setSaving(null);
      }
    });

  const saveBilling = () =>
    guard(async () => {
      setBMsg(null);
      setSaving('bill');
      try {
        const cfg = {
          ...themeCfg,
          tax_value: taxValue.trim(),
          tax_type: taxType,
          svc_value: svcValue.trim(),
          svc_type: svcType,
          fbr_value: fbrValue.trim(),
          ntn: ntn.trim(),
          strn: strn.trim(),
        };
        const { error } = await createClient()
          .from('restaurants')
          .update({ theme_config: cfg })
          .eq('id', restaurantId);
        if (error) throw error;
        setThemeCfg(cfg);
        setBMsg({ text: t('set_saved_bill'), ok: true });
        logActivity(createClient(), {
          restaurantId,
          action: ACT.BILLING_UPDATED,
          entityType: 'restaurant',
          entityId: restaurantId,
          details: { section: 'billing_receipt' },
        });
      } catch (err) {
        setBMsg({ text: `\u274C ${err instanceof Error ? err.message : t('set_err_default')}`, ok: false });
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

  // Live preview vars for the brand section (WYSIWYG — same vars TenantProvider applies)
  const pvC1 = isHex(brandColor) ? brandColor.trim() : '#6D28D9';
  const pvC2 = brandMode === 'dual' && isHex(brandColor2) ? brandColor2.trim() : '';
  const previewVars = brandThemeVars(pvC1, pvC2) as CSSProperties;

  return (
    <div className="space-y-5">
      <div className="border-b border-line pb-4">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink">
          Restaurant & Security Settings
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          Manage business profile, owner credentials, and access security
        </p>
      </div>

      {/* ── restaurant ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand/10 text-brand text-lg shadow-sm">
            🏪
          </span>
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-ink">Restaurant Profile</h3>
            <p className="text-[12.5px] font-medium text-muted">{t('set_rest_info')}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Restaurant Logo input & preview */}
          <div className="sm:col-span-2 rounded-[18px] border border-line bg-soft/40 p-4">
            <Label>Restaurant Company Logo</Label>
            <p className="text-[12px] text-muted mb-3">
              Official branding logo displayed on PDF reports, receipts, and invoices
            </p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-line bg-[var(--c-surface-solid)] flex items-center justify-center shadow-xs">
                {logoUrl ? (
                  <SmartImage
                    src={logoUrl}
                    alt={name || 'Logo'}
                    fill
                    sizes="64px"
                    className="object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <span className="text-2xl font-black text-brand">
                    {name ? name.charAt(0).toUpperCase() : '🏪'}
                  </span>
                )}
              </div>
              <div className="flex-1 w-full space-y-1.5">
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://example.com/logo.png (Direct Image URL)"
                />
                <p className="text-[11px] text-muted">Paste your image URL (JPG, PNG, WEBP, or SVG)</p>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2 rounded-[18px] border border-line bg-soft/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Label>Brand Color</Label>
                <p className="text-[12px] text-muted">
                  Your restaurant&apos;s primary color across the app (buttons, highlights)
                </p>
              </div>
              <div
                className="flex rounded-full border border-line bg-[var(--c-surface-solid)] p-0.5 text-[12px] font-extrabold"
                role="tablist"
                aria-label="Brand color mode"
              >
                {(['single', 'dual'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={brandMode === m}
                    onClick={() => setBrandMode(m)}
                    className={`rounded-full px-3.5 py-1.5 capitalize transition-all ${
                      brandMode === m ? 'bg-brand text-white shadow-sm' : 'text-muted hover:text-ink'
                    }`}
                  >
                    {m === 'single' ? 'Single' : 'Dual'}
                  </button>
                ))}
              </div>
            </div>

            {/* 8 preset swatches */}
            <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-muted">Presets</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {BRAND_PRESETS.map((c) => {
                const active = brandColor.trim().toLowerCase() === c.toLowerCase();
                return (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    aria-label={`Preset color ${c}`}
                    onClick={() => setBrandColor(c)}
                    className={`h-9 w-9 rounded-full transition-transform hover:scale-110 ${
                      active ? 'ring-2 ring-ink ring-offset-2 ring-offset-[var(--c-surface-solid)]' : 'ring-1 ring-line'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                );
              })}
            </div>

            {/* Custom picker (kept as-is) */}
            <p className="mt-4 text-[11px] font-extrabold uppercase tracking-wider text-muted">Custom</p>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="color"
                value={isHex(brandColor) ? brandColor.trim() : '#6D28D9'}
                onChange={(e) => setBrandColor(e.target.value)}
                aria-label="Brand color picker"
                className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-[var(--c-surface-solid)]"
              />
              <Input
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                placeholder="#6D28D9 (empty = OrderKar default)"
                maxLength={7}
                className="max-w-[220px] font-mono"
                aria-label="Brand color hex"
              />
              {brandColor.trim() && (
                <button
                  type="button"
                  onClick={() => setBrandColor('')}
                  className="text-[12px] font-bold text-muted underline"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Dual: second color */}
            {brandMode === 'dual' && (
              <div className="mt-4">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-muted">Second color</p>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={isHex(brandColor2) ? brandColor2.trim() : '#0D9488'}
                    onChange={(e) => setBrandColor2(e.target.value)}
                    aria-label="Second brand color picker"
                    className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-[var(--c-surface-solid)]"
                  />
                  <Input
                    value={brandColor2}
                    onChange={(e) => setBrandColor2(e.target.value)}
                    placeholder="#0D9488"
                    maxLength={7}
                    className="max-w-[220px] font-mono"
                    aria-label="Second brand color hex"
                  />
                  {brandColor2.trim() && (
                    <button
                      type="button"
                      onClick={() => setBrandColor2('')}
                      className="text-[12px] font-bold text-muted underline"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Live preview */}
            <div className="mt-4 rounded-[14px] border border-line bg-[var(--c-surface-solid)] p-3" style={previewVars}>
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-muted">Live preview</p>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="btn-3d rounded-btn px-4 py-2 text-[13px] font-bold text-white">Order Now</span>
                <span className="rounded-full bg-brand px-3 py-1 text-[11px] font-extrabold text-white">New</span>
                <span className="text-[14px] font-extrabold text-brand">Spice Route</span>
              </div>
              {brandMode === 'dual' && pvC2 && (
                <div
                  className="mt-2.5 h-2.5 w-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${pvC1}, ${pvC2})` }}
                />
              )}
            </div>

            {/* Save */}
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <Btn size="sm" disabled={saving === 'brand'} onClick={saveBrand}>
                {saving === 'brand' ? 'Saving…' : 'Save Brand Color'}
              </Btn>
              {brandMsg && (
                <span className={`text-[12.5px] font-bold ${brandMsg.ok ? 'text-emerald-600' : 'text-danger'}`}>
                  {brandMsg.text}
                </span>
              )}
            </div>
          </div>

          <div className="sm:col-span-2 rounded-[18px] border border-line bg-soft/40 p-4">
            <Label>Your Subdomain</Label>
            <p className="text-[12px] text-muted mb-3">
              Your own web address. Works once <span className="font-mono">*.{rootDomain()}</span> points to OrderKar.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-line bg-[var(--c-surface-solid)] px-3 py-2 font-mono text-[13px] font-bold text-brand">
                https://{slug}.{rootDomain()}/
              </span>
              <Btn
                variant="secondary"
                onClick={() => {
                  try {
                    navigator.clipboard.writeText(`https://${slug}.${rootDomain()}/`);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {}
                }}
              >
                {copied ? 'Copied ✓' : 'Copy'}
              </Btn>
            </div>
          </div>

          <div>
            <Label>Restaurant Business Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Spice Villa" maxLength={80} />
          </div>
          <div>
            <Label>Public Contact Email</Label>
            <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="hello@restaurant.pk" maxLength={120} />
          </div>
          <div>
            <Label>Business Phone Number</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" maxLength={30} />
          </div>
          <div>
            <Label>Physical Street Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Road, Kharian" maxLength={160} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-line bg-soft px-3 py-1 font-mono text-[12px] font-bold text-muted">
            URL: /{slug}
          </span>
          {tier && (
            <span className="rounded-full bg-brand/10 px-3 py-1 text-[12px] font-extrabold text-brand uppercase tracking-wider">
              {tier} Tier
            </span>
          )}
        </div>
        <p className="mt-2 text-[11.5px] text-muted">{t('set_slug_note')}</p>
        {rMsg && <div className="mt-3">{msg(rMsg.text, rMsg.ok)}</div>}
        <div className="mt-5 border-t border-line/70 pt-4">
          <Btn onClick={saveRestaurant} disabled={saving === 'rest'}>
            {saving === 'rest' ? t('set_saving') : 'Save Profile Changes'}
          </Btn>
        </div>
      </Card>

      {/* ── Subscription ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-brand/15 text-brand text-lg shadow-sm">
            💳
          </span>
          <div>
            <h3 className="font-display text-[15px] font-extrabold text-ink">Subscription & Billing</h3>
            <p className="text-[12px] text-muted">Your plan, trial status and invoices.</p>
          </div>
        </div>
        <div className="mt-4">
          <SubscriptionCard restaurantId={restaurantId} />
        </div>
      </Card>

      {/* ── Billing & Receipt ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-emerald-500/15 text-emerald-600 text-lg shadow-sm">
            🧾
          </span>
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-ink">{t('set_billing_title')}</h3>
            <p className="text-[12.5px] font-medium text-muted">{t('set_billing_sub')}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {[
            { label: t('set_tax'), value: taxValue, setValue: setTaxValue, type: taxType, setType: setTaxType },
            { label: t('set_svc'), value: svcValue, setValue: setSvcValue, type: svcType, setType: setSvcType },
          ].map((f) => (
            <div key={f.label} className="rounded-[16px] border border-line/70 bg-soft/40 p-4">
              <Label>{f.label}</Label>
              <div className="mt-1.5 flex gap-2">
                <Input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={f.value}
                  onChange={(e) => f.setValue(e.target.value)}
                  placeholder="0"
                  className="min-w-0 flex-1"
                />
                <div className="flex shrink-0 overflow-hidden rounded-btn border border-line/70">
                  {(['rs', 'pct'] as const).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => f.setType(k)}
                      className={`px-3.5 py-2 text-[12.5px] font-extrabold transition-colors ${
                        f.type === k ? 'bg-brand text-white' : 'text-muted hover:text-ink'
                      }`}
                    >
                      {k === 'rs' ? 'Rs' : '%'}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-1.5 text-[11.5px] font-medium text-muted">
                {f.type === 'pct' ? '% of bill subtotal' : 'Flat Rs amount per bill'}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div className="rounded-[16px] border border-line/70 bg-soft/40 p-4">
            <Label>FBR POS Charges (Rs)</Label>
            <Input
              type="number"
              min="0"
              inputMode="decimal"
              value={fbrValue}
              onChange={(e) => setFbrValue(e.target.value)}
              placeholder="0"
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11.5px] font-medium text-muted">Flat Rs per bill, added after tax</p>
          </div>
          <div className="rounded-[16px] border border-line/70 bg-soft/40 p-4">
            <Label>NTN #</Label>
            <Input
              value={ntn}
              onChange={(e) => setNtn(e.target.value)}
              placeholder="2211544-7"
              maxLength={30}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11.5px] font-medium text-muted">Printed on the receipt header</p>
          </div>
          <div className="rounded-[16px] border border-line/70 bg-soft/40 p-4">
            <Label>STRN #</Label>
            <Input
              value={strn}
              onChange={(e) => setStrn(e.target.value)}
              placeholder="0701980106655"
              maxLength={30}
              className="mt-1.5"
            />
            <p className="mt-1.5 text-[11.5px] font-medium text-muted">Printed on the receipt header</p>
          </div>
        </div>

        {bMsg && <div className="mt-3">{msg(bMsg.text, bMsg.ok)}</div>}
        <div className="mt-5 border-t border-line/70 pt-4">
          <Btn onClick={saveBilling} disabled={saving === 'bill'}>
            {saving === 'bill' ? t('set_saving') : 'Save Billing Settings'}
          </Btn>
        </div>
      </Card>

      {/* ── POS Register Appearance & Theme ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber/15 text-amber text-lg shadow-sm">
            🎨
          </span>
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-ink">POS Register Theme Color Palette</h3>
            <p className="text-[12.5px] font-medium text-muted">
              Choose the color palette for your counter billing and table POS register
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(POS_PALETTES) as PosPaletteId[]).map((pid) => {
            const p = POS_PALETTES[pid];
            const isSelected = posPalette === pid;
            return (
              <button
                key={pid}
                type="button"
                onClick={() => {
                  setPosPalette(pid);
                  try {
                    localStorage.setItem('orderkar_pos_palette', pid);
                  } catch {}
                }}
                className={`relative flex items-center gap-3.5 rounded-2xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? 'border-brand bg-brand/[0.06] shadow-sm ring-2 ring-brand/20'
                    : 'border-line bg-[var(--c-surface-solid)] hover:border-brand/40 hover:bg-soft/40'
                }`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-xs text-white text-xs font-bold"
                  style={{ backgroundColor: p.brand }}
                >
                  {isSelected ? '✓' : ''}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-ink">{p.name}</p>
                    {isSelected && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted font-medium mt-0.5">{p.nameUrdu}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── my account ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-teal/15 text-teal text-lg shadow-sm">
            👤
          </span>
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-ink">Owner Account</h3>
            <p className="text-[12.5px] font-medium text-muted">{t('set_acct_info')}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Owner Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Tahseen Alam" maxLength={80} />
          </div>
          <div>
            <Label>Owner Mobile Phone</Label>
            <Input value={myPhone} onChange={(e) => setMyPhone(e.target.value)} placeholder="0300 1234567" maxLength={30} />
          </div>
        </div>
        <div className="mt-4">
          <Label>Active Login Email</Label>
          <Input value={loginEmail} disabled className="opacity-60 bg-soft cursor-not-allowed font-mono text-[13.5px]" />
          <p className="mt-1 text-[11.5px] text-muted">{t('set_email_note')}</p>
        </div>
        {aMsg && <div className="mt-3">{msg(aMsg.text, aMsg.ok)}</div>}
        <div className="mt-5 border-t border-line/70 pt-4">
          <Btn onClick={saveAccount} disabled={saving === 'acct'}>
            {saving === 'acct' ? t('set_saving') : 'Update Account Info'}
          </Btn>
        </div>
      </Card>

      {/* ── security ── */}
      <Card className="stat-card-luxury p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-amber/15 text-amber text-lg shadow-sm">
            🔐
          </span>
          <div>
            <h3 className="font-display text-[16px] font-extrabold text-ink">Login & Password Security</h3>
            <p className="text-[12.5px] font-medium text-muted">Update administrative authentication details</p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[16px] border border-line bg-soft/30 p-4">
            <Label>{t('set_new_email')}</Label>
            <div className="mt-1.5 flex gap-2">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="new@email.pk" className="flex-1" maxLength={120} />
              <Btn variant="secondary" onClick={changeEmail} disabled={saving === 'email'}>
                {saving === 'email' ? '…' : 'Update'}
              </Btn>
            </div>
          </div>
          <div className="rounded-[16px] border border-line bg-soft/30 p-4">
            <Label>{t('set_new_pass')}</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder={t('set_ph_pass')} maxLength={72} />
            <div className="mt-3">
              <Label>{t('set_pass_confirm')}</Label>
              <div className="mt-1 flex gap-2">
                <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} placeholder="••••••••" className="flex-1" maxLength={72} />
                <Btn variant="secondary" onClick={changePassword} disabled={saving === 'pass'}>
                  {saving === 'pass' ? '…' : 'Change Password'}
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
