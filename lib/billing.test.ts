import { describe, it, expect } from 'vitest';
import {
  parseBillingConfig,
  calcBill,
  fmtReceipt,
  chargeLabel,
  DEFAULT_BILLING,
  type BillingConfig,
} from './billing';

describe('parseBillingConfig', () => {
  it('returns defaults for null/undefined', () => {
    expect(parseBillingConfig(null)).toEqual(DEFAULT_BILLING);
    expect(parseBillingConfig(undefined)).toEqual(DEFAULT_BILLING);
  });

  it('parses valid rs and pct charges', () => {
    const cfg = parseBillingConfig({
      tax_value: 16,
      tax_type: 'pct',
      svc_value: 50,
      svc_type: 'rs',
      fbr_value: 10,
    });
    expect(cfg).toEqual({ taxValue: 16, taxType: 'pct', svcValue: 50, svcType: 'rs', fbrValue: 10 });
  });

  it('rejects negative and non-numeric values (clamps to 0)', () => {
    const cfg = parseBillingConfig({ tax_value: -5, svc_value: 'abc', fbr_value: NaN });
    expect(cfg.taxValue).toBe(0);
    expect(cfg.svcValue).toBe(0);
    expect(cfg.fbrValue).toBe(0);
  });

  it('defaults unknown charge types to pct', () => {
    const cfg = parseBillingConfig({ tax_type: 'bogus', svc_type: 'rs' });
    expect(cfg.taxType).toBe('pct');
    expect(cfg.svcType).toBe('rs');
  });

  it('parses numeric strings', () => {
    const cfg = parseBillingConfig({ tax_value: '16.5' });
    expect(cfg.taxValue).toBe(16.5);
  });
});

describe('calcBill', () => {
  const base: BillingConfig = { ...DEFAULT_BILLING };

  it('returns zeros for zero subtotal', () => {
    const b = calcBill(0, base);
    expect(b).toEqual({ subtotal: 0, tax: 0, fbr: 0, grandTotal: 0, svc: 0, total: 0 });
  });

  it('clamps negative subtotal to 0', () => {
    expect(calcBill(-100, base).total).toBe(0);
  });

  it('applies percentage tax correctly', () => {
    const b = calcBill(1000, { ...base, taxValue: 16, taxType: 'pct' });
    expect(b.tax).toBe(160);
    expect(b.grandTotal).toBe(1160);
    expect(b.total).toBe(1160);
  });

  it('applies flat Rs tax correctly', () => {
    const b = calcBill(1000, { ...base, taxValue: 50, taxType: 'rs' });
    expect(b.tax).toBe(50);
    expect(b.total).toBe(1050);
  });

  it('caps flat charges at 10x subtotal (anti-abuse)', () => {
    const b = calcBill(100, { ...base, taxValue: 999999, taxType: 'rs' });
    expect(b.tax).toBe(1000);
  });

  it('adds FBR charges after tax', () => {
    const b = calcBill(1000, { ...base, taxValue: 10, taxType: 'pct', fbrValue: 25 });
    // tax=100, fbr=25 → grandTotal=1125
    expect(b.tax).toBe(100);
    expect(b.fbr).toBe(25);
    expect(b.grandTotal).toBe(1125);
    expect(b.total).toBe(1125);
  });

  it('applies service charge on top of grand total', () => {
    const b = calcBill(1000, { ...base, svcValue: 5, svcType: 'pct' });
    expect(b.svc).toBe(50);
    expect(b.total).toBe(1050);
  });

  it('rounds to 2 decimals', () => {
    const b = calcBill(333, { ...base, taxValue: 16, taxType: 'pct' });
    expect(b.tax).toBe(53.28);
  });

  it('full realistic bill: subtotal 2582.59 + 16% tax + Rs 50 FBR + 5% svc', () => {
    const b = calcBill(2582.59, {
      taxValue: 16,
      taxType: 'pct',
      svcValue: 5,
      svcType: 'pct',
      fbrValue: 50,
    });
    expect(b.subtotal).toBe(2582.59);
    expect(b.tax).toBeCloseTo(413.21, 2);
    expect(b.fbr).toBe(50);
    expect(b.svc).toBeCloseTo(129.13, 2);
    // total = grandTotal + svc
    expect(b.total).toBeCloseTo(b.grandTotal + b.svc, 2);
  });
});

describe('fmtReceipt', () => {
  it('formats with thousands separator and 2 decimals', () => {
    expect(fmtReceipt(2582.59)).toBe('2,582.59');
    expect(fmtReceipt(1000)).toBe('1,000.00');
  });
});

describe('chargeLabel', () => {
  it('labels pct and rs charges', () => {
    expect(chargeLabel(16, 'pct')).toBe('16%');
    expect(chargeLabel(50, 'rs')).toBe('Rs 50');
  });
});
