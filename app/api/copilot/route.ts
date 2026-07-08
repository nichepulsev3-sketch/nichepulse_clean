import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { askCopilot } from '@/lib/ai'
import { engine } from '@/lib/services/engine/registry'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/copilot')

const Schema = z.object({
  question: z.string().min(3).max(300),
})

const MAX_CONTEXT_NICHES = 8

/**
 * Fase 11 (Copiloto de negocio) — ver NICHEPULSE_PLATFORM_STRATEGY.md.
 * No es un modelo nuevo: es el mismo motor de IA (Claude) con contexto
 * real del Niche Intelligence Graph (nichos con mejor score reciente +
 * perfil de comportamiento del propio usuario, Fase 2). Solo Pro/Agency,
 * mismo criterio que el informe ejecutivo — es una llamada a IA con coste.
 */
export async function POST(req: NextRequest) {
  try {
    const { question } = Schema.parse(await req.json())

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
    if (profile.plan === 'free') {
      return NextResponse.json({ error: 'El Copiloto de negocio está disponible en Pro y Agency.' }, { status: 403 })
    }

    // Contexto real del AI Intelligence Engine (Módulo 16, ver
    // AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md): nichos con mejor score
    // reciente (Knowledge Engine, M1) + perfil propio del cliente que
    // pregunta (AI Memory, M3). Antes esta consulta vivía suelta aquí
    // mismo; ahora pasa por el registro del motor como cualquier otro
    // consumidor, sin cambiar el resultado que ve el usuario.
    const [topNiches, userProfile] = await Promise.all([
      engine.knowledge.getTop(db, MAX_CONTEXT_NICHES),
      engine.aiMemory.getUserProfile(db, user.id),
    ])

    const result = await askCopilot(question, { topNiches, userProfile }, profile.plan)
    return NextResponse.json(result)
  } catch (err: any) {
    log.error('Error en el copiloto de negocio', { error: err?.message ?? String(err) })
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Pregunta inválida' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
