/**
 * Tests del parser JSON robusto de lib/ai.ts — Fase 12 del roadmap de
 * arquitectura. Esta función es la que más incidentes reales causó en
 * esta sesión (JSON truncado por max_tokens, comillas sin escapar
 * rompiendo el parseo con stop_reason:end_turn) — es la pieza con más
 * valor real en tener tests que la verifiquen sin depender de logs de
 * producción para descubrir una regresión.
 */
import { describe, it, expect } from 'vitest'
import { parse } from '../lib/ai'

const MINIMAL_NICHE = {
  name: 'Test Niche',
  opportunity_score: 80,
  confidence: 90,
  scores: {
    opportunity: { value: 80, reasons: ['motivo 1'] },
  },
  market_size: '$1B', margin: '50%', avg_ticket: '$50', competition: 'Baja',
  trend: '↑', trend_pct: 10, profit_score: 80, seasonality: 'Evergreen',
  time_to_results: '4 semanas', initial_investment: '$500', tags: ['test'],
  trend_source: 'organic', ad_channels: ['TikTok Ads'],
  executive_summary: 'resumen', conclusion: 'concl', strengths: ['a'],
  weaknesses: ['b'], opportunities: ['c'], risks: ['d'],
  demand_description: 'x', competition_description: 'y',
  target_audience: 'z', winning_angle: 'w', suppliers: [],
  keywords: ['k'], getting_started: ['g'], next_steps: ['n'],
  success_probability: 70, demand_level: 8, competition_level: 3,
  virality_level: 5, scalability_level: 6, final_recommendation: 'r',
  score_improvement: 's',
}

describe('parse — JSON válido', () => {
  it('parsea un array JSON limpio', () => {
    const text = JSON.stringify([MINIMAL_NICHE])
    const result = parse(text)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
    expect(result![0].name).toBe('Test Niche')
  })

  it('ignora fences de markdown (```json ... ```)', () => {
    const text = '```json\n' + JSON.stringify([MINIMAL_NICHE]) + '\n```'
    const result = parse(text)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(1)
  })

  it('tolera comas colgantes antes de cerrar array/objeto', () => {
    const raw = JSON.stringify([MINIMAL_NICHE])
    const withTrailingComma = raw.slice(0, -1) + ',]'
    const result = parse(withTrailingComma)
    expect(result).not.toBeNull()
  })
})

describe('parse — recuperación de truncado (stop_reason:max_tokens)', () => {
  it('recupera los nichos completos de un array cortado a mitad del último objeto', () => {
    const full = JSON.stringify([MINIMAL_NICHE, { ...MINIMAL_NICHE, name: 'Segundo Nicho' }])
    // Simula un corte a mitad del tercer nicho (nunca existió un tercero
    // completo — el array queda sin cerrar, como ocurre con max_tokens).
    const truncated = full.slice(0, -1) + ',{"name":"Tercero incompleto","opportunity_sc'
    const result = parse(truncated)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(2)
    expect(result!.map(r => r.name)).toEqual(['Test Niche', 'Segundo Nicho'])
  })
})

describe('parse — texto irrecuperable', () => {
  it('devuelve null si no hay ningún JSON válido ni reparable', () => {
    expect(parse('esto no es JSON en absoluto, solo prosa libre.')).toBeNull()
  })

  it('devuelve null con un string vacío', () => {
    expect(parse('')).toBeNull()
  })
})
