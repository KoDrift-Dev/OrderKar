'use client';

// Superadmin: create a new restaurant tenant.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export default function AdminAddRestaurant() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tier, setTier] = useState('monthly');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const router = useRouter();

  const onName = (v: string) => {
    setName(v);
    if (!slug || slug === slugify(name)) setSlug(slugify(v));
  };

  const create = async () => {
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) {
      setMsg('Name and slug are required.');
      return;
    }
    setSaving(true);
    setMsg('');
    const supabase = createClient();
    const { data, error } = await supabase
      .from('restaurants')
      .insert({
        name: name.trim(),
        slug: finalSlug,
        subscription_tier: tier,
        theme_config: {},
      })
      .select('id')
      .single();
    setSaving(false);
    if (error) {
      setMsg(error.message.includes('duplicate') ? 'Slug already taken.' : `Error: ${error.message}`);
      return;
    }
    setOpen(false);
    setName('');
    setSlug('');
    setMsg('');
    router.refresh();
    if (data?.id) router.push(`/admin/restaurants/${data.id}`);
  };

  const input =
    'w-full rounded-[10px] border border-line/12 bg-[var(--c-surface-solid)] px-3 py-2 text-[13.5px] font-medium text-ink outline-none focus:border-brand/50';

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-3d inline-flex items-center gap-2 rounded-btn px-4 py-2 text-[13.5px] font-extrabold text-white"
      >
        <span className="text-[16px]">＋</span> Add New Restaurant
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[20px] border border-line/12 bg-[var(--c-surface)] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-[18px] font-black text-ink">Add New Restaurant</h3>
            <p className="mt-1 text-[13px] text-muted">Creates a new tenant. You can add menu, tables & staff afterwards.</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Name</label>
                <input
                  className={input}
                  value={name}
                  onChange={(e) => onName(e.target.value)}
                  placeholder="e.g. Lahore Grill House"
                  maxLength={80}
                />
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Slug (URL)</label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] text-muted">/r/</span>
                  <input
                    className={input}
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="lahore-grill"
                    maxLength={40}
                  />
                </div>
                <p className="mt-1 text-[11.5px] text-muted">Cannot be changed later — QR codes use it.</p>
              </div>
              <div>
                <label className="mb-1 block text-[12px] font-bold uppercase tracking-wider text-muted">Plan</label>
                <select className={input} value={tier} onChange={(e) => setTier(e.target.value)}>
                  <option value="monthly">Monthly — Rs 7,999/mo</option>
                  <option value="6month">6 Months — Rs 43,999 one-time</option>
                  <option value="yearly">Yearly — Rs 79,999 one-time</option>
                </select>
              </div>
            </div>

            {msg && <p className="mt-3 text-[13px] font-bold text-red-500">{msg}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setOpen(false)}
                className="rounded-btn border border-line/12 px-4 py-2 text-[13.5px] font-bold text-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={saving}
                className="btn-3d rounded-btn px-4 py-2 text-[13.5px] font-extrabold text-white disabled:opacity-50"
              >
                {saving ? 'Creating…' : 'Create Restaurant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
