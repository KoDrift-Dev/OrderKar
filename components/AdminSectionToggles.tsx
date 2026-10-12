'use client';

// Per-restaurant section visibility toggles for superadmin.
// Disabled sections are hidden from the restaurant's StaffShell nav.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const SECTIONS = [
  { key: 'pos', label: 'POS Register', icon: '🧾', desc: 'Point-of-sale billing screen' },
  { key: 'menu', label: 'Menu', icon: '🍽️', desc: 'Menu management' },
  { key: 'team', label: 'Team', icon: '👥', desc: 'Staff & role management' },
  { key: 'kitchen', label: 'Kitchen', icon: '👨‍🍳', desc: 'Kitchen display screen' },
  { key: 'waiter', label: 'Waiter', icon: '🧑‍💼', desc: 'Waiter ordering screen' },
] as const;

export default function AdminSectionToggles({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: Record<string, boolean>;
}) {
  const [sections, setSections] = useState<Record<string, boolean>>(() => {
    const s: Record<string, boolean> = {};
    for (const sec of SECTIONS) s[sec.key] = initial[sec.key] !== false;
    return s;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const toggle = async (key: string) => {
    const next = { ...sections, [key]: !sections[key] };
    setSections(next);
    setSaving(true);
    setMsg('');
    const supabase = createClient();
    const { data: cur } = await supabase.from('restaurants').select('theme_config').eq('id', restaurantId).single();
    const tc = ((cur?.theme_config ?? {}) as Record<string, unknown>);
    const { error } = await supabase
      .from('restaurants')
      .update({ theme_config: { ...tc, sections: next } })
      .eq('id', restaurantId);
    setSaving(false);
    setMsg(error ? `Error: ${error.message}` : 'Saved ✓');
    if (error) setSections(sections); // revert on failure
  };

  return (
    <div>
      <p className="mb-3 text-[13px] text-muted">
        Turn sections on/off for this restaurant. Disabled sections are hidden from their staff navigation.
      </p>
      <div className="space-y-2">
        {SECTIONS.map((sec) => {
          const on = sections[sec.key];
          return (
            <div
              key={sec.key}
              className="flex items-center justify-between gap-3 rounded-[12px] border border-line/12 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-[20px]">{sec.icon}</span>
                <div>
                  <p className="text-[14px] font-extrabold text-ink">{sec.label}</p>
                  <p className="text-[12px] text-muted">{sec.desc}</p>
                </div>
              </div>
              <button
                onClick={() => toggle(sec.key)}
                disabled={saving}
                role="switch"
                aria-checked={on}
                aria-label={`${sec.label} section`}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                  on ? 'bg-green-500' : 'bg-line/30'
                } disabled:opacity-50`}
              >
                <span
                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    on ? 'left-6' : 'left-1'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
      {msg && <p className="mt-2 text-[13px] font-bold text-muted">{msg}</p>}
    </div>
  );
}
