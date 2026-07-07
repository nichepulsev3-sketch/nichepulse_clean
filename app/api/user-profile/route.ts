import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { getUserProfile } from '@/lib/services/userProfile'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/user-profile')

/**
 * Fase 2 (Memoria permanente) — ver NICHEPULSE_PLATFORM_STRATEGY.md.
 * Expone el perfil derivado de las interacciones reales del propio
 * usuario con el Niche Intelligence Graph. Cada usuario solo puede
 * leer el suyo (el token determina el userId, no viene por parámetro).
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  try {
    const profile = await getUserProfile(db, user.id)
    return NextResponse.json(profile)
  } catch (err: any) {
    log.error('Error obteniendo perfil de usuario', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
