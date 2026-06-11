import Anthropic from '@anthropic-ai/sdk'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const BASE_SYSTEM = `Eres NichePulse AI, el mejor analista de nichos de dropshipping del mundo.
Tienes acceso a datos de mercado en tiempo real.
Responde ÚNICAMENTE con un array JSON. Sin texto extra, sin markdown, sin explicaciones fuera del JSON.

Por cada nicho devuelve exactamente esta estructura:
{
  "name": "nombre específico del nicho",
  "score": <número 0-100, confianza de la IA>,
  "market_size": "$X.XB o $XXXM",
  "margin": "XX-XX%",
  "competition": "Baja" | "Media" | "Alta",
  "trend": "↑ XX% YoY" | "↓ XX% YoY" | "→ Estable",
  "trend_pct": <número positivo o negativo>,
  "profit_score": <número 0-100>,
  "tags": ["trending","low_comp","high_margin","evergreen","seasonal","viral"],
  "insights": ["insight 1 específico", "insight 2 específico", "insight 3 específico"],
  "suppliers": [
    {"name": "AliExpress | Spocket | CJ Dropshipping | Zendrop", "note": "nota corta"},
    {"name": "...", "note": "..."}
  ],
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "ad_channels": ["TikTok Ads", "Meta Ads", "Google Shopping", "Pinterest Ads"],
  "trend_source": "google" | "tiktok" | "amazon" | "organic"
}

Reglas:
- PRIORIZA nichos que aparezcan en las señales en vivo del bloque siguiente.
- Score mayor de 85 solo para oportunidades excepcionales con datos reales.
- Los insights deben ser ESPECÍFICOS: menciona plataformas, demografías, comportamientos reales.
- Si un nicho aparece en TikTok, menciona el hashtag y las vistas en los insights.
- Si aparece en Amazon, menciona el salto de posición.
- Si aparece en Google Trends, menciona el volumen de tráfico.
- Devuelve entre 3 y 10 nichos ordenados por score descendente.`

export async function searchNiches(
  query: string,
  filters: Record<string, boolean>,
  plan: string,
  geo = 'US'
): Promise<NicheResult[]> {
  const maxResults = plan === 'free' ? 3 : 10

  // Obtener señales en vivo para enriquecer el prompt
  let trendContext = ''
  try {
    const trends = await getTrends(geo)
    trendContext = buildTrendContext(trends)
  } catch {
    trendContext = '(Señales en vivo no disponibles — usando conocimiento base)'
  }

  const filterDesc = Object.entries(filters)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ')

  const systemPrompt = `${BASE_SYSTEM}

────────────────────────────────────────
${trendContext}
────────────────────────────────────────

Cruza la consulta del usuario con las señales anteriores.
Si la consulta tiene relación con alguna keyword en tendencia, sube su score 5-15 puntos y menciona la señal en los insights.`

  const userPrompt = `Consulta: "${query}"
Filtros activos: ${filterDesc || 'ninguno'}
País/Mercado: ${geo}
Máximo de resultados: ${maxResults}
Fecha de hoy: ${new Date().toISOString().split('T')[0]}

Encuentra los mejores nichos de dropshipping. Prioriza los que tengan señales reales en los datos en vivo.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as any).text)
    .join('')

  const clean = text.replace(/```json|```/g, '').trim()

  try {
    const parsed = JSON.parse(clean)
    const arr = Array.isArray(parsed) ? parsed : (parsed.niches ?? [])
    return arr.slice(0, maxResults) as NicheResult[]
  } catch {
    throw new Error('La IA devolvió un formato incorrecto. Inténtalo de nuevo.')
  }
}
