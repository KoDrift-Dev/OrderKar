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
        ink: 'var(--c-ink)',
        body: 'var(--c-body)',
        muted: 'var(--c-muted)',
        line: 'var(--c-line)',
        brand: 'var(--c-brand)',
        'brand-deep': 'var(--c-brand-deep)',
        'brand-soft': 'var(--c-brand-soft)',
        teal: 'var(--c-teal)',
        amber: 'var(--c-amber)',
        ok: 'var(--c-ok)',
        warn: 'var(--c-warn)',
        danger: 'var(--c-danger)',
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
