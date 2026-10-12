// POST /api/menu/scan — extract menu items from a menu photo with AI.
// Body: { restaurantId: string, imageUrl: string }
// Returns: { items: [{ name, description, price, category }] }
// Only owner/manager of the restaurant may scan.

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { visionIsConfigured, extractMenuFromImage } from '@/lib/vision';

export async function POST(req: Request) {
  if (!visionIsConfigured()) {
    return NextResponse.json(
      {
        error:
          'AI menu scanning is not configured yet. Set VISION_API_URL, VISION_API_KEY and VISION_MODEL (OpenAI, Azure OpenAI or OpenRouter) to enable it.',
      },
      { status: 503 },
    );
  }
  const { restaurantId, imageUrl } = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    imageUrl?: string;
  };
  if (!restaurantId || !imageUrl) {
    return NextResponse.json({ error: 'restaurantId and imageUrl are required' }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, restaurant_id, is_active')
    .eq('id', user.id)
    .maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  const profileRest = (profile as { restaurant_id?: string } | null)?.restaurant_id;
  const isActive = (profile as { is_active?: boolean } | null)?.is_active;
  if (!profile || isActive === false) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (profileRest !== restaurantId && role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (role !== 'owner' && role !== 'manager' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Only owners or managers can scan menus' }, { status: 403 });
  }

  // Vision API spend protection: 10 scans per 10 minutes per user.
  // Checked after auth so the key is the authenticated user id.
  const rl = rateLimit(`scan:${user.id}`, { limit: 10, windowMs: 10 * 60 * 1000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a little before scanning again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  try {
    const items = await extractMenuFromImage(imageUrl);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Scan failed' },
      { status: 502 },
    );
  }
}
