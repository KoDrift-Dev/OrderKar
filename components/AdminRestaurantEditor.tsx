'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AdminRestaurantEditor({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: { name: string; logo_url: string; address: string; phone: string; email: string; brand_color: string };
}) {
  const [name, setName] = useState(initial.name);
  const [logoUrl, setLogoUrl] = useState(initial.logo_url);
  const [address, setAddress] = useState(initial.address);
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [brandColor, setBrandColor] = useState(initial.brand_color);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const save = async () => {
    if (!name.trim()) {
      setMsg('Name is required.');
      return;
    }
    setSaving(true);
    setMsg('');
    const supabase = createClient();
    const { data: cur } = await supabase.from('restaurants').select('theme_config').eq('id', restaurantId).single();
    const tc = ((cur?.theme_config ?? {}) as Record<string, unknown>);
    const { error } = await supabase
      .from('restaurants')
      .update({
        name: name.trim(),
        theme_config: {
          ...tc,
          logo_url: logoUrl.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          brand_color: brandColor.trim() || null,
        },
      })
      .eq('id', restaurantId);
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : 'Saved ✓');
  };

  const input =
    'w-full rounded-[10px] border border-line/12 bg-[var(--c-surface-solid)] px-3 py-2 text-[13.5px] font-medium text-ink outline-none focus:border-brand/50';

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Restaurant Name</label>
        <input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Logo URL</label>
        <input className={input} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" maxLength={500} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Phone</label>
          <input className={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300 1234567" maxLength={30} />
        </div>
        <div>
          <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Email</label>
          <input className={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="info@…" maxLength={120} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Address</label>
        <input className={input} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Main Road, City" maxLength={160} />
      </div>
      <div>
        <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Brand Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={brandColor || '#6D28D9'}
            onChange={(e) => setBrandColor(e.target.value)}
            className="h-9 w-12 cursor-pointer rounded-[8px] border border-line/12"
          />
          <input className={input} value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#6D28D9" maxLength={7} />
        </div>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={save}
          disabled={saving}
          className="btn-3d rounded-btn px-4 py-2 text-[13.5px] font-extrabold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Details'}
        </button>
        {msg && <span className="text-[13px] font-bold text-muted">{msg}</span>}
      </div>
    </div>
  );
}
