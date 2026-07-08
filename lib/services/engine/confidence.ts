/**
 * lib/services/engine/confidence.ts — Módulo 12, AI Confidence.
 *
 * Antes de esto, solo lib/services/scoringEngine.ts (Camino A) exponía
 * un nivel de confianza. Esta función generaliza esa misma lógica para
 * que cualquier módulo del motor (Reasoning Layer, Prediction Engine,
 * Recommendation Engine...) pueda calcular un nivel de confianza con
 * el mismo criterio en toda la app, en vez de que cada uno invente el
 * suyo. No sustituye a scoringEngine.ts — ese sigue siendo el dueño de
 * su propio cálculo de Camino A; esto es para el resto del motor.
 *
 * AUDITORIA_INTELLIGENCE_ENGINE.md, Fase 5 (P0.3): `computeConfidence`
 * medía solo VOLUMEN de evidencia (dataPoints). Se añaden aquí
 * `computeDataQuality` (consistencia del histórico) y `computeCoverage`
 * (cuánto contexto propio hubo disponible) como señales independientes
 * — un nicho con muchos datos pero contradictorios entre sí ya no
 * obtiene "confianza alta" solo por volumen.
 */
import type { AIConfidence } from './types'

const LEVEL_LADDER = ['sin_datos', 'baja', 'media', 'alta'] as const
type Level = (typeof LEVEL_LADDER)[number]

/** Umbral bajo el cual la consistencia del histórico se considera pobre
 *  y debe limitar el nivel de confianza, aunque haya mucho volumen. */
const LOW_QUALITY_THRESHOLD = 40

function downgrade(level: Level): Level {
  const idx = LEVEL_LADDER.indexOf(level)
  // Nunca baja hasta 'sin_datos' por mala calidad si YA había datos reales
  // (dataPoints > 0) — 'sin_datos' significa "no hay nada que evaluar",
  // no "lo que hay es contradictorio". Eso son dos honestidades distintas.
  return LEVEL_LADDER[Math.max(1, idx - 1)]
}

/**
 * Calcula el nivel de confianza a partir de cuántos hechos reales
 * sustentan una respuesta, opcionalmente ajustado por la calidad de
 * esos datos (ver computeDataQuality). Deliberadamente simple
 * (umbrales, no un modelo): la confianza es sobre CANTIDAD y
 * CONSISTENCIA de evidencia real, no sobre una estimación estadística
 * que hoy no tenemos datos para hacer.
 */
export function computeConfidence(
  dataPoints: number,
  context?: string,
  dataQuality: number | null = null,
  coverage = 0
): AIConfidence {
  let level: Level =
    dataPoints <= 0 ? 'sin_datos' :
    dataPoints < 3  ? 'baja' :
    dataPoints < 10 ? 'media' : 'alta'

  let reasoning =
    context ??
    (dataPoints <= 0
      ? 'Todavía no hay ningún dato propio (histórico, interacciones) para esta consulta.'
      : dataPoints < 3
      ? `Solo ${dataPoints} dato(s) real(es) disponible(s) — suficiente para orientar, no para confiar del todo.`
      : dataPoints < 10
      ? `${dataPoints} datos reales disponibles — base razonable, todavía no exhaustiva.`
      : `${dataPoints} datos reales disponibles — base sólida para esta respuesta.`)

  // Volumen alto no compensa consistencia baja: si el histórico del
  // nicho se contradice consigo mismo, el nivel se limita explícitamente
  // en vez de mostrar "alta confianza" sobre datos poco fiables.
  if (level !== 'sin_datos' && dataQuality != null && dataQuality < LOW_QUALITY_THRESHOLD) {
    level = downgrade(level)
    reasoning += ` El histórico de este nicho es poco consistente entre análisis (calidad ${dataQuality}/100), así que la confianza se limita aunque haya volumen de datos.`
  }

  return { level, dataPoints, dataQuality, coverage, reasoning }
}

/**
 * 0-100: cuán consistente es el histórico de un nicho consigo mismo,
 * a partir de sus snapshots de opportunity_score en niche_score_history.
 * `null` si hay menos de 2 puntos que comparar — honesto: no se puede
 * juzgar consistencia con un solo dato, y `null` no es lo mismo que "0"
 * (0 significaría "muy inconsistente", que sería una afirmación falsa
 * cuando en realidad no hay suficiente información para afirmar nada).
 */
export function computeDataQuality(scores: (number | null | undefined)[]): number | null {
  const values = scores.filter((v): v is number => typeof v === 'number')
  if (values.length < 2) return null

  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length
  const stdDev = Math.sqrt(variance)

  // Los opportunity_score se mueven en escala 0-100; una desviación
  // típica >= 30 puntos entre análisis del mismo nicho se considera
  // altamente inconsistente (quality 0). Es un umbral pragmático, no
  // estadístico — mismo espíritu que GROWTH_CAP en scoringEngine.ts.
  const MAX_STD_DEV = 30
  const quality = Math.round(Math.max(0, Math.min(100, 100 - (stdDev / MAX_STD_DEV) * 100)))
  return quality
}

/**
 * 0-100: de las fuentes de contexto que la Reasoning Layer puede
 * aportar, cuántas estuvieron realmente disponibles para esta consulta
 * concreta. Un nicho nuevo sin histórico tiene cobertura baja aunque el
 * LLM responda con aparente seguridad — esto es justo lo que antes se
 * perdía: el usuario no podía distinguir "la IA sabe mucho de esto" de
 * "la IA sabe poco de esto pero lo redacta igual de seguro".
 */
export function computeCoverage(flags: {
  knownNiche: boolean
  related: boolean
  userProfile: boolean
  marketTrend: boolean
  prediction: boolean
}): number {
  const total = Object.keys(flags).length
  const available = Object.values(flags).filter(Boolean).length
  return Math.round((available / total) * 100)
}
