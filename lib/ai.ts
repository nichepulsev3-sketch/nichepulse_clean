/**
 * NichepulseV.3 — Motor Multi-IA en modo Consultor
 * Analiza nichos como un consultor senior de ecommerce:
 * executive summary, SWOT, Opportunity Score propio y plan de acción.
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult, Plan, SignalSource } from './types'

const anthropic    = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim(), maxRetries: 0 })
const openaiClient = process.env.OPENAI_API_KEY?.trim()
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), maxRetries: 0 })
  : null

/* ── Configuración de modelos por plan ─────────────────────────── */
const AI_CONFIG = {
  free:   { claude: 'claude-haiku-4-5-20251001', openai: null,         tokens: 2500 },
  pro:    { claude: 'claude-haiku-4-5-20251001', openai: 'gpt-4o-mini',tokens: 5000 },
  agency: { claude: 'claude-haiku-4-5-20251001', openai: 'gpt-4o-mini',tokens: 6000 },
}

const TIMEOUT = { claude: 28000, openai: 24000, retry: 30000 }

/* ── Opportunity Score Calculator ──────────────────────────────── */
function calculateOpportunityScore(signals: any): number {
  if (!signals || typeof signals !== 'object') return 70
  const weights = {
    demand:      0.20,
    competition: 0.18,  // high = bueno (baja competencia)
    margin:      0.15,
    trend:       0.12,
    tiktok:      0.10,
    seo:         0.08,
    amazon:      0.07,
    virality:    0.05,
    scalability: 0.03,
    saturation:  0.02,  // high = bueno (baja saturación)
  }
  let score = 0
  let totalWeight = 0
  for (const [key, weight] of Object.entries(weights)) {
    const val = signals[key] ?? 5
    const normalized = Math.max(0, Math.min(10, Number(val)))
    score += normalized * 10 * weight
    totalWeight += weight
  }
  return Math.round(score / totalWeight)
}

