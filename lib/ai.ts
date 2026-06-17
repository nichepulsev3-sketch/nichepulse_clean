import Anthropic from '@anthropic-ai/sdk'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BASE_SYSTEM = `Eres NichePulse AI, el mejor analista de nichos de dropshipping del mundo.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO.
Sin texto antes ni después. Sin bloques de código. Sin explicaciones. SOLO el array JSON.

Por cada nicho devuelve EXACTAMENTE esta estructura completa:
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
  "insights": [
    "insight específico 1 con datos reales",
    "insight específico 2 con demografía",
    "insight específico 3 con plataformas"
  ],
  "suppliers": [
    {"name":"AliExpress","note":"Gran catálogo, envío 15-30 días"},
    {"name":"Spocket","note":"Proveedores EU/US, envío 3-7 días"}
  ],
  "keywords": ["keyword principal","keyword 2","keyword 3","keyword 4","keyword 5"],
  "ad_channels": ["TikTok Ads","Meta Ads","Google Shopping"],
  "trend_source": "organic",
  "target_audience": "Descripción detallada del público objetivo: edad, intereses, comportamiento de compra",
  "avg_ticket": "$35-65",
  "seasonality": "Describe si tiene picos estacionales, meses fuertes o si es evergreen",
  "risks": [
    "Riesgo 1 específico de este nicho",
    "Riesgo 2 a considerar",
    "Riesgo 3 importante"
  ],
  "getting_started": [
    "Paso 1: acción concreta para empezar este nicho",
    "Paso 2: siguiente acción específica",
    "Paso 3: cómo validar antes de invertir mucho"
  ],
  "winning_angle": "El ángulo de marketing único que diferencia este nicho de la competencia"
}

Reglas:
- PRIORIZA nichos con señales reales en los datos en vivo.
- Score mayor de 85 solo para oportunidades excepcionales.
- Los insights, risks y getting_started deben ser MUY ESPECÍFICOS para este nicho.
- target_audience debe incluir edad, intereses y comportamiento real del comprador.
- winning_angle debe ser accionable e inspirador, no genérico.
- Devuelve entre 3 y 10 nichos ordenados por score. SOLO el array JSON.`

export async function searchNiches(
  query:   string,
  filters: Record<string, boolean>,
  plan:    string,
  geo =    'US'
): Promise<NicheResult[]> {
  const maxResults = plan === 'free' ? 3 : 10

  // Obtener señales en vivo con timeout de 4s para no bloquear en móvil
  let trendContext = ''
  try {
    const trendPromise    = getTrends(geo)
    const timeoutPromise  = new Promise<null>(r => setTimeout(() => r(null), 4000))
    const result          = await Promise.race([trendPromise, timeoutPromise])
    if (result) trendContext = buildTrendContext(result)
  } catch (e) {
    console.warn('[ai] Trends no disponibles, continuando sin contexto:', e)
  }

  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v).map(([k]) => k).join(', ')

  const systemPrompt = trendContext
    ? `${BASE_SYSTEM}\n\nSEÑALES EN VIVO:\n${trendContext}`
    : BASE_SYSTEM

  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc || 'ninguno'}
País/Mercado: ${geo}
Máximo: ${maxResults} nichos
Fecha: ${new Date().toISOString().split('T')[0]}

Devuelve SOLO el array JSON con análisis COMPLETOS y DETALLADOS de cada nicho.`

  let text = ''
  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 6000,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })
    text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as any).text)
      .join('')
  } catch (err: any) {
    console.error('[ai] Error Anthropic:', err?.status, err?.message)

    if (err?.status === 401)
      throw new Error('ANTHROPIC_API_KEY inválida. Ve a Railway → Variables y comprueba que empieza por sk-ant-')
    if (err?.status === 429)
      throw new Error('Límite de la API de Anthropic alcanzado. Espera unos minutos e inténtalo de nuevo.')
    if (err?.status === 402 || err?.message?.includes('credit'))
      throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing y recarga.')

    throw new Error('Error conectando con la IA. Inténtalo de nuevo en unos segundos.')
  }

  console.log('[ai] Respuesta raw (200 chars):', text.slice(0, 200))

  // Extraer JSON de varias formas
  let parsed: any = null

  try { parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) } catch {}

  if (!parsed) {
    try { const m = text.match(/\[[\s\S]*\]/); if (m) parsed = JSON.parse(m[0]) } catch {}
  }
  if (!parsed) {
    try { const m = text.match(/\{[\s\S]*\}/); if (m) { const o = JSON.parse(m[0]); parsed = o.niches ?? o.results ?? o.data } } catch {}
  }

  if (!parsed) {
    console.error('[ai] JSON no parseable. Texto:', text.slice(0, 500))
    throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.')
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed]
  return arr.slice(0, maxResults) as NicheResult[]
}
