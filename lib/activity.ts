// Activity audit trail — fire-and-forget logging for the security audit trail.
// Every important staff/customer action should call logActivity() AFTER the
// mutation succeeds. Logging must NEVER break or slow the main flow, so it is
// intentionally not awaited and swallows its own errors.
//
// Backed by public.activity_log (supabase/activity-log.sql).

import type { SupabaseClient } from '@supabase/supabase-js';

export type ActivityOpts = {
  restaurantId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

// Standard action names — keep these stable, the History UI filters on them.
export const ACT = {
  ORDER_CREATED: 'order_created',
  ORDER_STATUS_CHANGED: 'order_status_changed',
  ORDER_CANCELLED: 'order_cancelled',
  PAYMENT_COLLECTED: 'payment_collected',
  PAYMENT_REFUNDED: 'payment_refunded',
  MENU_ITEM_CREATED: 'menu_item_created',
  MENU_ITEM_UPDATED: 'menu_item_updated',
  MENU_ITEM_DELETED: 'menu_item_deleted',
  MENU_ITEM_AVAILABILITY: 'menu_item_availability',
  CATEGORY_CREATED: 'category_created',
  CATEGORY_UPDATED: 'category_updated',
  CATEGORY_DELETED: 'category_deleted',
  TABLE_ADDED: 'table_added',
  TABLE_UPDATED: 'table_updated',
  TABLE_REMOVED: 'table_removed',
  STAFF_ADDED: 'staff_added',
  STAFF_REMOVED: 'staff_removed',
  STAFF_LOGIN_ADDED: 'staff_login_added',
  WASTE_LOGGED: 'waste_logged',
  SETTINGS_UPDATED: 'settings_updated',
  BILLING_UPDATED: 'billing_updated',
  STAFF_LOGIN: 'staff_login',
  STAFF_LOGOUT: 'staff_logout',
  INVENTORY_DEDUCTED: 'inventory_deducted',
  SUPPLIER_ADDED: 'supplier_added',
  SUPPLIER_UPDATED: 'supplier_updated',
  SUPPLIER_DELETED: 'supplier_deleted',
  PO_CREATED: 'po_created',
  PO_STATUS_CHANGED: 'po_status_changed',
} as const;

export function logActivity(supabase: SupabaseClient, opts: ActivityOpts): void {
  void (async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      await supabase.from('activity_log').insert({
        restaurant_id: opts.restaurantId,
        actor_id: user?.id ?? null,
        action: opts.action,
        entity_type: opts.entityType,
        entity_id: opts.entityId ?? null,
        details: opts.details ?? {},
        // Client-side: IP is not reliably available; user agent is.
        ip_address: null,
        user_agent:
          typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
      });
    } catch {
      // Audit logging is best-effort — never break the user flow.
    }
  })();
}
