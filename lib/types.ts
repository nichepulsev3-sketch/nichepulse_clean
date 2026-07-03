/**
 * NichepulseV.3 — Tipos centralizados
 * Fuente única de verdad para todos los tipos del sistema.
 */

/* ── Planes ─────────────────────────────────────────────────────── */
export type Plan = 'free' | 'pro' | 'agency'

/* ── Señales por fuente ──────────────────────────────────────────── */
export type SignalSource = 'google' | 'tiktok' | 'amazon' | 'organic'

/* ── Signals breakdown para Opportunity Score (legacy, v2) ─────
 * Mantenido como opcional por compatibilidad con búsquedas guardadas
 * antes de la migración al Motor de Inteligencia (IntelligenceScores,
 * más abajo). Nada en la UI actual lee estos campos directamente. */
export interface OpportunitySignals {
  demand:       number  // 0-10: volumen de búsqueda / interés del consumidor
  competition:  number  // 0-10: 10 = baja competencia (invertido para que alto sea bueno)
  margin:       number  // 0-10: potencial de margen de beneficio
  trend:        number  // 0-10: velocidad de crecimiento
  seo:          number  // 0-10: potencial de posicionamiento orgánico
  tiktok:       number  // 0-10: presencia y viralidad en TikTok
  amazon:       number  // 0-10: oportunidad en Amazon/marketplaces
  virality:     number  // 0-10: capacidad de propagación viral
  scalability:  number  // 0-10: potencial de escalar el negocio
  saturation:   number  // 0-10: 10 = mercado muy poco saturado (invertido)
}

/* ── Motor de Inteligencia — Scores explicados ──────────────────
 * Sustituye el "un solo número" por 12 puntuaciones independientes,
 * cada una con sus propios motivos (2-4 frases cortas). Ninguna
 * puntuación debe mostrarse sin su explicación: es la diferencia
 * entre "mostrar datos" y "ayudar a decidir".
 * ──────────────────────────────────────────────────────────────── */
export type ScoreKey =
  | 'opportunity' | 'demand' | 'growth' | 'competition' | 'saturation'
  | 'profit' | 'advertising' | 'seo' | 'social' | 'trend' | 'stability' | 'risk'

export interface ScoreCard {
  value:   number    // 0-100
  reasons: string[]  // 2-4 motivos cortos y concretos que justifican el valor
}

export type IntelligenceScores = Record<ScoreKey, ScoreCard>

/* Metadatos de presentación por score. `invert:true` significa que un
 * valor ALTO es MALO (competencia, saturación, riesgo) — el color y la
 * lectura en pantalla deben invertirse para que "verde" siga significando
 * "bueno para el usuario" en todos los casos. */
export const SCORE_META: Record<ScoreKey, { label: string; icon: string; invert?: boolean; help: string }> = {
  opportunity: { label: 'Oportunidad', icon: '🎯', help: 'Puntuación compuesta: resume si merece la pena entrar en este nicho ahora.' },
  demand:      { label: 'Demanda',     icon: '📊', help: 'Volumen e interés real del consumidor por este producto/nicho.' },
  growth:      { label: 'Crecimiento', icon: '📈', help: 'Velocidad a la que está creciendo la demanda en el tiempo.' },
  competition: { label: 'Competencia', icon: '⚔️', invert: true, help: 'Cuántos vendedores/marcas compiten ya por este nicho. Alto = más difícil.' },
  saturation:  { label: 'Saturación',  icon: '🌊', invert: true, help: 'Qué tan lleno está el mercado de oferta similar. Alto = más saturado.' },
  profit:      { label: 'Margen',      icon: '💰', help: 'Potencial de margen de beneficio sobre precio de venta.' },
  advertising: { label: 'Publicidad',  icon: '📢', help: 'Eficiencia estimada de la inversión publicitaria (CPC, respuesta en ads).' },
  seo:         { label: 'SEO',         icon: '🔍', help: 'Potencial de posicionamiento orgánico y volumen de búsqueda.' },
  social:      { label: 'Social',      icon: '📱', help: 'Presencia, viralidad y engagement en redes sociales (TikTok, Reels...).' },
  trend:       { label: 'Tendencia',   icon: '🔥', help: 'Momentum actual: qué tan "caliente" está el nicho ahora mismo.' },
  stability:   { label: 'Estabilidad', icon: '🛡️', help: 'Qué tan predecible/duradera es la demanda (evergreen vs. moda pasajera).' },
  risk:        { label: 'Riesgo',      icon: '⚠️', invert: true, help: 'Riesgo combinado: logístico, legal, de devoluciones y de copia. Alto = más riesgo.' },
}

