/**
 * instrumentation.ts — punto de entrada que Next.js 14 App Router llama
 * automáticamente al arrancar el proceso, antes de servir cualquier
 * request. Carga la configuración de Sentry correcta según el runtime
 * (Node vs Edge) — no hace falta ningún flag experimental en Next 14.2.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Captura errores no manejados en Server Components / Route Handlers que
// Next.js no deja llegar al try/catch normal (Fase 4: "Unhandled Errors").
export async function onRequestError(err: unknown, request: { path: string; method: string }) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureException(err, { extra: { path: request.path, method: request.method } })
}
