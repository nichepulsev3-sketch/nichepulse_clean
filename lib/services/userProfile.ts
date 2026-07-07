/**
 * lib/services/userProfile.ts — Fase 2 de la plataforma (Memoria
 * permanente, ver NICHEPULSE_PLATFORM_STRATEGY.md).
 *
 * Deriva un perfil del usuario a partir de lo que YA quedó registrado
 * en el Niche Intelligence Graph (`user_niche_interactions` + `niches`).
 * No inventa nada nuevo: es una agregación de hechos ya guardados.
 *
 * Deliberadamente NO se conecta todavía a `lib/ai.ts` para personalizar
 * el prompt de búsqueda — ese es un cambio de mayor riesgo (toca la
 * pieza más frágil del sistema, con su propio parser de reparación de
 * JSON) y merece su propia decisión explícita, no colarse de paso en
 * esta fase. Esto de aquí es la lectura; la personalización del motor
 * de IA es un paso posterior y separado.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('services/userProfile')

const MAX_INTERACTIONS = 500 // cap por usuario para no traer histórico ilimitado

export interface UserProfile {
  userId: string
  totalInteractions: number
  totalSearches: number
  totalSaved: number
  totalExports: number
  topGeos: { geo: string; count: number }[]
  topTags: { tag: string; count: number }[]
  avgAcceptedScore: number | null
  lastActiveAt: string | null
}

const POSITIVE_TYPES = new Set(['watchlist_add', 'favorite_add', 'export'])

export async function getUserProfile(db: SupabaseClient, userId: string): Promise<UserProfile> {
  const empty: UserProfile = {
    userId, totalInteractions: 0, totalSearches: 0, totalSaved: 0, totalExports: 0,
    topGeos: [], topTags: [], avgAcceptedScore: null, lastActiveAt: null,
  }

  try {
    const { data, error } = await db
      .from('user_niche_interactions')
      .select('interaction_type, geo, created_at, niches(tags, latest_opportunity_score)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(MAX_INTERACTIONS)

    if (error) throw error
    if (!data || data.length === 0) return empty

    const geoCounts = new Map<string, number>()
    const tagCounts = new Map<string, number>()
    let totalSearches = 0, totalSaved = 0, totalExports = 0
    let acceptedScoreSum = 0, acceptedScoreCount = 0

    for (const row of data as any[]) {
      if (row.geo) geoCounts.set(row.geo, (geoCounts.get(row.geo) ?? 0) + 1)

      if (row.interaction_type === 'search') totalSearches++
      if (row.interaction_type === 'watchlist_add' || row.interaction_type === 'favorite_add') totalSaved++
      if (row.interaction_type === 'export') totalExports++

      if (POSITIVE_TYPES.has(row.interaction_type) && row.niches) {
        const niche = Array.isArray(row.niches) ? row.niches[0] : row.niches
        for (const tag of niche?.tags ?? []) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)
        }
        if (typeof niche?.latest_opportunity_score === 'number') {
          acceptedScoreSum += niche.latest_opportunity_score
          acceptedScoreCount++
        }
      }
    }

    const topGeos = Array.from(geoCounts.entries())
      .map(([geo, count]) => ({ geo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    const topTags = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return {
      userId,
      totalInteractions: data.length,
      totalSearches,
      totalSaved,
      totalExports,
      topGeos,
      topTags,
      avgAcceptedScore: acceptedScoreCount > 0 ? Math.round(acceptedScoreSum / acceptedScoreCount) : null,
      lastActiveAt: (data[0] as any)?.created_at ?? null,
    }
  } catch (err: any) {
    log.error('No se pudo derivar el perfil de usuario', { userId, error: err?.message ?? String(err) })
    return empty
  }
}
