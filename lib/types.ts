// Shared Supabase row types (subset of the production schema).

export type Role = 'super_admin' | 'owner' | 'manager' | 'waiter' | 'kitchen';

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  theme_config: Record<string, unknown>;
  subscription_tier: 'starter' | 'pro' | 'enterprise';
  created_at: string;
}

export interface Profile {
  id: string;
  restaurant_id: string | null;
  role: Role;
  is_super_admin: boolean;
  name: string;
  phone: string | null;
  address: string | null;
  gender: 'male' | 'female' | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StaffMember {
  id: string;
  restaurant_id: string;
  name: string;
  job_title: string | null;
  phone: string | null;
  address: string | null;
  gender: 'male' | 'female' | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface MenuCategory {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  ingredients: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  prep_time_minutes: number;
  tags: string[];
}

export interface DiningTable {
  id: string;
  restaurant_id: string;
  table_number: number;
  qr_code: string;
  capacity: number;
  floor_section: string;
  is_active: boolean;
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  order_number: number;
  restaurant_id: string;
  table_id: string | null;
  waiter_id: string | null;
  order_type: string;
  status: OrderStatus;
  total_amount: number;
  payment_status: string;
  payment_method: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  notes: string | null;
  status: 'pending' | 'preparing' | 'ready';
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  tables?: { table_number: number } | null;
  profiles?: { name: string } | null;
}

export interface WasteLog {
  id: string;
  restaurant_id: string;
  item_name: string;
  quantity: number;
  reason: string;
  estimated_cost: number;
  logged_at: string;
}

export interface Review {
  id: string;
  restaurant_id: string;
  order_id: string | null;
  rating: number;
  comment: string | null;
  customer_name: string | null;
  created_at: string;
}
