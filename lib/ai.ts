import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

const CLAUDE_MODEL = {
  free:   'claude-haiku-4-5-20251001',
  pro:    'claude-sonnet-4-6',
  agency: 'claude-sonnet-4-6',
}
const MAX_TOKENS = { free: 2048, pro: 8096, agency: 8096 }

const BASE_FIELDS = `{
  "name": "nombre específico",
  "score": 85,
  "market_size": "$2.1B",
  "margin": "45-60%",
  "competition": "Baja",
  "trend": "↑ 34% YoY",
  "trend_pct": 34,
  "profit_score": 72,
  "tags": ["trending","low_comp"],
  "insights": ["insight 1 con datos reales","insight 2 con demografía","insight 3 con plataformas"],
  "suppliers": [{"name":"AliExpress","note":"Gran catálogo"},{"name":"Spocket","note":"Envío rápido EU"}],
  "keywords": ["keyword1","keyword2","keyword3","keyword4"],
  "ad_channels": ["TikTok Ads","Meta Ads","Google Shopping"],
  "trend_source": "organic",
  "target_audience": "Descripción detallada del comprador ideal",
  "avg_ticket": "$35-65",
  "seasonality": "Evergreen con pico en Navidad",
  "risks": ["Riesgo 1","Riesgo 2","Riesgo 3"],
  "getting_started": ["Paso 1 concreto","Paso 2 concreto","Paso 3 concreto"],
  "winning_angle": "Ángulo diferenciador de marketing"
}`

const AGENCY_EXTRA = `,
  "expert_verdict": "Veredicto del equipo experto con alta probabilidad de éxito ahora mismo",
  "validated_roi": "ROI estimado en 90 días con inversión inicial de $500-1000 y condiciones necesarias"`

const PRO_SYSTEM = `Eres NichePulse AI, analista experto en nichos de dropshipping.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. Sin texto fuera del array.
Estructura: ${BASE_FIELDS}
REGLAS: Comillas dobles. Sin saltos de línea dentro de strings. SOLO el array JSON.`

const AGENCY_SYSTEM = `Eres un equipo de expertos en dropshipping con 10 años validando nichos millonarios.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. Sin texto fuera del array.
Estructura: ${BASE_FIELDS.slice(0,-1)}${AGENCY_EXTRA}
}
REGLAS: Datos VERIFICADOS. Máxima profundidad. Comillas dobles. SOLO el array JSON.`

function repairAndParse(text: string): any {
  let s = text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()
  const st = s.indexOf('['), en = s.lastIndexOf(']')
  if (st !== -1 && en > st) s = s.slice(st, en+1)
  try { return JSON.parse(s) } catch {}
  s = s.replace(/,(\s*[}\]])/g,'$1')
  try { return JSON.parse(s) } catch {}
  const lg = s.lastIndexOf('},')
  if (lg !== -1) { try { return JSON.parse(s.slice(0,lg+1)+']') } catch {} }
  // Intento con objeto raíz
  try {
    const m = s.match(/\{[\s\S]*\}/)
    if (m) { const o = JSON.parse(m[0]); return o.niches??o.results??o.data??[o] }
  } catch {}
  return null
}

async function withClaude(system: string, userPrompt: string, plan: string): Promise<string> {
  const model  = CLAUDE_MODEL[plan as keyof typeof CLAUDE_MODEL] ?? 'claude-sonnet-4-6'
  const tokens = MAX_TOKENS[plan as keyof typeof MAX_TOKENS]     ?? 8096
  const response = await anthropic.messages.create({
    model, max_tokens: tokens, system,
    messages: [{ role:'user', content:userPrompt }],
  })
  return response.content.filter(b=>b.type==='text').map(b=>(b as any).text).join('')
}