/* ── Prompt del sistema ─────────────────────────────────────────── */
function buildSystem(plan: Plan, trends: string): string {
  const isAgency = plan === 'agency'
  const isPro    = plan === 'pro' || isAgency

  const expertise = isAgency
    ? 'Eres un equipo de élite de 5 consultores senior de ecommerce y dropshipping con 15 años validando negocios millonarios. Tus análisis son los más profundos y precisos del mercado.'
    : isPro
    ? 'Eres un consultor senior de dropshipping y ecommerce con 10 años de experiencia, especializado en identificar nichos rentables con datos de mercado reales.'
    : 'Eres NichepulseV.3 AI, motor de análisis de nichos dropshipping con datos de mercado en tiempo real.'

  const format = `RESPONDE EXCLUSIVAMENTE CON UN ARRAY JSON VÁLIDO. Sin texto fuera del array. Sin markdown. Sin explicaciones.

Estructura OBLIGATORIA por nicho (todos los campos requeridos):
{
  "name": "nombre específico del nicho",
  "opportunity_score": 82,
  "confidence": 88,
  "signals": {
    "demand": 8, "competition": 7, "margin": 8, "trend": 9,
    "seo": 6, "tiktok": 8, "amazon": 7, "virality": 7,
    "scalability": 8, "saturation": 6
  },
  "market_size": "$2.4B",
  "margin": "52-68%",
  "avg_ticket": "$45-85",
  "competition": "Baja-Media",
  "trend": "↑ 47% YoY",
  "trend_pct": 47,
  "profit_score": 82,
  "seasonality": "Evergreen con pico diciembre-enero",
  "time_to_results": "3-6 semanas",
  "initial_investment": "$300-800",
  "tags": ["trending", "low_comp"],
  "trend_source": "tiktok",
  "ad_channels": ["TikTok Ads", "Meta Ads", "Google Shopping"],
  "executive_summary": "2-3 oraciones de visión ejecutiva con datos concretos sobre por qué este nicho es una oportunidad ahora mismo.",
  "conclusion": "Veredicto final en 1 oración directa y accionable.",
  "strengths": ["Fortaleza específica 1 con dato", "Fortaleza 2", "Fortaleza 3"],
  "weaknesses": ["Debilidad realista 1", "Debilidad 2"],
  "opportunities": ["Oportunidad concreta 1", "Oportunidad 2"],
  "risks": ["Riesgo específico 1", "Riesgo 2"],
  "demand_description": "Descripción del nivel de demanda con datos.",
  "competition_description": "Descripción del nivel de competencia.",
  "target_audience": "Perfil exacto: edad, nivel económico, plataformas, motivación de compra.",
  "winning_angle": "Propuesta de valor única basada en vacío real del mercado.",
  "suppliers": [
    {"name": "AliExpress", "note": "catálogo amplio, 15-30 días", "delivery_time": "15-30 días", "rating": 4.2},
    {"name": "Spocket", "note": "proveedores EU, 3-7 días", "delivery_time": "3-7 días", "rating": 4.6}
  ],
  "keywords": ["keyword volumen alto", "keyword long-tail", "keyword buyer intent", "keyword problema"],
  "getting_started": ["Semana 1: acción específica con presupuesto", "Semana 2-3: validación con métricas", "Mes 1: escala con KPIs"],
  "next_steps": ["Acción inmediata hoy", "Esta semana", "Este mes"],
  "success_probability": 76,
  "demand_level": 8,
  "competition_level": 3,
  "virality_level": 7,
  "scalability_level": 8,
  "final_recommendation": "Recomendación directa y accionable sobre si entrar y cómo.",
  "score_improvement": "Qué haría subir el score de este nicho y cuándo."${isAgency ? `,
  "expert_verdict": "Veredicto experto: análisis profundo de por qué este nicho tiene alta probabilidad de éxito AHORA.",
  "validated_roi": "ROI calculado en 90 días con inversión de $500-1000, condiciones y probabilidad.",
  "agency_playbook": ["Paso estratégico 1 para agencia", "Paso 2", "Paso 3"]` : ''}
}

REGLAS CRÍTICAS:
- Comillas dobles siempre. Sin saltos de línea dentro de strings.
- Datos REALES y VERIFICADOS, nunca genéricos.
- opportunity_score: calcula con precisión usando signals (0-100).
- executive_summary: máximo 60 palabras, con datos concretos.
- insights/strengths/weaknesses: máximo 15 palabras cada uno.
- getting_started: específico con semanas y presupuesto.${trends ? `\nSEÑALES EN VIVO (prioriza estos nichos):\n${trends}` : ''}`

  return `${expertise}\n${format}`
}

/* ── Parser JSON robusto ────────────────────────────────────────── */
function parse(text: string): NicheResult[] | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const attempts = [
    () => JSON.parse(clean),
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1)) },
    () => JSON.parse(clean.replace(/,(\s*[}\]])/g,'$1')),
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1).replace(/,(\s*[}\]])/g,'$1')) },
    () => {
      const s=clean.indexOf('['); if(s<0) return null
      const partial=s>=0&&clean.lastIndexOf(']')>s ? clean.slice(s,clean.lastIndexOf(']')+1) : clean.slice(s)
      const lg=partial.lastIndexOf('},'); if(lg>0) return JSON.parse(partial.slice(0,lg+1)+']')
    },
    () => { const m=clean.match(/\{[\s\S]*\}/); if(m){const o=JSON.parse(m[0]); return o.niches??o.results??o.data??[o]} },
  ]
  for (const attempt of attempts) {
    try {
      const r = attempt()
      if (!r) continue
      const arr = Array.isArray(r) ? r : [r]
      if (arr.length > 0) return arr.map(enrichResult) as NicheResult[]
    } catch {}
  }
  return null
}

