'use client';

// Super-admin per-restaurant POS on/off switch.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useGuard } from './DeleteFlow';

export default function AdminPosToggle({
  restaurantId,
  initial,
}: {
  restaurantId: string;
  initial: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);
  const guard = useGuard();

  const toggle = () =>
    guard(async () => {
      setSaving(true);
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('restaurants')
          .select('theme_config')
          .eq('id', restaurantId)
          .single();
        const tc = { ...((data?.theme_config ?? {}) as Record<string, unknown>), pos_enabled: !enabled };
        const { error } = await supabase.from('restaurants').update({ theme_config: tc }).eq('id', restaurantId);
        if (error) throw error;
        setEnabled(!enabled);
      } finally {
        setSaving(false);
      }
    });

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle();
      }}
      disabled={saving}
      className="flex w-full items-center justify-between gap-3"
      title="Super-admin: POS tab on/off for this restaurant"
    >
      <span className="text-[13px] font-bold text-muted">
        🧾 POS {enabled ? <span className="text-ok">enabled</span> : <span className="text-danger">disabled</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-ok' : 'bg-soft'}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  );
}
