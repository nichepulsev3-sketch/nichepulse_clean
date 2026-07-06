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
 *
 * Fase 4 (Sentry): cada `.error()` se reporta también a Sentry, no solo
 * a la consola/Railway — "no dejar console.error sin registrar". El
 * import de @sentry/nextjs es seguro incluso sin DSN configurado: el SDK
 * no hace nada si `Sentry.init()` nunca se llamó (ver sentry.*.config.ts),
 * así que este archivo funciona igual antes y después de que exista el DSN.
 */
import * as Sentry from '@sentry/nextjs'

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

  if (level === 'error') {
    try {
      Sentry.captureMessage(`[${scope}] ${msg}`, { level: 'error', extra: meta })
    } catch {
      // Nunca dejamos que un fallo reportando a Sentry rompa el log real.
    }
  }
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
