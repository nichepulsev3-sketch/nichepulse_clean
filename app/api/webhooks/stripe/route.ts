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

      // ── Pago completado en el checkout ─────────────────────
      // Este es el evento más fiable para cambiar el plan
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const userId  = session.metadata?.user_id
        const plan    = session.metadata?.plan as 'pro' | 'agency'

        console.log('[webhook] checkout.session.completed', { userId, plan })

        if (!userId || !plan) {
          console.error('[webhook] Falta user_id o plan en metadata')
          break
        }

        // Cambiar el plan del usuario
        const { error } = await db
          .from('profiles')
          .update({ plan })
          .eq('id', userId)

        if (error) {
          console.error('[webhook] Error actualizando plan:', error)
        } else {
          console.log(`[webhook] Plan actualizado a ${plan} para usuario ${userId}`)
        }
        break
      }

      // ── Suscripción creada o actualizada ───────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub  = event.data.object as Stripe.Subscription
        const uid  = sub.metadata?.user_id
        const plan = sub.metadata?.plan as 'pro' | 'agency'

        console.log('[webhook] subscription event', { uid, plan, status: sub.status })

        // Guardar suscripción en base de datos
        await db.from('subscriptions').upsert({
          id:                   sub.id,
          user_id:              uid ?? '',
          status:               sub.status,
          plan:                 plan ?? 'pro',
          stripe_price_id:      sub.items.data[0].price.id,
          current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
          current_period_end:   new Date(sub.current_period_end   * 1000).toISOString(),
          cancel_at_period_end: sub.cancel_at_period_end,
        })

        // Actualizar plan si uid está disponible
        if (uid && (sub.status === 'active' || sub.status === 'trialing')) {
          await db.from('profiles').update({ plan }).eq('id', uid)
          console.log(`[webhook] Plan actualizado a ${plan} vía subscription para ${uid}`)
        }
        break
      }

      // ── Suscripción cancelada ──────────────────────────────
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const uid = sub.metadata?.user_id
        if (uid) {
          await db.from('profiles').update({ plan: 'free' }).eq('id', uid)
          console.log(`[webhook] Plan vuelto a free para ${uid}`)
        }
        await db.from('subscriptions').update({ status: 'canceled' }).eq('id', sub.id)
        break
      }

      // ── Pago fallido ───────────────────────────────────────
      case 'invoice.payment_failed': {
        const inv = event.data.object as Stripe.Invoice
        if (inv.subscription) {
          await db.from('subscriptions')
            .update({ status: 'past_due' })
            .eq('id', inv.subscription as string)
        }
        break
      }

      default:
        console.log(`[webhook] Evento no manejado: ${event.type}`)
    }
  } catch (err) {
    console.error(`[webhook] Error en ${event.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
