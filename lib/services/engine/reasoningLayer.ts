/**
 * lib/services/engine/reasoningLayer.ts — Módulo 7, AI Reasoning Layer.
 *
 * Pieza central del AI Intelligence Engine (ver
 * AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md). Reúne todo lo que NichePulse
 * ya sabe ANTES de llamar al LLM: qué conoce del nicho (Knowledge
 * Engine), qué relaciona con él (Niche Graph), qué sabe del usuario
 * (AI Memory), cómo evolucionó su score (Market Memory), si hay una
 * predicción real disponible (Prediction Engine, hoy siempre null por
 * falta de datos) y con cuánta confianza puede afirmarlo todo.
 *
 * El LLM nunca ve menos contexto del que ya existe en NichePulse — este
 * módulo es el que se lo entrega ya preparado. No decide nada por su
 * cuenta ni sustituye al LLM: solo reúne hechos, el LLM sigue siendo
 * quien redacta e interpreta.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import { getKnownNiche, getRelatedNiches } from '@/lib/services/nicheGraph'
import { getUserProfile } from '@/lib/services/userProfile'
import { getScoreTrend } from '@/lib/services/marketMemory'
import { predict } from './predictionEngine'
import { computeConfidence, computeDataQuality, computeCoverage } from './confidence'
import type { ReasoningContext, EngineExplanation } from './types'

const log = createLogger('services/engine/reasoningLayer')

export interface BuildContextInput {
  query: string
  userId: string
  geo: string
  db: SupabaseClient
}

/**
 * Reúne el contexto completo para una consulta. Todas las fuentes son
 * best-effort e independientes entre sí (Promise.allSettled): si una
 * falla, el resto del contexto sigue siendo válido — el motor nunca
 * debe bloquear una búsqueda por un fallo parcial de una sola fuente.
 */
export async function buildContext(input: BuildContextInput): Promise<ReasoningContext> {
  const { query, userId, geo, db } = input

  const [knownNicheR, relatedR, userProfileR] = await Promise.allSettled([
    getKnownNiche(db, query),
    getRelatedNiches(db, query, 5),
    getUserProfile(db, userId),
  ])

  const knownNiche = knownNicheR.status === 'fulfilled' ? knownNicheR.value : null
  const related = relatedR.status === 'fulfilled' ? relatedR.value : []
  const userProfile = userProfileR.status === 'fulfilled' ? userProfileR.value : null

  if (knownNicheR.status === 'rejected') log.error('Fallo leyendo Knowledge Engine', { error: String(knownNicheR.reason) })
  if (relatedR.status === 'rejected') log.error('Fallo leyendo Recommendation Engine', { error: String(relatedR.reason) })
  if (userProfileR.status === 'rejected') log.error('Fallo leyendo AI Memory', { error: String(userProfileR.reason) })

  // Market Memory (M4) y Prediction Engine (M6) dependen de que el nicho
  // ya exista en el Graph — si es la primera vez que se busca, no hay
  // histórico que leer ni nada que predecir, y eso es honesto, no un fallo.
  let marketTrend: ReasoningContext['marketTrend'] = []
  let prediction: ReasoningContext['prediction'] = null
  if (knownNiche) {
    try {
      const { data: nicheRow } = await db.from('niches').select('id').eq('slug', knownNiche.slug).maybeSingle()
      if (nicheRow?.id) {
        marketTrend = await getScoreTrend(db, nicheRow.id, 90)
        const predicted = await predict(db, nicheRow.id)
        prediction = predicted
      }
    } catch (err: any) {
      log.error('Fallo leyendo Market Memory / Prediction Engine', { error: err?.message ?? String(err) })
    }
  }

  // Confianza del contexto reunido: cuenta hechos reales disponibles
  // (veces que se analizó el nicho + interacciones del usuario + puntos
  // de histórico de mercado) — no es la confianza del LLM, es la
  // confianza de NichePulse en lo que le está dando de comer al LLM.
  const dataPoints =
    (knownNiche?.timesAnalyzed ?? 0) +
    (userProfile?.totalSearches ?? 0) +
    marketTrend.length

  // AUDITORIA_INTELLIGENCE_ENGINE.md Fase 5 / P0.3: volumen (dataPoints)
  // ya no es la única señal. dataQuality mide si el histórico del nicho
  // es consistente consigo mismo; coverage mide cuánto de las 5 fuentes
  // de contexto posibles estuvo realmente disponible para esta consulta.
  const dataQuality = computeDataQuality(marketTrend.map(p => p.opportunityScore))
  const coverageFlags = {
    knownNiche: knownNiche != null,
    related: related.length > 0,
    userProfile: userProfile != null && userProfile.totalSearches > 0,
    marketTrend: marketTrend.length > 0,
    prediction: prediction != null,
  }
  const coverage = computeCoverage(coverageFlags)

  const confidence = computeConfidence(
    dataPoints,
    knownNiche
      ? `Este nicho ya se analizó ${knownNiche.timesAnalyzed} vez/veces antes en NichePulse.`
      : 'Primera vez que NichePulse analiza este nicho — sin histórico propio todavía.',
    dataQuality,
    coverage
  )

  // Explicabilidad de segunda capa (Fase 6 / P0.2): qué se usó de verdad
  // y qué faltó, en lenguaje llano — antes esta información se reunía
  // igual pero se descartaba después de convertirse en texto de prompt.
  const explanation = buildExplanation(coverageFlags, knownNiche)

  return {
    query,
    userId,
    geo,
    knownNiche,
    related: related.map(r => ({ name: r.name, slug: r.slug, sharedTags: r.sharedTags })),
    userProfile: userProfile
      ? {
          topGeos: userProfile.topGeos,
          topTags: userProfile.topTags,
          avgAcceptedScore: userProfile.avgAcceptedScore,
          totalSearches: userProfile.totalSearches,
        }
      : null,
    marketTrend,
    prediction,
    confidence,
    explanation,
  }
}

