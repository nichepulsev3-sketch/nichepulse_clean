/**
 * lib/services/engine/decisionEngine.ts — Módulo 17, Decision Engine.
 *
 * ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 3: único punto de decisión
 * del motor. Antes de este archivo, la decisión final (¿qué confianza
 * tiene esta respuesta? ¿hay contradicciones con el histórico? ¿qué la
 * respalda?) vivía repartida en tres sitios -- computeConfidence()
 * calculaba el nivel base, detectContradictions() vivía dentro de
 * reasoningLayer.ts (que debería solo REUNIR hechos, no decidir nada), y
 * el ensamblaje final ocurría inline en lib/ai.ts, mezclado con las
 * llamadas a Claude/OpenAI. Este módulo es donde vive esa decisión
 * ahora, y el único sitio de todo el motor que puede tomarla.
 *
 * Ningún módulo consumidor (lib/ai.ts) debe volver a calcular nivel de
 * confianza, contradicciones o evidencia de respaldo por su cuenta --
 * siempre pasa por decide().
 */
import { createLogger } from '@/lib/logger'
import { downgrade } from './confidence'
import type { AIConfidence, EngineExplanation, ReasoningContext } from './types'

const log = createLogger('services/engine/decisionEngine')

export interface DecidableNiche {
  name?: string
  verdict?: string | null
  opportunity_score?: number | null
  profit_score?: number | null
}

export interface EngineDecision {
  confidence: AIConfidence
  explanation: EngineExplanation
}

/**
 * Paso de contraste determinístico — SIN llamadas a IA. Compara lo que
 * el LLM acaba de afirmar sobre un nicho contra lo que el propio
 * Knowledge Graph ya sabía ANTES de preguntarle, y devuelve una lista de
 * contradicciones objetivas (vacía si no hay ninguna, o si no hay
 * histórico suficiente para poder contrastar). No sustituye la
 * respuesta del LLM, pero puede señalar cuándo desconfiar de ella.
 *
 * (Trasladado desde reasoningLayer.ts — reasoningLayer solo reúne
 * hechos ahora, nunca decide; ver Fase 1/3 del documento de arquitectura.)
 */
export function detectContradictions(
  niche: DecidableNiche,
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
 * Fase 4 (P0.2, Evidence Engine) — el lado positivo de
 * detectContradictions: señales deterministas (mismo dato, sin IA) de
 * que el histórico del Graph RESPALDA lo que afirma el LLM, no solo la
 * ausencia de contradicción. Vacío si no hay histórico suficiente para
 * poder contrastar, nunca una afirmación de respaldo sin evidencia real.
 */
export function computeSupportingEvidence(
  niche: DecidableNiche,
  ctx: Pick<ReasoningContext, 'marketTrend' | 'knownNiche'>
): string[] {
  const evidence: string[] = []
  const verdict = niche.verdict ?? null
  const trend = ctx.marketTrend

  if (trend && trend.length >= 2) {
    const first = trend[0]
    const last = trend[trend.length - 1]
    if (first.opportunityScore != null && last.opportunityScore != null) {
      const delta = last.opportunityScore - first.opportunityScore
      const SIGNIFICANT = 10
      if (delta >= SIGNIFICANT && verdict === 'invertir') {
        evidence.push(`El veredicto "invertir" coincide con una subida real de ${delta} puntos en el histórico propio de NichePulse para este nicho.`)
      }
      if (delta <= -SIGNIFICANT && verdict === 'evitar') {
        evidence.push(`El veredicto "evitar" coincide con una bajada real de ${Math.abs(delta)} puntos en el histórico propio de NichePulse para este nicho.`)
      }
    }
  }

  if (ctx.knownNiche?.latestVerdict && verdict && ctx.knownNiche.latestVerdict === verdict) {
    evidence.push(`El veredicto coincide con el último veredicto que NichePulse ya tenía registrado para este nicho (${ctx.knownNiche.timesAnalyzed} análisis previos).`)
  }

  return evidence
}

/**
 * Punto único de decisión (Fase 3). Recibe un nicho ya generado por el
 * LLM y el ReasoningContext ya reunido por reasoningLayer.buildContext(),
 * y devuelve la confianza y explicación FINALES — nunca a calcular de
 * nuevo por quien lo consume. También registra un log de auditoría
 * estructurado por cada decisión (Fase 15, AI Governance, P0.6): con qué
 * confianza y por qué, usando el logger ya existente, sin infraestructura
 * nueva.
 */
export function decide(niche: DecidableNiche, ctx: ReasoningContext): EngineDecision {
  const contradictions = detectContradictions(niche, ctx)
  const supportingEvidence = computeSupportingEvidence(niche, ctx)

  const confidence: AIConfidence = contradictions.length
    ? {
        ...ctx.confidence,
        level: downgrade(ctx.confidence.level),
        reasoning: `${ctx.confidence.reasoning} Se detectaron ${contradictions.length} contradicción(es) con el histórico propio de NichePulse — revisa el detalle antes de confiar del todo.`,
      }
    : ctx.confidence

  const explanation: EngineExplanation = {
    ...ctx.explanation,
    contradictions,
    supportingEvidence,
  }

  // Fase 15 / P0.6: registro auditable de la decisión — nivel final,
  // cuántas contradicciones/evidencias de respaldo se encontraron y con
  // qué cobertura de contexto se decidió. No sustituye a una tabla de
  // auditoría persistente (ver ARQUITECTURA_INTELIGENCIA_10_ANOS.md,
  // Fase 15 — eso es P1, requiere migración y confirmación explícita),
  // pero da trazabilidad real hoy mismo vía los logs ya capturados en
  // Railway, sin infraestructura nueva.
  log.info('Decisión del motor', {
    niche: niche.name ?? '?',
    level: confidence.level,
    dataQuality: confidence.dataQuality,
    coverage: confidence.coverage,
    uncertainty: confidence.uncertainty,
    contradictions: contradictions.length,
    supportingEvidence: supportingEvidence.length,
  })

  return { confidence, explanation }
}
