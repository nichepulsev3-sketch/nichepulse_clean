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
 */
import type { AIConfidence } from './types'

/**
 * Calcula el nivel de confianza a partir de cuántos hechos reales
 * sustentan una respuesta. Deliberadamente simple (umbrales, no un
 * modelo): la confianza es sobre CANTIDAD de evidencia real, no sobre
 * una estimación estadística que hoy no tenemos datos para hacer.
 */
export function computeConfidence(dataPoints: number, context?: string): AIConfidence {
  if (dataPoints <= 0) {
    return {
      level: 'sin_datos',
      dataPoints: 0,
      reasoning: context ?? 'Todavía no hay ningún dato propio (histórico, interacciones) para esta consulta.',
    }
  }
  if (dataPoints < 3) {
    return {
      level: 'baja',
      dataPoints,
      reasoning: context ?? `Solo ${dataPoints} dato(s) real(es) disponible(s) — suficiente para orientar, no para confiar del todo.`,
    }
  }
  if (dataPoints < 10) {
    return {
      level: 'media',
      dataPoints,
      reasoning: context ?? `${dataPoints} datos reales disponibles — base razonable, todavía no exhaustiva.`,
    }
  }
  return {
    level: 'alta',
    dataPoints,
    reasoning: context ?? `${dataPoints} datos reales disponibles — base sólida para esta respuesta.`,
  }
}
