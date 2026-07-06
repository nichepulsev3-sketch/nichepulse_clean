/**
 * lib/services/cache.ts — Fase 6 del roadmap de arquitectura.
 *
 * Caché en memoria con TTL para no volver a llamar a la IA (ni a
 * Supabase para lecturas repetidas) cuando ya existe un resultado
 * válido reciente. Genérico: cualquier parte de la app puede usarlo con
 * su propio namespace de claves.
 *
 * LIMITACIÓN HONESTA (documentada, no oculta): esto vive en la memoria
 * del proceso Node. En una sola instancia de Railway (que es como corre
 * hoy este proyecto) funciona perfectamente. Si el proyecto escala a
 * varias instancias en paralelo, cada una tendría su propia caché
 * independiente — mismo tipo de límite que ya tiene el rate limiter de
 * `middleware.ts`. El día que eso importe de verdad, este mismo archivo
 * es el único sitio que habría que cambiar (sustituir el Map interno
 * por Redis/Upstash) — el resto de la app solo conoce `cache.get/set`.
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

class TTLCache {
  private store = new Map<string, CacheEntry<any>>()
  private hits = 0
  private misses = 0

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) { this.misses++; return undefined }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      this.misses++
      return undefined
    }
    this.hits++
    return entry.value as T
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs })
  }

  invalidate(key: string): void {
    this.store.delete(key)
  }

  invalidatePrefix(prefix: string): void {
    for (const k of this.store.keys()) {
      if (k.startsWith(prefix)) this.store.delete(k)
    }
  }

  /** Limpia entradas ya expiradas (llamar periódicamente para no acumular memoria indefinidamente). */
  sweep(): number {
    const now = Date.now()
    let removed = 0
    for (const [k, v] of this.store.entries()) {
      if (now > v.expiresAt) { this.store.delete(k); removed++ }
    }
    return removed
  }

  stats() {
    const total = this.hits + this.misses
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Math.round((this.hits / total) * 100) / 100 : null,
    }
  }
}

export const cache = new TTLCache()

// Barrido periódico simple — evita que el Map crezca sin límite con
// claves ya expiradas que nadie volvió a pedir. No es un cron real, solo
// un setInterval de proceso (coherente con no requerir Redis todavía).
if (typeof setInterval !== 'undefined') {
  setInterval(() => cache.sweep(), 10 * 60 * 1000)
}

// TTLs por defecto, centralizados aquí para que quien lea el código sepa
// de un vistazo cuánto dura cada tipo de dato en caché.
export const CACHE_TTL = {
  aiSearch: 3 * 60 * 60 * 1000,   // 3h — resultados de searchNiches (motor de IA)
  dashboard: 60 * 1000,           // 1min — agregados ligeros de dashboard
  watchlist: 60 * 1000,           // 1min
  config: 60 * 1000,              // 1min — ya cubierto también por feature flags (60s)
} as const
