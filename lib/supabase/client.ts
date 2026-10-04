'use client';

// Browser-side Supabase client (anon key — RLS protects everything).
// Build-safe: falls back to placeholders when env vars are missing so
// `next build` never crashes. Use `isSupabaseConfigured()` to gate UI.

import { createBrowserClient } from '@supabase/ssr';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  return (
    url.length > 0 &&
    key.length > 0 &&
    !url.includes('placeholder') &&
    key !== PLACEHOLDER_KEY
  );
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY,
  );
}
