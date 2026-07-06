import { createBrowserClient } from '@supabase/ssr'
import { createClient }        from '@supabase/supabase-js'
import { env } from './env'

// Re-export types from centralized types file
export type { NicheResult, Profile, Plan, FavoriteNiche, SmartAlert, SearchHistory, OnboardingData, ScoreKey, ScoreCard, IntelligenceScores, Verdict, CompareVerdict } from './types'
export { PLAN_LIMITS, canSearch, searchesLeft, scoreColor, scoreLabel, scoreGradient, SCORE_META, SCORE_ORDER, VERDICT_META, scoreCardColor } from './types'

export function getSupabaseBrowser() {
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

export function getSupabaseAdmin() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