/* ── Enriquecer resultado con campos derivados ──────────────────── */
function enrichResult(raw: any): NicheResult {
  // Calcular opportunity_score si no viene o es genérico
  if (!raw.opportunity_score || raw.opportunity_score === raw.profit_score) {
    raw.opportunity_score = calculateOpportunityScore(raw.signals) || raw.score || 70
  }
  // Asegurar backward compat
  raw.profit_score  = raw.profit_score  || raw.opportunity_score
  raw.score         = raw.opportunity_score
  raw.confidence    = raw.confidence    || Math.round(raw.opportunity_score * 0.9 + Math.random() * 10)
  raw.insights      = raw.insights      || raw.strengths?.slice(0,3) || []
  raw.trend_source  = raw.trend_source  || 'organic'

  // Asegurar signals
  if (!raw.signals || typeof raw.signals !== 'object') {
    raw.signals = {
      demand: raw.demand_level || 7, competition: 10-(raw.competition_level||5),
      margin: 7, trend: Math.min(10, Math.floor((raw.trend_pct||30)/10)),
      seo: 6, tiktok: 7, amazon: 6, virality: raw.virality_level || 6,
      scalability: raw.scalability_level || 7, saturation: 6,
    }
  }

  return raw as NicheResult
}

/* ── Detección robusta de timeouts ────────────────────────────────
 * Algunas versiones/errores del SDK de Anthropic/OpenAI no rechazan
 * con un DOMException `name === 'AbortError'` cuando el AbortController
 * dispara — a veces envuelven el abort en su propio tipo de error
 * (p.ej. APIConnectionError) cuyo `.message` es "Request was aborted."
 * sin que `.name` lo refleje. Comprobamos ambas señales para no dejar
 * pasar timeouts reales como errores genéricos sin diagnosticar. */
function isAbortError(err: any): boolean {
  return err?.name === 'AbortError' || /aborted|abort/i.test(err?.message ?? '')
}

