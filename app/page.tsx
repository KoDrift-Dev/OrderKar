import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import { Btn, Card, Pill } from '@/components/ui';
import Logo from '@/components/Logo';

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <Logo size={40} />
      <span className="font-display text-xl font-extrabold tracking-tight text-ink">OrderKar</span>
    </div>
  );
}

const FEATURES = [
  {
    icon: '📱',
    title: 'QR table ordering',
    body: 'Guests scan, browse the menu and order from their phones. No app download, no waiting for a waiter.',
  },
  {
    icon: '🔥',
    title: 'Live kitchen display',
    body: 'Orders hit the kitchen screen instantly with timers, beeps and flash alerts. Mark ready in one tap.',
  },
  {
    icon: '🧑‍🍳',
    title: 'Waiter app',
    body: 'Take tableside orders, track every table at a glance, and close out checks without the paper chaos.',
  },
  {
    icon: '📊',
    title: 'Owner analytics',
    body: 'Revenue, rush hours, top items and staff performance — filterable by day, week, month or year.',
  },
  {
    icon: '🤖',
    title: 'AI menu scanner',
    body: 'Snap a photo of a paper menu — OrderKar digitises it into categories, items and prices. Coming in Phase 2.',
    soon: true,
  },
  {
    icon: '🏪',
    title: 'Multi-restaurant ready',
    body: 'Run one outlet or ten. Every restaurant is fully isolated with its own menu, staff and reports.',
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: '4,999',
    blurb: 'For small cafés getting started.',
    features: ['QR ordering', 'Waiter app', 'Kitchen display', 'Basic dashboard', 'Up to 10 tables'],
    cta: 'Start free trial',
    hot: false,
  },
  {
    name: 'Pro',
    price: '9,999',
    blurb: 'For growing dine-in restaurants.',
    features: ['Everything in Starter', 'AI menu scanner', 'Waste tracking', 'Inventory', 'Up to 50 tables', 'API access'],
    cta: 'Start free trial',
    hot: true,
  },
  {
    name: 'Enterprise',
    price: '24,999',
    blurb: 'For chains and 5+ locations.',
    features: ['Everything in Pro', 'Multi-branch', 'Custom branding', 'Priority support'],
    cta: 'Talk to us',
    hot: false,
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line bg-[var(--c-surface)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <BrandMark />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="hidden rounded-btn px-4 py-2 text-sm font-bold text-muted hover:text-ink sm:block">
              Log in
            </Link>
            <Link href="/signup">
              <Btn size="sm">Get started</Btn>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="animate-drift pointer-events-none absolute -left-24 top-10 h-96 w-96 rounded-full bg-brand/15 blur-3xl" />
        <div className="animate-drift pointer-events-none absolute -right-24 top-64 h-80 w-80 rounded-full bg-teal/15 blur-3xl" style={{ animationDelay: '-5s' }} />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:px-6 sm:pt-24">
          <Pill tone="brand">✨ Multi-tenant SaaS for Pakistani restaurants</Pill>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-extrabold leading-[1.12] tracking-tight text-ink sm:text-6xl">
            Restaurant chalana <span className="text-gradient">ab aasaan.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-muted">
            OrderKar puts QR ordering, a live kitchen display, waiter tools and owner analytics
            into one beautiful system — per restaurant, fully isolated, ready in minutes.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Btn size="lg">Start 14-day free trial</Btn>
            </Link>
            <Link href="#pricing">
              <Btn size="lg" variant="secondary">See pricing</Btn>
            </Link>
          </div>
          <p className="mt-4 text-[13px] font-semibold text-muted">No credit card · No hardware lock-in · Urdu-friendly</p>
        </div>
      </section>

      {/* Product mock strip */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <Card deep className="overflow-hidden p-0">
          <div className="grid sm:grid-cols-3">
            {[
              { t: 'Customer', d: 'Scan → menu → order → live status', c: 'text-brand' },
              { t: 'Kitchen', d: 'Live queue, timers, one-tap ready', c: 'text-amber' },
              { t: 'Owner', d: 'Revenue, rush hours, top items', c: 'text-teal' },
            ].map((s) => (
              <div key={s.t} className="border-b border-line p-6 last:border-0 sm:border-b-0 sm:border-r sm:last:border-0">
                <p className={`font-display text-lg font-extrabold ${s.c}`}>{s.t}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.d}</p>
                <div className="mt-4 h-24 rounded-[14px] bg-gradient-to-br from-brand-soft via-transparent to-teal/10" />
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">Everything a restaurant needs</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">One subscription replaces paper KOTs, missed orders and end-of-day guesswork.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="group p-6 transition-transform hover:-translate-y-1">
              <div className="glass flex h-12 w-12 items-center justify-center !rounded-[14px] text-2xl">{f.icon}</div>
              <h3 className="mt-4 flex items-center gap-2 font-display text-lg font-extrabold text-ink">
                {f.title}
                {f.soon && <Pill tone="amber">Soon</Pill>}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{f.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">Simple PKR pricing</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">Start free for 14 days. Upgrade when the orders roll in.</p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} deep={p.hot} className={`relative flex flex-col p-7 ${p.hot ? 'ring-2 ring-brand' : ''}`}>
              {p.hot && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Pill tone="brand">Most popular</Pill>
                </div>
              )}
              <h3 className="font-display text-xl font-extrabold text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              <p className="mt-4">
                <span className="font-mono text-4xl font-bold text-ink">{p.price}</span>
                <span className="ml-1 text-sm font-bold text-muted">PKR/mo</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px] font-semibold text-body">
                    <span className="mt-0.5 text-ok">✓</span> {f}
                  </li>
                ))}
              </ul>
              <Link href="/signup" className="mt-6">
                <Btn variant={p.hot ? 'primary' : 'secondary'} className="w-full" size="lg">
                  {p.cta}
                </Btn>
              </Link>
            </Card>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <BrandMark />
          <p>© 2026 OrderKar · Built for Pakistani restaurants 🇵🇰</p>
        </div>
      </footer>
    </div>
  );
}
