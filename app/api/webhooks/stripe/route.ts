import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getSupabaseAdmin } from '@/lib/supabase'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import Stripe from 'stripe'

const log = createLogger('webhook/stripe')

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature') ?? ''

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, env.STRIPE_WEBHOOK_SECRET)
  } catch (err: any) {
    log.error('Firma inválida', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  // ── Idempotencia ──────────────────────────────────────────────
  // Stripe puede reenviar el mismo evento (reintentos, at-least-once
  // delivery). Registramos el event.id antes de procesar; si ya existe,
  // es un reenvío y no lo volvemos a aplicar. Si la tabla todavía no
  // existe (migración 007 no ejecutada), no bloqueamos el pago real:
  // solo perdemos la protección de idempotencia para ese evento.
  const { error: dedupeError } = await db
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })

  if (dedupeError) {
    if (dedupeError.code === '23505') {
      log.info('Evento ya procesado antes (reintento de Stripe), ignorando', { eventId: event.id })
      return NextResponse.json({ received: true, duplicate: true })
    }
    log.error('No se pudo registrar idempotencia (¿falta la migración 007?)', { eventId: event.id, error: dedupeError.message })
  }

  try {
    // ── Pago completado ────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      log.info('checkout.session.completed recibido', {
        eventId: event.id,
        metadata: session.metadata,
        customer: session.customer,
        customerEmail: session.customer_details?.email,
      })

      // Determinar el plan (desde metadata o desde el precio)
      let plan: 'pro' | 'agency' = (session.metadata?.plan as 'pro' | 'agency') ?? 'pro'

      // Si no hay plan en metadata, determinarlo por el precio
      if (!session.metadata?.plan && session.amount_total) {
        plan = session.amount_total <= 1900 ? 'pro' : 'agency'
      }

      // ── Buscar usuario de 3 formas distintas ─────────────────

      let userId: string | null = null

      // Forma 1: metadata directa (lo más rápido)
      if (session.metadata?.user_id) {
        userId = session.metadata.user_id
        log.info('Usuario encontrado por metadata', { userId })
      }

      // Forma 2: por stripe_customer_id guardado en perfiles
      if (!userId && session.customer) {
        const { data } = await db
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', session.customer as string)
          .single()
        if (data?.id) {
          userId = data.id
          log.info('Usuario encontrado por customer_id', { userId })
        }
      }

      // Forma 3: por email del pago
      if (!userId && session.customer_details?.email) {
        const { data } = await db
          .from('profiles')
          .select('id')
          .eq('email', session.customer_details.email)
          .single()
        if (data?.id) {
          userId = data.id
          log.info('Usuario encontrado por email', { userId })
        }
      }

      if (!userId) {
        log.error('No se encontró el usuario para este pago', {
          eventId: event.id,
          metadata: session.metadata,
          customer: session.customer,
          customerEmail: session.customer_details?.email,
        })
        // Devolvemos 200 para que Stripe no reintente, pero logueamos el error
        return NextResponse.json({ received: true, warning: 'user_not_found' })
      }

      // ── Actualizar el plan ────────────────────────────────────
      const { error } = await db
        .from('profiles')
        .update({ plan })
        .eq('id', userId)

      if (error) {
        log.error('Error actualizando plan en Supabase', { userId, error: error.message })
      } else {
        log.info('Plan actualizado', { userId, plan })
      }
    }

    // ── Suscripción cancelada ──────────────────────────────────
    else if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription

      // Buscar usuario por customer_id
      const customerId = sub.customer as string
      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (data?.id) {
        await db.from('profiles').update({ plan: 'free' }).eq('id', data.id)
        log.info('Plan vuelto a free (suscripción cancelada)', { userId: data.id })
      }
    }

    // ── Pago fallido ───────────────────────────────────────────
    else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice
      log.warn('Pago fallido', { customer: inv.customer })
    }

    // ── Suscripción actualizada (cambio de plan, reactivación tras
    //    recuperar un pago fallido, cambios hechos desde el Customer
    //    Portal) ────────────────────────────────────────────────
    else if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const customerId = sub.customer as string

      const { data } = await db
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (!data?.id) {
        log.warn('subscription.updated: usuario no encontrado para customer', { customerId })
      } else if (sub.status === 'active' || sub.status === 'trialing') {
        const priceId = sub.items.data[0]?.price?.id
        const plan: 'pro' | 'agency' = priceId === env.STRIPE_PRICE_AGENCY_MONTHLY ? 'agency' : 'pro'
        await db.from('profiles').update({ plan }).eq('id', data.id)
        log.info('subscription.updated → plan actualizado', { userId: data.id, plan })
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        await db.from('profiles').update({ plan: 'free' }).eq('id', data.id)
        log.info('subscription.updated → plan free', { userId: data.id, status: sub.status })
      }
    }

    // ── Pago recuperado tras un fallo previo (dunning exitoso) ──
    else if (event.type === 'invoice.paid') {
      const inv = event.data.object as Stripe.Invoice
      const customerId = inv.customer as string
      if (customerId) {
        const { data } = await db.from('profiles').select('id, plan').eq('stripe_customer_id', customerId).single()
        if (data?.id && data.plan === 'free') {
          // Si el usuario había vuelto a 'free' por un fallo previo y ahora
          // paga con éxito, la suscripción activa se restaura vía
          // customer.subscription.updated (que llega junto a este evento).
          log.info('invoice.paid recibido — el plan se restaura vía subscription.updated', { userId: data.id })
        }
      }
    }

  } catch (err: any) {
    log.error('Error inesperado procesando webhook', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
