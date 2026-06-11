import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, canSearch } from '@/lib/supabase'
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

    // 3. Cargar perfil del usuario
    const { data: profile } = await db.from('profiles').select('*').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })

    // 4. Resetear contador diario si han pasado 24h
    const hoursDiff = (Date.now() - new Date(profile.searches_reset_at).getTime()) / 3_600_000
    let used = profile.searches_today
    if (hoursDiff >= 24) {
      used = 0
      await db.from('profiles').update({ searches_today: 0, searches_reset_at: new Date().toISOString() }).eq('id', user.id)
    }

    // 5. Verificar cuota
    if (!canSearch(profile.plan, used)) {
      return NextResponse.json({ error: 'Límite de búsquedas alcanzado. Actualiza a Pro.' }, { status: 429 })
    }

    // 6. Ejecutar búsqueda con IA + señales en vivo
    const results = await searchNiches(query, filters, profile.plan, geo.toUpperCase())

    // 7. Guardar búsqueda e incrementar contador
    await Promise.all([
      db.from('niche_searches').insert({ user_id: user.id, query, filters, results }),
      db.from('profiles').update({ searches_today: used + 1 }).eq('id', user.id),
    ])

    return NextResponse.json({ results, searches_used: used + 1, plan: profile.plan })

  } catch (err: any) {
    console.error('[search-niches]', err)
    if (err?.name === 'ZodError') return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}
