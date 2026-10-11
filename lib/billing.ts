// Shared billing math for receipts: tax + service charges, each either a flat
// Rs amount or a % of the subtotal. Config lives in restaurants.theme_config:
//   tax_value, tax_type ('rs' | 'pct'), svc_value, svc_type ('rs' | 'pct')

export type ChargeType = 'rs' | 'pct';

export interface BillingConfig {
  taxValue: number;
  taxType: ChargeType;
  svcValue: number;
  svcType: ChargeType;
}

export const DEFAULT_BILLING: BillingConfig = {
  taxValue: 0,
  taxType: 'pct',
  svcValue: 0,
  svcType: 'pct',
};

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function ctype(v: unknown): ChargeType {
  return v === 'rs' ? 'rs' : 'pct';
}

export function parseBillingConfig(tc: Record<string, unknown> | null | undefined): BillingConfig {
  if (!tc) return { ...DEFAULT_BILLING };
  return {
    taxValue: num(tc.tax_value),
    taxType: ctype(tc.tax_type),
    svcValue: num(tc.svc_value),
    svcType: ctype(tc.svc_type),
  };
}

export interface BillBreakdown {
  subtotal: number;
  tax: number;
  svc: number;
  total: number;
}

export function calcBill(subtotal: number, cfg: BillingConfig): BillBreakdown {
  const sub = Math.max(0, subtotal);
  const tax = cfg.taxType === 'pct' ? (sub * cfg.taxValue) / 100 : Math.min(cfg.taxValue, sub * 10);
  const svc = cfg.svcType === 'pct' ? (sub * cfg.svcValue) / 100 : Math.min(cfg.svcValue, sub * 10);
  const round = (n: number) => Math.round(n * 100) / 100;
  return { subtotal: round(sub), tax: round(tax), svc: round(svc), total: round(sub + tax + svc) };
}

export function chargeLabel(value: number, type: ChargeType): string {
  return type === 'pct' ? `${value}%` : `Rs ${value}`;
}

export const PAY_METHODS = [
  { value: 'cash', label: 'Cash', icon: '\uD83D\uDCB5' },
  { value: 'card', label: 'Card', icon: '\uD83D\uDCB3' },
  { value: 'jazzcash', label: 'JazzCash', icon: '\uD83D\uDCF1' },
  { value: 'easypaisa', label: 'EasyPaisa', icon: '\uD83D\uDCF1' },
];
