import { defineConfig, devices } from '@playwright/test'

/**
 * Configuración de Playwright (E2E) — Fase de testing del roadmap de
 * arquitectura. Cubre los recorridos esenciales que SÍ se pueden probar
 * sin credenciales reales (páginas públicas, redirecciones de auth).
 *
 * NO está enchufado al workflow de CI todavía: los recorridos con login
 * real (búsqueda, watchlist, facturación) necesitarían un usuario de
 * prueba y un proyecto de Supabase de test, que no existen en este
 * repositorio — añadirlos como secrets de GitHub Actions es la decisión
 * pendiente antes de activar esto en CI (ver README).
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
