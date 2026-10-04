import type { Config } from 'tailwindcss';

// OrderKar SaaS design system — premium purple glassmorphism.
// Light default, dark via [data-theme="dark"]. All themeable colors resolve
// through CSS variables so the toggle flips every page instantly.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        page: 'var(--c-page)',
        soft: 'var(--c-soft)',
        surface: 'var(--c-surface)',
        // rgb-triplet vars + <alpha-value> so /opacity modifiers work
        ink: 'rgb(var(--c-ink-rgb) / <alpha-value>)',
        body: 'var(--c-body)',
        muted: 'var(--c-muted)',
        line: 'var(--c-line)',
        brand: 'rgb(var(--c-brand-rgb) / <alpha-value>)',
        'brand-deep': 'var(--c-brand-deep)',
        'brand-soft': 'var(--c-brand-soft)',
        teal: 'rgb(var(--c-teal-rgb) / <alpha-value>)',
        amber: 'rgb(var(--c-amber-rgb) / <alpha-value>)',
        ok: 'rgb(var(--c-ok-rgb) / <alpha-value>)',
        warn: 'var(--c-warn)',
        danger: 'rgb(var(--c-danger-rgb) / <alpha-value>)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glass: 'var(--shadow-glass)',
        lift: 'var(--shadow-lift)',
        glow: 'var(--shadow-glow)',
      },
      borderRadius: {
        btn: '14px',
        card: '20px',
      },
      backdropBlur: {
        glass: '18px',
      },
    },
  },
  plugins: [],
};

export default config;
