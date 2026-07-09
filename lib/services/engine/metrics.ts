/**
 * lib/services/engine/metrics.ts — Metrics Layer (Módulo 18).
 *
 * NICHEPULSE_INTELLIGENCE_ENGINE_BLUEPRINT.md, capa 12 (Metrics Layer) +
 * sección "AI Quality": mide continuamente la calidad objetiva del
 * motor, para que "es más inteligente que ayer" sea un número, no una
 * opinión. El blueprint define 9 métricas (Prediction Accuracy,
 * Recommendation Accuracy, Confidence Calibration, Graph Coverage,
 * Knowledge Growth, Evidence Quality, Discovery Time, False
 * Positives/Negatives, Learning Velocity).
 *
 * De esas 9, solo 2 son calculables HOY sin inventar nada: Graph
 * Coverage y Knowledge Growth -- se derivan directamente de `niches`,
 * sin depender de volumen de `niche_outcomes` (todavía muy por debajo
 * del mínimo estadísticamente útil) ni de un registro de auditoría
 * persistente por decisión (P1, no existe todavía -- ver
 * ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 15). Las otras 7 se dejan
 * documentadas (ver comentario al final del archivo) con su condición
 * objetiva de activación -- ninguna se aproxima aquí con un cálculo
 * poco fiable solo por completitud.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'

const log = createLogger('services/engine/metrics')

export interface GraphCoverage {
  totalNiches: number
  withCategory: number
  withCategoryPct: number
  withTags: number
  withTagsPct: number
}

/**
 * % del Knowledge Graph que está realmente poblado, no solo creado.
 * `niches.category` existe en el schema desde la migración 011 pero
 * nunca se puebla (gap ya señalado en ARQUITECTURA_INTELIGENCIA_10_ANOS.md,
 * Fase 7) -- este número es la forma objetiva de verlo, en vez de
 * describirlo solo en prosa.
 */
export async function computeGraphCoverage(db: SupabaseClient): Promise<GraphCoverage> {
  try {
    const { count: total } = await db.from('niches').select('id', { count: 'exact', head: true })
    const { count: withCategory } = await db.from('niches').select('id', { count: 'exact', head: true }).not('category', 'is', null)
    const { count: withTags } = await db.from('niches').select('id', { count: 'exact', head: true }).not('tags', 'eq', '{}')

    const totalNiches = total ?? 0
    return {
      totalNiches,
      withCategory: withCategory ?? 0,
      withCategoryPct: totalNiches > 0 ? Math.round(((withCategory ?? 0) / totalNiches) * 100) : 0,
      withTags: withTags ?? 0,
      withTagsPct: totalNiches > 0 ? Math.round(((withTags ?? 0) / totalNiches) * 100) : 0,
    }
  } catch (err: any) {
    log.error('No se pudo calcular Graph Coverage', { error: err?.message ?? String(err) })
    return { totalNiches: 0, withCategory: 0, withCategoryPct: 0, withTags: 0, withTagsPct: 0 }
  }
}

export interface KnowledgeGrowth {
  windowDays: number
  newNichesThisWindow: number
  newNichesPreviousWindow: number
  /** null si la ventana anterior no tuvo ningún nicho nuevo -- honesto: "creció infinito%" no es un dato útil. */
  growthPct: number | null
}

/**
 * Ritmo de crecimiento del activo principal -- entidades nuevas
 * verificadas (nichos con al menos un análisis real) por unidad de
 * tiempo, comparando dos ventanas consecutivas. Esto NO cuenta
 * relaciones (tags compartidos) todavía porque no hay una tabla de
 * eventos de relación separada de `niches` -- se amplía el día que
 * merezca la pena separarla.
 */
export async function computeKnowledgeGrowth(db: SupabaseClient, windowDays = 30): Promise<KnowledgeGrowth> {
  try {
    const now = Date.now()
    const windowMs = windowDays * 24 * 60 * 60 * 1000
    const currentStart = new Date(now - windowMs).toISOString()
    const previousStart = new Date(now - 2 * windowMs).toISOString()

    const { count: newThisWindow } = await db
      .from('niches')
      .select('id', { count: 'exact', head: true })
      .gte('first_seen_at', currentStart)

    const { count: newPreviousWindow } = await db
      .from('niches')
      .select('id', { count: 'exact', head: true })
      .gte('first_seen_at', previousStart)
      .lt('first_seen_at', currentStart)

    const thisWindow = newThisWindow ?? 0
    const prevWindow = newPreviousWindow ?? 0

    return {
      windowDays,
      newNichesThisWindow: thisWindow,
      newNichesPreviousWindow: prevWindow,
      growthPct: prevWindow > 0 ? Math.round(((thisWindow - prevWindow) / prevWindow) * 100) : null,
    }
  } catch (err: any) {
    log.error('No se pudo calcular Knowledge Growth', { error: err?.message ?? String(err) })
    return { windowDays, newNichesThisWindow: 0, newNichesPreviousWindow: 0, growthPct: null }
  }
}

/**
 * Las 7 métricas restantes del blueprint, sus datos ya identificados
 * y su condición objetiva de activación -- documentado aquí (no
 * implementado) para que quien retome este archivo sepa exactamente
 * qué falta y por qué, en vez de tener que releer el blueprint entero:
 *
 * - Prediction Accuracy       -- requiere predictionEngine.predict() activo (isReady()=true, hoy stub).
 * - Recommendation Accuracy   -- requiere niche_outcomes con volumen suficiente para ser representativo.
 * - Confidence Calibration    -- requiere agrupar decisiones pasadas por nivel de confianza + su outcome real; hoy no hay registro persistente de decisiones (solo logs transitorios de decisionEngine.ts).
 * - Evidence Quality          -- misma dependencia: necesita el registro de auditoría persistente (ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 15, P1) para agregar evidencia por decisión histórica.
 * - Discovery Time            -- requiere instrumentar el momento en que una señal de mercado aparece en trends.ts vs. cuándo se le muestra a un usuario -- no existe ese emparejamiento hoy.
 * - False Positives/Negatives -- misma dependencia que Recommendation Accuracy.
 * - Learning Velocity         -- es la derivada de las anteriores mes a mes; no puede existir antes que ellas.
 */
