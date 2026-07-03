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
  } catch (err) {
    console.error('[webhook] Firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const db = getSupabaseAdmin()

  try {
    // ── Pago completado ────────────────────────────────────────
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      console.log('[webhook] checkout.session.completed recibido')
      console.log('[webhook] metadata:', JSON.stringify(session.metadata))
      console.log('[webhook] customer:', session.customer)
      console.log('[webhook] customer_email:', session.customer_details?.email)

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
        console.log('[webhook] Usuario encontrado por metadata:', userId)
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
          console.log('[webhook] Usuario encontrado por customer_id:', userId)
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
          console.log('[webhook] Usuario encontrado por email:', userId)
        }
      }

      if (!userId) {
        console.error('[webhook] ❌ No se encontró el usuario. Datos del pago:', {
          metadata:       session.metadata,
          customer:       session.customer,
          customer_email: session.customer_details?.email,
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
        console.error('[webhook] ❌ Error actualizando plan en Supabase:', error)
      } else {
        console.log(`[webhook] ✅ Plan actualizado a "${plan}" para usuario ${userId}`)
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
        console.log(`[webhook] ✅ Plan vuelto a free para usuario ${data.id}`)
      }
    }

    // ── Pago fallido ───────────────────────────────────────────
    else if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object as Stripe.Invoice
      console.log('[webhook] Pago fallido para:', inv.customer)
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
        console.warn('[webhook] subscription.updated: usuario no encontrado para customer', customerId)
      } else if (sub.status === 'active' || sub.status === 'trialing') {
        const priceId = sub.items.data[0]?.price?.id
        const plan: 'pro' | 'agency' = priceId === process.env.STRIPE_PRICE_AGENCY_MONTHLY ? 'agency' : 'pro'
        await db.from('profiles').update({ plan }).eq('id', data.id)
        console.log(`[webhook] ✅ subscription.updated → plan "${plan}" para usuario ${data.id}`)
      } else if (['canceled', 'unpaid', 'incomplete_expired'].includes(sub.status)) {
        await db.from('profiles').update({ plan: 'free' }).eq('id', data.id)
        console.log(`[webhook] ✅ subscription.updated → plan "free" (status ${sub.status}) para usuario ${data.id}`)
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
          console.log('[webhook] invoice.paid recibido para usuario', data.id, '— el plan se restaura vía subscription.updated')
        }
      }
    }

  } catch (err) {
    console.error('[webhook] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
