import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { searchNiches } from '@/lib/ai'
import { recordNicheAnalysis } from '@/lib/services/nicheGraph'
import { sendEmail, opportunityAlertEmail } from '@/lib/email'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import type { Plan } from '@/lib/types'

const log = createLogger('cron/opportunity-feed')

/**
 * Feed de oportunidades — IA proactiva (P1.1 del roadmap).
 *
 * Se ejecuta una vez al día desde un cron externo (Railway Cron,
 * cron-job.org, GitHub Actions...) contra esta ruta, protegida con
 * CRON_SECRET. Para cada búsqueda reciente de un usuario Pro/Agency,
 * vuelve a correr el Motor de Inteligencia y compara el resultado con
 * lo que ya se le mostró: si un nicho sube/baja de veredicto o cambia
 * de score de forma relevante, genera una alerta. Además revisa la
 * watchlist de cada usuario y, si corresponde, envía un email.
 *
 * Coste controlado deliberadamente: solo usuarios Pro/Agency, solo la
 * búsqueda más reciente por usuario (no todo el histórico), y un límite
 * duro de re-análisis por ejecución.
 */
const MAX_QUERIES_PER_RUN = 40
const SIGNIFICANT_DELTA   = 15
const JOB_NAME            = 'opportunity-feed'
// Si una ejecución previa quedó "running" hace más de esto, se considera
// colgada (crash, timeout de Railway) y no bloquea una nueva — evita que
// un fallo silencioso deje el cron bloqueado para siempre.
const LOCK_STALE_MS       = 10 * 60 * 1000

// Reintento simple con backoff para el re-análisis de un nicho: una
// llamada a la IA que falla por un error transitorio (timeout, 429) no
// debería perder ese registro para toda la ejecución del día — se
// reintenta una vez tras una pausa corta antes de darlo por fallido.
async function withRetry<T>(fn: () => Promise<T>, attempts = 2, backoffMs = 1500): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < attempts - 1) await new Promise(r => setTimeout(r, backoffMs * (i + 1)))
    }
  }
  throw lastErr
}

function buildMessage(nicheName: string, oldScore: number, newScore: number, oldVerdict: string, newVerdict: string): string {
  if (oldVerdict !== newVerdict) {
    return `${nicheName}: veredicto cambió de "${oldVerdict}" a "${newVerdict}" (score ${oldScore} → ${newScore}).`
  }
  const dir = newScore > oldScore ? 'subió' : 'bajó'
  return `${nicheName}: el Opportunity Score ${dir} de ${oldScore} a ${newScore}.`
}

