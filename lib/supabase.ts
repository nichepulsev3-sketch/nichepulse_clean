import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// ── Tipos ────────────────────────────────────────────────────

export type NicheResult = {
  name: string
  score: number
  market_size: string
  margin: string
  competition: string
  trend: string
  trend_pct: number
  profit_score: number
  tags: string[]
  insights: string[]
  suppliers: { name: string; note: string }[]
  keywords: string[]
  ad_channels: string[]
  trend_source?: string
}

export type Profile = {
  id: string
  email: string
  full_name: string | null
  plan: 'free' | 'pro' | 'agency'
  searches_today: number
  searches_reset_at: string
  affiliate_code: string | null
  stripe_customer_id: string | null
}

// ── Cliente para componentes del navegador ('use client') ────

export function getSupabaseBrowser() {
  return createBrowserClient(URL, ANON)
}

// ── Cliente para componentes del servidor (API routes) ───────

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(URL, ANON, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(list) {
        try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) }
        catch {}
      },
    },
  })
}

// ── Cliente admin con privilegios (solo en API routes) ───────

export function getSupabaseAdmin() {
  return createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ── Ayudas de cuota ──────────────────────────────────────────

export const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  pro: 999999,
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
