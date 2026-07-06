import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'
import { z } from 'zod'

const log = createLogger('api/niche-outcomes')

const Schema = z.object({
  watchlistId: z.string().uuid(),
  milestoneDays: z.union([z.literal(30), z.literal(60), z.literal(90)]),
  tried: z.boolean(),
  outcome: z.enum(['exito', 'fracaso', 'en_curso', 'no_probado']),
  revenueRange: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
})

// Motor propio (Fase 1) — ver MOTOR_PROPIO_PROPUESTA.md. Recibe el
// resultado real que un usuario Pro/Agency reporta sobre un nicho que
// vigiló hace 30/60/90 días. No toca el motor de IA en absoluto: solo
// acumula el dato que algún día permitirá entrenar un modelo propio.
export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  const { watchlistId, milestoneDays, tried, outcome, revenueRange, notes } = parsed.data

  // Verificar que el watchlist pertenece de verdad a este usuario antes
  // de aceptar el reporte — nunca confiar en el watchlistId a ciegas.
  const { data: watchRow, error: watchErr } = await db
    .from('watchlist')
    .select('id, user_id, niche_name')
    .eq('id', watchlistId)
    .eq('user_id', user.id)
    .single()

  if (watchErr || !watchRow) return NextResponse.json({ error: 'Nicho no encontrado' }, { status: 404 })

  const { error } = await db.from('niche_outcomes').upsert({
    user_id: user.id,
    watchlist_id: watchlistId,
    niche_name: watchRow.niche_name,
    milestone_days: milestoneDays,
    tried,
    outcome,
    revenue_range: revenueRange ?? null,
    notes: notes ?? null,
    reported_at: new Date().toISOString(),
  }, { onConflict: 'watchlist_id,milestone_days' })

  if (error) {
    log.error('Error guardando resultado real', { userId: user.id, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
