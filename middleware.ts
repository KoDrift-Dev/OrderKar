// Route protection for /r/[slug]/*.
// Public: /r/[slug]/table/* (QR customer ordering), /r/[slug]/feedback.
// Staff routes require a session; roles are enforced per route; the profile's
// restaurant must match the URL slug's restaurant (anti-tenant-hopping).

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

// route -> minimum role
const ROLE_ROUTES: { prefix: string; minRole: string }[] = [
  { prefix: '/waiter', minRole: 'waiter' },
  { prefix: '/kitchen', minRole: 'kitchen' },
  { prefix: '/manager', minRole: 'manager' },
  { prefix: '/owner', minRole: 'owner' },
  { prefix: '/menu', minRole: 'manager' },
  { prefix: '/team', minRole: 'manager' },
];

const RANK: Record<string, number> = {
  kitchen: 1,
  waiter: 2,
  manager: 3,
  owner: 4,
  super_admin: 5,
};

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
  const configured = !url.includes('placeholder');

  const res = NextResponse.next();
  if (!configured) return res; // setup mode: pages show the setup notice

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const pathname = req.nextUrl.pathname;
  const slugMatch = pathname.match(/^\/r\/([^/]+)(\/.*)?$/);
  if (!slugMatch) return res;
  const [, slug, rest = '/'] = slugMatch;

  // Public customer routes
  if (rest.startsWith('/table/') || rest === '/feedback' || rest === '/') return res;

  // Staff routes need a session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', pathname);
    login.searchParams.set('slug', slug);
    return NextResponse.redirect(login);
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, restaurant_id, role, is_super_admin, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !profile.is_active) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('error', 'no-profile');
    return NextResponse.redirect(login);
  }

  // Tenant binding: profile's restaurant must match the slug's restaurant
  // (super_admin is platform-wide).
  if (!profile.is_super_admin) {
    const { data: restaurant } = await supabase
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!restaurant || restaurant.id !== profile.restaurant_id) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  // Role gate
  const gate = ROLE_ROUTES.find((r) => rest === r.prefix || rest.startsWith(r.prefix + '/'));
  if (gate) {
    const rank = profile.is_super_admin ? RANK.super_admin : RANK[profile.role as string] ?? 0;
    if (rank < RANK[gate.minRole]) {
      // send them to the highest route their role allows
      const fallback =
        RANK[profile.role as string] >= RANK.manager
          ? `/r/${slug}/manager`
          : profile.role === 'kitchen'
            ? `/r/${slug}/kitchen`
            : `/r/${slug}/waiter`;
      return NextResponse.redirect(new URL(profile.is_super_admin ? `/r/${slug}/owner` : fallback, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/r/:slug/:path*'],
};
