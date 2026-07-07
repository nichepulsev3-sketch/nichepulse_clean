import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getTrends } from '@/lib/trends'
import { computeFastScore } from '@/lib/services/scoringEngine'
import { recordInteraction } from '@/lib/services/nicheGraph'
import { isFeatureEnabled } from '@/lib/services/featureFlags'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/search-preview')

const Schema = z.object({
  query: z.string().min(1).max(200),
  geo: z.string().length(2).default('US'),
})

/**
 * Camino A del Motor propio (ver MOTOR_PROPIO_PROPUESTA.md y
 * NICHEPULSE_PLATFORM_STRATEGY.md). Vista previa instantanea sin IA:
 * cero coste de tokens, respuesta en milisegundos. No consume la cuota
 * de busquedas del plan del usuario (no es el analisis completo) ni
 * reemplaza a /api/search-niches -- es un adelanto rapido antes de
 * pedir el analisis completo con IA.
 */
export async function POST(req: NextRequest) {
  try {
    const { query, geo } = Schema.parse(await req.json())

    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // fallback=true: si la tabla feature_flags no existe o el flag nunca
    // se creo, la vista previa rapida queda activada por defecto (es
    // gratis y de bajo riesgo) -- se puede desactivar sin redeploy
    // creando la fila 'fast_mode' con enabled=false.
    const enabled = await isFeatureEnabled('fast_mode', true)
    if (!enabled) return NextResponse.json({ error: 'Vista previa rapida no disponible ahora mismo' }, { status: 503 })

    const trends = await getTrends(geo.toUpperCase())
    const result = computeFastScore(query, trends)

    // Niche Intelligence Graph: registrar el uso como interaccion 'view',
    // pero SOLO si la busqueda coincide con un nicho que ya existe en el
    // Graph (recordInteraction ya hace ese chequeo internamente y no hace
    // nada si no existe). A proposito NO se crea un nicho nuevo desde
    // aqui: el score de Camino A (momentum, no validado) es de una
    // naturaleza distinta al opportunity_score que genera la IA, y
    // mezclarlos en niches.latest_opportunity_score degradaria la calidad
    // del contexto que usa el Copiloto (Fase 11) y el resto del Graph.
    // Best-effort, no bloqueante -- igual que el resto de escrituras al Graph.
    recordInteraction(db, { userId: user.id, nicheName: query, type: 'view', geo: geo.toUpperCase() }).catch(() => {})

    return NextResponse.json(result)
  } catch (err: any) {
    log.error('Error en la vista previa rapida', { error: err?.message ?? String(err) })
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos invalidos' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
