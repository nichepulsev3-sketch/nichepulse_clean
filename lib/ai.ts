/**
 * NichePulse — Motor Multi-IA
 * Free:   Claude Haiku   (ultra rápido)
 * Pro:    Haiku + GPT-4o-mini en carrera paralela (el más rápido gana)
 * Agency: Sonnet + GPT-4o  en carrera paralela (mejor calidad)
 *
 * Cada llamada tiene timeout estricto + un reintento final de seguridad
 * solo con Claude si la carrera completa falla.
 */
import Anthropic from '@anthropic-ai/sdk'
import OpenAI    from 'openai'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const anthropic    = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, maxRetries: 0 })
const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, maxRetries: 0 })
  : null

// Modelos por plan y proveedor
const AI_CONFIG = {
  free:   { claude:'claude-haiku-4-5-20251001', openai: null,          tokens: 1500 },
  pro:    { claude:'claude-haiku-4-5-20251001', openai:'gpt-4o-mini',  tokens: 2200 },
  agency: { claude:'claude-sonnet-4-6',         openai:'gpt-4o',       tokens: 5000 },
}

const CLAUDE_TIMEOUT_MS = 28000
const OPENAI_TIMEOUT_MS = 25000
const RETRY_TIMEOUT_MS  = 28000

// ── Estructura JSON compacta (menos tokens = respuestas más rápidas) ──
const JSON_STRUCT_BASE = `[{"name":"nombre","score":85,"market_size":"$2.1B","margin":"45-60%","competition":"Baja","trend":"↑34% YoY","trend_pct":34,"profit_score":72,"tags":["trending","low_comp"],"insights":["insight 1 con cifras","insight 2 demografía","insight 3 plataformas"],"suppliers":[{"name":"AliExpress","note":"15-30 días"},{"name":"Spocket","note":"3-7 días EU"}],"keywords":["kw1","kw2","kw3","kw4"],"ad_channels":["TikTok Ads","Meta Ads"],"trend_source":"organic","target_audience":"perfil del comprador","avg_ticket":"$35-65","seasonality":"evergreen o estacional","risks":["riesgo 1","riesgo 2"],"getting_started":["paso 1","paso 2","paso 3"],"winning_angle":"ángulo único"}]`

const AGENCY_EXTRA = `,"expert_verdict":"veredicto del equipo experto","validated_roi":"ROI estimado 90 días"`

function buildSystem(plan: string, trends: string): string {
  const isAgency = plan === 'agency'
  const intro = isAgency
    ? 'Eres un equipo experto en dropshipping con datos verificados de mercado.'
    : 'Eres NichePulse Multi-IA, motor de análisis de nichos dropshipping.'

  const struct = isAgency
    ? JSON_STRUCT_BASE.replace('"winning_angle":"ángulo único"', `"winning_angle":"ángulo único"${AGENCY_EXTRA}`)
    : JSON_STRUCT_BASE

  return `${intro}
RESPONDE SOLO CON UN ARRAY JSON VÁLIDO. Sin texto antes ni después. Sin markdown.
Estructura exacta por nicho: ${struct}
Comillas dobles. Sin saltos de línea en strings. Datos realistas y específicos.${trends ? `\nSeñales en vivo (prioriza):\n${trends}` : ''}`
}

// ── Parser JSON robusto ─────────────────────────────────────────
function parse(text: string): NicheResult[] | null {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  const attempts: Array<() => any> = [
    () => JSON.parse(clean),
    () => { const s = clean.indexOf('['), e = clean.lastIndexOf(']'); if (s >= 0 && e > s) return JSON.parse(clean.slice(s, e + 1)) },
    () => JSON.parse(clean.replace(/,(\s*[}\]])/g, '$1')),
    () => { const s = clean.indexOf('['), e = clean.lastIndexOf(']'); if (s >= 0 && e > s) return JSON.parse(clean.slice(s, e + 1).replace(/,(\s*[}\]])/g, '$1')) },
    () => {
      const s = clean.indexOf('[')
      if (s < 0) return null
      const e = clean.lastIndexOf(']')
      const partial = e > s ? clean.slice(s, e + 1) : clean.slice(s)
      const lastGood = partial.lastIndexOf('},')
      if (lastGood > 0) return JSON.parse(partial.slice(0, lastGood + 1) + ']')
    },
    () => { const m = clean.match(/\{[\s\S]*\}/); if (m) { const o = JSON.parse(m[0]); return o.niches ?? o.results ?? o.data ?? [o] } },
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

// ── Llamadas individuales ────────────────────────────────────────
async function callClaude(model: string, system: string, prompt: string, maxTokens: number, timeoutMs = CLAUDE_TIMEOUT_MS): Promise<NicheResult[]> {
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await anthropic.messages.create(
      { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: prompt }] },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const text = res.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
    const parsed = parse(text)
    const ms = Date.now() - start
    if (!parsed) {
      console.error(`[claude:${model.split('-')[1]}] ${ms}ms → JSON inválido. Texto recibido (500 chars):`, text.slice(0, 500))
      throw new Error('Claude: JSON inválido')
    }
    console.log(`[claude:${model.split('-')[1]}] ${ms}ms → ${parsed.length} nichos ✅`)
    return parsed
  } catch (err: any) {
    clearTimeout(timer)
    const ms = Date.now() - start
    if (err?.name === 'AbortError' || err?.message?.includes('timeout')) {
      console.error(`[claude:${model.split('-')[1]}] ❌ Timeout tras ${ms}ms`)
      throw new Error(`Claude: timeout tras ${ms}ms`)
    }
    console.error(`[claude:${model.split('-')[1]}] ❌ ${ms}ms →`, err?.status, err?.message)
    throw err
  }
}

