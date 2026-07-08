/**
 * lib/services/marketMemory.ts — Módulo 4, Market Memory.
 *
 * Ver AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md. Lectura pura sobre
 * `niche_score_history` (migración 011), que ya se viene poblando desde
 * hace semanas vía search-niches y el cron opportunity-feed — no hace
 * falta ninguna migración nueva para que este archivo funcione.
 *
 * Deliberadamente sin RPC/SQL a medida: la agregación (agrupar por
 * nicho, comparar el snapshot más reciente contra el anterior) se hace
 * en JS sobre un lote acotado de filas, mismo patrón ya usado en
 * lib/services/userProfile.ts. Es un enfoque pragmático, no el más
 * eficiente a escala muy grande — si el volumen crece mucho, migrar
 * esto a una función SQL/vista materializada es la mejora natural,
 * pero no antes de que haga falta de verdad.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import type { ScoreTrendPoint, TrendingNiche } from './engine/types'

const log = createLogger('services/marketMemory')

// Tope de filas que se traen para agrupar en JS — suficiente para varios
// cientos de nichos con un par de snapshots cada uno sin sobrecargar la
// consulta. Se sube si hace falta cuando haya más volumen real.
const MAX_ROWS_FOR_TREND_SCAN = 1000

/** Historial de scores de un nicho concreto en los últimos `days` días. */
export async function getScoreTrend(
  db: SupabaseClient,
  nicheId: string,
  days = 90
): Promise<ScoreTrendPoint[]> {
  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    const { data, error } = await db
      .from('niche_score_history')
      .select('opportunity_score, verdict, recorded_at')
      .eq('niche_id', nicheId)
      .gte('recorded_at', since)
      .order('recorded_at', { ascending: true })

    if (error) throw error

    return (data ?? []).map((row: any) => ({
      recordedAt: row.recorded_at,
      opportunityScore: row.opportunity_score,
      verdict: row.verdict,
    }))
  } catch (err: any) {
    log.error('No se pudo obtener el historial de scores', { nicheId, error: err?.message ?? String(err) })
    return []
  }
}

interface GroupedHistory {
  nicheId: string
  slug: string
  name: string
  points: { opportunityScore: number | null; recordedAt: string }[]
}

async function scanRecentHistory(db: SupabaseClient, geo: string): Promise<GroupedHistory[]> {
  const { data, error } = await db
    .from('niche_score_history')
    .select('niche_id, opportunity_score, recorded_at, niches(slug, display_name)')
    .eq('geo', geo)
    .order('recorded_at', { ascending: false })
    .limit(MAX_ROWS_FOR_TREND_SCAN)

  if (error) throw error

  const groups = new Map<string, GroupedHistory>()
  for (const row of (data ?? []) as any[]) {
    const niche = Array.isArray(row.niches) ? row.niches[0] : row.niches
    if (!niche) continue
    const existing = groups.get(row.niche_id)
    const point = { opportunityScore: row.opportunity_score, recordedAt: row.recorded_at }
    if (existing) {
      if (existing.points.length < 2) existing.points.push(point)
    } else {
      groups.set(row.niche_id, {
        nicheId: row.niche_id,
        slug: niche.slug,
        name: niche.display_name,
        points: [point],
      })
    }
  }
  return Array.from(groups.values()).filter(g => g.points.length >= 2)
}

/** Nichos cuyo opportunity_score subió más recientemente en un mercado (geo). */
export async function getRisingNiches(db: SupabaseClient, geo: string, limit = 10): Promise<TrendingNiche[]> {
  try {
    const groups = await scanRecentHistory(db, geo)
    return groups
      .map(g => toTrendingNiche(g))
      .filter(t => t.delta > 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, limit)
  } catch (err: any) {
    log.error('No se pudieron obtener nichos en subida', { geo, error: err?.message ?? String(err) })
    return []
  }
}

/** Nichos cuyo opportunity_score bajó más recientemente en un mercado (geo). */
export async function getFallingNiches(db: SupabaseClient, geo: string, limit = 10): Promise<TrendingNiche[]> {
  try {
    const groups = await scanRecentHistory(db, geo)
    return groups
      .map(g => toTrendingNiche(g))
      .filter(t => t.delta < 0)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, limit)
  } catch (err: any) {
    log.error('No se pudieron obtener nichos en bajada', { geo, error: err?.message ?? String(err) })
    return []
  }
}

function toTrendingNiche(g: GroupedHistory): TrendingNiche {
  const [latest, previous] = g.points // ya viene ordenado desc por recorded_at
  const latestScore = latest.opportunityScore
  const previousScore = previous.opportunityScore
  const delta = latestScore != null && previousScore != null ? latestScore - previousScore : 0
  return {
    name: g.name,
    slug: g.slug,
    latestOpportunityScore: latestScore,
    previousOpportunityScore: previousScore,
    delta,
  }
}
