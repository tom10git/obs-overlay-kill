import Stripe from 'npm:stripe@17.7.0'

let stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!stripe) {
    const key = Deno.env.get('STRIPE_SECRET_KEY')
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    stripe = new Stripe(key)
  }
  return stripe
}

export function getStripePriceId(featureId: string): string | undefined {
  const map: Record<string, string | undefined> = {
    probabilities: Deno.env.get('STRIPE_PRICE_PROBABILITIES'),
    autoReply: Deno.env.get('STRIPE_PRICE_AUTO_REPLY'),
    viewerSettings: Deno.env.get('STRIPE_PRICE_VIEWER_SETTINGS'),
    layoutFine: Deno.env.get('STRIPE_PRICE_LAYOUT_FINE'),
    all: Deno.env.get('STRIPE_PRICE_ALL_FEATURES'),
  }
  const id = map[featureId]?.trim()
  return id || undefined
}
