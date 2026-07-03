import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { searchNiches } from '@/lib/ai'
import { z } from 'zod'

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
      console.error('[search-niches] quota rpc error', quotaErr)
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
      results = await searchNiches(query, filters, profile.plan, geo.toUpperCase(), { history })
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
    await db.from('niche_searches').insert({ user_id: user.id, query, filters, results, geo: geo.toUpperCase() })

    return NextResponse.json({ results, searches_used: quota.used, plan: profile.plan })

  } catch (err: any) {
    console.error('[search-niches]', err)
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
