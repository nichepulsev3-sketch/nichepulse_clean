// AUDITORIA_LANZAMIENTO_V1.md, Fase 5/15 (P0.4): middleware.ts ya
// fijaba estas cabeceras, pero SOLO en páginas autenticadas -- su
// `matcher` ni siquiera incluye '/' o '/pricing', y el propio código
// de middleware.ts devuelve early antes de llegar a esas líneas para
// cualquier request a /api/*. Definirlas aquí, en next.config.js,
// las aplica de verdad a TODAS las rutas (landing, pricing, y cada
// respuesta de API) sin depender del matcher del middleware.
async function securityHeaders() {
  return [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  headers: securityHeaders,
}

// Sentry (Fase 4): el plugin de build (source maps + release tracking)
// solo se activa si hay credenciales de subida configuradas. Sin
// SENTRY_AUTH_TOKEN el build sigue funcionando exactamente igual que
// antes — nunca debe romper un despliegue por faltar esto.
const hasSentryBuildConfig = !!(process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT)

if (!hasSentryBuildConfig) {
  module.exports = nextConfig
} else {
  const { withSentryConfig } = require('@sentry/nextjs')
  module.exports = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
  })
}
