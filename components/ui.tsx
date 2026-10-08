'use client';

// OrderKar SaaS UI kit — purple glassmorphism primitives.

import React from 'react';

/* ── Glass card ─────────────────────────────────────────────── */
export function Card({
  children,
  className = '',
  deep = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  deep?: boolean;
}) {
  return (
    <div className={`${deep ? 'glass-deep' : 'glass'} ${className}`} {...rest}>
      {children}
    </div>
  );
}

/* ── Buttons ────────────────────────────────────────────────── */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Btn({ variant = 'primary', size = 'md', className = '', ...rest }: BtnProps) {
  const sizes = {
    sm: 'px-3.5 py-2 text-[13px]',
    md: 'px-5 py-2.5 text-[15px]',
    lg: 'px-7 py-3.5 text-base',
  } as const;
  const variants = {
    primary: 'btn-3d text-white font-bold',
    secondary:
      'bg-[var(--c-surface-solid)] text-ink font-bold border border-line shadow-lift hover:-translate-y-px active:translate-y-0 transition-all',
    ghost: 'text-brand font-bold hover:bg-brand-soft transition-colors',
    danger:
      'text-white font-bold bg-gradient-to-br from-red-500 to-red-700 shadow-lift hover:-translate-y-px active:translate-y-0 transition-all',
  } as const;
  return (
    <button
      className={`inline-flex select-none items-center justify-center gap-2 rounded-btn font-display ${sizes[size]} ${variants[variant]} ${className} disabled:opacity-50 disabled:pointer-events-none`}
      {...rest}
    />
  );
}

/* ── Neumorphic input ───────────────────────────────────────── */
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`input-neu w-full px-4 py-2.5 text-[15px] text-ink placeholder:text-muted ${props.className ?? ''}`}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`input-neu w-full px-4 py-2.5 text-[15px] text-ink placeholder:text-muted ${props.className ?? ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`input-neu w-full px-4 py-2.5 text-[15px] text-ink ${props.className ?? ''}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-bold text-body">{children}</label>;
}

/* ── Section heading ────────────────────────────────────────── */
export function SectionHead({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── KPI card ───────────────────────────────────────────────── */
const KPI_ACCENTS = {
  emerald: 'border-t-emerald-500',
  sky: 'border-t-sky-500',
  amber: 'border-t-amber-500',
  rose: 'border-t-rose-500',
  orange: 'border-t-orange-500',
  teal: 'border-t-teal-500',
  violet: 'border-t-violet-500',
} as const;

export function Kpi({
  label,
  value,
  delta,
  icon,
  accent,
}: {
  label: string;
  value: string;
  delta?: { text: string; up: boolean | null };
  icon?: React.ReactNode;
  /** colored top border by KPI type */
  accent?: keyof typeof KPI_ACCENTS;
}) {
  return (
    <Card className={`min-w-0 border-t-[3px] p-3.5 sm:p-5 ${accent ? KPI_ACCENTS[accent] : 'border-t-transparent'}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted sm:text-[13px]">{label}</p>
        {icon}
      </div>
      <p className="mt-1.5 truncate whitespace-nowrap font-mono text-[22px] font-bold leading-none text-ink sm:mt-2 sm:text-[28px]">
        {value}
      </p>
      {delta && delta.up !== null && (
        <p className={`mt-2 text-[13px] font-bold ${delta.up ? 'text-ok' : 'text-danger'}`}>
          {delta.up ? '▲' : '▼'} {delta.text}
        </p>
      )}
    </Card>
  );
}

/* ── Pill / badge ───────────────────────────────────────────── */
export function Pill({
  children,
  tone = 'brand',
}: {
  children: React.ReactNode;
  tone?: 'brand' | 'teal' | 'amber' | 'ok' | 'danger' | 'muted';
}) {
  const tones = {
    brand: 'bg-brand-soft text-brand',
    teal: 'bg-teal/10 text-teal',
    amber: 'bg-amber/15 text-amber',
    ok: 'bg-ok/10 text-ok',
    danger: 'bg-danger/10 text-danger',
    muted: 'bg-soft text-muted',
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/* ── Tabs ───────────────────────────────────────────────────── */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  wrap,
}: {
  tabs: { key: T; label: string }[];
  active: T;
  onChange: (k: T) => void;
  /** wrap pills onto multiple rows instead of horizontal scroll */
  wrap?: boolean;
}) {
  return (
    <div
      className={`glass gap-1 p-1.5 !rounded-[16px] ${
        wrap ? 'flex flex-wrap' : 'no-scrollbar inline-flex max-w-full overflow-x-auto'
      }`}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`whitespace-nowrap rounded-[12px] px-4 py-2 text-sm font-bold transition-all ${
            active === t.key ? 'btn-3d text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────── */
export function Empty({ title, sub }: { title: string; sub?: string }) {
  return (
    <Card className="border-dashed p-10 text-center">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </Card>
  );
}

/* ── Page header (staff apps) ───────────────────────────────── */
export function PageHeader({
  title,
  sub,
  right,
}: {
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] font-extrabold leading-tight text-ink">{title}</h1>
        {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </div>
  );
}
