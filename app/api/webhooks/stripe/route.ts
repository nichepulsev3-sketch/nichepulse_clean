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

  } catch (err) {
    console.error('[webhook] Error inesperado:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