function buildExplanation(
  flags: { knownNiche: boolean; related: boolean; userProfile: boolean; marketTrend: boolean; prediction: boolean },
  knownNiche: ReasoningContext['knownNiche']
): EngineExplanation {
  const usedSources: string[] = []
  const missingSources: string[] = []

  if (flags.knownNiche) usedSources.push(`Histórico de ${knownNiche?.timesAnalyzed ?? 0} análisis previos de este nicho en NichePulse`)
  else missingSources.push('Sin histórico propio de este nicho todavía (primera vez que se analiza)')

  if (flags.related) usedSources.push('Nichos relacionados ya conocidos por el Knowledge Graph')
  else missingSources.push('Sin nichos relacionados conocidos')

  if (flags.userProfile) usedSources.push('Perfil de comportamiento del usuario (búsquedas y preferencias previas)')
  else missingSources.push('Sin perfil de usuario suficiente (pocas o ninguna búsqueda previa)')

  if (flags.marketTrend) usedSources.push('Tendencia de score de este nicho en los últimos 90 días')
  else missingSources.push('Sin tendencia de mercado propia (nicho nuevo o sin snapshots recientes)')

  if (flags.prediction) usedSources.push('Predicción del Prediction Engine')
  else missingSources.push('Sin predicción disponible (Prediction Engine: faltan datos reales de resultado suficientes)')

  return { usedSources, missingSources, contradictions: [] }
}

/**
 * Paso de contraste determinístico (Fase 10 / P0.1) — SIN llamadas a IA.
 * Compara lo que el LLM acaba de afirmar sobre un nicho contra lo que el
 * propio Knowledge Graph ya sabía ANTES de preguntarle, y devuelve una
 * lista de contradicciones objetivas (vacía si no hay ninguna, o si no
 * hay histórico suficiente para poder contrastar). Esto es lo que hace
 * que NichePulse deje de repetir ciegamente lo que dice el LLM: no
 * sustituye su respuesta, pero puede señalar cuándo desconfiar de ella.
 */