async function withOpenAI(system: string, userPrompt: string): Promise<string> {
  if (!openaiClient) throw new Error('OpenAI no configurado')
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 4096,
    messages: [
      { role:'system', content: system + '\nResponde SIEMPRE con un array JSON válido, sin texto extra.' },
      { role:'user',   content: userPrompt },
    ],
    response_format: { type:'json_object' },
  })
  const raw = response.choices[0]?.message?.content ?? ''
  // GPT devuelve objeto JSON, extraer el array
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return JSON.stringify(parsed)
    const arr = parsed.niches ?? parsed.results ?? parsed.data ?? parsed
    return JSON.stringify(Array.isArray(arr) ? arr : [arr])
  } catch {
    return raw
  }
}

async function fetchAI(system: string, userPrompt: string, plan: string): Promise<string> {
  const isPaid = plan === 'pro' || plan === 'agency'

  // Pro/Agency + OpenAI disponible → carrera paralela
  if (isPaid && openaiClient) {
    let resolved = false
    const claudeP = withClaude(system, userPrompt, plan)
      .then(t => { if (!resolved) { resolved=true; console.log('[ai] ✓ Claude ganó la carrera'); } return t })
      .catch(() => null)
    const openaiP = withOpenAI(system, userPrompt)
      .then(t => { if (!resolved) { resolved=true; console.log('[ai] ✓ OpenAI ganó la carrera'); } return t })
      .catch(() => null)

    const winner = await Promise.race([claudeP, openaiP])
    if (winner) return winner

    const [c, o] = await Promise.allSettled([claudeP, openaiP])
    for (const r of [c,o]) {
      if (r.status==='fulfilled' && r.value) return r.value
    }
    throw new Error('Ambas IAs fallaron. Inténtalo de nuevo.')
  }

  // Free o sin OpenAI → Claude Haiku (rápido) con retry
  let lastErr: any
  for (let attempt=1; attempt<=2; attempt++) {
    try { return await withClaude(system, userPrompt, plan) }
    catch (err: any) {
      lastErr = err
      if (err?.status===401 || err?.status===402) break
      if (attempt < 2) await new Promise(r=>setTimeout(r,1500))
    }
  }

  // Último recurso: OpenAI si está disponible
  if (openaiClient) {
    try { return await withOpenAI(system, userPrompt) } catch {}
  }

  const s = lastErr?.status
  if (s===401) throw new Error('ANTHROPIC_API_KEY inválida. Compruébala en Railway → Variables.')
  if (s===429) throw new Error('Límite de IA alcanzado. Espera 1 minuto.')
  if (s===402 || lastErr?.message?.includes('credit'))
    throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
  throw new Error('Error conectando con la IA. Inténtalo de nuevo.')
}

export async function searchNiches(
  query: string, filters: Record<string,boolean>, plan: string, geo='US'
): Promise<NicheResult[]> {
  const isAgency   = plan==='agency'
  const maxResults = plan==='free' ? 3 : isAgency ? 5 : 8

  let trendContext=''
  try {
    const r = await Promise.race([getTrends(geo), new Promise<null>(r=>setTimeout(()=>r(null),3000))])
    if (r) trendContext = buildTrendContext(r)
  } catch {}

  const filterDesc = Object.entries(filters).filter(([,v])=>v).map(([k])=>k).join(', ')
  const baseSystem = isAgency ? AGENCY_SYSTEM : PRO_SYSTEM
  const system     = trendContext ? `${baseSystem}\n\nSEÑALES EN VIVO:\n${trendContext}` : baseSystem
  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc||'ninguno'} | País: ${geo} | Máximo: ${maxResults} | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency?'MODO AGENCY: análisis expert con datos verificados.':''}
Devuelve SOLO el array JSON. Nada más.`

  console.log(`[ai] plan:${plan} haiku:${plan==='free'} openai:${!!openaiClient}`)
  const text   = await fetchAI(system, userPrompt, plan)
  const parsed = repairAndParse(text)
  if (!parsed) {
    console.error('[ai] JSON no parseable:', text.slice(0,300))
    throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.')
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed]
  console.log(`[ai] ✅ ${arr.length} nichos`)
  return arr.slice(0,maxResults) as NicheResult[]
}
