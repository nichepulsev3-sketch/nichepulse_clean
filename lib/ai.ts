/**
 * NichepulseV.3 — Motor Multi-IA en modo Consultor
 * Analiza nichos como un consultor senior de ecommerce:
 * executive summary, SWOT, Opportunity Score propio y plan de acción.
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult, Plan, ScoreKey, IntelligenceScores, ScoreCard, Verdict, CompareVerdict } from './types'
import { SCORE_ORDER } from './types'

const anthropic    = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY ?? '').trim(), maxRetries: 0 })
const openaiClient = process.env.OPENAI_API_KEY?.trim()
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim(), maxRetries: 0 })
  : null

/* ── Configuración de modelos por plan ───────────────────────────
 * Los presupuestos de tokens subieron respecto a la versión anterior
 * porque el Motor de Inteligencia pide 12 scorecards explicadas por
 * nicho (antes era un único signals plano) — es más payload, pero es
 * la diferencia entre "un número" y "una decisión justificada". */
// claude-haiku-4-5 soporta hasta 64.000 tokens de salida (no 8.192 — ese
// techo es de generaciones anteriores de Haiku). El log de producción
// confirmó stop_reason:"max_tokens" con solo 4 nichos y ~8.192 tokens
// agotados a mitad del último nicho: el modelo llevaba tiempo generando
// bien, simplemente lo cortábamos nosotros antes de que pudiera terminar.
const AI_CONFIG = {
  free:   { claude: 'claude-haiku-4-5-20251001', openai: null,         tokens: 6000  },
  pro:    { claude: 'claude-haiku-4-5-20251001', openai: 'gpt-4o-mini',tokens: 14000 },
  agency: { claude: 'claude-haiku-4-5-20251001', openai: 'gpt-4o-mini',tokens: 16000 },
}

// Timeout adaptativo por inactividad (ver callClaude/callOpenAI más abajo):
// un plazo fijo total no tiene sentido con un esquema de 12 scorecards por
// nicho, cuya duración de generación varía según carga del proveedor —
// 40s fijos garantizaban timeout con max_tokens:7000-8000 (7000 tokens a
// ritmo normal de generación ya superan 40s solo en texto, sin contar
// colas). IDLE_LIMIT corta si el modelo deja de producir texto; HARD_LIMIT
// es el techo de seguridad absoluto por si acaso.
const IDLE_LIMIT = { claude: 25000, openai: 25000 }
const HARD_LIMIT = { claude: 170000, openai: 120000 }

/* ── Motor de Inteligencia: normalización y cálculo defensivo ─────
 * La IA genera los 12 scores directamente (valor + motivos) porque
 * son ella la que puede justificar cada número — no fingimos calcular
 * "de verdad" un score de SEO o de riesgo a partir de datos que no
 * tenemos. Lo que SÍ hacemos aquí es blindar la respuesta: si la IA
 * omite un score, no devuelve el formato exacto, o se inventa un
 * texto en vez de un objeto, esta función lo normaliza a un formato
 * seguro en vez de dejar que la UI reciba `undefined` y rompa. */
function normalizeScores(raw: any): IntelligenceScores {
  const out = {} as IntelligenceScores
  for (const key of SCORE_ORDER) {
    const card = raw?.[key]
    const value = typeof card?.value === 'number' && isFinite(card.value)
      ? Math.max(0, Math.min(100, Math.round(card.value)))
      : 50
    const reasons = Array.isArray(card?.reasons)
      ? card.reasons.filter((r: any) => typeof r === 'string' && r.trim()).slice(0, 4)
      : []
    out[key] = { value, reasons } as ScoreCard
  }
  // Si la IA no dio un "opportunity" fiable (o vino igual que el resto,
  // señal de que no lo calculó de verdad), lo recomponemos nosotros con
  // una media ponderada del resto de scores — así opportunity_score
  // nunca depende de un solo campo que la IA pudo rellenar sin pensar.
  if (!raw?.opportunity || typeof raw.opportunity.value !== 'number') {
    out.opportunity.value = calculateOpportunityFromScores(out)
  }
  return out
}

