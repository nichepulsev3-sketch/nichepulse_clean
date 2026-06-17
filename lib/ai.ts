import Anthropic from '@anthropic-ai/sdk'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BASE_SYSTEM = `Eres NichePulse AI, el mejor analista de nichos de dropshipping del mundo.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO.
Sin texto antes ni después. Sin bloques de código. SOLO el array JSON empezando por [ y terminando por ].

Estructura de cada nicho (TODOS los campos son obligatorios):
{
  "name": "nombre específico del nicho",
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
  "keywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "ad_channels": ["TikTok Ads","Meta Ads","Google Shopping"],
  "trend_source": "organic",
  "target_audience": "Mujeres 25-40 años interesadas en bienestar animal, gasto mensual alto en mascotas",
  "avg_ticket": "$35-65",
  "seasonality": "Evergreen con pico en Navidad y San Valentín",
  "risks": ["Saturación creciente en AliExpress","Dependencia de proveedores chinos","Márgenes se comprimen con más anunciantes"],
  "getting_started": ["Crea una tienda Shopify con tema minimalista y 20 productos piloto","Lanza anuncios en TikTok con UGC auténtico de mascotas","Valida con $50 de presupuesto antes de escalar"],
  "winning_angle": "Posicionate como la marca de cuidado emocional para mascotas, no solo productos"
}

IMPORTANTE: Usa siempre comillas dobles. No uses saltos de línea dentro de los strings. No pongas texto fuera del array JSON.`

// ── Reparar JSON con errores comunes ────────────────────────
function repairAndParse(text: string): any {
  // Eliminar bloques markdown
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()

  // Extraer solo el array JSON (de [ a ])
  const start = s.indexOf('[')
  const end   = s.lastIndexOf(']')
  if (start !== -1 && end > start) {
    s = s.slice(start, end + 1)
  }

  // Intentar parsear directo
  try { return JSON.parse(s) } catch {}

  // Reparar comas finales antes de } o ]
  s = s.replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(s) } catch {}

  // Si el JSON está cortado (sin cerrar), intentar cerrar
  const openBraces   = (s.match(/\{/g) || []).length
  const closeBraces  = (s.match(/\}/g) || []).length
  const openBrackets = (s.match(/\[/g) || []).length
  const closeBrackets= (s.match(/\]/g) || []).length

  let repaired = s
  // Eliminar último objeto incompleto
  const lastComplete = repaired.lastIndexOf('},')
  if (lastComplete !== -1) {
    repaired = repaired.slice(0, lastComplete + 1) + ']'
  } else {
    for (let i = 0; i < openBraces  - closeBraces;  i++) repaired += '}'
    for (let i = 0; i < openBrackets- closeBrackets; i++) repaired += ']'
  }

  repaired = repaired.replace(/,(\s*[}\]])/g, '$1')

  try { return JSON.parse(repaired) } catch {}

  return null
}

export async function searchNiches(
  query:   string,
  filters: Record<string, boolean>,
  plan:    string,
  geo =    'US'
): Promise<NicheResult[]> {
  const maxResults = plan === 'free' ? 3 : 8

  // Señales en vivo con timeout 4s para no bloquear en móvil
  let trendContext = ''
  try {
    const result = await Promise.race([
      getTrends(geo),
      new Promise<null>(r => setTimeout(() => r(null), 4000)),
    ])
    if (result) trendContext = buildTrendContext(result)
  } catch (e) {
    console.warn('[ai] Trends no disponibles:', e)
  }

  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v).map(([k]) => k).join(', ')

  const systemPrompt = trendContext
    ? `${BASE_SYSTEM}\n\nSEÑALES EN VIVO:\n${trendContext}`
    : BASE_SYSTEM

  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc || 'ninguno'}
País: ${geo}
Máximo: ${maxResults} nichos
Fecha: ${new Date().toISOString().split('T')[0]}

Devuelve SOLO el array JSON con ${maxResults} nichos. Todos los campos completos. Sin texto extra.`

  let text = ''
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 8096,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })
    text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')
  } catch (err: any) {
    console.error('[ai] Error Anthropic:', err?.status, err?.message)
    if (err?.status === 401) throw new Error('ANTHROPIC_API_KEY inválida. Ve a Railway → Variables y compruébala.')
    if (err?.status === 429) throw new Error('Límite de la IA alcanzado. Espera unos minutos.')
    if (err?.status === 402 || err?.message?.includes('credit'))
      throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
    throw new Error('Error conectando con la IA. Inténtalo de nuevo.')
  }

  console.log('[ai] Respuesta recibida. Longitud:', text.length, 'chars. Inicio:', text.slice(0, 80))

  const parsed = repairAndParse(text)

  if (!parsed) {
    console.error('[ai] JSON no reparable. Texto completo:', text)
    throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.')
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed]
  console.log('[ai] Nichos parseados correctamente:', arr.length)
  return arr.slice(0, maxResults) as NicheResult[]
}
