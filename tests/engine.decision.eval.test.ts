/**
 * tests/engine.decision.eval.test.ts — Harness de evaluación continua
 * del Intelligence Engine (ARQUITECTURA_INTELIGENCIA_10_ANOS.md, Fase 14,
 * P0.5).
 *
 * Esto es la disciplina de ingeniería que pidió explícitamente el CEO:
 * "crea un conjunto fijo de casos de prueba y evalúa el motor
 * automáticamente tras cada cambio". No evalúa al LLM (eso necesitaría
 * 100 nichos con resultado real conocido, y niche_outcomes hoy no tiene
 * ese volumen — ver Fase 14 del documento para el harness de calibración
 * diferido, gate: niche_outcomes >= 50 filas). Esto evalúa la parte del
 * motor que SÍ es determinista hoy — Decision Engine + Confidence Engine
 * — con casos fijos de input/output conocido, sin llamar a ninguna API
 * de IA, sin coste, y ya corre en CI (.github/workflows/ci.yml) en cada
 * push/PR a main. Si un cambio futuro a decisionEngine.ts o confidence.ts
 * rompe la calibración esperada, este archivo falla el build ANTES de
 * llegar a producción — esa es la protección real que compra.
 */
import { describe, it, expect } from 'vitest'
import {
  computeConfidence,
  computeDataQuality,
  computeCoverage,
  computeDataFreshness,
  computeUncertainty,
  downgrade,
} from '../lib/services/engine/confidence'
import { decide, detectContradictions, computeSupportingEvidence } from '../lib/services/engine/decisionEngine'
import type { ReasoningContext, ScoreTrendPoint } from '../lib/services/engine/types'

/* ── Fixtures: contexto mínimo válido, sobreescribible por caso ────── */
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString()
}

function trend(points: (number | null)[]): ScoreTrendPoint[] {
  return points.map((opportunityScore, i) => ({
    recordedAt: daysAgo(points.length - i),
    opportunityScore,
    verdict: null,
  }))
}

function makeCtx(overrides: Partial<ReasoningContext> = {}): ReasoningContext {
  return {
    query: 'test',
    userId: 'user-1',
    geo: 'US',
    knownNiche: null,
    related: [],
    userProfile: null,
    marketTrend: [],
    prediction: null,
    confidence: computeConfidence(0),
    explanation: { usedSources: [], missingSources: [], contradictions: [], supportingEvidence: [] },
    ...overrides,
  }
}

/* ── Confidence Engine: calibración de niveles ──────────────────────── */
describe('computeConfidence — calibración de niveles (Fase 5)', () => {
  it('sin datos (dataPoints=0) siempre es sin_datos, nunca un nivel inventado', () => {
    expect(computeConfidence(0).level).toBe('sin_datos')
  })

  it('escalones de volumen: <3 baja, <10 media, >=10 alta', () => {
    expect(computeConfidence(1).level).toBe('baja')
    expect(computeConfidence(2).level).toBe('baja')
    expect(computeConfidence(3).level).toBe('media')
    expect(computeConfidence(9).level).toBe('media')
    expect(computeConfidence(10).level).toBe('alta')
    expect(computeConfidence(50).level).toBe('alta')
  })

  it('mucho volumen pero baja calidad (dataQuality<40) degrada un escalón, nunca hasta sin_datos', () => {
    const highVolumeLowQuality = computeConfidence(20, undefined, 20, 100)
    expect(highVolumeLowQuality.level).toBe('media') // alta -> media por downgrade
    expect(highVolumeLowQuality.level).not.toBe('sin_datos')
  })

  it('alta calidad (dataQuality>=40) no degrada el nivel', () => {
    const highVolumeHighQuality = computeConfidence(20, undefined, 80, 100)
    expect(highVolumeHighQuality.level).toBe('alta')
  })

  it('dataQuality null (menos de 2 snapshots) nunca degrada — "sin info" no es "mala calidad"', () => {
    const r = computeConfidence(20, undefined, null, 100)
    expect(r.level).toBe('alta')
  })
})

describe('downgrade — escalera de niveles', () => {
  it('alta baja a media, media baja a baja, baja se queda en baja (nunca sin_datos)', () => {
    expect(downgrade('alta')).toBe('media')
    expect(downgrade('media')).toBe('baja')
    expect(downgrade('baja')).toBe('baja')
  })
})

