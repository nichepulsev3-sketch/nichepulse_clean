/**
 * Tests de lib/services/cache.ts (Fase 6) — lógica pura, sin red ni
 * Supabase, así que se puede testear con confianza total sin mocks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { cache } from '../lib/services/cache'

describe('TTLCache', () => {
  beforeEach(() => {
    // No hay reset público a propósito (la caché real es un singleton de
    // proceso) — invalidamos por prefijo para dejar cada test aislado.
    cache.invalidatePrefix('')
  })

  it('devuelve el valor mientras no expire', () => {
    cache.set('k1', { a: 1 }, 10_000)
    expect(cache.get('k1')).toEqual({ a: 1 })
  })

  it('devuelve undefined tras expirar el TTL', async () => {
    vi.useFakeTimers()
    cache.set('k2', 'valor', 100)
    vi.advanceTimersByTime(200)
    expect(cache.get('k2')).toBeUndefined()
    vi.useRealTimers()
  })

  it('invalidate() borra una clave concreta', () => {
    cache.set('k3', 1, 10_000)
    cache.invalidate('k3')
    expect(cache.get('k3')).toBeUndefined()
  })

  it('invalidatePrefix() borra solo las claves con ese prefijo', () => {
    cache.set('ai-search:pro:US:zapatillas:', [1], 10_000)
    cache.set('otro:namespace', [2], 10_000)
    cache.invalidatePrefix('ai-search:')
    expect(cache.get('ai-search:pro:US:zapatillas:')).toBeUndefined()
    expect(cache.get('otro:namespace')).toEqual([2])
  })

  it('stats() refleja hits y misses reales', () => {
    cache.set('k4', 1, 10_000)
    cache.get('k4')       // hit
    cache.get('no-existe') // miss
    const stats = cache.stats()
    expect(stats.hits).toBeGreaterThanOrEqual(1)
    expect(stats.misses).toBeGreaterThanOrEqual(1)
  })
})