/* ── Llamadas individuales con timeout ──────────────────────────── */
async function callClaude(model: string, system: string, prompt: string, maxTokens: number): Promise<NicheResult[]> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT.claude)
  try {
    const res = await anthropic.messages.create(
      { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const text = res.content.filter(b=>b.type==='text').map(b=>(b as any).text).join('')
    const parsed = parse(text)
    if (!parsed) { console.error(`[claude] ${Date.now()-start}ms → JSON inválido:`, text.slice(0,300)); throw new Error('Claude: JSON inválido') }
    console.log(`[claude:${model.split('-')[1]}] ✅ ${Date.now()-start}ms → ${parsed.length} nichos`)
    return parsed
  } catch (err: any) {
    clearTimeout(timer)
    // Log completo para diagnóstico (status HTTP, tipo de error) — el mensaje
    // genérico que ve el usuario no debe ser la única pista que quede en logs.
    console.error(`[claude] ❌ ${Date.now()-start}ms → status:${err?.status ?? '?'} name:${err?.name ?? '?'} msg:${err?.message ?? err}`)
    if (isAbortError(err)) throw new Error(`Claude: timeout (${TIMEOUT.claude/1000}s)`)
    if (err?.status === 401) throw new Error('Claude: 401 API key inválida')
    if (err?.status === 402) throw new Error('Claude: 402 sin crédito')
    if (err?.status === 429) throw new Error('Claude: 429 rate limit')
    throw err
  }
}

async function callOpenAI(model: string, system: string, prompt: string): Promise<NicheResult[]> {
  if (!openaiClient) throw new Error('OpenAI no configurado')
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT.openai)
  try {
    const res = await openaiClient.chat.completions.create(
      { model, max_tokens: 3500, temperature: 0.2, messages: [
        { role: 'system', content: `${system}\nResponde SIEMPRE con un array JSON válido y nada más.` },
        { role: 'user', content: prompt },
      ]},
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const raw = res.choices[0]?.message?.content ?? ''
    const parsed = parse(raw)
    if (!parsed) throw new Error('OpenAI: JSON inválido')
    console.log(`[openai:${model}] ✅ ${Date.now()-start}ms → ${parsed.length} nichos`)
    return parsed
  } catch (err: any) {
    clearTimeout(timer)
    if (isAbortError(err)) throw new Error('OpenAI: timeout')
    if (err?.status===429 || err?.message?.includes('quota') || err?.message?.includes('exceeded')) {
      console.warn(`[openai] ⚠️ Sin crédito (429)`)
      throw new Error('OpenAI: sin crédito')
    }
    if (err?.message?.includes('Connection') || err?.cause) throw new Error('OpenAI: error de conexión')
    throw err
  }
}

/* ── Motor de carrera paralela ──────────────────────────────────── */
async function raceAI(promises: Promise<NicheResult[]>[]): Promise<NicheResult[]> {
  const safe = promises.map(p => p.catch(e => { console.warn('[race]', e?.message); return null }))
  return new Promise((resolve, reject) => {
    let settled = 0, resolved = false
    safe.forEach(p => {
      p.then(r => {
        settled++
        if (r && r.length > 0 && !resolved) { resolved = true; resolve(r) }
        else if (settled === safe.length && !resolved) reject(new Error('Todas las IAs fallaron'))
      })
    })
  })
}

/* ── Función principal ──────────────────────────────────────────── */
export async function searchNiches(
  query: string, filters: Record<string,boolean>, plan: Plan, geo = 'US'
): Promise<NicheResult[]> {
  const cfg = AI_CONFIG[plan] ?? AI_CONFIG.pro
  const isAgency   = plan === 'agency'
  const maxResults = plan === 'free' ? 3 : isAgency ? 5 : 6

  // Señales en vivo (timeout 1.5s máximo)
  let trendContext = ''
  try {
    const r = await Promise.race([getTrends(geo), new Promise<null>(r=>setTimeout(()=>r(null),1500))])
    if (r) trendContext = buildTrendContext(r)
  } catch {}

  const filterDesc = Object.entries(filters).filter(([,v])=>v).map(([k])=>k).join(', ')
  const system     = buildSystem(plan, trendContext)
  const userPrompt = `Consulta del cliente: "${query}"
Filtros: ${filterDesc || 'ninguno'} | País/Mercado: ${geo} | Nichos a analizar: ${maxResults} | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency ? 'CLIENTE AGENCY: máxima profundidad, datos verificados, playbook incluido.' : ''}
Devuelve SOLO el array JSON con ${maxResults} nichos ordenados por opportunity_score DESC. Análisis de nivel consultor.`

  const promises: Promise<NicheResult[]>[] = [
    callClaude(cfg.claude, system, userPrompt, cfg.tokens),
  ]
  if (cfg.openai && openaiClient) {
    promises.push(callOpenAI(cfg.openai, system, userPrompt))
  }

  console.log(`[multi-ia] plan:${plan} | ${promises.length} IAs | geo:${geo}`)

  try {
    const results = await raceAI(promises)
    return results.slice(0, maxResults)
  } catch {
    console.warn('[multi-ia] Reintentando con Claude...')
    try {
      const retry = await callClaude(cfg.claude, system, userPrompt, cfg.tokens)
      return retry.slice(0, maxResults)
    } catch (err: any) {
      // Log completo (no solo el mensaje reducido al usuario) para que el
      // error real quede en los logs de Railway/Vercel y se pueda diagnosticar
      // sin tener que reproducirlo a ciegas.
      console.error('[multi-ia] ❌ Reintento con Claude también falló:', err?.message ?? err)
      const msg = err?.message ?? ''
      if (msg.includes('401')) throw new Error('ANTHROPIC_API_KEY inválida. Compruébala en Railway → Variables.')
      if (msg.includes('429')) throw new Error('Límite de IA alcanzado. Espera 1 minuto.')
      if (msg.includes('402') || msg.includes('credit')) throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
      if (msg.includes('timeout')) throw new Error(`El motor de IA tardó demasiado en responder (>${TIMEOUT.claude/1000}s). Puede ser un problema temporal de conexión con Anthropic — inténtalo de nuevo en un minuto.`)
      throw new Error(`Error en el motor Multi-IA: ${msg || 'desconocido'}. Inténtalo de nuevo.`)
    }
  }
}
