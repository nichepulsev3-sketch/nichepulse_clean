/**
 * lib/services/featureFlags.ts — Fase 15 del roadmap de arquitectura.
 *
 * Primer archivo del proyecto que vive bajo lib/services/ siguiendo la
 * convención descrita en ARCHITECTURE.md: lógica de negocio pura,
 * desacoplada de si el flag vive en Supabase o en otro sitio el día de
 * mañana.
 *
 * Caché en memoria de 60s: los flags no cambian con la frecuencia
 * suficiente como para justificar una consulta a Supabase en cada
 * request, pero sí queremos que un cambio se refleje rápido sin
 * necesitar un redeploy.
 */
import { getSupabaseAdmin } from '../supabase'
import { createLogger } from '../logger'

const log = createLogger('featureFlags')
const CACHE_TTL_MS = 60_000

let cache: Map<string, boolean> | null = null
let cacheLoadedAt = 0

async function loadFlags(): Promise<Map<string, boolean>> {
  const db = getSupabaseAdmin()
  const { data, error } = await db.from('feature_flags').select('key, enabled')
  if (error) {
    // Si la tabla no existe todavía (migración 009 no ejecutada) o falla
    // la consulta, no rompemos la app: todos los flags se consideran
    // desactivados (comportamiento conservador, fail-safe).
    log.warn('No se pudieron cargar feature_flags, usando todo desactivado', { error: error.message })
    return new Map()
  }
  return new Map((data ?? []).map(f => [f.key, f.enabled]))
}

/**
 * Comprueba si una feature está activa. `fallback` se usa si la tabla
 * no existe todavía o el flag nunca se creó — así el helper es seguro de
 * llamar incluso antes de correr la migración 009.
 */
export async function isFeatureEnabled(key: string, fallback = false): Promise<boolean> {
  const now = Date.now()
  if (!cache || now - cacheLoadedAt > CACHE_TTL_MS) {
    cache = await loadFlags()
    cacheLoadedAt = now
  }
  return cache.has(key) ? cache.get(key)! : fallback
}

/** Fuerza recargar los flags en la próxima llamada (tras cambiar uno a mano). */
export function invalidateFeatureFlagsCache() {
  cache = null
}
