import Anthropic from '@anthropic-ai/sdk'
import { getTrends, buildTrendContext } from './trends'
import type { NicheResult } from './supabase'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const PRO_SYSTEM = `Eres NichePulse AI, analista experto en nichos de dropshipping.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. Sin texto fuera del array.

Estructura de cada nicho:
{
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
  "target_audience": "Descripción del comprador ideal: edad, intereses, comportamiento",
  "avg_ticket": "$35-65",
  "seasonality": "Evergreen con pico en Navidad",
  "risks": ["Riesgo 1","Riesgo 2","Riesgo 3"],
  "getting_started": ["Paso 1 concreto","Paso 2 concreto","Paso 3 concreto"],
  "winning_angle": "Ángulo de marketing diferenciador"
}
REGLAS: Comillas dobles siempre. Sin saltos de línea dentro de strings. SOLO el array JSON.`

const AGENCY_SYSTEM = `Eres un equipo de expertos en dropshipping con 10 años de experiencia validando nichos millonarios.
Tu análisis es el más profundo y preciso del mercado. Cada nicho que recomiendas ha sido VALIDADO con datos reales.
RESPONDE ÚNICAMENTE CON UN ARRAY JSON VÁLIDO. Sin texto fuera del array.

Estructura EXPERTA de cada nicho:
{
  "name": "nombre específico del nicho",
  "score": 92,
  "market_size": "$2.1B",
  "margin": "52-68%",
  "competition": "Baja",
  "trend": "↑ 47% YoY",
  "trend_pct": 47,
  "profit_score": 84,
  "tags": ["trending","low_comp","high_margin"],
  "insights": [
    "Dato validado 1: cifras exactas de mercado y comportamiento del consumidor",
    "Dato validado 2: análisis de competencia con nombres de marcas reales",
    "Dato validado 3: plataformas y estrategias con ROI documentado"
  ],
  "suppliers": [
    {"name":"AliExpress","note":"Proveedor verificado, envío 12-18 días, MOQ 1 unidad"},
    {"name":"Spocket","note":"Proveedor EU certificado, envío 3-5 días, margen neto 48%"},
    {"name":"CJ Dropshipping","note":"Stock garantizado, fulfillment automático, API disponible"}
  ],
  "keywords": ["keyword volumen alto","keyword long-tail","keyword buyer intent","keyword comparativa","keyword problema"],
  "ad_channels": ["TikTok Ads","Meta Ads","Google Shopping","Pinterest Ads","YouTube Ads"],
  "trend_source": "organic",
  "target_audience": "Perfil detallado: edad exacta, nivel socioeconómico, plataformas que usa, problema que resuelve el producto, frecuencia de compra estimada y LTV",
  "avg_ticket": "$45-85",
  "seasonality": "Análisis mensual detallado: meses fuertes, meses débiles, eventos que disparan ventas",
  "risks": [
    "Riesgo principal con probabilidad estimada y cómo mitigarlo",
    "Riesgo de mercado específico con estrategia de contingencia",
    "Riesgo operacional con solución recomendada"
  ],
  "getting_started": [
    "Semana 1: acción exacta con herramientas específicas y presupuesto recomendado",
    "Semana 2-3: validación con métricas exactas de éxito/fracaso",
    "Mes 1: escala con presupuesto mínimo recomendado y KPIs objetivo"
  ],
  "winning_angle": "Propuesta de valor única y diferenciadora basada en vacío real del mercado",
  "expert_verdict": "Veredicto final del equipo experto: por qué este nicho tiene alta probabilidad de éxito ahora mismo y cuándo es el momento ideal para entrar",
  "validated_roi": "ROI estimado en 90 días con inversión inicial de $500-1000 y las condiciones necesarias para alcanzarlo"
}
REGLAS CRÍTICAS: Comillas dobles siempre. Sin saltos de línea dentro de strings. SOLO el array JSON.`

function repairAndParse(text: string): any {
  let s = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = s.indexOf('[')
  const end   = s.lastIndexOf(']')
  if (start !== -1 && end > start) s = s.slice(start, end + 1)

  try { return JSON.parse(s) } catch {}
  s = s.replace(/,(\s*[}\]])/g, '$1')
  try { return JSON.parse(s) } catch {}

  // JSON cortado: eliminar último objeto incompleto
  const lastGood = s.lastIndexOf('},')
  if (lastGood !== -1) {
    try { return JSON.parse(s.slice(0, lastGood + 1) + ']') } catch {}
  }
  return null
}

export async function searchNiches(
  query: string, filters: Record<string, boolean>, plan: string, geo = 'US'
): Promise<NicheResult[]> {
  const isAgency   = plan === 'agency'
  const maxResults = plan === 'free' ? 3 : isAgency ? 5 : 8

  // Señales en vivo — timeout estricto 3s para no bloquear búsqueda
  let trendContext = ''
  try {
    const result = await Promise.race([
      getTrends(geo),
      new Promise<null>(r => setTimeout(() => r(null), 3000)),
    ])
    if (result) trendContext = buildTrendContext(result)
  } catch {}

  const filterDesc = Object.entries(filters).filter(([, v]) => v).map(([k]) => k).join(', ')
  const system = isAgency ? AGENCY_SYSTEM : PRO_SYSTEM
  const systemWithTrends = trendContext
    ? `${system}\n\nSEÑALES EN VIVO:\n${trendContext}`
    : system

  const userPrompt = `Consulta: "${query}"
Filtros: ${filterDesc || 'ninguno'} | País: ${geo} | Máximo: ${maxResults} nichos | Fecha: ${new Date().toISOString().split('T')[0]}
${isAgency ? 'MODO AGENCY: análisis validado por expertos. Datos verificados. Máxima profundidad.' : 'MODO PRO: análisis completo y preciso.'}
Devuelve SOLO el array JSON. Nada más.`

  let text = ''
  let lastError: any = null

  // Hasta 2 intentos automáticos si falla
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-6', max_tokens: 8096,
        system: systemWithTrends,
        messages: [{ role: 'user', content: userPrompt }],
      })
      text = response.content.filter(b => b.type === 'text').map(b => (b as any).text).join('')
      lastError = null
      break
    } catch (err: any) {
      lastError = err
      console.warn(`[ai] Intento ${attempt} fallido:`, err?.status, err?.message)
      if (err?.status === 401 || err?.status === 402) break // No reintentar en errores de auth
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500)) // Espera 1.5s antes del reintento
    }
  }

  if (lastError) {
    const s = lastError?.status
    if (s === 401) throw new Error('ANTHROPIC_API_KEY inválida. Compruébala en Railway → Variables.')
    if (s === 429) throw new Error('Límite de la IA alcanzado. Espera 1 minuto e inténtalo de nuevo.')
    if (s === 402 || lastError?.message?.includes('credit'))
      throw new Error('Sin crédito en Anthropic. Ve a console.anthropic.com → Billing.')
    throw new Error('Error conectando con la IA. Inténtalo de nuevo.')
  }

  console.log('[ai] Respuesta:', text.length, 'chars |', plan, '| inicio:', text.slice(0, 60))
  const parsed = repairAndParse(text)
  if (!parsed) {
    console.error('[ai] JSON no parseable:', text.slice(0, 300))
    throw new Error('La IA devolvió un formato inesperado. Inténtalo de nuevo.')
  }
  const arr = Array.isArray(parsed) ? parsed : [parsed]
  return arr.slice(0, maxResults) as NicheResult[]
}
