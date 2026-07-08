/**
 * lib/services/engine/types.ts — Contratos del AI Intelligence Engine.
 *
 * Ver AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md para el diseño completo.
 * Este archivo es la fuente única de tipos del motor — igual que
 * lib/types.ts lo es para el resto de la app. Ningún módulo de
 * lib/services/engine/ debe redefinir estos tipos por su cuenta.
 *
 * Principio que gobierna estos contratos: un módulo puede no tener
 * datos suficientes para responder de verdad. Cuando eso pasa, el
 * contrato exige decirlo explícitamente (nivel 'sin_datos', o `null`),
 * nunca fabricar un valor con apariencia de precisión que no existe —
 * la misma regla de honestidad que ya se aplicó en scoringEngine.ts.
 */

/** Nivel de confianza de una respuesta del motor — Módulo 12. */
export interface AIConfidence {
  level: 'sin_datos' | 'baja' | 'media' | 'alta'
  /** Cuántos hechos reales (interacciones, snapshots, resultados) sustentan esta respuesta. */
  dataPoints: number
  /** Por qué ese nivel, en una frase corta y concreta. */
  reasoning: string
}

/** De dónde viene cada pieza de información que usó el motor — Módulo 13. */
export type EvidenceSource = 'graph' | 'market_history' | 'user_profile' | 'llm' | 'trends_live' | 'outcomes'

/** Envoltorio uniforme: ningún valor debe mostrarse sin sus motivos y su procedencia. */
export interface Explained<T> {
  value: T
  reasons: string[]
  sources: EvidenceSource[]
}

/** Contrato que implementa cada módulo del motor (Módulo 16, ver registry.ts).
 *  Permite sustituir la implementación de un módulo (p.ej. Prediction Engine
 *  v1 basado en reglas → v2 con modelo entrenado) sin que quien lo consume
 *  tenga que cambiar. */
export interface EngineModule<TInput, TOutput> {
  name: string
  tier: 0 | 1 | 2 | 3
  /** false = honestamente no hay datos suficientes todavía para este módulo. */
  isReady(): Promise<boolean>
  run(input: TInput): Promise<TOutput>
}

/* ── Tipos concretos usados por la Reasoning Layer (Módulo 7) ────── */

export interface KnownNiche {
  slug: string
  name: string
  timesAnalyzed: number
  latestOpportunityScore: number | null
  latestVerdict: string | null
  tags: string[]
}

export interface ScoreTrendPoint {
  recordedAt: string
  opportunityScore: number | null
  verdict: string | null
}

export interface TrendingNiche {
  name: string
  slug: string
  latestOpportunityScore: number | null
  previousOpportunityScore: number | null
  delta: number
}

export interface Prediction {
  growthProbability: number | null
  saturationProbability: number | null
  riskLevel: number | null
  estimatedTimeToResults: string | null
}

/** Contexto reunido por la Reasoning Layer ANTES de llamar al LLM.
 *  Esto es literalmente "lo que NichePulse ya sabe" — el LLM solo lo
 *  interpreta y redacta, no lo genera. */
export interface ReasoningContext {
  query: string
  userId: string
  geo: string
  knownNiche: KnownNiche | null
  related: { name: string; slug: string; sharedTags: string[] }[]
  userProfile: {
    topGeos: { geo: string; count: number }[]
    topTags: { tag: string; count: number }[]
    avgAcceptedScore: number | null
    totalSearches: number
  } | null
  marketTrend: ScoreTrendPoint[]
  prediction: Explained<Prediction> | null
  confidence: AIConfidence
}
