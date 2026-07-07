/**
 * lib/services/scoringEngine.ts -- Camino A del Motor propio (ver
 * MOTOR_PROPIO_PROPUESTA.md, seccion 2, y NICHEPULSE_PLATFORM_STRATEGY.md).
 *
 * Formula deterministica calculada directamente desde las senales reales
 * de lib/trends.ts (Google Trends, TikTok, Amazon Movers) -- CERO
 * llamadas a Claude/OpenAI, respuesta en milisegundos, coste cero.
 *
 * Honestidad tecnica, la misma que ya se aplico en el resto del
 * proyecto: esto NO sustituye al analisis completo con IA. Solo calcula
 * un "momentum score" a partir de senales de mercado que coinciden con
 * la busqueda del usuario -- no genera scores de competencia, margen,
 * SEO, riesgo, etc. (esos 8 de los 12 scores del Motor de Inteligencia
 * necesitan razonamiento, no solo numeros de trends.ts; fabricarlos
 * aqui seria aparentar una precision que no existe). Si no hay ninguna
 * senal en vivo que coincida con la busqueda, se dice explicitamente en
 * vez de inventar un numero.
 *
 * Nota de codigo: este archivo se escribe en ASCII puro (sin acentos ni
 * caracteres especiales, ni en comentarios) por la misma razon que
 * lib/services/nicheGraph.ts -- evitar cualquier riesgo de corrupcion de
 * caracteres Unicode al guardar el archivo, tras dos incidentes reales
 * de build roto por esto en esta sesion.
 */
import type { AggregatedTrends, TrendSignal } from '@/lib/trends'
import { slugify } from '@/lib/services/nicheGraph'

// Techos de normalizacion por fuente -- cada fuente de trends.ts mide
// "crecimiento" en una escala distinta (traffic de Google, rank_diff de
// TikTok, posiciones de Amazon), asi que no se pueden comparar en crudo.
// Estos techos son heuristicos, elegidos mirando los rangos reales que
// devuelve lib/trends.ts (incluidos los datos de respaldo) -- no vienen
// de ningun estudio estadistico, es una normalizacion pragmatica.
const GROWTH_CAP: Record<TrendSignal['source'], number> = {
  google: 500,
  tiktok: 1000,
  amazon: 4000,
}

export type FastConfidence = 'sin_datos' | 'baja' | 'media' | 'alta'

export interface MatchedSignal {
  keyword: string
  source: TrendSignal['source']
  volume: string
  category: string
  normalizedGrowth: number
}

export interface FastScoreResult {
  query: string
  matched: boolean
  matchedSignals: MatchedSignal[]
  momentumScore: number | null
  sourceCoverage: number
  fastOpportunityScore: number | null
  confidence: FastConfidence
  reasons: string[]
  generatedAt: string
}

function tokenize(text: string): Set<string> {
  const slug = slugify(text)
  return new Set(slug.split('-').filter(w => w.length >= 3))
}

function normalizeGrowth(signal: TrendSignal): number {
  const cap = GROWTH_CAP[signal.source] ?? 500
  const pct = (signal.growth / cap) * 100
  return Math.max(0, Math.min(100, Math.round(pct)))
}

/**
 * Calcula un score rapido y gratuito para una busqueda, basado
 * exclusivamente en si las senales de mercado en vivo (trends.ts)
 * mencionan literalmente la misma palabra clave que el usuario busco.
 * Limitacion honesta v1: coincidencia por palabra, no semantica -- una
 * busqueda en espanol rara vez coincidira con senales en ingles de
 * Google/TikTok/Amazon. Cuando eso pasa, se devuelve confidence
 * 'sin_datos' en vez de fabricar un numero.
 */
export function computeFastScore(query: string, trends: AggregatedTrends): FastScoreResult {
  const queryTokens = tokenize(query)
  const generatedAt = new Date().toISOString()

  const allSignals: TrendSignal[] = [...trends.google, ...trends.tiktok, ...trends.amazon]

  const matches: MatchedSignal[] = []
  for (const signal of allSignals) {
    const signalTokens = tokenize(signal.keyword)
    let overlap = 0
    for (const t of Array.from(queryTokens)) if (signalTokens.has(t)) overlap++
    if (overlap > 0) {
      matches.push({
        keyword: signal.keyword,
        source: signal.source,
        volume: signal.volume,
        category: signal.category,
        normalizedGrowth: normalizeGrowth(signal),
      })
    }
  }

  if (matches.length === 0) {
    return {
      query,
      matched: false,
      matchedSignals: [],
      momentumScore: null,
      sourceCoverage: 0,
      fastOpportunityScore: null,
      confidence: 'sin_datos',
      reasons: ['Ninguna senal en vivo (Google Trends, TikTok, Amazon Movers) menciona literalmente esta busqueda ahora mismo. No es un veredicto negativo -- solo significa que Camino A no tiene con que calcular un score sin usar IA. Usa el analisis completo para un veredicto real.'],
      generatedAt,
    }
  }

  const momentumScore = Math.round(
    matches.reduce((sum, m) => sum + m.normalizedGrowth, 0) / matches.length
  )
  const sourcesMatched = new Set(matches.map(m => m.source)).size
  const sourceCoverage = Math.round((sourcesMatched / 3) * 100)
  const fastOpportunityScore = Math.round(momentumScore * 0.7 + sourceCoverage * 0.3)

  const confidence: FastConfidence =
    sourcesMatched >= 3 ? 'alta' :
    sourcesMatched === 2 || matches.length >= 2 ? 'media' :
    'baja'

  const reasons = matches.slice(0, 4).map(m =>
    `"${m.keyword}" en ${m.source === 'google' ? 'Google Trends' : m.source === 'tiktok' ? 'TikTok' : 'Amazon Movers'}: ${m.volume}`
  )

  return {
    query,
    matched: true,
    matchedSignals: matches,
    momentumScore,
    sourceCoverage,
    fastOpportunityScore,
    confidence,
    reasons,
    generatedAt,
  }
}
