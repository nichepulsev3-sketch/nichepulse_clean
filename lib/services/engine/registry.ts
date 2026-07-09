/**
 * lib/services/engine/registry.ts — Módulo 16, AI Operating System.
 *
 * No es una capa nueva que hace algo por sí misma: es el punto único
 * desde el que se puede llamar a cualquier módulo del motor sin saber
 * cómo está implementado por dentro. Esto es lo que evita que el motor
 * se convierta en un conjunto de funciones sueltas sin relación entre
 * sí — cada módulo nuevo (Tier 2, Tier 3) se añade aquí cuando exista,
 * con el mismo contrato `EngineModule` (ver types.ts), y todo lo que ya
 * lo usa sigue funcionando igual.
 *
 * Módulo 15 (Multi-Agent) NO se añade todavía a propósito — sigue
 * siendo solo el documento de contratos de agents.contracts.ts, tal
 * como pidió el CEO.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import * as nicheGraph from '@/lib/services/nicheGraph'
import * as userProfileService from '@/lib/services/userProfile'
import * as marketMemory from '@/lib/services/marketMemory'
import * as predictionEngine from './predictionEngine'
import * as confidenceModule from './confidence'
import * as reasoningLayer from './reasoningLayer'
import * as decisionEngineModule from './decisionEngine'

export const engine = {
  /** Módulo 1 — Knowledge Engine (lectura/escritura ya en nicheGraph.ts). */
  knowledge: {
    record: nicheGraph.recordNicheAnalysis,
    recordInteraction: nicheGraph.recordInteraction,
    getKnown: nicheGraph.getKnownNiche,
    getTop: nicheGraph.getTopNiches,
  },
  /** Módulo 2 — Niche Intelligence Graph. */
  graph: {
    getRelated: nicheGraph.getRelatedNiches,
    slugify: nicheGraph.slugify,
  },
  /** Módulo 3 — AI Memory (perfil de usuario). */
  aiMemory: {
    getUserProfile: userProfileService.getUserProfile,
  },
  /** Módulo 4 — Market Memory. */
  marketMemory: {
    getScoreTrend: marketMemory.getScoreTrend,
    getRisingNiches: marketMemory.getRisingNiches,
    getFallingNiches: marketMemory.getFallingNiches,
  },
  /** Módulo 6 — Prediction Engine (Tier 2, stub honesto hasta que isReady()=true). */
  prediction: {
    isReady: predictionEngine.isReady,
    predict: predictionEngine.predict,
    outcomesUntilReady: predictionEngine.outcomesUntilReady,
  },
  /** Módulo 7 — AI Reasoning Layer (orquestador). */
  reasoning: {
    buildContext: reasoningLayer.buildContext,
    toPromptBlock: reasoningLayer.contextToPromptBlock,
  },
  /** Módulo 9 — Recommendation Engine (versión Tier 1: solapamiento de tags). */
  recommend: {
    getRelated: nicheGraph.getRelatedNiches,
  },
  /** Módulo 12 — AI Confidence. */
  confidence: {
    compute: confidenceModule.computeConfidence,
  },
  /** Módulo 17 — Decision Engine (único punto de decisión del motor,
   *  ver ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 3). */
  decision: {
    decide: decisionEngineModule.decide,
    detectContradictions: decisionEngineModule.detectContradictions,
    computeSupportingEvidence: decisionEngineModule.computeSupportingEvidence,
  },
} as const

/**
 * Comprueba qué módulos Tier 2 siguen esperando datos y cuánto falta —
 * pensado para exponerse en /admin/motor-propio (panel ya existente),
 * no para el flujo de usuario.
 */
export async function getTier2Readiness(db: SupabaseClient) {
  const [predictionReady, outcomesLeft] = await Promise.all([
    predictionEngine.isReady(db),
    predictionEngine.outcomesUntilReady(db),
  ])
  return {
    predictionEngine: {
      ready: predictionReady,
      outcomesUntilReady: outcomesLeft,
      threshold: predictionEngine.MIN_LABELED_OUTCOMES,
    },
  }
}
