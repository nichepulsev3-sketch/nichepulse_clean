import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/admin/motor-propio-stats')

const MILESTONES = [30, 60, 90] as const
type Outcome = 'exito' | 'fracaso' | 'en_curso' | 'no_probado'

/**
 * Motor propio — panel de monitoreo (ver MOTOR_PROPIO_PROPUESTA.md).
 *
 * Panel de solo lectura para vigilar cuántos resultados reales van
 * llegando a `niche_outcomes`. No expone nada por sí sola: requiere
 * sesión (Bearer token) Y que el email de esa sesión esté en
 * env.ADMIN_EMAILS. Sin eso, siempre 403 — igual de estricto tanto si
 * el usuario no está logueado como si es un usuario normal Pro/Agency.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const { data: { user }, error: authErr } = await db.auth.getUser(token)
  if (authErr || !user?.email) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  if (!env.ADMIN_EMAILS.includes(user.email.toLowerCase())) {
    return NextResponse.json({ error: 'No tienes acceso a este panel' }, { status: 403 })
  }

  try {
    // ── Totales de niche_outcomes ────────────────────────────────
    const { count: totalOutcomes } = await db
      .from('niche_outcomes')
      .select('id', { count: 'exact', head: true })

    const { count: totalTried } = await db
      .from('niche_outcomes')
      .select('id', { count: 'exact', head: true })
      .eq('tried', true)

    const byOutcome: Record<Outcome, number> = { exito: 0, fracaso: 0, en_curso: 0, no_probado: 0 }
    for (const outcome of Object.keys(byOutcome) as Outcome[]) {
      const { count } = await db
        .from('niche_outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('outcome', outcome)
      byOutcome[outcome] = count ?? 0
    }

    // ── Por hito: cuántos emails se enviaron vs cuántas respuestas llegaron ──
    const byMilestone = []
    for (const milestone of MILESTONES) {
      const sentColumn = `feedback_sent_${milestone}`
      const { count: emailsSent } = await db
        .from('watchlist')
        .select('id', { count: 'exact', head: true })
        .not(sentColumn, 'is', null)

      const { count: responses } = await db
        .from('niche_outcomes')
        .select('id', { count: 'exact', head: true })
        .eq('milestone_days', milestone)

      byMilestone.push({
        milestone,
        emailsSent: emailsSent ?? 0,
        responses: responses ?? 0,
        responseRate: emailsSent && emailsSent > 0 ? Math.round(((responses ?? 0) / emailsSent) * 100) : null,
      })
    }

    // ── Contexto: tamaño total del pipeline elegible (Pro/Agency) ──
    const { count: eligibleWatchlist } = await db
      .from('watchlist')
      .select('id, profiles!inner(plan)', { count: 'exact', head: true })
      .in('profiles.plan', ['pro', 'agency'])

    // ── Últimas respuestas reales (sin datos personales, solo lo agregado) ──
    const { data: recent } = await db
      .from('niche_outcomes')
      .select('niche_name, milestone_days, tried, outcome, revenue_range, reported_at')
      .order('reported_at', { ascending: false })
      .limit(20)

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      totals: {
        totalOutcomes: totalOutcomes ?? 0,
        tried: totalTried ?? 0,
        notTried: (totalOutcomes ?? 0) - (totalTried ?? 0),
      },
      byOutcome,
      byMilestone,
      eligibleWatchlist: eligibleWatchlist ?? 0,
      recent: recent ?? [],
    })
  } catch (err: any) {
    log.error('Error generando estadísticas del panel', { error: err?.message ?? String(err) })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
