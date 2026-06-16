import Anthropic from '@anthropic-ai/sdk'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BASE_SYSTEM = `Eres NichePulse AI, el mejor analista de nichos de dropshipping del mundo.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. 
Sin texto antes ni después. Sin bloques de código. Sin explicaciones. SOLO el array JSON.

Por cada nicho usa exactamente esta estructura:
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
  "insights": ["insight específico 1","insight específico 2","insight específico 3"],
  "suppliers": [{"name":"AliExpress","note":"Gran catálogo"},{"name":"Spocket","note":"Envío rápido"}],
  "keywords": ["keyword1","keyword2","keyword3"],
  "ad_channels": ["TikTok Ads","Meta Ads","Google Shopping"],
  "trend_source": "organic"
}

Devuelve entre 3 y 10 nichos ordenados por score. SOLO el array JSON, nada más.`

export async function searchNiches(
  query: string,
  filters: Record<string, boolean>,
  plan: string,
  geo = 'US'
): Promise<NicheResult[]> {
  const maxResults = plan === 'free' ? 3 : 10

  let trendContext = ''
  try {
    const trends = await getTrends(geo)
    trendContext = buildTrendContext(trends)
  } catch {
    trendContext = ''
  }

  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const systemPrompt = trendContext
    ? `${BASE_SYSTEM}\n\nSEÑALES EN VIVO:\n${trendContext}`
    : BASE_SYSTEM

  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc || 'ninguno'}
País: ${geo}
Máximo: ${maxResults} nichos
Fecha: ${new Date().toISOString().split('T')[0]}

Devuelve SOLO el array JSON con los mejores nichos de dropshipping para esta consulta.`

  let text = ''
  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
    text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('')
  } catch (err: any) {
    console.error('[ai] Error llamando a Anthropic:', err?.message)
    throw new Error('Error conectando con la IA. Verifica tu ANTHROPIC_API_KEY.')
  }

  console.log('[ai] Respuesta raw (primeros 200 chars):', text.slice(0, 200))

  // Intentar extraer JSON de varias formas
  let parsed: any = null

  // Intento 1: respuesta limpia
  try {
    const clean = text.replace(/```json|```/g, '').trim()
    parsed = JSON.parse(clean)
  } catch {}

  // Intento 2: buscar array JSON dentro del texto
  if (!parsed) {
    try {
      const match = text.match(/\[[\s\S]*\]/)
      if (match) parsed = JSON.parse(match[0])
    } catch {}
  }

  // Intento 3: buscar objeto con clave niches
  if (!parsed) {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const obj = JSON.parse(match[0])
        parsed = obj.niches ?? obj.results ?? obj.data ?? null
      }
    } catch {}
  }

  if (!parsed) {
    console.error('[ai] No se pudo parsear JSON. Texto completo:', text)
    throw new Error('La IA devolvió un formato incorrecto. Inténtalo de nuevo.')
  }

  const arr = Array.isArray(parsed) ? parsed : [parsed]
  return arr.slice(0, maxResults) as NicheResult[]
}
