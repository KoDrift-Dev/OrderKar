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

export function getPriceId(plan: string): string | null {
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  return map[plan] ?? null;
}

export function getWebhookSecret(): string | null {
  return process.env.STRIPE_WEBHOOK_SECRET ?? null;
}
