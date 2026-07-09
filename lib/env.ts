/**
 * lib/env.ts — Validación centralizada de variables de entorno.
 *
 * Antes, cada archivo leía `process.env.X!` por su cuenta (13 sitios
 * distintos en 6 archivos). Si faltaba una variable en Railway, el fallo
 * aparecía como un crash confuso en tiempo de ejecución (p.ej.
 * "Cannot read property 'apiVersion' of undefined" dentro del SDK de
 * Stripe), sin decir jamás cuál variable faltaba.
 *
 * Este archivo centraliza esa lectura. Cada propiedad es un getter: se
 * valida solo en el momento en que algo la usa de verdad (no todas de
 * golpe al importar), así que el radio de impacto de una variable
 * faltante sigue siendo el mismo que antes (p.ej. si falta
 * STRIPE_SECRET_KEY, solo rompe las rutas que tocan Stripe, no
 * middleware ni el resto de la app) — lo único que cambia es que el
 * error ahora dice exactamente qué variable falta y dónde configurarla.
 *
 * Uso: import { env } from '@/lib/env'; env.NEXT_PUBLIC_SUPABASE_URL
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    throw new Error(
      `[env] Falta la variable de entorno obligatoria "${name}". ` +
      `Configúrala en Railway (o en .env.local en desarrollo) — la app no puede funcionar sin ella.`
    )
  }
  return v.trim()
}

function optional(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback
}

// Next.js solo sustituye `process.env.NEXT_PUBLIC_X` en el bundle del
// navegador cuando es un acceso ESTÁTICO y literal (análisis en build
// time). `process.env[name]` con un string dinámico NO se sustituye —
// en el navegador `process.env` no existe de verdad, así que esa lectura
// devuelve `undefined` y el getter lanzaba una excepción en cada render
// de cliente ("Application error: a client-side exception has ocurred").
// Por eso las 3 variables NEXT_PUBLIC_ que SÍ se leen desde código de
// cliente (getSupabaseBrowser, usado en dashboard/favorites/watchlist/
// login...) usan aquí acceso literal en vez del helper genérico.
function requiredPublic(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(
      `[env] Falta la variable de entorno obligatoria "${name}". ` +
      `Configúrala en Railway (o en .env.local en desarrollo) — la app no puede funcionar sin ella.`
    )
  }
  return value.trim()
}

export const env = {
  // ── Supabase ──────────────────────────────────────────────────
  get NEXT_PUBLIC_SUPABASE_URL()      { return requiredPublic('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL) },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return requiredPublic('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) },
  get SUPABASE_SERVICE_ROLE_KEY()     { return required('SUPABASE_SERVICE_ROLE_KEY') },

  // ── Stripe ────────────────────────────────────────────────────
  get STRIPE_SECRET_KEY()             { return required('STRIPE_SECRET_KEY') },
  get STRIPE_WEBHOOK_SECRET()         { return required('STRIPE_WEBHOOK_SECRET') },
  get STRIPE_PRICE_PRO_MONTHLY()      { return required('STRIPE_PRICE_PRO_MONTHLY') },
  get STRIPE_PRICE_AGENCY_MONTHLY()   { return required('STRIPE_PRICE_AGENCY_MONTHLY') },

  // ── IA (opcionales de forma individual: el motor ya hace fallback
  //    Claude → OpenAI; si faltan las dos, lib/ai.ts falla en la
  //    llamada real con un mensaje propio, no aquí) ────────────────
  get ANTHROPIC_API_KEY() { return optional('ANTHROPIC_API_KEY') },
  get OPENAI_API_KEY()    { return optional('OPENAI_API_KEY') },

  // ── Cron ──────────────────────────────────────────────────────
  get CRON_SECRET() { return optional('CRON_SECRET') },

  // ── Email (opcional — sin esto, sendEmail() ya hace no-op con warning) ──
  get RESEND_API_KEY() { return optional('RESEND_API_KEY') },
  get RESEND_FROM()    { return optional('RESEND_FROM', 'NichePulse <onboarding@resend.dev>') },

  // ── App ───────────────────────────────────────────────────────
  // También literal: aunque hoy solo se usa en código de servidor
  // (layout/sitemap/robots/checkout/cron), es NEXT_PUBLIC_ por convención
  // y podría acabar en un componente de cliente en el futuro — más seguro
  // dejarlo ya como acceso estático.
  get NEXT_PUBLIC_APP_URL() { return process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://nichepulse.app' },

  // ── Observabilidad (Fase 4) ─────────────────────────────────────
  // El DSN de Sentry NO es un secreto (está diseñado para ir en el
  // bundle del navegador — por eso es NEXT_PUBLIC_ y usa acceso estático,
  // igual que las variables de Supabase de arriba). Opcional: sin él,
  // sentry.*.config.ts simplemente no llama a Sentry.init() y la app
  // sigue funcionando exactamente igual que hoy.
  get NEXT_PUBLIC_SENTRY_DSN() { return process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || '' },

  // ── Analytics de producto (AUDITORIA_LANZAMIENTO_V1.md, Fase 9/11/15,
  // P0.9) ───────────────────────────────────────────────────────────
  // Sin ningún analytics de producto hoy, el equipo lanzaría a ciegas
  // sobre dónde abandona el usuario en el embudo registro → búsqueda →
  // guardar nicho -- exactamente lo que el propio criterio de "listo
  // para producción" del CEO pide evitar ("hay métricas para aprender
  // del uso real"). Plausible se eligió como opción recomendada por ser
  // ligero (un único script), sin cookies (coherente con la Política de
  // Privacidad recién añadida) y sin necesitar consentimiento de cookies
  // adicional. Opcional a propósito: sin esta variable, layout.tsx
  // simplemente no carga el script -- cero comportamiento nuevo hasta
  // que el equipo cree la cuenta y la configure en Railway.
  get NEXT_PUBLIC_PLAUSIBLE_DOMAIN() { return process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN?.trim() || '' },

  // ── Admin (panel de Motor propio, ver MOTOR_PROPIO_PROPUESTA.md) ──
  // Lista de emails con acceso a /admin/*, separados por coma. Opcional:
  // si no se configura en Railway, cae por defecto al email del CEO para
  // que el panel funcione sin pasos extra de configuración. Añadir más
  // administradores en el futuro es solo cambiar esta variable, sin tocar
  // código ni desplegar de nuevo.
  get ADMIN_EMAILS(): string[] {
    const raw = process.env.ADMIN_EMAILS?.trim() || 'solsona17@gmail.com'
    return raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  },
}