export async function POST(req: NextRequest) {
  const secret = env.CRON_SECRET
  const auth   = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado en el servidor' }, { status: 500 })
  if (auth !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const appUrl = env.NEXT_PUBLIC_APP_URL
  let processed = 0, alertsCreated = 0, emailsSent = 0
  const errors: string[] = []

  // ── Locking ───────────────────────────────────────────────────
  // Si ya hay una ejecución "running" reciente para este job, no
  // arrancamos una segunda en paralelo (dos triggers externos
  // coincidiendo, o un reintento manual mientras la ejecución
  // automática sigue en curso procesarían los mismos usuarios dos
  // veces y podrían duplicar alertas/emails).
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

  try {
    // 1. Última búsqueda de cada usuario Pro/Agency en los últimos 14 días.
    const since = new Date(Date.now() - 14 * 86400000).toISOString()
    const { data: recentSearches, error: searchErr } = await db
      .from('niche_searches')
      .select('id, user_id, query, geo, results, created_at, profiles!inner(plan)')
      .gte('created_at', since)
      .in('profiles.plan', ['pro', 'agency'])
      .order('created_at', { ascending: false })
      .limit(MAX_QUERIES_PER_RUN * 3) // sobre-pedimos porque luego deduplicamos por usuario+query

    if (searchErr) throw searchErr

    // Deduplicar: solo la búsqueda más reciente por (user_id, query).
    const seen = new Set<string>()
    const targets = (recentSearches ?? []).filter((r: any) => {
      const key = `${r.user_id}::${r.query}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, MAX_QUERIES_PER_RUN)

    // 2. Watchlist de todos los usuarios afectados, para cruce rápido.
    const userIds = Array.from(new Set(targets.map((t: any) => t.user_id)))
    const { data: watchlistRows } = userIds.length
      ? await db.from('watchlist').select('*').in('user_id', userIds)
      : { data: [] as any[] }
    const { data: profilesRows } = userIds.length
      ? await db.from('profiles').select('id, email, plan').in('id', userIds)
      : { data: [] as any[] }
    const profileMap = new Map((profilesRows ?? []).map((p: any) => [p.id, p]))

    // Se acumulan las alertas en memoria y se insertan en un único INSERT
    // por lotes al final, en vez de un INSERT por nicho cambiado (podían
    // ser hasta ~160 round-trips secuenciales por ejecución con el límite
    // actual de 40 búsquedas × 4 nichos). Los updates de watchlist se
    // lanzan en paralelo con Promise.all en vez de awaits secuenciales.
    const alertRows: any[] = []
    // PromiseLike, no Promise: el query builder de supabase-js es "thenable"
    // (tiene .then) pero no implementa toda la interfaz de Promise
    // (catch/finally/Symbol.toStringTag), así que TypeScript lo rechaza si
    // se tipa como Promise<any>[]. PromiseLike es el tipo correcto y
    // Promise.all lo acepta igual.
    const watchlistUpdates: PromiseLike<any>[] = []
    const emailJobs: Promise<boolean>[] = []

    for (const target of targets) {
      processed++
      try {
        const plan: Plan = (target as any).profiles?.plan ?? 'pro'
        const geo = target.geo || 'US'
        const fresh = await withRetry(() => searchNiches(target.query, {}, plan, geo))
        const previous: any[] = Array.isArray(target.results) ? target.results : []

        // Niche Intelligence Graph (Fase 3, ver NICHEPULSE_PLATFORM_STRATEGY.md):
        // este cron es el único punto del sistema que re-analiza el MISMO
        // nicho día tras día — es exactamente lo que necesita
        // niche_score_history para dejar de ser un snapshot único y
        // convertirse en una serie temporal real (la base del futuro
        // Timeline, Fase 10). Best-effort, nunca bloquea ni puede tumbar
        // esta ejecución del cron.
        Promise.all(
          fresh.map((card: any) => recordNicheAnalysis(db, { userId: target.user_id, card, geo }))
        ).catch(() => {})

        for (const freshNiche of fresh) {
          const prevNiche = previous.find((p: any) => p?.name === freshNiche.name)
          if (!prevNiche) continue
          const oldScore = prevNiche.opportunity_score ?? prevNiche.profit_score ?? 0
          const newScore = freshNiche.opportunity_score ?? freshNiche.profit_score ?? 0
          const oldVerdict = prevNiche.verdict ?? 'esperar'
          const newVerdict = freshNiche.verdict ?? 'esperar'
          const delta = Math.abs(newScore - oldScore)
          const relevant = oldVerdict !== newVerdict || delta >= SIGNIFICANT_DELTA
          if (!relevant) continue

          const message = buildMessage(freshNiche.name, oldScore, newScore, oldVerdict, newVerdict)

          alertRows.push({
            user_id: target.user_id, niche_name: freshNiche.name, query: target.query,
            old_score: oldScore, new_score: newScore, old_verdict: oldVerdict, new_verdict: newVerdict,
            message, source: 'feed',
          })

          // ¿Está en la watchlist de este usuario? → también email.
          const watched = (watchlistRows ?? []).find((w: any) => w.user_id === target.user_id && w.niche_name === freshNiche.name)
          if (watched) {
            watchlistUpdates.push(
              db.from('watchlist').update({
                last_score: newScore, last_verdict: newVerdict, niche_data: freshNiche,
              }).eq('id', watched.id)
            )

            alertRows.push({
              user_id: target.user_id, niche_name: freshNiche.name, query: target.query,
              old_score: oldScore, new_score: newScore, old_verdict: oldVerdict, new_verdict: newVerdict,
              message, source: 'watchlist',
            })

            const profile = profileMap.get(target.user_id)
            if (profile?.email) {
              emailJobs.push(sendEmail({
                to: profile.email,
                subject: `📡 ${freshNiche.name} cambió en tu watchlist — NichePulse`,
                html: opportunityAlertEmail(freshNiche.name, message, appUrl),
              }))
            }
          }
        }
      } catch (innerErr: any) {
        errors.push(`${target.user_id}/${target.query}: ${innerErr?.message ?? innerErr}`)
      }
    }

    if (alertRows.length) {
      const { error: insertErr } = await db.from('opportunity_alerts').insert(alertRows)
      if (insertErr) errors.push(`insert alertas: ${insertErr.message}`)
      else alertsCreated = alertRows.length
    }
    if (watchlistUpdates.length) await Promise.all(watchlistUpdates)
    if (emailJobs.length) emailsSent = (await Promise.all(emailJobs)).filter(Boolean).length

    if (logId) {
      await db.from('cron_logs').update({
        status: 'success', processed, alerts_created: alertsCreated, emails_sent: emailsSent,
        error_message: errors.length ? errors.slice(0, 10).join(' | ') : null,
        finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart,
      }).eq('id', logId)
    }

    return NextResponse.json({ ok: true, processed, alertsCreated, emailsSent, errors: errors.slice(0, 10) })

  } catch (err: any) {
    log.error('Error en la ejecución del cron', { error: err?.message ?? String(err) })
    if (logId) {
      await db.from('cron_logs').update({
        status: 'error', processed, error_message: err?.message ?? String(err),
        finished_at: new Date().toISOString(), duration_ms: Date.now() - runStart,
      }).eq('id', logId)
    }
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}

// Permite disparar el cron manualmente con GET (mismo secreto) para pruebas.
export async function GET(req: NextRequest) { return POST(req) }
