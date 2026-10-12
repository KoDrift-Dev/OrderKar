// Route protection for /r/[slug]/* + subdomain tenant routing.
//
// Tenants are reachable two ways:
//   path-based:  orderkar.pk/r/spice-villa/owner
//   subdomain:  spice-villa.orderkar.pk/owner        (rewritten to /r/spice-villa/owner)
//
// Public: /r/[slug]/table/* (QR customer ordering), /r/[slug]/feedback.
// Staff routes require a session; roles are enforced per route; the profile's
// restaurant must match the URL slug's restaurant (anti-tenant-hopping).
//
// DNS: point *.orderkar.pk at the Vercel project (wildcard domain) or set
// NEXT_PUBLIC_ROOT_DOMAIN to your own root domain.

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { tenantFromHost } from './lib/tenant-url';
import { ROLE_RANK, roleRank } from './lib/roles';

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'orderkar.pk';

// Paths served from the root even on a tenant subdomain (no /r/[slug] rewrite).
const EXCLUDED_PATHS = new Set([
  '/login',
  '/signup',
  '/reset-password',
  '/admin',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
]);

function isExcludedPath(pathname: string): boolean {
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return true;
  if (EXCLUDED_PATHS.has(pathname)) return true;
  if (/\.[a-z0-9]+$/i.test(pathname)) return true; // static files
  return false;
}

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'placeholder-anon-key';

// route -> minimum role
// NOTE: owner + manager share one merged console, so /owner allows managers.
const ROLE_ROUTES: { prefix: string; minRole: string }[] = [
  { prefix: '/waiter', minRole: 'waiter' },
  { prefix: '/kitchen', minRole: 'kitchen' },
  { prefix: '/manager', minRole: 'manager' },
  { prefix: '/owner', minRole: 'manager' },
  { prefix: '/menu', minRole: 'manager' },
  { prefix: '/team', minRole: 'manager' },
];

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
  const configured = !url.includes('placeholder');

  const pathname = req.nextUrl.pathname;
  const host = req.headers.get('host') || '';
  const subSlug = tenantFromHost(host, ROOT_DOMAIN);

  // Resolve the tenant + the in-tenant path, from either URL style.
  let slug: string | null = null;
  let rest = '/';
  let rewritePath: string | null = null;
  const slugMatch = pathname.match(/^\/r\/([^/]+)(\/.*)?$/);
  if (slugMatch) {
    slug = slugMatch[1];
    rest = slugMatch[2] || '/';
  } else if (subSlug && !isExcludedPath(pathname)) {
    slug = subSlug;
    rest = pathname === '/' ? '/' : pathname;
    rewritePath = `/r/${slug}${rest === '/' ? '' : rest}`;
  }

  const res = (() => {
    if (!rewritePath) return NextResponse.next();
    const u = req.nextUrl.clone();
    u.pathname = rewritePath;
    return NextResponse.rewrite(u);
  })();
  if (!configured) return res; // setup mode: pages show the setup notice
  if (!slug) return res;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  // Public customer routes
  if (rest.startsWith('/table/') || rest === '/feedback' || rest === '/') return res;

  // On a tenant subdomain, `next` keeps the original path so the user stays
  // on the subdomain after login; on path URLs it keeps /r/[slug]/....
  const nextAfterLogin = rewritePath ? pathname : `/r/${slug}${rest === '/' ? '' : rest}`;
  // Same for role-fallback redirects: stay on the subdomain when we came from one.
  const base = rewritePath ? '' : `/r/${slug}`;

  // Staff routes need a session
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = req.nextUrl.clone();
    login.pathname = '/login';
    login.searchParams.set('next', nextAfterLogin);
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
    const rank = profile.is_super_admin ? ROLE_RANK.super_admin : roleRank(profile.role);
    if (rank < roleRank(gate.minRole)) {
      // send them to the highest route their role allows
      const fallback =
        roleRank(profile.role) >= ROLE_RANK.manager
          ? `${base}/manager`
          : profile.role === 'kitchen'
            ? `${base}/kitchen`
            : `${base}/waiter`;
      return NextResponse.redirect(new URL(profile.is_super_admin ? `${base}/owner` : fallback, req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!api/|_next/|_static/|favicon.ico|robots.txt|sitemap.xml|.*\..*).*)'],
};