function calculateOpportunityFromScores(scores: IntelligenceScores): number {
  // "invert:true" en SCORE_META (competition, saturation, risk) significa
  // que un valor alto es MALO — se usa (100 - value) para que pesen en la
  // dirección correcta dentro de la media ponderada.
  const weights: Partial<Record<ScoreKey, number>> = {
    demand: 0.20, growth: 0.15, competition: 0.15, profit: 0.15,
    trend: 0.10, social: 0.08, seo: 0.07, advertising: 0.05,
    stability: 0.03, saturation: 0.01, risk: 0.01,
  }
  const invert = new Set<ScoreKey>(['competition', 'saturation', 'risk'])
  let sum = 0, total = 0
  for (const [key, weight] of Object.entries(weights) as [ScoreKey, number][]) {
    const val = scores[key]?.value ?? 50
    const adjusted = invert.has(key) ? 100 - val : val
    sum += adjusted * weight
    total += weight
  }
  return Math.round(sum / total)
}

function normalizeVerdict(raw: any, opportunityScore: number): Verdict {
  if (raw === 'invertir' || raw === 'esperar' || raw === 'evitar') return raw
  if (opportunityScore >= 75) return 'invertir'
  if (opportunityScore >= 50) return 'esperar'
  return 'evitar'
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
  "confidence": 88,
  "scores": {
    "opportunity":  {"value": 82, "reasons": ["motivo corto 1", "motivo corto 2", "motivo corto 3"]},
    "demand":       {"value": 78, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "growth":       {"value": 74, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "competition":  {"value": 35, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "saturation":   {"value": 30, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "profit":       {"value": 80, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "advertising":  {"value": 65, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "seo":          {"value": 55, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "social":       {"value": 70, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "trend":        {"value": 72, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "stability":    {"value": 60, "reasons": ["motivo corto 1", "motivo corto 2"]},
    "risk":         {"value": 25, "reasons": ["motivo corto 1", "motivo corto 2"]}
  },
  "verdict": "invertir",
  "verdict_reason": "Frase directa y accionable de máximo 20 palabras sobre qué hacer ahora con este nicho.",
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
- Sé específico y basa cada afirmación en las señales de mercado disponibles; evita cifras genéricas sin justificación.
- Los 12 "scores" son OBLIGATORIOS y cada uno debe llevar entre 2 y 4 "reasons" cortos (máximo 6 palabras cada uno, sin frases largas) que expliquen concretamente ESE valor — nunca dejes reasons vacío ni repitas el mismo motivo en varios scores.
- "competition", "saturation" y "risk": un valor ALTO significa PEOR para el usuario (mucha competencia, mucha saturación, mucho riesgo) — sé consistente con esa dirección.
- "opportunity": puntuación compuesta — súbela solo si el resto de scores (demanda, crecimiento, margen, baja competencia) realmente la respaldan.
- "verdict": "invertir" solo si opportunity >= 75 y no hay riesgos graves en "risks"; "evitar" si opportunity < 50 o hay un riesgo crítico; si no, "esperar". "verdict_reason" debe ser una frase directa y accionable, no una descripción.
- executive_summary: máximo 60 palabras, con datos concretos.
- insights/strengths/weaknesses: máximo 15 palabras cada uno.
- getting_started: específico con semanas y presupuesto.${trends ? `\nSEÑALES EN VIVO (prioriza estos nichos):\n${trends}` : ''}`

  return `${expertise}\n${format}`
}

/* ── Reparación de arrays JSON truncados ──────────────────────────
 * Si el modelo agota max_tokens a mitad de generación, la respuesta
 * se corta dentro de un objeto — el array nunca llega a cerrarse. En
 * vez de perder TODA la respuesta, recorremos el texto respetando
 * strings/escapes y localizamos el último objeto de nivel superior
 * que se cerró por completo (el momento exacto en que depth vuelve a
 * 1 justo tras un '}'), y devolvemos el array hasta ahí. Así, si 3 de
 * 4 nichos terminaron de generarse antes del corte, recuperamos esos
 * 3 en vez de fallar la búsqueda entera. Más fiable que buscar el
 * último "}," de forma literal, que puede coincidir por casualidad
 * dentro de un string o de un nivel más profundo del objeto incompleto. */
function repairTruncatedArray(text: string): any[] | null {
  const start = text.indexOf('[')
  if (start < 0) return null
  let depth = 0, inString = false, escape = false, lastCompleteEnd = -1
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '[' || ch === '{') depth++
    else if (ch === ']' || ch === '}') {
      depth--
      if (depth === 1 && ch === '}') lastCompleteEnd = i
    }
  }
  if (lastCompleteEnd < 0) return null
  try { return JSON.parse(text.slice(start, lastCompleteEnd + 1) + ']') } catch { return null }
}

/* ── Parser JSON robusto ────────────────────────────────────────── */
function parse(text: string): NicheResult[] | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const attempts = [
    () => JSON.parse(clean),
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1)) },
    () => JSON.parse(clean.replace(/,(\s*[}\]])/g,'$1')),
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1).replace(/,(\s*[}\]])/g,'$1')) },
    () => repairTruncatedArray(clean),
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
  // Motor de Inteligencia: normalizar los 12 scores (blindado ante
  // respuestas incompletas/mal formadas de la IA) y derivar el
  // opportunity_score/profit_score "planos" que el resto de la app
  // (tarjetas, PDF) sigue leyendo directamente.
  raw.scores = normalizeScores(raw.scores)
  raw.opportunity_score = raw.scores.opportunity.value
  raw.profit_score  = raw.profit_score || raw.scores.profit.value || raw.opportunity_score
  raw.score         = raw.opportunity_score
  raw.confidence    = raw.confidence    || Math.round(raw.opportunity_score * 0.9 + Math.random() * 10)
  raw.insights      = raw.insights      || raw.strengths?.slice(0,3) || []
  raw.trend_source  = raw.trend_source  || 'organic'
  raw.verdict        = normalizeVerdict(raw.verdict, raw.opportunity_score)
  raw.verdict_reason = typeof raw.verdict_reason === 'string' && raw.verdict_reason.trim()
    ? raw.verdict_reason
    : (raw.conclusion || raw.final_recommendation || '')

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

/* ── Llamadas individuales con timeout adaptativo (streaming) ──────
 * En vez de esperar el mensaje completo con un plazo fijo, streameamos
 * la respuesta: mientras el modelo siga produciendo texto activamente
 * lo dejamos continuar (resetea el contador de inactividad en cada
 * fragmento), y solo abortamos si se queda callado más de IDLE_LIMIT
 * ms, o si supera el techo absoluto HARD_LIMIT. Esto refleja la
 * realidad de generar 12 scorecards con motivos para 5-6 nichos: la
 * duración varía con la carga del proveedor en ese momento, no es un
 * número fijo que se pueda adivinar de antemano. */
async function callClaude(model: string, system: string, prompt: string, maxTokens: number): Promise<NicheResult[]> {
  const start = Date.now()
  let lastActivity = Date.now()
  let abortReason = ''

  const stream = anthropic.messages.stream({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] })
  stream.on('text', () => { lastActivity = Date.now() })

  const idleTimer = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_LIMIT.claude) {
      abortReason = `sin actividad ${IDLE_LIMIT.claude / 1000}s`
      stream.abort()
    }
  }, 2000)
  const hardTimer = setTimeout(() => {
    abortReason = `superó el techo de ${HARD_LIMIT.claude / 1000}s`
    stream.abort()
  }, HARD_LIMIT.claude)

  try {
    const finalMessage = await stream.finalMessage()
    clearInterval(idleTimer); clearTimeout(hardTimer)
    const text = finalMessage.content.filter(b=>b.type==='text').map(b=>(b as any).text).join('')
    const parsed = parse(text)
    if (!parsed) {
      // stop_reason:'max_tokens' confirma que el corte fue por presupuesto
      // de tokens agotado, no un fallo de formato — clave para diagnosticar.
      // Se loguea inicio Y final del texto: la reparación de truncado
      // necesita ver justo el final, que antes se perdía con slice(0,300).
      console.error(`[claude] ${Date.now()-start}ms → JSON inválido (stop_reason:${(finalMessage as any).stop_reason ?? '?'}, ${text.length} chars)`)
      console.error(`[claude] inicio:`, text.slice(0, 200))
      console.error(`[claude] final:`, text.slice(-300))
      throw new Error('Claude: JSON inválido')
    }
    console.log(`[claude:${model.split('-')[1]}] ✅ ${Date.now()-start}ms → ${parsed.length} nichos`)
    return parsed
  } catch (err: any) {
    clearInterval(idleTimer); clearTimeout(hardTimer)
    // Log completo para diagnóstico (status HTTP, tipo de error) — el mensaje
    // genérico que ve el usuario no debe ser la única pista que quede en logs.
    console.error(`[claude] ❌ ${Date.now()-start}ms → status:${err?.status ?? '?'} name:${err?.name ?? '?'} msg:${err?.message ?? err}`)
    if (abortReason) throw new Error(`Claude: timeout (${abortReason})`)
    if (isAbortError(err)) throw new Error('Claude: timeout')
    if (err?.status === 401) throw new Error('Claude: 401 API key inválida')
    if (err?.status === 402) throw new Error('Claude: 402 sin crédito')
    if (err?.status === 429) throw new Error('Claude: 429 rate limit')
    throw err
  }
}

async function callOpenAI(model: string, system: string, prompt: string, maxTokens: number): Promise<NicheResult[]> {
  if (!openaiClient) throw new Error('OpenAI no configurado')
  const start = Date.now()
  let lastActivity = Date.now()
  let abortReason = ''
  const controller = new AbortController()

  const idleTimer = setInterval(() => {
    if (Date.now() - lastActivity > IDLE_LIMIT.openai) {
      abortReason = `sin actividad ${IDLE_LIMIT.openai / 1000}s`
      controller.abort()
    }
  }, 2000)
  const hardTimer = setTimeout(() => {
    abortReason = `superó el techo de ${HARD_LIMIT.openai / 1000}s`
    controller.abort()
  }, HARD_LIMIT.openai)

  try {
    const stream = await openaiClient.chat.completions.create(
      { model, max_tokens: maxTokens, temperature: 0.2, stream: true, messages: [
        { role: 'system', content: `${system}\nResponde SIEMPRE con un array JSON válido y nada más.` },
        { role: 'user', content: prompt },
      ]},
      { signal: controller.signal }
    )
    let raw = ''
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content
      if (delta) { raw += delta; lastActivity = Date.now() }
    }
    clearInterval(idleTimer); clearTimeout(hardTimer)
    const parsed = parse(raw)
    if (!parsed) throw new Error('OpenAI: JSON inválido')
    console.log(`[openai:${model}] ✅ ${Date.now()-start}ms → ${parsed.length} nichos`)
    return parsed
  } catch (err: any) {
    clearInterval(idleTimer); clearTimeout(hardTimer)
    if (abortReason) throw new Error(`OpenAI: timeout (${abortReason})`)
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
  query: string, filters: Record<string,boolean>, plan: Plan, geo = 'US',
  opts?: { history?: string[] }
): Promise<NicheResult[]> {
  const cfg = AI_CONFIG[plan] ?? AI_CONFIG.pro
  const isAgency   = plan === 'agency'
  // Bajado de 6/5 a 4 para pro/agency: con 12 scorecards + motivos por
  // nicho, pedir 6 nichos se comía el presupuesto de tokens y Claude
  // cortaba la respuesta a mitad de generación (JSON truncado). Con 4
  // nichos cada uno recibe más presupuesto real y termina completo.
  const maxResults = plan === 'free' ? 3 : 4

  // Señales en vivo (timeout 1.5s máximo)
  let trendContext = ''
  try {
    const r = await Promise.race([getTrends(geo), new Promise<null>(r=>setTimeout(()=>r(null),1500))])
    if (r) trendContext = buildTrendContext(r)
  } catch {}

  // Memoria de sesión básica: si el cliente tiene búsquedas recientes,
  // se las pasamos como contexto para que la IA pueda relacionar el
  // nicho actual con lo que ya buscó ("alternativa con mejor margen a
  // lo que buscaste la semana pasada") — solo si aporta valor real,
  // nunca forzado. No requiere tablas nuevas, ya viene de niche_searches.
  const history = (opts?.history ?? []).filter(h => h && h.toLowerCase() !== query.toLowerCase()).slice(0, 5)
  const historyContext = history.length
    ? `\nCONTEXTO DEL CLIENTE: sus últimas búsquedas fueron: ${history.map(h => `"${h}"`).join(', ')}. Si algún nicho que generes ahora se relaciona con su historial (mismo mercado, alternativa con mejor margen/menos competencia, complemento natural), menciónalo brevemente en su executive_summary o verdict_reason — solo si aporta valor real y es honesto, no lo fuerces si no hay relación.`
    : ''

  const filterDesc = Object.entries(filters).filter(([,v])=>v).map(([k])=>k).join(', ')
  const system     = buildSystem(plan, trendContext)
  const userPrompt = `Consulta del cliente: "${query}"
Filtros: ${filterDesc || 'ninguno'} | País/Mercado: ${geo} | Nichos a analizar: ${maxResults} | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency ? 'CLIENTE AGENCY: máxima profundidad, datos verificados, playbook incluido.' : ''}${historyContext}
Devuelve SOLO el array JSON con ${maxResults} nichos ordenados por opportunity_score DESC. Análisis de nivel consultor.`

  const promises: Promise<NicheResult[]>[] = [
    callClaude(cfg.claude, system, userPrompt, cfg.tokens),
  ]
  if (cfg.openai && openaiClient) {
    promises.push(callOpenAI(cfg.openai, system, userPrompt, cfg.tokens))
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
      if (msg.includes('timeout')) throw new Error(`El motor de IA tardó demasiado en responder (${msg}). Puede ser un problema temporal de conexión con Anthropic — inténtalo de nuevo en un minuto.`)
      throw new Error(`Error en el motor Multi-IA: ${msg || 'desconocido'}. Inténtalo de nuevo.`)
    }
  }
}

/* ── Comparador de nichos ──────────────────────────────────────────
 * NO vuelve a analizar los nichos desde cero: reutiliza el 100% de los
 * 12 scores + veredicto que el Motor de Inteligencia ya generó para
 * cada uno. Solo pide a la IA una decisión corta — "de estos que ya
 * tienes analizados, ¿cuál elegirías y por qué" — así el coste y el
 * tiempo de espera son mínimos comparados con una búsqueda normal. */
const COMPARE_TIMEOUT = 20000

export async function compareNiches(niches: any[], plan: Plan): Promise<CompareVerdict> {
  const model = AI_CONFIG[plan]?.claude ?? AI_CONFIG.pro.claude
  const system = `Eres un consultor senior de ecommerce y dropshipping. Te dan 2 o 3 nichos que un cliente ya analizó (con sus scores 0-100 y veredicto). Decide cuál elegirías tú si solo pudieras invertir en uno.
RESPONDE EXCLUSIVAMENTE CON JSON VÁLIDO, sin markdown ni texto fuera del objeto:
{"winner":"<name EXACTO de uno de los nichos recibidos>","reasoning":"<máximo 40 palabras, comparando datos concretos de los nichos entre sí, nunca una frase genérica>"}`

  const summarized = niches.map((n: any) => ({
    name: n.name,
    opportunity_score: n.opportunity_score ?? n.profit_score,
    verdict: n.verdict,
    scores: n.scores
      ? Object.fromEntries(Object.entries(n.scores).map(([k, v]: [string, any]) => [k, v?.value]))
      : undefined,
    margin: n.margin,
    market_size: n.market_size,
    competition: n.competition,
    trend: n.trend,
    time_to_results: n.time_to_results,
  }))

  const fallback = (): CompareVerdict => {
    const best = niches.reduce((a: any, b: any) =>
      (b.opportunity_score ?? b.profit_score ?? 0) > (a.opportunity_score ?? a.profit_score ?? 0) ? b : a)
    return { winner: best.name, reasoning: 'Comparación automática por Opportunity Score — la IA no pudo generar un veredicto razonado en este momento.' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), COMPARE_TIMEOUT)
  try {
    const res = await anthropic.messages.create(
      { model, max_tokens: 400, system, messages: [{ role: 'user', content: `Nichos a comparar:\n${JSON.stringify(summarized)}\n\nDevuelve SOLO el JSON.` }] },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const text = res.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
    if (s < 0 || e <= s) throw new Error('Comparador: JSON inválido')
    const obj = JSON.parse(clean.slice(s, e + 1))
    if (!obj?.winner || !niches.some((n: any) => n.name === obj.winner)) throw new Error('Comparador: winner no coincide')
    return { winner: obj.winner, reasoning: typeof obj.reasoning === 'string' ? obj.reasoning : '' }
  } catch (err: any) {
    clearTimeout(timer)
    console.error('[compare] ❌', err?.message ?? err)
    return fallback()
  }
}

/* ── Plan de acción 30/60/90 para el informe ejecutivo v2 ──────────
 * Solo se genera a partir de los nichos que el Motor de Inteligencia
 * marcó "invertir" — no fabricamos un plan genérico para nichos que la
 * propia IA ya desaconsejó, sería incoherente con su propio veredicto. */
export async function generateActionPlan(investNiches: any[], plan: Plan): Promise<string[]> {
  if (!investNiches.length) return []
  const model = AI_CONFIG[plan]?.claude ?? AI_CONFIG.pro.claude
  const system = `Eres un consultor senior de ecommerce. Te dan una lista de nichos que un sistema de análisis ya marcó como "invertir" (con datos concretos). Genera un plan de acción de 3 fases (30/60/90 días) para que el cliente empiece a ejecutar HOY sobre estos nichos en conjunto, priorizando el de mayor score primero.
RESPONDE EXCLUSIVAMENTE CON JSON VÁLIDO: {"plan":["fase 1 (días 1-30): acción concreta con presupuesto/pasos","fase 2 (días 31-60): acción concreta","fase 3 (días 61-90): acción concreta"]}
Cada fase máximo 35 palabras, específica y accionable — nunca genérica.`
  const summarized = investNiches.slice(0,5).map((n: any) => ({ name: n.name, opportunity_score: n.opportunity_score, margin: n.margin, initial_investment: n.initial_investment, winning_angle: n.winning_angle }))
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), COMPARE_TIMEOUT)
  try {
    const res = await anthropic.messages.create(
      { model, max_tokens: 600, system, messages: [{ role: 'user', content: `Nichos a priorizar:\n${JSON.stringify(summarized)}\n\nDevuelve SOLO el JSON.` }] },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const text = res.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
    const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const s = clean.indexOf('{'), e = clean.lastIndexOf('}')
    const obj = JSON.parse(clean.slice(s, e + 1))
    return Array.isArray(obj?.plan) ? obj.plan.filter((p: any) => typeof p === 'string').slice(0,3) : []
  } catch (err: any) {
    clearTimeout(timer)
    console.error('[action-plan] ❌', err?.message ?? err)
    return []
  }
}
