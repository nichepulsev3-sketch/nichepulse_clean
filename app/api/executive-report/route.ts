import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { generateActionPlan } from '@/lib/ai'
import { recordInteraction } from '@/lib/services/nicheGraph'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/executive-report')

const Schema = z.object({
  niches: z.array(z.any()).min(1),
})

export async function POST(req: NextRequest) {
  try {
    const { niches } = Schema.parse(await req.json())

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (profile.plan === 'free') {
      return NextResponse.json({ error: 'El informe ejecutivo está disponible en Pro y Agency.' }, { status: 403 })
    }

    const investNiches = niches.filter((n: any) => n.verdict === 'invertir')
    const actionPlan = await generateActionPlan(investNiches, profile.plan)

    // Niche Intelligence Graph (Fase 1b): un informe ejecutivo es una señal
    // fuerte de interés real en un nicho — más que solo verlo en pantalla.
    // Best-effort, no bloquea la respuesta del informe.
    Promise.all(
      investNiches.map((n: any) => recordInteraction(db, { userId: user.id, nicheName: n.name, type: 'export' }))
    ).catch(() => {})

    return NextResponse.json({ actionPlan })

  } catch (err: any) {
    log.error('Error generando informe ejecutivo', { error: err?.message ?? String(err) })
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