export function detectContradictions(
  niche: { verdict?: string | null; opportunity_score?: number | null; profit_score?: number | null },
  ctx: Pick<ReasoningContext, 'marketTrend'>
): string[] {
  const contradictions: string[] = []
  const trend = ctx.marketTrend
  if (!trend || trend.length < 2) return contradictions // honesto: sin histórico, no hay nada que contrastar

  const first = trend[0]
  const last = trend[trend.length - 1]
  if (first.opportunityScore == null || last.opportunityScore == null) return contradictions

  const delta = last.opportunityScore - first.opportunityScore
  const SIGNIFICANT = 10
  const verdict = niche.verdict ?? null
  const score = niche.opportunity_score ?? niche.profit_score ?? null

  if (delta <= -SIGNIFICANT && verdict === 'invertir') {
    contradictions.push(`El veredicto es "invertir", pero el score de este nicho ha bajado ${Math.abs(delta)} puntos en NichePulse en los últimos análisis — contrástalo antes de decidir.`)
  }
  if (delta >= SIGNIFICANT && verdict === 'evitar') {
    contradictions.push(`El veredicto es "evitar", pero el score de este nicho ha subido ${delta} puntos en NichePulse en los últimos análisis — contrástalo antes de decidir.`)
  }
  if (score != null && last.opportunityScore != null) {
    const jump = Math.abs(score - last.opportunityScore)
    if (jump >= 30) {
      contradictions.push(`El score de esta respuesta (${score}) se aleja mucho del último registrado para este nicho (${last.opportunityScore}) sin que el veredicto haya cambiado de forma proporcional.`)
    }
  }

  return contradictions
}

/**
 * Convierte el contexto en un bloque de texto listo para inyectar en un
 * prompt de LLM — mismo patrón ya validado con `historyContext` en
 * lib/ai.ts (searchNiches): un párrafo adicional de contexto, nunca una
 * instrucción que cambie el formato JSON obligatorio de salida.
 */
export function contextToPromptBlock(ctx: ReasoningContext): string {
  const lines: string[] = []

  if (ctx.knownNiche) {
    lines.push(
      `NichePulse ya analizó "${ctx.knownNiche.name}" ${ctx.knownNiche.timesAnalyzed} vez/veces antes` +
      (ctx.knownNiche.latestOpportunityScore != null
        ? ` (último opportunity_score conocido: ${ctx.knownNiche.latestOpportunityScore}, veredicto: ${ctx.knownNiche.latestVerdict ?? 'sin veredicto'}).`
        : '.')
    )
  }

  if (ctx.marketTrend.length >= 2) {
    const first = ctx.marketTrend[0]
    const last = ctx.marketTrend[ctx.marketTrend.length - 1]
    if (first.opportunityScore != null && last.opportunityScore != null) {
      const delta = last.opportunityScore - first.opportunityScore
      if (delta !== 0) {
        lines.push(`Su score interno ha ${delta > 0 ? 'subido' : 'bajado'} ${Math.abs(delta)} puntos desde el ${first.recordedAt.split('T')[0]}.`)
      }
    }
  }

  if (ctx.related.length) {
    lines.push(`Nichos relacionados ya conocidos por NichePulse: ${ctx.related.map(r => r.name).join(', ')}.`)
  }

  // AI Memory (M3): esto es lo que en NICHEPULSE_PLATFORM_STRATEGY.md
  // (seccion 2.3) quedo pendiente de confirmacion explicita -- "el motor
  // de IA podria priorizar paises/categorias que el usuario ya demostro
  // preferir". Se anade aqui, ahora que esta confirmado, con el mismo
  // cuidado que ya usa historyContext: informacion disponible, nunca una
  // instruccion que fuerce el resultado.
  if (ctx.userProfile) {
    const p = ctx.userProfile
    const bits: string[] = []
    if (p.topTags.length) bits.push(`suele interesarle: ${p.topTags.slice(0, 5).map(t => t.tag).join(', ')}`)
    if (p.topGeos.length) bits.push(`mercados que más consulta: ${p.topGeos.slice(0, 3).map(g => g.geo).join(', ')}`)
    if (p.avgAcceptedScore != null) bits.push(`suele aceptar nichos con score medio de ${p.avgAcceptedScore}+`)
    if (bits.length) {
      lines.push(`Sobre este cliente (${p.totalSearches} búsquedas previas en NichePulse): ${bits.join('; ')}. Úsalo solo si un nicho generado ahora conecta de verdad con esto — nunca lo fuerces ni lo menciones si no aporta valor real.`)
    }
  }

  if (!lines.length) return ''

  return `\nCONOCIMIENTO PROPIO DE NICHEPULSE (usa esto si aporta valor real, no lo repitas literal): ${lines.join(' ')}`
}
