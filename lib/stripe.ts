import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
})

export const PLANS = {
  pro:    { name: 'Pro',    priceId: process.env.STRIPE_PRICE_PRO_MONTHLY!,    amount: 1900 },
  agency: { name: 'Agency', priceId: process.env.STRIPE_PRICE_AGENCY_MONTHLY!, amount: 7900 },
}

export function commissionPct(refs: number): number {
  if (refs >= 51) return 40
  if (refs >= 11) return 30
  return 20
}
