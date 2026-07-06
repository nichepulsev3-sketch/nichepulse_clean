/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
