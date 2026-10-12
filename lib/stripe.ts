// Stripe client — server-side only. Everything here is env-gated: if the
// Stripe keys are not configured, billingIsConfigured() is false and the
// billing API routes return 503 with a friendly message instead of crashing.

import Stripe from 'stripe';

let client: Stripe | null = null;

export function billingIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!billingIsConfigured()) {
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY missing)');
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
      apiVersion: '2026-09-30.endive',
    });
  }
  return client;
}

export function getPriceId(period: string): string | null {
  const map: Record<string, string | undefined> = {
    monthly: process.env.STRIPE_PRICE_MONTHLY,
    '6month': process.env.STRIPE_PRICE_6MONTH,
    yearly: process.env.STRIPE_PRICE_ANNUAL,
  };
  return map[period] ?? null;
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}
