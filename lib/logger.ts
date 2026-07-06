/**
 * lib/logger.ts — Logging estructurado (Fase 7 del roadmap de arquitectura).
 *
 * Sustituye los `console.log/warn/error` sueltos (64 ocurrencias en 17
 * archivos antes de este cambio) por un formato consistente y parseable:
 * cada línea es JSON con { level, scope, msg, requestId?, ...meta, time }.
 * Esto permite, sin añadir ningún servicio de pago nuevo, filtrar y
 * buscar logs de Railway por campo (scope, requestId) en vez de por
 * texto libre — que es como se ha diagnosticado cada incidente de esta
 * sesión hasta ahora.
 *
 * requestId es opcional a propósito: no hay middleware de tracing todavía
 * (añadirlo requeriría tocar todas las rutas para propagarlo), así que
 * hoy se pasa a mano en los sitios que ya identifican una operación por
 * IDs propios (userId, event.id de Stripe, query de búsqueda, etc.) — es
 * un primer paso realista, no tracing distribuido completo.
 */

type Level = 'debug' | 'info' | 'warn' | 'error'

interface LogMeta {
  requestId?: string
  [key: string]: unknown
}

function emit(level: Level, scope: string, msg: string, meta?: LogMeta) {
  const line = {
    time: new Date().toISOString(),
    level,
    scope,
    msg,
    ...meta,
  }
  const serialized = JSON.stringify(line)
  if (level === 'error') console.error(serialized)
  else if (level === 'warn') console.warn(serialized)
  else console.log(serialized)
}

/**
 * Crea un logger con un "scope" fijo (normalmente el nombre del módulo o
 * ruta, ej. "webhook/stripe", "cron/opportunity-feed") para no repetirlo
 * en cada llamada.
 */
export function createLogger(scope: string) {
  return {
    debug: (msg: string, meta?: LogMeta) => emit('debug', scope, msg, meta),
    info:  (msg: string, meta?: LogMeta) => emit('info',  scope, msg, meta),
    warn:  (msg: string, meta?: LogMeta) => emit('warn',  scope, msg, meta),
    error: (msg: string, meta?: LogMeta) => emit('error', scope, msg, meta),
  }
}

export type Logger = ReturnType<typeof createLogger>