async function callOpenAI(model: string, system: string, prompt: string, maxTokens: number, timeoutMs = OPENAI_TIMEOUT_MS): Promise<NicheResult[]> {
  if (!openaiClient) throw new Error('OpenAI no configurado')
  const start = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await openaiClient.chat.completions.create(
      {
        model, max_tokens: maxTokens, temperature: 0.3,
        messages: [
          { role: 'system', content: `${system}\nResponde SIEMPRE con un array JSON válido y nada más.` },
          { role: 'user', content: prompt },
        ],
      },
      { signal: controller.signal }
    )
    clearTimeout(timer)
    const raw = res.choices[0]?.message?.content ?? ''
    const parsed = parse(raw)
    const ms = Date.now() - start
    if (!parsed) {
      console.error(`[openai:${model}] ${ms}ms → JSON inválido. Texto (500 chars):`, raw.slice(0, 500))
      throw new Error('OpenAI: JSON inválido')
    }
    console.log(`[openai:${model}] ${ms}ms → ${parsed.length} nichos ✅`)
    return parsed
  } catch (err: any) {
    clearTimeout(timer)
    const ms = Date.now() - start
    if (err?.name === 'AbortError') {
      console.error(`[openai:${model}] ❌ Timeout tras ${ms}ms`)
      throw new Error(`OpenAI: timeout tras ${ms}ms`)
    }
    if (err?.message?.includes('Connection') || err?.code === 'ECONNREFUSED' || err?.cause) {
      const causeMsg = err?.cause?.message ?? err?.cause?.code ?? 'desconocida'
      console.error(`[openai:${model}] ❌ Error de conexión tras ${ms}ms | causa: ${causeMsg} | revisa OPENAI_API_KEY o que Railway permita salida a api.openai.com`)
      throw new Error('OpenAI: error de conexión')
    }
    console.error(`[openai:${model}] ❌ ${ms}ms →`, err?.status, err?.message)
    throw err
  }
}

// ── Carrera: el primero que devuelva resultado válido gana ──────
async function race(promises: Promise<NicheResult[]>[]): Promise<NicheResult[]> {
  const safe = promises.map(p => p.catch(e => { console.warn('[race] IA fallida:', e?.message); return null }))

  return new Promise((resolve, reject) => {
    let settled = 0
    let resolved = false
    safe.forEach(p => {
      p.then(result => {
        settled++
        if (result && result.length > 0 && !resolved) {
          resolved = true
          resolve(result)
        } else if (settled === safe.length && !resolved) {
          reject(new Error('Todas las IAs fallaron en la carrera'))
        }
      })
    })
  })
}

// ── Función principal ────────────────────────────────────────────
export async function searchNiches(
  query: string,
  filters: Record<string, boolean>,
  plan: string,
  geo = 'US'
): Promise<NicheResult[]> {
  const cfg        = AI_CONFIG[plan as keyof typeof AI_CONFIG] ?? AI_CONFIG.pro
  const isAgency   = plan === 'agency'
  const maxResults = plan === 'free' ? 3 : isAgency ? 5 : 8

  // Señales en vivo — timeout corto, no debe frenar la búsqueda
  let trendContext = ''
  try {
    const result = await Promise.race([
      getTrends(geo),
      new Promise<null>(r => setTimeout(() => r(null), 1500)),
    ])
    if (result) trendContext = buildTrendContext(result)
  } catch {}

  const filterDesc = Object.entries(filters).filter(([, v]) => v).map(([k]) => k).join(', ')
  const system     = buildSystem(plan, trendContext)
  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc || 'ninguno'} | País: ${geo} | Devuelve: ${maxResults} nichos | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency ? 'MODO AGENCY: máxima profundidad y datos verificados.' : ''}
Responde SOLO con el array JSON de ${maxResults} nichos.`

  const promises: Promise<NicheResult[]>[] = [
    callClaude(cfg.claude, system, userPrompt, cfg.tokens, CLAUDE_TIMEOUT_MS),
  ]
  if (cfg.openai && openaiClient) {
    promises.push(callOpenAI(cfg.openai, system, userPrompt, cfg.tokens, OPENAI_TIMEOUT_MS))
  }

  console.log(`[multi-ia] plan:${plan} | IAs en carrera:${promises.length} | geo:${geo} | tokens:${cfg.tokens}`)

  try {
    const results = await race(promises)
    console.log(`[multi-ia] ✅ ${results.length} nichos listos`)
    return results.slice(0, maxResults)
  } catch {
    // ── Reintento de seguridad: un único intento extra solo con Claude ──
    console.warn('[multi-ia] Carrera falló por completo. Reintentando solo con Claude...')
    try {
      const retry = await callClaude(cfg.claude, system, userPrompt, cfg.tokens, RETRY_TIMEOUT_MS)
      console.log(`[multi-ia] ✅ Reintento exitoso: ${retry.length} nichos`)
      return retry.slice(0, maxResults)
    } catch (err: any) {
      const msg = err?.message ?? ''
      console.error('[multi-ia] ❌ Reintento también falló:', msg)
      if (msg.includes('401') || msg.includes('Incorrect API'))
        throw new Error('Clave de IA inválida. Comprueba ANTHROPIC_API_KEY en Railway → Variables.')
      if (msg.includes('429') || msg.includes('rate limit'))
        throw new Error('Límite de IA alcanzado. Espera 1 minuto e inténtalo de nuevo.')
      if (msg.includes('402') || msg.includes('credit'))
        throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
      if (msg.includes('timeout'))
        throw new Error('La IA tardó demasiado en responder. Inténtalo de nuevo.')
      throw new Error('Error en el motor Multi-IA. Inténtalo de nuevo.')
    }
  }
}
