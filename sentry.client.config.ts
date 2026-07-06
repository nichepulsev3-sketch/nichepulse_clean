/**
 * Sentry — configuración de cliente (navegador). Fase 4 del roadmap de
 * arquitectura. Se activa solo si NEXT_PUBLIC_SENTRY_DSN está configurado
 * en Railway; sin él, `enabled:false` y esto no hace absolutamente nada.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: process.env.NODE_ENV,
  // Performance monitoring: 10% de las transacciones — suficiente para
  // detectar regresiones de rendimiento sin disparar el coste/cuota.
  tracesSampleRate: 0.1,
  // Replay de sesión desactivado por defecto (coste de cuota y
  // privacidad de datos de usuario) — se puede subir explícitamente
  // desde el dashboard de Sentry si hace falta más adelante.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
})
