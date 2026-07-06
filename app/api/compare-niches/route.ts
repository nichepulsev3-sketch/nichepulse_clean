import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { compareNiches } from '@/lib/ai'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/compare-niches')

// El comparador reutiliza los 12 scores + veredicto que YA generó el
// Motor de Inteligencia para cada nicho (no vuelve a analizarlos desde
// cero) — solo pide una llamada corta a la IA para decidir cuál de los
// que el usuario ya tiene delante elegiría y por qué.
const Schema = z.object({
  niches: z.array(z.any()).min(2).max(3),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { niches } = Schema.parse(body)

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (profile.plan === 'free') {
      return NextResponse.json({ error: 'El comparador está disponible en Pro y Agency.' }, { status: 403 })
    }

    const verdict = await compareNiches(niches, profile.plan)
    return NextResponse.json({ verdict })

  } catch (err: any) {
    log.error('Error comparando nichos', { error: err?.message ?? String(err) })
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
