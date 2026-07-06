import { test, expect } from '@playwright/test'

/**
 * Recorridos E2E "esenciales" que no requieren un usuario logueado real.
 * Los flujos con auth de verdad (búsqueda, watchlist, facturación) se
 * documentan como pendientes hasta tener un usuario/proyecto Supabase de
 * test dedicado — ver playwright.config.ts.
 */

test('la landing carga y muestra el CTA principal', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/NichepulseV\.3/i)
})

test('la página de login es accesible sin sesión', async ({ page }) => {
  await page.goto('/auth/login')
  await expect(page.locator('body')).toBeVisible()
})

test('una ruta protegida redirige a login si no hay sesión', async ({ page }) => {
  await page.goto('/dashboard')
  await page.waitForURL(/\/auth\/login/, { timeout: 10_000 })
  expect(page.url()).toContain('/auth/login')
})

test('el health check responde con la forma esperada', async ({ request }) => {
  const res = await request.get('/api/health')
  const body = await res.json()
  expect(body).toHaveProperty('status')
  expect(body).toHaveProperty('database')
  expect(body).toHaveProperty('cron')
  expect([200, 503]).toContain(res.status())
})
