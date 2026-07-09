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

/**
 * Nivel de confianza de una respuesta del motor — Módulo 12.
 *
 * AUDITORIA_INTELLIGENCE_ENGINE.md, Fase 5 (P0.3): antes `level` solo
 * medía VOLUMEN de evidencia (cuántos hechos hay). Un nicho analizado
 * muchas veces con datos contradictorios entre sí obtenía "confianza
 * alta" igual que uno con datos consistentes -- eso es una confusión
 * conceptual entre "hay muchos datos" y "los datos son fiables".
 * `dataQuality` y `coverage` separan esas dos preguntas; `level` sigue
 * existiendo como resumen para la UI, pero ahora se calcula a partir de
 * las tres señales, no solo de `dataPoints`.
 */
export interface AIConfidence {
  level: 'sin_datos' | 'baja' | 'media' | 'alta'
  /** Cuántos hechos reales (interacciones, snapshots, resultados) sustentan esta respuesta. */
  dataPoints: number
  /**
   * 0-100: cuán CONSISTENTE es el histórico de este nicho consigo mismo
   * (varianza baja entre snapshots de niche_score_history = alta calidad).
   * `null` cuando no hay al menos 2 snapshots que comparar -- honesto:
   * "no se puede juzgar consistencia todavía", nunca un valor inventado.
   */
  dataQuality: number | null
  /**
   * 0-100: de las fuentes de contexto que la Reasoning Layer podría
   * aportar (nicho conocido, relacionados, perfil de usuario, tendencia
   * de mercado, predicción), cuántas estuvieron realmente disponibles
   * para esta respuesta concreta.
   */
  coverage: number
  /**
   * Días desde el snapshot más reciente de niche_score_history para este
   * nicho -- ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 5 (P0.3). `null`
   * si nunca se registró ningún snapshot (nicho sin histórico todavía).
   * Un dato "correcto" pero de hace 6 meses no es igual de fiable que uno
   * de ayer, y antes no había forma de distinguirlos.
   */
  dataFreshnessDays: number | null
  /**
   * 0-100: incertidumbre agregada -- combinación determinista de
   * coverage, dataQuality y dataPoints (nunca un dato nuevo, solo la
   * lectura inversa de los tres anteriores). 100 = máxima incertidumbre.
   * Pensado como resumen de un vistazo, no sustituye a mirar los tres
   * campos por separado si hace falta el detalle.
   */
  uncertainty: number
  /** Por qué ese nivel, en una frase corta y concreta. */
  reasoning: string
}

/**
 * Explicabilidad de segunda capa — Módulo 13 (Fase 6 / P0.2 de
 * AUDITORIA_INTELLIGENCE_ENGINE.md). El `ReasoningContext` ya reunía
 * toda esta información antes de llamar al LLM, pero se descartaba
 * después de convertirse en texto de prompt -- nunca llegaba al
 * usuario. Esto la expone de forma estructurada.
 */
export interface EngineExplanation {
  /** Qué datos propios de NichePulse (no del conocimiento general del LLM) se usaron. */
  usedSources: string[]
  /** Qué datos propios NO estaban disponibles para esta respuesta -- honesto, no oculto. */
  missingSources: string[]
  /**
   * Contradicciones detectadas de forma determinística (sin IA) entre lo
   * que afirma el LLM y lo que el propio Knowledge Graph sabe -- p.ej.
   * el LLM dice "en crecimiento" pero niche_score_history muestra una
   * caída sostenida. Vacío si no se detectó ninguna, o si no hay
   * histórico suficiente para poder contrastar.
   */
  contradictions: string[]
  /**
   * ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 4 (P0.2, Evidence Engine):
   * el lado positivo de detectContradictions -- señales deterministas
   * (mismo dato, sin IA) de que el histórico del Graph RESPALDA lo que
   * afirma el LLM, no solo la ausencia de contradicción. Vacío si no hay
   * histórico suficiente para poder contrastar, nunca una afirmación de
   * respaldo sin evidencia real detrás.
   */
  supportingEvidence: string[]
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
  /**
   * ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 10 (P0.4): contrato
   * ampliado a los 6 campos que pide el diseño de Prediction Engine 2.0.
   * Cero cambio de comportamiento -- predict() sigue devolviendo `null`
   * hasta que isReady() sea true (ver predictionEngine.ts), esto solo
   * deja el tipo listo para cuando exista implementación real detrás.
   */
  successProbability: number | null
  competitionLevel: number | null
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
  /** Explicabilidad de segunda capa (Fase 6 / P0.2) -- ver EngineExplanation. */
  explanation: EngineExplanation
}