describe('computeDataQuality — consistencia del histórico (Fase 5)', () => {
  it('null con menos de 2 puntos — honesto, no se puede juzgar consistencia', () => {
    expect(computeDataQuality([])).toBeNull()
    expect(computeDataQuality([80])).toBeNull()
  })

  it('scores idénticos = calidad 100 (desviación 0)', () => {
    expect(computeDataQuality([80, 80, 80])).toBe(100)
  })

  it('scores muy dispersos = calidad baja', () => {
    const q = computeDataQuality([10, 90, 20, 85])!
    expect(q).toBeLessThan(50)
  })

  it('siempre en rango 0-100', () => {
    const q = computeDataQuality([0, 100, 0, 100])!
    expect(q).toBeGreaterThanOrEqual(0)
    expect(q).toBeLessThanOrEqual(100)
  })
})

describe('computeCoverage — Fase 5', () => {
  it('0 fuentes disponibles = 0%', () => {
    expect(computeCoverage({ knownNiche: false, related: false, userProfile: false, marketTrend: false, prediction: false })).toBe(0)
  })

  it('5 de 5 fuentes disponibles = 100%', () => {
    expect(computeCoverage({ knownNiche: true, related: true, userProfile: true, marketTrend: true, prediction: true })).toBe(100)
  })

  it('2 de 5 fuentes = 40%', () => {
    expect(computeCoverage({ knownNiche: true, related: true, userProfile: false, marketTrend: false, prediction: false })).toBe(40)
  })
})

describe('computeDataFreshness — Fase 5, P0.3', () => {
  it('null cuando no hay snapshot registrado', () => {
    expect(computeDataFreshness(null)).toBeNull()
    expect(computeDataFreshness(undefined)).toBeNull()
  })

  it('0 días para un snapshot de hoy', () => {
    expect(computeDataFreshness(new Date().toISOString())).toBe(0)
  })

  it('cuenta correctamente días pasados', () => {
    expect(computeDataFreshness(daysAgo(10))).toBe(10)
  })

  it('nunca negativo', () => {
    const future = new Date(Date.now() + 100000).toISOString()
    expect(computeDataFreshness(future)).toBeGreaterThanOrEqual(0)
  })
})

describe('computeUncertainty — Fase 5, P0.3', () => {
  it('cobertura y calidad máximas + volumen alto = incertidumbre mínima', () => {
    expect(computeUncertainty(100, 100, 20)).toBe(0)
  })

  it('sin cobertura ni puntos, calidad desconocida (null=neutral, no castiga de más) = incertidumbre alta pero no absoluta', () => {
    // certainty = 0*0.4 (coverage) + 50*0.4 (quality neutral) + 0*0.2 (volumen) = 20 -> uncertainty 80
    expect(computeUncertainty(null, 0, 0)).toBe(80)
  })

  it('0 cobertura + calidad mala conocida (0) + sin puntos = incertidumbre absoluta (100)', () => {
    expect(computeUncertainty(0, 0, 0)).toBe(100)
  })

  it('siempre en rango 0-100', () => {
    for (const [q, cov, dp] of [[0, 0, 0], [100, 100, 100], [50, 30, 5]] as const) {
      const u = computeUncertainty(q as any, cov, dp)
      expect(u).toBeGreaterThanOrEqual(0)
      expect(u).toBeLessThanOrEqual(100)
    }
  })
})

/* ── Decision Engine: casos fijos de contradicción/evidencia ───────── */
describe('detectContradictions — Fase 3/4, casos deterministas conocidos', () => {
  it('sin histórico (0 o 1 punto) nunca contradice — nada que contrastar', () => {
    expect(detectContradictions({ verdict: 'invertir' }, { marketTrend: [] })).toEqual([])
    expect(detectContradictions({ verdict: 'invertir' }, { marketTrend: trend([80]) })).toEqual([])
  })

  it('CASO CONOCIDO: verdict "invertir" con tendencia cayendo >=10 puntos = contradicción', () => {
    const ctx = { marketTrend: trend([80, 60]) } // cae 20
    const result = detectContradictions({ verdict: 'invertir' }, ctx)
    expect(result.length).toBeGreaterThan(0)
  })

  it('CASO CONOCIDO: verdict "evitar" con tendencia subiendo >=10 puntos = contradicción', () => {
    const ctx = { marketTrend: trend([40, 65]) } // sube 25
    const result = detectContradictions({ verdict: 'evitar' }, ctx)
    expect(result.length).toBeGreaterThan(0)
  })

  it('CASO CONOCIDO: verdict "invertir" con tendencia subiendo = SIN contradicción', () => {
    const ctx = { marketTrend: trend([40, 65]) }
    expect(detectContradictions({ verdict: 'invertir' }, ctx)).toEqual([])
  })

  it('CASO CONOCIDO: score actual muy alejado (>=30) del último snapshot = contradicción', () => {
    const ctx = { marketTrend: trend([50, 52]) } // último registrado: 52
    const result = detectContradictions({ verdict: 'esperar', opportunity_score: 90 }, ctx)
    expect(result.length).toBeGreaterThan(0)
  })

  it('CASO CONOCIDO: score coherente con el último snapshot = sin contradicción', () => {
    const ctx = { marketTrend: trend([50, 52]) }
    expect(detectContradictions({ verdict: 'esperar', opportunity_score: 55 }, ctx)).toEqual([])
  })
})

