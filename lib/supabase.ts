/**
 * lib/supabase.ts
 * ✅ SOLO importaciones seguras para cliente Y servidor.
 * ❌ SIN import de 'next/headers' — eso causa el error de build.
 */

import { createBrowserClient } from '@supabase/ssr'
import { createClient }         from '@supabase/supabase-js'

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPA_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Tipos ────────────────────────────────────────────────────

export type NicheResult = {
  name:         string
  score:        number
  market_size:  string
  margin:       string
  competition:  string
  trend:        string
  trend_pct:    number
  profit_score: number
  tags:         string[]
  insights:     string[]
  suppliers:    { name: string; note: string }[]
  keywords:     string[]
  ad_channels:  string[]
  trend_source?: string
}

export type Profile = {
  id:                  string
  email:               string
  full_name:           string | null
  plan:                'free' | 'pro' | 'agency'
  searches_today:      number
  searches_reset_at:   string
  affiliate_code:      string | null
  stripe_customer_id:  string | null
}

// ── Cliente para componentes del navegador ('use client') ────
// Llama a esta función dentro de tus componentes cliente.

export function getSupabaseBrowser() {
  return createBrowserClient(SUPA_URL, SUPA_ANON)
}

// ── Cliente admin (solo para API routes del servidor) ────────
// NUNCA lo importes en un componente 'use client'.

export function getSupabaseAdmin() {
  return createClient(SUPA_URL, SUPA_SVC, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Helpers de cuota ─────────────────────────────────────────

export const PLAN_LIMITS: Record<string, number> = {
  free:   5,
  pro:    999999,
  agency: 999999,
}

export function canSearch(plan: string, used: number): boolean {
  return used < (PLAN_LIMITS[plan] ?? 5)
}

export function searchesLeft(plan: string, used: number): number {
  const limit = PLAN_LIMITS[plan] ?? 5
  if (limit > 9000) return Infinity
  return Math.max(0, limit - used)
}
