import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { stripe, PLANS } from '@/lib/stripe'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/create-checkout')

export async function POST(req: NextRequest) {
  try {
    const { plan, affiliateCode } = await req.json()
    if (!PLANS[plan as keyof typeof PLANS]) return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user } } = await db.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()

    // Crear o recuperar cliente de Stripe
    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({ email: user.email!, metadata: { user_id: user.id } })
      customerId = customer.id
      await db.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id)
    }

    const planConfig = PLANS[plan as keyof typeof PLANS]
    const appUrl = env.NEXT_PUBLIC_APP_URL

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?success=1&plan=${plan}`,
      cancel_url: `${appUrl}/pricing`,
      allow_promotion_codes: true,
      metadata: { user_id: user.id, plan, affiliate_code: affiliateCode ?? '' },
      subscription_data: { metadata: { user_id: user.id, plan, affiliate_code: affiliateCode ?? '' } },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    log.error('Error creando sesión de pago', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Error al crear la sesión de pago' }, { status: 500 })
  }
}
