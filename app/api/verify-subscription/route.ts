/**
 * /api/verify-subscription
 * Consulta Stripe directamente para verificar si el usuario tiene
 * una suscripción activa y actualiza el plan en Supabase.
 * Se llama desde el dashboard cuando el usuario llega con ?success=1
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()

  // 1. Verificar usuario
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // 2. Cargar perfil
  const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

  console.log('[verify-sub] Buscando suscripción para:', user.email)

  // 3. Buscar customer de Stripe (por ID guardado o por email)
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 })
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
      await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
      console.log('[verify-sub] Customer encontrado por email:', customerId)
    }
  }

  if (!customerId) {
    console.log('[verify-sub] No se encontró customer de Stripe')
    return NextResponse.json({ plan: 'free', updated: false })
  }

  // 4. Buscar suscripciones activas
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status:   'active',
    limit:    1,
  })

  if (subs.data.length === 0) {
    // Buscar también trialing
    const trialSubs = await stripe.subscriptions.list({
      customer: customerId,
      status:   'trialing',
      limit:    1,
    })
    if (trialSubs.data.length === 0) {
      console.log('[verify-sub] No hay suscripciones activas')
      return NextResponse.json({ plan: 'free', updated: false })
    }
    subs.data.push(...trialSubs.data)
  }

  // 5. Determinar el plan desde el precio
  const sub     = subs.data[0]
  const priceId = sub.items.data[0].price.id

  let plan: 'pro' | 'agency' = 'pro'
  if (priceId === process.env.STRIPE_PRICE_AGENCY_MONTHLY) {
    plan = 'agency'
  }

  console.log('[verify-sub] Suscripción activa encontrada. Plan:', plan, 'PriceId:', priceId)

  // 6. Actualizar plan en Supabase
  const { error: updateErr } = await db
    .from('profiles')
    .update({ plan })
    .eq('id', user.id)

  if (updateErr) {
    console.error('[verify-sub] Error actualizando plan:', updateErr)
    return NextResponse.json({ error: 'Error actualizando plan' }, { status: 500 })
  }

  console.log('[verify-sub] ✅ Plan actualizado a', plan, 'para', user.email)
  return NextResponse.json({ plan, updated: true })
}
