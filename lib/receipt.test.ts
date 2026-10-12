import { describe, it, expect } from 'vitest';
import { esc, buildThermal, buildBrowser, pkr, type ReceiptData } from './receipt';

const sample: ReceiptData = {
  lang: 'english',
  restaurant: { name: 'Test Restaurant', address: 'Main St', phone: '0300-1234567' },
  orderNo: 42,
  date: new Date('2026-01-15T12:30:00Z'),
  orderType: 'dine_in',
  tableLabel: 'Table 5',
  cashier: 'Waiter 1',
  items: [
    { name: 'Chicken Biryani', qty: 2, price: 350 },
    { name: 'Raita', qty: 1, price: 80 },
  ],
  paymentMethod: 'cash',
};

describe('esc (XSS protection)', () => {
  it('escapes angle brackets', () => {
    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes ampersands first (no double-escaping)', () => {
    expect(esc('Fish & Chips')).toBe('Fish &amp; Chips');
    expect(esc('&lt;')).toBe('&amp;lt;');
  });

  it('escapes double quotes', () => {
    expect(esc('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('leaves safe text untouched', () => {
    expect(esc('Chicken Biryani Rs 350')).toBe('Chicken Biryani Rs 350');
  });

  it('handles empty string', () => {
    expect(esc('')).toBe('');
  });
});

describe('buildThermal', () => {
  it('includes restaurant name, order number, and items', () => {
    const html = buildThermal(sample);
    expect(html).toContain('TEST RESTAURANT');
    expect(html).toContain('42');
    expect(html).toContain('Chicken Biryani');
    expect(html).toContain('Raita');
  });

  it('shows quantities and line totals', () => {
    const html = buildThermal(sample);
    expect(html).toContain('2'); // qty
    expect(html).toContain(pkr(700)); // 2 × 350
  });

  it('escapes malicious item names (XSS)', () => {
    const evil: ReceiptData = {
      ...sample,
      items: [{ name: '<img src=x onerror=alert(1)>', qty: 1, price: 10 }],
    };
    const html = buildThermal(evil);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes malicious restaurant name', () => {
    const evil: ReceiptData = {
      ...sample,
      restaurant: { ...sample.restaurant, name: '"><script>alert(1)</script>' },
    };
    const html = buildThermal(evil);
    // The only <script> allowed is the legit print trigger at the bottom.
    expect(html).toContain('&quot;&gt;&lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt;');
    expect(html).not.toContain('"><script>alert(1)</script>');
  });

  it('renders the bill total', () => {
    const html = buildThermal(sample);
    expect(html).toContain(pkr(780));
  });
});

describe('buildBrowser', () => {
  it('produces valid HTML containing key fields', () => {
    const html = buildBrowser(sample);
    expect(html).toContain('Test Restaurant');
    expect(html).toContain('Chicken Biryani');
    expect(html).toContain(pkr(780));
  });

  it('escapes malicious content', () => {
    const evil: ReceiptData = {
      ...sample,
      cashier: '<svg onload=alert(1)>',
    };
    const html = buildBrowser(evil);
    expect(html).not.toContain('<svg');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
  });
});

describe('pkr', () => {
  it('formats PKR amounts (whole rupees)', () => {
    expect(pkr(2582.59)).toBe('Rs 2,583');
    expect(pkr(780)).toBe('Rs 780');
  });
});
