'use client';

// Staff avatar: real photo when uploaded, otherwise a gender-based silhouette.

import { cdnUrl } from '@/lib/images';

function MaleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
      <circle cx="24" cy="17" r="8" fill="currentColor" />
      <path d="M16 15c-1-4 3-8 8-8s9 4 8 8c-1-2-2-3-4-3-3 1-9 1-12 3z" fill="currentColor" opacity="0.85" />
      <path d="M8 44c0-9 7-14 16-14s16 5 16 14v2H8v-2z" fill="currentColor" />
    </svg>
  );
}

function FemaleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden="true">
      <path d="M24 4c-6 0-10 4-10 10 0 8-2 12-4 16 3 1 6-1 7-4 2 3 5 4 7 4s5-1 7-4c1 3 4 5 7 4-2-4-4-8-4-16 0-6-4-10-10-10z" fill="currentColor" opacity="0.9" />
      <circle cx="24" cy="18" r="7" fill="currentColor" />
      <path d="M10 44c0-8 6-13 14-13s14 5 14 13v2H10v-2z" fill="currentColor" />
    </svg>
  );
}

export default function Avatar({
  name,
  photoUrl,
  gender,
  size = 44,
}: {
  name: string;
  photoUrl?: string | null;
  gender?: 'male' | 'female' | null;
  size?: number;
}) {
  const bg = gender === 'female' ? 'bg-pink-500/15 text-pink-600' : gender === 'male' ? 'bg-brand/15 text-brand' : 'bg-teal/15 text-teal';
  return (
    <div
      title={name}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full ${bg}`}
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <img src={cdnUrl(photoUrl)} alt={name} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-[72%] w-[72%]">{gender === 'female' ? <FemaleGlyph /> : <MaleGlyph />}</div>
      )}
    </div>
  );
}
