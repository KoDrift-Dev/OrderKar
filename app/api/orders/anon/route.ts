// POST /api/orders/anon — anonymous (QR customer) order creation.
// Body: { restaurantId, tableId, items, trackingToken, customerName?, notes? }
//   items: [{ menu_item_id, quantity, item_name?, unit_price?, notes? }]
//
// Server-side wrapper around the create_anon_order SECURITY DEFINER RPC.
// Exists so the fraud-critical anon order path gets a real server-side rate
// limit (5 orders/hour per IP+table) — the old client-side localStorage
// throttle was trivially bypassable. Pricing/trust still lives entirely in
// the RPC: it re-prices every line from menu_items and forces
// status='pending' / payment_status='unpaid'; client-supplied prices are
// ignored by the database function itself.

import { NextResponse } from 'next/server';
import { createClient, isServerConfigured } from '@/lib/supabase/server';
import { rateLimit, clientIp } from '@/lib/rate-limit';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AnonItem {
  menu_item_id?: unknown;
  quantity?: unknown;
  item_name?: unknown;
  unit_price?: unknown;
  notes?: unknown;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: 'Ordering is not configured yet.' }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: unknown;
    tableId?: unknown;
    items?: unknown;
    trackingToken?: unknown;
    customerName?: unknown;
    notes?: unknown;
  };

  const { restaurantId, tableId, items, trackingToken } = body;
  if (typeof restaurantId !== 'string' || !UUID_RE.test(restaurantId)) return bad('Invalid restaurantId');
  if (typeof tableId !== 'string' || !UUID_RE.test(tableId)) return bad('Invalid tableId');
  if (typeof trackingToken !== 'string' || !UUID_RE.test(trackingToken))
    return bad('Invalid trackingToken');
  if (!Array.isArray(items) || items.length === 0 || items.length > 30)
    return bad('items must be a non-empty array (max 30 lines)');
  for (const it of items as AnonItem[]) {
    if (typeof it !== 'object' || it === null) return bad('Invalid item');
    if (typeof it.menu_item_id !== 'string' || !UUID_RE.test(it.menu_item_id))
      return bad('Invalid menu_item_id');
    // Bounds mirror the create_anon_order RPC (1..20) so bad input gets a
    // clean 400 here instead of an RPC exception.
    if (typeof it.quantity !== 'number' || !Number.isInteger(it.quantity) || it.quantity < 1 || it.quantity > 20)
      return bad('Invalid quantity');
  }
  const customerName =
    typeof body.customerName === 'string' && body.customerName.trim()
      ? body.customerName.trim().slice(0, 60)
      : null;
  const notes =
    typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  // 5 orders/hour per IP+table — mirrors the old client-side device throttle,
  // now enforced server-side where it cannot be bypassed.
  const rl = rateLimit(`anon-order:${clientIp(req)}:${tableId}`, {
    limit: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many orders from this device. Please wait a little before ordering again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      },
    );
  }

  const supabase = createClient();
  const { data: rpcData, error: rpcErr } = await supabase.rpc('create_anon_order', {
    p_restaurant_id: restaurantId,
    p_table_id: tableId,
    p_items: items,
    p_tracking_token: trackingToken,
    p_customer_name: customerName,
    p_notes: notes,
  });
  if (rpcErr) {
    // RPC raises for: unknown restaurant/table, cross-tenant items,
    // unavailable items, bad quantities. Surface the message, never internals.
    return bad(rpcErr.message || 'Order failed');
  }
  const rpc = rpcData as { order_id?: string; total_amount?: number } | null;
  if (!rpc?.order_id) return bad('Order failed', 500);
  return NextResponse.json({ order_id: rpc.order_id, total_amount: rpc.total_amount ?? null });
}
