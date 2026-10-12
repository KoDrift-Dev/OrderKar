import { describe, it, expect } from 'vitest';
import { tenantFromHost, tenantUrl } from './tenant-url';

describe('tenantFromHost', () => {
  it('extracts slug from tenant subdomain', () => {
    expect(tenantFromHost('spice-villa.orderkar.pk')).toBe('spice-villa');
    expect(tenantFromHost('spice-route.orderkar.pk', 'orderkar.pk')).toBe('spice-route');
  });

  it('returns null for root and www', () => {
    expect(tenantFromHost('orderkar.pk')).toBeNull();
    expect(tenantFromHost('www.orderkar.pk')).toBeNull();
  });

  it('returns null for reserved subdomains', () => {
    for (const sub of ['www', 'admin', 'app', 'api', 'mail', 'cdn']) {
      expect(tenantFromHost(`${sub}.orderkar.pk`)).toBeNull();
    }
  });

  it('returns null for nested subdomains', () => {
    expect(tenantFromHost('a.b.orderkar.pk')).toBeNull();
  });

  it('returns null for localhost and 127.0.0.1', () => {
    expect(tenantFromHost('localhost')).toBeNull();
    expect(tenantFromHost('127.0.0.1')).toBeNull();
  });

  it('extracts slug from .localhost dev domains', () => {
    expect(tenantFromHost('spice-villa.localhost')).toBe('spice-villa');
    expect(tenantFromHost('admin.localhost')).toBeNull();
  });

  it('strips port from host', () => {
    expect(tenantFromHost('spice-villa.localhost:3000')).toBe('spice-villa');
  });

  it('returns null for unrelated domains', () => {
    expect(tenantFromHost('orderkarr.vercel.app')).toBeNull();
    expect(tenantFromHost('evil.com')).toBeNull();
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(tenantFromHost('  Spice-Villa.Orderkar.PK  ')).toBe('spice-villa');
  });

  it('returns null for empty host', () => {
    expect(tenantFromHost('')).toBeNull();
  });
});

describe('tenantUrl', () => {
  it('builds subdomain URL on root domain', () => {
    expect(tenantUrl('spice-villa', '/menu', 'https://orderkar.pk')).toBe(
      'https://spice-villa.orderkar.pk/menu'
    );
  });

  it('builds subdomain URL when already on a tenant subdomain', () => {
    expect(tenantUrl('spice-route', '/table/1', 'https://spice-villa.orderkar.pk')).toBe(
      'https://spice-route.orderkar.pk/table/1'
    );
  });

  it('uses localhost subdomain in dev', () => {
    expect(tenantUrl('spice-villa', '/', 'http://localhost:3000')).toBe(
      'http://spice-villa.localhost:3000/'
    );
  });

  it('falls back to path URL on vercel.app (no subdomain support)', () => {
    expect(tenantUrl('spice-villa', '/menu', 'https://orderkarr.vercel.app')).toBe(
      'https://orderkarr.vercel.app/r/spice-villa/menu'
    );
  });

  it('normalizes path without leading slash', () => {
    expect(tenantUrl('spice-villa', 'menu', 'https://orderkarr.vercel.app')).toBe(
      'https://orderkarr.vercel.app/r/spice-villa/menu'
    );
  });

  it('returns relative path when no origin is available (SSR)', () => {
    expect(tenantUrl('spice-villa', '/table/5')).toBe('/r/spice-villa/table/5');
  });

  it('defaults path to /', () => {
    expect(tenantUrl('spice-villa', undefined, 'https://orderkarr.vercel.app')).toBe(
      'https://orderkarr.vercel.app/r/spice-villa/'
    );
  });
});

import { hexToRgbTriplet, darkenHex, brandThemeVars } from './tenant-url';

describe('hexToRgbTriplet', () => {
  it('converts valid hex to rgb triplet', () => {
    expect(hexToRgbTriplet('#6D28D9')).toBe('109 40 217');
    expect(hexToRgbTriplet('6d28d9')).toBe('109 40 217');
  });

  it('rejects invalid hex', () => {
    expect(hexToRgbTriplet('xyz')).toBeNull();
    expect(hexToRgbTriplet('#fff')).toBeNull();
    expect(hexToRgbTriplet('')).toBeNull();
  });
});

describe('darkenHex', () => {
  it('darkens by default fraction', () => {
    const result = darkenHex('#FFFFFF');
    expect(result).toBe('#b8b8b8'); // 255 * 0.72 = 183.6 → 184 = 0xb8
  });

  it('returns null for invalid input', () => {
    expect(darkenHex('not-a-color')).toBeNull();
  });
});

describe('brandThemeVars', () => {
  it('returns full var set for single color', () => {
    const vars = brandThemeVars('#6D28D9');
    expect(vars['--c-brand']).toBe('#6D28D9');
    expect(vars['--c-brand-rgb']).toBe('109 40 217');
    expect(vars['--c-brand-deep']).toBeTruthy();
    expect(vars['--c-brand-soft']).toContain('0.1');
  });

  it('uses color2 as deep in dual mode', () => {
    const vars = brandThemeVars('#6D28D9', '#0D9488');
    expect(vars['--c-brand-deep']).toBe('#0D9488');
    expect(vars['--c-brand-2-rgb']).toBe('13 148 136');
  });

  it('returns empty object for invalid color1', () => {
    expect(brandThemeVars('invalid')).toEqual({});
  });
});
