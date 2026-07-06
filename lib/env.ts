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

export const env = {
  // ── Supabase ──────────────────────────────────────────────────
  get NEXT_PUBLIC_SUPABASE_URL()      { return required('NEXT_PUBLIC_SUPABASE_URL') },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() { return required('NEXT_PUBLIC_SUPABASE_ANON_KEY') },
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
  get NEXT_PUBLIC_APP_URL() { return optional('NEXT_PUBLIC_APP_URL', 'https://nichepulse.app') },
}
