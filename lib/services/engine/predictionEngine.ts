/**
 * lib/services/engine/predictionEngine.ts — Módulo 6, Prediction Engine.
 *
 * Contrato listo desde ya (Fase A); implementación real bloqueada a
 * propósito hasta que haya datos reales que predecir (Fase D, Tier 2
 * de AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md sección 6). Mientras
 * MIN_LABELED_OUTCOMES no se alcance, isReady() siempre es false y
 * predict() siempre devuelve null — nunca un número inventado. Esto es
 * intencional, no una limitación temporal que se nos olvidó resolver:
 * es la misma regla de honestidad que ya se aplicó en scoringEngine.ts
 * y en MOTOR_PROPIO_PROPUESTA.md sobre el Camino B.
 *
 * Cuando isReady() empiece a devolver true (lo hará solo, sin tocar
 * este archivo desde fuera), el resto del sistema ya está preparado
 * para recibir predicciones reales sin ningún otro cambio — ReasoningLayer
 * y el registro (Módulo 16) ya llaman a esta función tal cual.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createLogger } from '@/lib/logger'
import type { Explained, Prediction } from './types'

const log = createLogger('services/engine/predictionEngine')

/** Umbral honesto (ver AI_INTELLIGENCE_ENGINE_ARCHITECTURE.md §6, confirmado por el CEO). */
export const MIN_LABELED_OUTCOMES = 300

export async function isReady(db: SupabaseClient): Promise<boolean> {
  try {
    const { count, error } = await db
      .from('niche_outcomes')
      .select('*', { count: 'exact', head: true })
      .neq('outcome', 'no_probado')
    if (error) throw error
    return (count ?? 0) >= MIN_LABELED_OUTCOMES
  } catch (err: any) {
    log.error('No se pudo comprobar si el Prediction Engine está listo', { error: err?.message ?? String(err) })
    return false
  }
}

/** Cuántos resultados reales faltan para que el Prediction Engine se active — para el panel de admin. */
export async function outcomesUntilReady(db: SupabaseClient): Promise<number> {
  try {
    const { count, error } = await db
      .from('niche_outcomes')
      .select('*', { count: 'exact', head: true })
      .neq('outcome', 'no_probado')
    if (error) throw error
    return Math.max(0, MIN_LABELED_OUTCOMES - (count ?? 0))
  } catch {
    return MIN_LABELED_OUTCOMES
  }
}

export async function predict(db: SupabaseClient, nicheId: string): Promise<Explained<Prediction> | null> {
  const ready = await isReady(db)
  if (!ready) return null // honesto: todavía no, no un número simulado

  // Implementación real cuando isReady() ya devuelva true. Se deja el
  // contrato listo a propósito, sin código funcional todavía — ver
  // regla de "No construir un módulo de mentira" en el documento de
  // arquitectura.
  log.warn('predict() llamado con isReady()=true pero sin implementación real todavía', { nicheId })
  return null
}