export const SCORE_ORDER: ScoreKey[] = [
  'opportunity','demand','growth','competition','saturation',
  'profit','advertising','seo','social','trend','stability','risk',
]

/* ── Veredicto accionable ────────────────────────────────────────
 * Cada nicho debe responder directamente "¿qué debería hacer ahora?"
 * en vez de dejar que el usuario interprete un número. */
export type Verdict = 'invertir' | 'esperar' | 'evitar'

export const VERDICT_META: Record<Verdict, { label: string; color: string; bg: string; icon: string }> = {
  invertir: { label: 'Invertir', color: '#2dd4bf', bg: 'rgba(45,212,191,0.14)', icon: '✅' },
  esperar:  { label: 'Esperar',  color: '#fbbf24', bg: 'rgba(251,191,36,0.14)', icon: '⏳' },
  evitar:   { label: 'Evitar',   color: '#f43f5e', bg: 'rgba(244,63,94,0.14)',  icon: '🚫' },
}

/* Color de un score individual respetando `invert` — así "verde" siempre
 * significa "bueno para el usuario", nunca "número alto" a secas. */
export function scoreCardColor(key: ScoreKey, value: number): string {
  const meta = SCORE_META[key]
  const v = meta.invert ? 100 - value : value
  if (v >= 75) return '#2dd4bf'
  if (v >= 55) return '#7c6fff'
  if (v >= 35) return '#fbbf24'
  return '#f43f5e'
}

/* ── Análisis de nicho enriquecido (Consultant Mode) ─────────── */
export interface NicheResult {
  // Core
  name:             string
  opportunity_score:number   // 0-100: nuestro score propietario
  confidence:       number   // 0-100: nivel de confianza en el análisis
  signals?:         OpportunitySignals   // legacy — opcional por compatibilidad con búsquedas antiguas

  // Motor de Inteligencia — 12 scores explicados + veredicto accionable
  scores?:          IntelligenceScores
  verdict?:         Verdict
  verdict_reason?:  string

  // Market data
  market_size:      string
  margin:           string
  avg_ticket:       string
  competition:      string
  trend:            string
  trend_pct:        number
  profit_score:     number   // Legacy: alias de opportunity_score
  seasonality:      string
  time_to_results:  string   // "2-4 semanas"
  initial_investment:string  // "$200-500"

  // Metadata
  tags:          string[]
  insights?:     string[]   // Legacy alias → usar strengths
  trend_source:  SignalSource
  ad_channels:   string[]

  // Consultant analysis
  executive_summary:    string   // 2-3 oraciones, visión ejecutiva
  conclusion:           string   // Veredicto final conciso
  strengths:            string[] // Puntos fuertes (SWOT)
  weaknesses:           string[] // Puntos débiles (SWOT)
  opportunities:        string[] // Oportunidades (SWOT)
  risks:                string[] // Riesgos/Amenazas (SWOT)

  // Signals narrative
  demand_description:   string
  competition_description: string

  // Business intel
  target_audience:      string
  winning_angle:        string
  suppliers:            SupplierInfo[]
  keywords:             string[]
  getting_started:      string[]
  next_steps:           string[]

  // Success metrics
  success_probability:  number   // 0-100
  demand_level:         number   // 0-10
  competition_level:    number   // 0-10
  virality_level:       number   // 0-10
  scalability_level:    number   // 0-10

  // Recommendation
  final_recommendation: string
  score_improvement:    string   // Cómo mejorar el score

  // Agency extras
  expert_verdict?:      string
  validated_roi?:       string
  agency_playbook?:     string[]
}

export interface SupplierInfo {
  name: string
  note: string
  url?:  string
  delivery_time?: string
  min_order?: string
  rating?: number
}

/* ── Perfil de usuario ───────────────────────────────────────────── */
export interface Profile {
  id:                  string
  email:               string
  full_name:           string | null
  avatar_url:          string | null
  plan:                Plan
  searches_today:      number
  searches_reset_at:   string
  affiliate_code:      string | null
  stripe_customer_id:  string | null
  onboarding_done:     boolean
  streak_days:         number
  total_searches:      number
  last_active_at:      string | null
  preferences:         UserPreferences | null
  created_at:          string
}

