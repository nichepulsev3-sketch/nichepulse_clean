/**
 * lib/services/engine/agents.contracts.ts — Módulo 15, Multi-Agent AI.
 *
 * SOLO INTERFACES. Cero implementación, tal como pidió explícitamente
 * el CEO: "No implementarlos completamente todavía. Solo dejar
 * preparada la arquitectura." Ningún código de este archivo se ejecuta
 * — es documentación tipada de cómo encajarán los agentes especializados
 * el día que el Graph y el histórico (Tier 2) tengan volumen real.
 *
 * Cuando llegue ese momento, cada agente se implementa como un
 * consumidor más del registro (Módulo 16, ver registry.ts) — no como
 * una arquitectura paralela nueva.
 */
import type { Explained, Prediction } from './types'

export interface Finding {
  summary: string
  confidence: 'sin_datos' | 'baja' | 'media' | 'alta'
}

export interface MarketAssessment {
  geo: string
  category: string
  demandLevel: number | null
  notes: string[]
}

export interface CompetitionReport {
  nicheId: string
  competitorCount: number | null
  notes: string[]
}

export interface TrendCall {
  direction: 'subiendo' | 'estable' | 'bajando' | 'sin_datos'
  confidence: 'sin_datos' | 'baja' | 'media' | 'alta'
}

export interface AlertCandidate {
  watchlistId: string
  reason: string
  severity: 'info' | 'importante' | 'critico'
}

export type AgentEvent =
  | { type: 'score_change'; nicheId: string; delta: number }
  | { type: 'new_related_niche'; nicheId: string; relatedTo: string }
  | { type: 'prediction_ready'; nicheId: string }

export interface ResearchAgent {
  research(topic: string): Promise<Finding[]>
}

export interface MarketAgent {
  assessMarket(geo: string, category: string): Promise<MarketAssessment>
}

export interface CompetitionAgent {
  assessCompetition(nicheId: string): Promise<CompetitionReport>
}

export interface TrendAgent {
  detectTrend(nicheId: string): Promise<TrendCall>
}

export interface PredictionAgent {
  predict(nicheId: string): Promise<Explained<Prediction>>
}

export interface ValidationAgent {
  validate(claim: string, evidence: Explained<unknown>[]): Promise<boolean>
}

export interface WatchlistAgent {
  evaluate(watchlistId: string): Promise<AlertCandidate | null>
}

export interface NotificationAgent {
  notify(userId: string, event: AgentEvent): Promise<void>
}
