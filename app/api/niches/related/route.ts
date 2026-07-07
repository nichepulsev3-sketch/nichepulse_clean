import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getRelatedNiches } from '@/lib/services/nicheGraph'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/niches/related')

/**
 * Fase 7 (Sistema de descubrimiento) — ver NICHEPULSE_PLATFORM_STRATEGY.md.
 * Requiere sesión (cualquier usuario logueado, no solo admin — es
 * inteligencia de mercado agregada, no dato personal de nadie).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const name = req.nextUrl.searchParams.get('name')
  if (!name) return NextResponse.json({ error: 'Falta el parámetro "name"' }, { status: 400 })

  try {
    const related = await getRelatedNiches(db, name)
    return NextResponse.json({ related })
  } catch (err: any) {
    log.error('Error obteniendo nichos relacionados', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
