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

const SHOWCASE = [
  {
    title: 'Owner Console',
    desc: 'Live revenue, occupied tables, prep times and AI insights — the whole restaurant at a glance.',
    img: 'https://res.cloudinary.com/duo55lhwh/image/upload/v1791801357/orderkar/showcase/rvqhkhmwkom1dz664ioq.jpg',
    alt: 'OrderKar owner dashboard with live KPIs and sales chart',
  },
  {
    title: 'Customer Ordering',
    desc: 'Guests scan the QR, browse the menu and order from their phones — with live order tracking.',
    img: 'https://res.cloudinary.com/duo55lhwh/image/upload/v1791801358/orderkar/showcase/p0tg5o4ug5027fxtjy9p.jpg',
    alt: 'OrderKar customer QR ordering with menu and live order status',
  },
  {
    title: 'Kitchen Display',
    desc: 'Orders hit the kitchen screen instantly — timers, one-tap ready, live queue that never misses.',
    img: 'https://res.cloudinary.com/duo55lhwh/image/upload/v1791801359/orderkar/showcase/s5ozacgs0b8avso7ksjy.jpg',
    alt: 'OrderKar kitchen display with live order cards',
  },
];

const BILLING_OPTIONS = [
  {
    name: 'Monthly',
    price: '7,999',
    per: 'PKR/month',
    blurb: 'Fixed monthly fee. Cancel anytime.',
    cta: 'Start free trial',
    hot: false,
  },
  {
    name: '6 Months',
    price: '43,999',
    per: 'PKR one-time',
    blurb: 'One payment, half a year covered.',
    cta: 'Start free trial',
    hot: false,
  },
  {
    name: 'Yearly',
    price: '79,999',
    per: 'PKR one-time',
    blurb: 'Best value — a full year, one payment.',
    cta: 'Start free trial',
    hot: true,
  },
];

const ALL_FEATURES = [
  'QR customer ordering',
  'Waiter + Kitchen apps',
  'Owner dashboard & reports',
  'Inventory & suppliers',
  'Recipe auto-deduction',
  'Up to 50 tables',
  'Up to 500 menu items',
  '5,000 orders/month',
];

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-line/12 bg-[var(--c-surface)] backdrop-blur-xl">
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

      {/* Product showcase — real screenshots */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center">
          <Pill tone="teal">✨ Live product tour</Pill>
          <h2 className="mt-4 font-display text-3xl font-extrabold text-ink sm:text-4xl">
            See OrderKar in action
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Real screenshots from a live restaurant — no mockups, no renders.
          </p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE.map((s) => (
            <div
              key={s.title}
              className="group overflow-hidden rounded-[20px] border border-line/12 bg-[var(--c-surface-solid)] shadow-lift transition-transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-1.5 border-b border-line/12 bg-black/[0.03] px-4 py-2.5 dark:bg-white/[0.03]">
                <span className="h-2.5 w-2.5 rounded-full bg-danger/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-ok/70" />
              </div>
              <div className="overflow-hidden">
                <img
                  src={s.img}
                  alt={s.alt}
                  loading="lazy"
                  className="aspect-[4/3] w-full object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5">
                <h3 className="font-display text-[17px] font-extrabold text-ink">{s.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
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
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">One plan. Simple pricing.</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            Every restaurant gets <b>all features</b>. Start free for 14 days — no credit card required.
          </p>
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {BILLING_OPTIONS.map((p) => (
            <Card key={p.name} deep={p.hot} className={`relative flex flex-col p-7 ${p.hot ? 'ring-2 ring-brand' : ''}`}>
              {p.hot && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Pill tone="brand">Best value</Pill>
                </div>
              )}
              <h3 className="font-display text-xl font-extrabold text-ink">{p.name}</h3>
              <p className="mt-1 text-sm text-muted">{p.blurb}</p>
              <p className="mt-4">
                <span className="font-mono text-4xl font-bold text-ink">{p.price}</span>
                <span className="ml-1 text-sm font-bold text-muted">{p.per}</span>
              </p>
              <Link href="/signup" className="mt-6">
                <Btn variant={p.hot ? 'primary' : 'secondary'} className="w-full" size="lg">
                  {p.cta}
                </Btn>
              </Link>
            </Card>
          ))}
        </div>
        <Card className="mx-auto mt-6 max-w-3xl p-6">
          <h3 className="text-center font-display text-[17px] font-extrabold text-ink">
            Everything included — fair-use limits
          </h3>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {ALL_FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2 text-[13px] font-semibold text-body">
                <span className="mt-0.5 shrink-0 text-ok">✓</span> {f}
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-line/12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:px-6">
          <BrandMark />
          <p>© 2026 OrderKar · Built for Pakistani restaurants 🇵🇰</p>
        </div>
      </footer>
    </div>
  );
}