export interface UserPreferences {
  default_geo:    string
  default_plan:   Plan
  notifications:  boolean
  email_reports:  boolean
  theme:          'dark' | 'system'
  language:       string
}

/* ── Onboarding ──────────────────────────────────────────────────── */
export interface OnboardingData {
  goal:       'launch_first' | 'scale_existing' | 'research' | 'agency'
  budget:     'under_500' | '500_2000' | '2000_10k' | 'over_10k'
  experience: 'beginner' | 'intermediate' | 'expert'
  geo:        string
  market:     string
  business_type: 'solo' | 'small_team' | 'agency' | 'enterprise'
}

/* ── Favorito ────────────────────────────────────────────────────── */
export interface FavoriteNiche {
  id:          string
  user_id:     string
  niche:       NicheResult
  note:        string | null
  tags:        string[]
  collection:  string | null
  created_at:  string
}

/* ── Alerta inteligente ──────────────────────────────────────────── */
export interface SmartAlert {
  id:           string
  user_id:      string
  name:         string
  type:         'score_above' | 'growth_above' | 'tiktok_trend' | 'competition_drops' | 'new_niche'
  threshold:    number
  geo:          string
  keywords:     string[]
  active:       boolean
  created_at:   string
  last_triggered?: string
}

/* ── Historial de búsqueda ───────────────────────────────────────── */
export interface SearchHistory {
  id:         string
  user_id:    string
  query:      string
  results:    NicheResult[]
  filters:    Record<string, boolean>
  geo:        string
  plan_at_time: Plan
  created_at: string
}

/* ── Limites por plan ────────────────────────────────────────────── */
export const PLAN_LIMITS: Record<Plan, {
  searches_per_day: number
  max_results:      number
  pdf_export:       boolean
  radar_access:     boolean
  comparator:       boolean
  smart_alerts:     number
  favorites:        number
  ai_mode:         'basic' | 'pro' | 'expert'
}> = {
  free:   { searches_per_day:5,  max_results:3, pdf_export:false, radar_access:false, comparator:false, smart_alerts:0,  favorites:5,   ai_mode:'basic'  },
  pro:    { searches_per_day:999,max_results:6, pdf_export:true,  radar_access:true,  comparator:true,  smart_alerts:3,  favorites:100, ai_mode:'pro'    },
  agency: { searches_per_day:999,max_results:5, pdf_export:true,  radar_access:true,  comparator:true,  smart_alerts:20, favorites:999, ai_mode:'expert' },
}

export function canSearch(plan: Plan, used: number): boolean {
  return used < PLAN_LIMITS[plan].searches_per_day
}
export function searchesLeft(plan: Plan, used: number): number {
  const lim = PLAN_LIMITS[plan].searches_per_day
  return lim > 100 ? Infinity : Math.max(0, lim - used)
}

/* ── Score helpers ───────────────────────────────────────────────── */
export function scoreColor(s: number): string {
  if (s >= 86) return '#2dd4bf'  // teal: excepcional
  if (s >= 71) return '#7c6fff'  // brand: muy bueno
  if (s >= 51) return '#fbbf24'  // amber: interesante
  return '#f43f5e'               // red: cuidado
}
export function scoreLabel(s: number): string {
  if (s >= 86) return 'Excepcional'
  if (s >= 71) return 'Muy bueno'
  if (s >= 51) return 'Interesante'
  if (s >= 31) return 'Moderado'
  return 'Bajo'
}
export function scoreBg(s: number): string {
  if (s >= 86) return 'rgba(45,212,191,0.12)'
  if (s >= 71) return 'rgba(124,111,255,0.12)'
  if (s >= 51) return 'rgba(251,191,36,0.12)'
  return 'rgba(244,63,94,0.12)'
}
export function scoreGradient(s: number): string {
  if (s >= 86) return 'linear-gradient(90deg,#7c6fff,#2dd4bf)'
  if (s >= 71) return 'linear-gradient(90deg,#7c6fff,#f471b5)'
  if (s >= 51) return 'linear-gradient(90deg,#fbbf24,#a3e635)'
  return 'linear-gradient(90deg,#f43f5e,#f97316)'
}