describe('computeSupportingEvidence — Fase 4, P0.2, contraparte positiva', () => {
  it('sin histórico = sin evidencia (nunca inventa respaldo)', () => {
    expect(computeSupportingEvidence({ verdict: 'invertir' }, { marketTrend: [], knownNiche: null })).toEqual([])
  })

  it('verdict "invertir" + tendencia subiendo >=10 = evidencia de respaldo', () => {
    const ctx = { marketTrend: trend([40, 65]), knownNiche: null }
    const result = computeSupportingEvidence({ verdict: 'invertir' }, ctx)
    expect(result.length).toBeGreaterThan(0)
  })

  it('verdict coincide con el último veredicto conocido del Graph = evidencia de respaldo', () => {
    const ctx = {
      marketTrend: [],
      knownNiche: { slug: 'x', name: 'X', timesAnalyzed: 5, latestOpportunityScore: 70, latestVerdict: 'invertir', tags: [] },
    }
    const result = computeSupportingEvidence({ verdict: 'invertir' }, ctx)
    expect(result.length).toBeGreaterThan(0)
  })

  it('un caso que contradice nunca aparece también como evidencia de respaldo (mutuamente excluyentes)', () => {
    const ctx = { marketTrend: trend([80, 60]), knownNiche: null } // cae 20
    const contradictions = detectContradictions({ verdict: 'invertir' }, ctx)
    const evidence = computeSupportingEvidence({ verdict: 'invertir' }, ctx)
    expect(contradictions.length).toBeGreaterThan(0)
    expect(evidence.length).toBe(0)
  })
})

/* ── decide(): integración del punto único de decisión ──────────────── */
describe('decide() — Decision Engine, punto único (Fase 3)', () => {
  it('sin contradicciones: la confianza final es la del contexto, sin degradar', () => {
    const ctx = makeCtx({ marketTrend: trend([40, 65]), confidence: computeConfidence(10) })
    const result = decide({ verdict: 'invertir' }, ctx)
    expect(result.confidence.level).toBe(ctx.confidence.level)
    expect(result.explanation.contradictions).toEqual([])
  })

  it('con contradicciones: el nivel se degrada un escalón y el motivo lo explica', () => {
    const ctx = makeCtx({ marketTrend: trend([80, 60]), confidence: computeConfidence(10) }) // dataPoints=10 -> alta
    const result = decide({ verdict: 'invertir' }, ctx)
    expect(result.confidence.level).toBe('media') // alta -> media
    expect(result.explanation.contradictions.length).toBeGreaterThan(0)
    expect(result.confidence.reasoning).toContain('contradicción')
  })

  it('la explicación final conserva usedSources/missingSources del contexto original', () => {
    const ctx = makeCtx({ explanation: { usedSources: ['a'], missingSources: ['b'], contradictions: [], supportingEvidence: [] } })
    const result = decide({ verdict: 'esperar' }, ctx)
    expect(result.explanation.usedSources).toEqual(['a'])
    expect(result.explanation.missingSources).toEqual(['b'])
  })

  it('nunca contradice y respalda al mismo tiempo para el mismo nicho', () => {
    const ctx = makeCtx({ marketTrend: trend([40, 65]), confidence: computeConfidence(10) })
    const result = decide({ verdict: 'invertir' }, ctx)
    expect(result.explanation.contradictions).toEqual([])
    expect(result.explanation.supportingEvidence.length).toBeGreaterThan(0)
  })
})
