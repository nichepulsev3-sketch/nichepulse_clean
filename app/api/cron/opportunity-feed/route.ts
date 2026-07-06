import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { searchNiches } from '@/lib/ai'
import { sendEmail, opportunityAlertEmail } from '@/lib/email'
import type { Plan } from '@/lib/types'

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

function buildMessage(nicheName: string, oldScore: number, newScore: number, oldVerdict: string, newVerdict: string): string {
  if (oldVerdict !== newVerdict) {
    return `${nicheName}: veredicto cambió de "${oldVerdict}" a "${newVerdict}" (score ${oldScore} → ${newScore}).`
  }
  const dir = newScore > oldScore ? 'subió' : 'bajó'
  return `${nicheName}: el Opportunity Score ${dir} de ${oldScore} a ${newScore}.`
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET no configurado en el servidor' }, { status: 500 })
  if (auth !== secret) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const db = getSupabaseAdmin()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://nichepulse.app'
  let processed = 0, alertsCreated = 0, emailsSent = 0
  const errors: string[] = []

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
        const fresh = await searchNiches(target.query, {}, plan, geo)
        const previous: any[] = Array.isArray(target.results) ? target.results : []

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

    return NextResponse.json({ ok: true, processed, alertsCreated, emailsSent, errors: errors.slice(0, 10) })

  } catch (err: any) {
    console.error('[cron/opportunity-feed] ❌', err?.message ?? err)
    return NextResponse.json({ error: err?.message ?? 'Error interno' }, { status: 500 })
  }
}

// Permite disparar el cron manualmente con GET (mismo secreto) para pruebas.
export async function GET(req: NextRequest) { return POST(req) }
