/**
 * Tests de lógica pura de lib/types.ts — Fase 12 del roadmap de
 * arquitectura. Este archivo NO cubre el 80% del proyecto (no hay
 * infraestructura previa de tests ni tiempo para escribirlos todos de
 * golpe sin build real que los verifique); cubre las funciones puras
 * más críticas para el negocio: los límites de plan (qué determina si
 * un usuario puede seguir buscando) y el color/label de score que ve
 * el usuario en cada tarjeta.
 */
import { describe, it, expect } from 'vitest'
import { canSearch, searchesLeft, scoreColor, scoreLabel, scoreCardColor, PLAN_LIMITS } from '../lib/types'

describe('canSearch', () => {
  it('permite buscar si el usuario no alcanzó su límite diario', () => {
    expect(canSearch('free', 0)).toBe(true)
    expect(canSearch('free', 4)).toBe(true)
  })

  it('bloquea al alcanzar el límite diario del plan free', () => {
    expect(canSearch('free', 5)).toBe(false)
    expect(canSearch('free', 10)).toBe(false)
  })

  it('pro/agency tienen un límite tan alto que en la práctica no bloquea', () => {
    expect(canSearch('pro', 500)).toBe(true)
    expect(canSearch('agency', 500)).toBe(true)
  })
})

describe('searchesLeft', () => {
  it('resta correctamente las búsquedas usadas en el plan free', () => {
    expect(searchesLeft('free', 0)).toBe(5)
    expect(searchesLeft('free', 3)).toBe(2)
  })

  it('nunca devuelve un negativo aunque used supere el límite', () => {
    expect(searchesLeft('free', 999)).toBe(0)
  })

  it('pro/agency devuelven Infinity (límite > 100)', () => {
    expect(searchesLeft('pro', 50)).toBe(Infinity)
    expect(searchesLeft('agency', 50)).toBe(Infinity)
  })
})

describe('scoreColor / scoreLabel', () => {
  it('clasifica los umbrales correctamente', () => {
    expect(scoreLabel(90)).toBe('Excepcional')
    expect(scoreLabel(75)).toBe('Muy bueno')
    expect(scoreLabel(55)).toBe('Interesante')
    expect(scoreLabel(35)).toBe('Moderado')
    expect(scoreLabel(10)).toBe('Bajo')
  })

  it('devuelve colores hex válidos para cada rango', () => {
    for (const s of [95, 75, 55, 10]) {
      expect(scoreColor(s)).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('scoreCardColor (respeta el flag invert)', () => {
  it('para scores normales (demand): valor alto = color bueno', () => {
    expect(scoreCardColor('demand', 90)).toBe(scoreColor(90))
  })

  it('para scores invertidos (competition/saturation/risk): valor alto = color de "cuidado", no de "bueno"', () => {
    // competition:90 (mucha competencia, malo) debe pintarse como si
    // fuera un score normal de valor bajo (100-90=10 → rojo).
    expect(scoreCardColor('competition', 90)).toBe(scoreColor(10))
    expect(scoreCardColor('risk', 5)).toBe(scoreColor(95))
  })
})

describe('PLAN_LIMITS — invariantes de negocio', () => {
  it('free nunca debe tener más resultados o límites que pro/agency', () => {
    expect(PLAN_LIMITS.free.searches_per_day).toBeLessThanOrEqual(PLAN_LIMITS.pro.searches_per_day)
    expect(PLAN_LIMITS.free.max_results).toBeLessThanOrEqual(PLAN_LIMITS.pro.max_results)
  })

  it('free no debe tener acceso a features premium', () => {
    expect(PLAN_LIMITS.free.pdf_export).toBe(false)
    expect(PLAN_LIMITS.free.radar_access).toBe(false)
    expect(PLAN_LIMITS.free.comparator).toBe(false)
  })
})
