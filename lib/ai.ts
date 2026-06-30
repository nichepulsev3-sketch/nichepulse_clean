/**
 * NichePulse — Motor Multi-IA
 * Free:   Claude Haiku   (ultra rápido)
 * Pro:    Haiku + GPT-4o-mini en carrera paralela (el más rápido gana)
 * Agency: Sonnet + GPT-4o  en carrera paralela (mejor calidad)
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const anthropic    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

// Modelos por plan y proveedor
const AI_CONFIG = {
  free:   { claude:'claude-haiku-4-5-20251001', openai: null,          tokens: 2048 },
  pro:    { claude:'claude-haiku-4-5-20251001', openai:'gpt-4o-mini',  tokens: 4096 },
  agency: { claude:'claude-sonnet-4-6',         openai:'gpt-4o',       tokens: 8096 },
}

// ── Sistema de prompts ─────────────────────────────────────────
const JSON_STRUCT = `[
  {
    "name":"nombre específico del nicho",
    "score":85,
    "market_size":"$2.1B",
    "margin":"45-60%",
    "competition":"Baja",
    "trend":"↑ 34% YoY",
    "trend_pct":34,
    "profit_score":72,
    "tags":["trending","low_comp"],
    "insights":["insight 1 con datos reales y cifras","insight 2 con demografía exacta","insight 3 con plataformas y ROI"],
    "suppliers":[{"name":"AliExpress","note":"catálogo amplio, 15-30 días"},{"name":"Spocket","note":"proveedores EU, 3-7 días"}],
    "keywords":["keyword volumen alto","keyword long-tail","keyword buyer intent","keyword comparativa"],
    "ad_channels":["TikTok Ads","Meta Ads","Google Shopping"],
    "trend_source":"organic",
    "target_audience":"Perfil detallado: edad, nivel económico, plataformas, motivación de compra",
    "avg_ticket":"$35-65",
    "seasonality":"Evergreen con pico en Navidad y San Valentín",
    "risks":["Riesgo específico 1","Riesgo específico 2","Riesgo específico 3"],
    "getting_started":["Semana 1: acción concreta con presupuesto","Semana 2-3: validación con métricas","Mes 1: escala con KPIs objetivo"],
    "winning_angle":"Propuesta de valor única basada en vacío real del mercado"
  }
]`

const AGENCY_EXTRA = `,"expert_verdict":"Veredicto del equipo experto: por qué tiene alta probabilidad de éxito AHORA y cuándo entrar","validated_roi":"ROI estimado en 90 días con $500-1000 de inversión y condiciones necesarias"`

const buildSystem = (plan: string, trends: string) => {
  const isAgency = plan === 'agency'
  const base = isAgency
    ? `Eres un equipo élite de 5 expertos en dropshipping con 10+ años validando nichos millonarios. Tu análisis está VERIFICADO con datos de mercado reales. Máxima profundidad y precisión.`
    : `Eres NichePulse Multi-IA, el motor de análisis de nichos de dropshipping más preciso del mercado.`

  const struct = isAgency
    ? JSON_STRUCT.replace('"winning_angle":"Propuesta de valor única basada en vacío real del mercado"', `"winning_angle":"Propuesta de valor única basada en vacío real del mercado"${AGENCY_EXTRA}`)
    : JSON_STRUCT

  return `${base}
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. CERO texto fuera del array. Sin markdown.

Estructura requerida:
${struct}

REGLAS CRÍTICAS:
- Comillas dobles siempre. Sin saltos de línea dentro de strings.
- Datos REALES y VERIFICADOS, no genéricos.
- Score > 85 solo si hay evidencia real de demanda alta y competencia baja.
- Insights con cifras exactas cuando sea posible.
${trends ? `\nSEÑALES EN VIVO (prioriza estos nichos):\n${trends}` : ''}`
}

// ── Parser JSON ultra-robusto ──────────────────────────────────
function parse(text: string): NicheResult[] | null {
  const clean = text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()

  // Intentos en orden de probabilidad
  const attempts = [
    // 1. Directo
    () => JSON.parse(clean),
    // 2. Solo el array
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1)) },
    // 3. Sin comas finales
    () => JSON.parse(clean.replace(/,(\s*[}\]])/g,'$1')),
    // 4. Array limpiado sin comas finales
    () => { const s=clean.indexOf('['), e=clean.lastIndexOf(']'); if(s>=0&&e>s) return JSON.parse(clean.slice(s,e+1).replace(/,(\s*[}\]])/g,'$1')) },
    // 5. JSON cortado — eliminar último objeto incompleto
    () => {
      const s=clean.indexOf('['), e=clean.lastIndexOf(']')
      if(s<0)return null
      const partial = s>=0 && e>s ? clean.slice(s,e+1) : clean.slice(s)+']}' // forzar cierre
      const lastGood = partial.lastIndexOf('},')
      if(lastGood>0) return JSON.parse(partial.slice(0,lastGood+1)+']')
    },
    // 6. Objeto raíz con array dentro
    () => { const m=clean.match(/\{[\s\S]*\}/); if(m){const o=JSON.parse(m[0]); return o.niches??o.results??o.data??[o]} },
  ]

  for (const attempt of attempts) {
    try {
      const result = attempt()
      if (Array.isArray(result) && result.length > 0) return result as NicheResult[]
      if (result && !Array.isArray(result)) return [result] as NicheResult[]
    } catch {}
  }
  return null
}

// ── Llamadas individuales a cada IA ───────────────────────────
async function callClaude(model: string, system: string, prompt: string, maxTokens: number): Promise<NicheResult[]> {
  const start = Date.now()
  const res = await anthropic.messages.create({
    model, max_tokens: maxTokens, system,
    messages: [{ role:'user', content:prompt }],
  })
  const text = res.content.filter(b=>b.type==='text').map(b=>(b as any).text).join('')
  const parsed = parse(text)
  console.log(`[claude:${model.split('-')[1]}] ${Date.now()-start}ms → ${parsed?.length??0} nichos`)
  if (!parsed) throw new Error('Claude: JSON inválido')
  return parsed
}

async function callOpenAI(model: string, system: string, prompt: string): Promise<NicheResult[]> {
  if (!openaiClient) throw new Error('OpenAI no configurado')
  const start = Date.now()
  const res = await openaiClient.chat.completions.create({
    model, max_tokens: 4096,
    messages: [
      { role:'system', content:`${system}\nResponde SIEMPRE con un array JSON válido y nada más.` },
      { role:'user',   content: prompt },
    ],
    temperature: 0.3,
  })
  const raw = res.choices[0]?.message?.content ?? ''
  const parsed = parse(raw)
  console.log(`[openai:${model}] ${Date.now()-start}ms → ${parsed?.length??0} nichos`)
  if (!parsed) throw new Error('OpenAI: JSON inválido')
  return parsed
}

// ── Motor de carrera: el más rápido y válido gana ─────────────
async function race(promises: Promise<NicheResult[]>[]): Promise<NicheResult[]> {
  // Envolver para capturar fallos individuales
  const safePromises = promises.map(p =>
    p.catch(e => { console.warn('[race] IA fallida:', e?.message); return null })
  )

  // Esperar al primero que devuelva resultado válido
  return new Promise((resolve, reject) => {
    let settled = 0
    let resolved = false

    safePromises.forEach(p => {
      p.then(result => {
        settled++
        if (result && result.length > 0 && !resolved) {
          resolved = true
          resolve(result)
        } else if (settled === safePromises.length && !resolved) {
          reject(new Error('Todas las IAs fallaron. Inténtalo de nuevo.'))
        }
      })
    })
  })
}

// ── Función principal ─────────────────────────────────────────
export async function searchNiches(
  query: string,
  filters: Record<string,boolean>,
  plan: string,
  geo = 'US'
): Promise<NicheResult[]> {
  const cfg        = AI_CONFIG[plan as keyof typeof AI_CONFIG] ?? AI_CONFIG.pro
  const isAgency   = plan === 'agency'
  const maxResults = plan === 'free' ? 3 : isAgency ? 5 : 8

  // Señales en vivo con timeout agresivo (2s)
  let trendContext = ''
  try {
    const result = await Promise.race([
      getTrends(geo),
      new Promise<null>(r => setTimeout(() => r(null), 2000)),
    ])
    if (result) trendContext = buildTrendContext(result)
  } catch {}

  const filterDesc = Object.entries(filters).filter(([,v])=>v).map(([k])=>k).join(', ')
  const system     = buildSystem(plan, trendContext)
  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc||'ninguno'} | País: ${geo} | Nichos a devolver: ${maxResults} | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency?'MODO AGENCY EXPERT: máxima profundidad, datos verificados, ROI calculado.':''}
Devuelve SOLO el array JSON con ${maxResults} nichos ordenados por score. NADA más.`

  // Construir lista de promesas según plan
  const promises: Promise<NicheResult[]>[] = []

  // Siempre incluir Claude
  promises.push(callClaude(cfg.claude, system, userPrompt, cfg.tokens))

  // Pro y Agency + OpenAI disponible → añadir a la carrera
  if (cfg.openai && openaiClient) {
    promises.push(callOpenAI(cfg.openai, system, userPrompt))
  }

  console.log(`[multi-ia] plan:${plan} | IAs en carrera: ${promises.length} | geo:${geo}`)

  try {
    const results = await race(promises)
    const final   = results.slice(0, maxResults)
    console.log(`[multi-ia] ✅ ${final.length} nichos listos`)
    return final
  } catch (err: any) {
    // Intentar parsear el error para dar un mensaje claro
    const msg = err?.message ?? ''
    if (msg.includes('401') || msg.includes('Incorrect API'))
      throw new Error('Clave de IA inválida. Comprueba ANTHROPIC_API_KEY en Railway → Variables.')
    if (msg.includes('429') || msg.includes('rate limit'))
      throw new Error('Límite de IA alcanzado. Espera 1 minuto e inténtalo de nuevo.')
    if (msg.includes('402') || msg.includes('credit'))
      throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
    throw new Error('Error en el motor Multi-IA. Inténtalo de nuevo.')
  }
}
