import { createBrowserClient } from '@supabase/ssr'
import { createClient }        from '@supabase/supabase-js'

// Re-export types from centralized types file
export type { NicheResult, Profile, Plan, FavoriteNiche, SmartAlert, SearchHistory, OnboardingData, ScoreKey, ScoreCard, IntelligenceScores, Verdict, CompareVerdict } from './types'
export { PLAN_LIMITS, canSearch, searchesLeft, scoreColor, scoreLabel, scoreGradient, SCORE_META, SCORE_ORDER, VERDICT_META, scoreCardColor } from './types'

const SUPA_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPA_SVC  = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function getSupabaseBrowser() {
  return createBrowserClient(SUPA_URL, SUPA_ANON)
}

export function getSupabaseAdmin() {
  return createClient(SUPA_URL, SUPA_SVC, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
