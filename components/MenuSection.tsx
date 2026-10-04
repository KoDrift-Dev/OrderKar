'use client';

// Menu section shell: Items | Categories tabs (dashboard stays untouched).

import { useState } from 'react';
import MenuManager from './MenuManager';
import CategoryManager from './CategoryManager';

export default function MenuSection({ restaurantId }: { restaurantId: string }) {
  const [tab, setTab] = useState<'items' | 'cats'>('items');
  return (
    <div>
      <div className="mb-5 flex gap-1.5">
        {(
          [
            { key: 'items', label: '🍽️ Menu Items' },
            { key: 'cats', label: '🗂 Categories' },
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
      {tab === 'items' ? <MenuManager restaurantId={restaurantId} /> : <CategoryManager restaurantId={restaurantId} />}
    </div>
  );
}
