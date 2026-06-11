import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  try {
    switch (event.type) {

      // Suscripción creada o actualizada
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub  = event.data.object as Stripe.Subscription
        const uid  = sub.metadata.user_id
        const plan = sub.metadata.plan as 'pro' | 'agency'
        if (!uid) break

        await db.from('subscriptions').upsert({
          id: sub.id, user_id: uid, status: sub.status, plan,
          stripe_price_id: sub.items.data[0].price.id,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        })

        if (sub.status === 'active' || sub.status === 'trialing') {
          await db.from('profiles').update({ plan }).eq('id', uid)

          // Registrar comisión de afiliado si hay código
          const code = sub.metadata.affiliate_code
          if (code) {
            const { count } = await db.from('affiliate_referrals').select('*', { count: 'exact' }).eq('affiliate_code', code)
            const refs = count ?? 0
            const pct  = refs >= 51 ? 40 : refs >= 11 ? 30 : 20
            const usd  = plan === 'pro' ? 19 * pct / 100 : 79 * pct / 100
            await db.from('affiliate_referrals').upsert({
              affiliate_code: code, referred_user_id: uid,
              plan_purchased: plan, commission_pct: pct, commission_usd: usd,
            })
          }
        }
        break
      }

      // Suscripción cancelada
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        if (!sub.metadata.user_id) break
        await Promise.all([
          db.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id),
          db.from('profiles').update({ plan: 'free' }).eq('id', sub.metadata.user_id),
        ])
        break
      }

      // Pago fallido
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        if (inv.subscription)
          await db.from('subscriptions').update({ status: 'past_due' }).eq('id', inv.subscription as string)
        break
      }
    }
  } catch (err) {
    console.error(`[webhook] ${event.type}`, err)
    return NextResponse.json({ error: 'Error procesando evento' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
