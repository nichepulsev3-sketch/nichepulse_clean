import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendEmail, outcomeFeedbackEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('cron/outcome-feedback')

/**
 * Motor propio (Fase 1) — ver MOTOR_PROPIO_PROPUESTA.md.
 *
 * Job independiente del cron de opportunity-feed a propósito (misma
 * regla de arquitectura de la Fase 7: cada dominio, su propio job). Este
 * NO analiza nada con IA ni cambia ningún score — solo pregunta al
 * usuario (Pro/Agency, decisión de producto ya confirmada) si un nicho
 * que vigiló hace 30/60/90 días funcionó de verdad en la vida real.
 * Sin este dato, ningún motor propio futuro sería más predictivo que la
 * IA actual, solo más rápido.
 */
const JOB_NAME = 'outcome-feedback'
const LOCK_STALE_MS = 10 * 60 * 1000
const MAX_EMAILS_PER_RUN = 100
const MILESTONES = [30, 60, 90] as const
// Ventana de captura por hito: si el cron falla un día o dos, seguimos
// pudiendo alcanzar al usuario unos días después sin reenviar eternamente
// (una vez enviado, feedback_sent_X queda marcado y no se repite).
const WINDOW_SLACK_DAYS = 4

export async function POST(req: NextRequest) {
  const secret = env.CRON_SECRET
  const auth = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado en el servidor' }, { status: 500 })
  if (auth !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const appUrl = env.NEXT_PUBLIC_APP_URL

  // ── Locking (mismo patrón que cron/opportunity-feed) ────────────
  const staleThreshold = new Date(Date.now() - LOCK_STALE_MS).toISOString()
  const { data: runningLock } = await db
    .from('cron_logs')
    .select('id, started_at')
    .eq('job_name', JOB_NAME)
    .eq('status', 'running')
    .gt('started_at', staleThreshold)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (runningLock) {
    log.warn('Ejecución ya en curso, se aborta esta para no solapar', { runningSince: runningLock.started_at })
    return NextResponse.json({ ok: false, skipped: true, reason: 'already_running' }, { status: 409 })
  }

  const runStart = Date.now()
  const { data: logRow } = await db
    .from('cron_logs')
    .insert({ job_name: JOB_NAME, status: 'running' })
    .select('id')
    .single()
  const logId = logRow?.id as string | undefined

  let emailsSent = 0
  const errors: string[] = []

  try {
    for (const milestone of MILESTONES) {
      if (emailsSent >= MAX_EMAILS_PER_RUN) break

      const sentColumn = `feedback_sent_${milestone}` as 'feedback_sent_30' | 'feedback_sent_60' | 'feedback_sent_90'
      const until = new Date(Date.now() - milestone * 86400000).toISOString()
      const since = new Date(Date.now() - (milestone + WINDOW_SLACK_DAYS) * 86400000).toISOString()

      const { data: candidates, error: qErr } = await db
        .from('watchlist')
        .select('id, user_id, niche_name, created_at, profiles!inner(plan, email)')
        .is(sentColumn, null)
        .gte('created_at', since)
        .lte('created_at', until)
        .in('profiles.plan', ['pro', 'agency'])
        .limit(MAX_EMAILS_PER_RUN - emailsSent)

      if (qErr) { errors.push(`milestone ${milestone}: ${qErr.message}`); continue }

      for (const row of candidates ?? []) {
        const profile = (row as any).profiles
        if (!profile?.email) continue
        try {
          const feedbackUrl = `${appUrl}/feedback/${row.id}?milestone=${milestone}`
          const sent = await sendEmail({
            to: profile.email,
            subject: `¿Qué tal te fue con "${row.niche_name}"? — NichePulse`,
            html: outcomeFeedbackEmail(row.niche_name, milestone, feedbackUrl),
          })
          // Se marca como enviado tanto si sendEmail tuvo éxito como si
          // no (p.ej. RESEND_API_KEY sin configurar): reintentar cada día
          // un envío que sabemos que va a fallar solo generaría ruido en
          // los logs sin ganar nada — se corrige configurando Resend, no
          // reintentando este job.
          await db.from('watchlist').update({ [sentColumn]: new Date().toISOString() }).eq('id', row.id)
          if (sent) emailsSent++
        } catch (innerErr: any) {
          errors.push(`${row.id}/${milestone}: ${innerErr?.message ?? innerErr}`)
        }
      }
    }

    if (logId) {
      await db.from('cron_logs').update({
        status: 'success', emails_sent: emailsSent,
        error_message: errors.length ? errors.slice(0, 10).join(' | ') : null,
        finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart,
      }).eq('id', logId)
    }

    return NextResponse.json({ ok: true, emailsSent, errors: errors.slice(0, 10) })
  } catch (err: any) {
    log.error('Error en la ejecución del cron', { error: err?.message ?? String(err) })
    if (logId) {
      await db.from('cron_logs').update({
        status: 'error', error_message: err?.message ?? String(err),
        finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart,
      }).eq('id', logId)
    }
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}

// Permite disparar el cron manualmente con GET (mismo secreto) para pruebas.
export async function GET(req: NextRequest) { return POST(req) }
