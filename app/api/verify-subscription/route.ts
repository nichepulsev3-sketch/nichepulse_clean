/**
 * /api/verify-subscription
 * Consulta Stripe directamente para verificar si el usuario tiene
 * una suscripción activa y actualiza el plan en Supabase.
 * Se llama desde el dashboard cuando el usuario llega con ?success=1
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('verify-subscription')

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

  log.info('Buscando suscripción', { email: user.email })

  // 3. Buscar customer de Stripe (por ID guardado o por email)
  let customerId = profile.stripe_customer_id

  if (!customerId) {
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 })
    if (customers.data.length > 0) {
      customerId = customers.data[0].id
      await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
      log.info('Customer encontrado por email', { customerId })
    }
  }

  if (!customerId) {
    log.info('No se encontró customer de Stripe')
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
      log.info('No hay suscripciones activas')
      return NextResponse.json({ plan: 'free', updated: false })
    }
    subs.data.push(...trialSubs.data)
  }

  // 5. Determinar el plan desde el precio
  const sub     = subs.data[0]
  const priceId = sub.items.data[0].price.id

  let plan: 'pro' | 'agency' = 'pro'
  if (priceId === env.STRIPE_PRICE_AGENCY_MONTHLY) {
    plan = 'agency'
  }

  log.info('Suscripción activa encontrada', { plan, priceId })

  // 6. Actualizar plan en Supabase
  const { error: updateErr } = await db
    .from('profiles')
    .update({ plan })
    .eq('id', user.id)

  if (updateErr) {
    log.error('Error actualizando plan', { error: updateErr.message })
    return NextResponse.json({ error: 'Error actualizando plan' }, { status: 500 })
  }

  log.info('Plan actualizado', { plan, email: user.email })
  return NextResponse.json({ plan, updated: true })
}
