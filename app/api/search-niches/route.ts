import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { searchNiches } from '@/lib/ai'
import { recordNicheAnalysis } from '@/lib/services/nicheGraph'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/search-niches')

const Schema = z.object({
  query:   z.string().min(1).max(200),
  filters: z.record(z.boolean()).default({}),
  geo:     z.string().length(2).default('US'),
})

export async function POST(req: NextRequest) {
  try {
    // 1. Validar input
    const body = await req.json()
    const { query, filters, geo } = Schema.parse(body)

    // 2. Verificar token del usuario
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    const db = getSupabaseAdmin()
    const { data: { user }, error } = await db.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

    // 3. Cargar perfil del usuario (solo para conocer el plan a usar en la búsqueda)
    const { data: profile } = await db.from('profiles').select('plan').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    // 4. Reservar cuota de forma atómica ANTES de gastar en IA.
    //    increment_search_usage() resetea el contador diario si han pasado
    //    24h, comprueba el límite del plan y solo incrementa si hay cuota
    //    disponible — todo en una única transacción con bloqueo de fila,
    //    para que dos requests simultáneas del mismo usuario no puedan
    //    saltarse el límite (condición de carrera del check-then-act previo).
    const { data: quota, error: quotaErr } = await db.rpc('increment_search_usage', { p_user_id: user.id })
    if (quotaErr) {
      log.error('Error en RPC de cuota', { error: quotaErr.message })
      return NextResponse.json({ error: 'Error interno al verificar tu cuota' }, { status: 500 })
    }
    if (!quota?.ok) {
      return NextResponse.json({ error: 'Límite de búsquedas alcanzado. Actualiza a Pro.' }, { status: 429 })
    }

    // 4b. Memoria de sesión básica: últimas 5 búsquedas del usuario (best-effort,
    //     si falla no debe bloquear la búsqueda actual).
    let history: string[] = []
    try {
      const { data: recent } = await db.from('niche_searches')
        .select('query').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5)
      history = (recent ?? []).map((r: any) => r.query).filter(Boolean)
    } catch { /* no bloqueante */ }

    // 5. Ejecutar búsqueda con IA + señales en vivo
    let results
    try {
      results = await searchNiches(query, filters, profile.plan, geo.toUpperCase(), { history, userId: user.id, db })
    } catch (searchErr) {
      // La cuota ya se gastó (RPC atómica) pero la búsqueda falló: devolvemos
      // la búsqueda para no cobrarle al usuario un intento que no obtuvo resultado.
      await db.rpc('refund_search_usage', { p_user_id: user.id }).then(
        () => {}, () => {} // best-effort; si la función no existe aún, no bloquea la respuesta de error
      )
      throw searchErr
    }

    // 6. Guardar búsqueda en el historial (no bloqueante para la respuesta)
    //    geo se guarda para que el cron del Feed de oportunidades pueda
    //    reproducir la misma búsqueda en el mismo país al re-analizarla.
    const { data: savedSearch } = await db.from('niche_searches')
      .insert({ user_id: user.id, query, filters, results, geo: geo.toUpperCase() })
      .select('id').single()

    // 6b. Niche Intelligence Graph (Fase 1, ver NICHEPULSE_PLATFORM_STRATEGY.md):
    //     cada nicho analizado enriquece el grafo propio en vez de quedarse
    //     solo como un JSON aislado en niche_searches. Best-effort explícito:
    //     no debe bloquear ni poder romper la respuesta de búsqueda.
    Promise.all(
      (results ?? []).map((card: any) =>
        recordNicheAnalysis(db, { userId: user.id, card, geo: geo.toUpperCase(), sourceSearchId: savedSearch?.id })
      )
    ).catch(() => { /* recordNicheAnalysis ya loguea sus propios errores; esto es un cinturón extra */ })

    return NextResponse.json({ results, searches_used: quota.used, plan: profile.plan })

  } catch (err: any) {
    log.error('Error en búsqueda de nichos', { error: err?.message ?? String(err) })
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    // code:'ai_unavailable' (ver lib/ai.ts): Claude/OpenAI no pueden responder
    // ahora mismo (sin crédito, clave inválida, límite de uso). Se distingue
    // con un status propio (503, no 500) y se propaga el code para que el
    // frontend pueda ofrecer el fallback automático al motor rápido sin IA
    // (Camino A) en vez de solo mostrar un error genérico.
    if (err?.code === 'ai_unavailable') {
      return NextResponse.json({ error: err.message, code: 'ai_unavailable' }, { status: 503 })
    }
    // AUDITORIA_LANZAMIENTO_V1.md, Fase 5/15 (P0.3): antes se devolvía
    // err?.message crudo al cliente (podía incluir detalle interno de
    // Supabase/excepciones). El detalle real ya queda en el log.error
    // de arriba -- el cliente solo necesita saber que algo falló.
    return NextResponse.json({ error: 'Error interno. Inténtalo de nuevo.' }, { status: 500 })
  }
}
