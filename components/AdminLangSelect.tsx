'use client';

// Super-admin per-restaurant language selector: Roman Urdu / English.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGuard } from './DeleteFlow';
import type { Lang } from '@/lib/i18n';

export default function AdminLangSelect({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: Lang;
}) {
  const [lang, setLang] = useState<Lang>(initial);
  const [saving, setSaving] = useState(false);
  const guard = useGuard();

  const set = (next: Lang) =>
    guard(async () => {
      if (next === lang) return;
      setSaving(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('restaurants')
          .select('theme_config')
          .eq('id', restaurantId)
          .single();
        const tc = { ...((data?.theme_config ?? {}) as Record<string, unknown>), language: next };
        const { error } = await supabase.from('restaurants').update({ theme_config: tc }).eq('id', restaurantId);
        if (error) throw error;
        setLang(next);
      } finally {
        setSaving(false);
      }
    });

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13px] font-bold text-muted">🌐 Language{saving ? '…' : ''}</span>
      <div className="flex overflow-hidden rounded-full border border-line text-[12px] font-extrabold">
        {(['roman', 'english'] as Lang[]).map((l) => (
          <button
            key={l}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              set(l);
            }}
            disabled={saving}
            className={`px-3 py-1.5 transition-colors ${lang === l ? 'bg-brand text-white' : 'text-muted hover:text-ink'}`}
          >
            {l === 'roman' ? 'Roman Urdu' : 'English'}
          </button>
        ))}
      </div>
    </div>
  );
}
