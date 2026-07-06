/**
 * /api/create-portal-session
 * Crea una sesión del Stripe Customer Portal para que el usuario pueda
 * autogestionar su suscripción: cambiar tarjeta, descargar facturas,
 * cancelar. Antes de este endpoint, la única vía era escribir a soporte
 * manualmente para cualquiera de estas acciones.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { stripe } from '@/lib/stripe'
import { env } from '@/lib/env'

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('stripe_customer_id').eq('id', user.id).single()

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No tienes ninguna suscripción activa todavía.' }, { status: 400 })
    }

    const appUrl = env.NEXT_PUBLIC_APP_URL
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err: any) {
    console.error('[create-portal-session]', err)
    return NextResponse.json({ error: 'Error al abrir el portal de facturación' }, { status: 500 })
  }
}
