/**
 * /api/radar
 * Antes, app/radar/page.tsx mostraba un array `SAMPLE` hardcodeado,
 * idéntico para todos los usuarios y todos los planes, con un
 * `setTimeout` fingiendo una carga — pese a venderse en /pricing como
 * "Radar de nichos en tiempo real" exclusivo de Pro/Agency.
 *
 * Este endpoint conecta las categorías que sí tienen una señal real
 * detrás (google/tiktok/amazon, ya recolectadas y cacheadas por
 * lib/trends.ts para el motor de búsqueda) a datos en vivo de verdad.
 * Las categorías sin una señal equivalente real (baja competencia,
 * alto margen, recomendados IA — que requerirían el motor de IA
 * completo, con su coste asociado, para cada combinación posible)
 * se devuelven marcadas explícitamente con `sample: true` para que el
 * frontend nunca las presente como datos en vivo cuando no lo son.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getTrends, type TrendSignal } from '@/lib/trends'

type RadarNiche = {
  name:      string
  score:     number
  category:  string
  trend:     string
  volume:    string
  geo?:      string
  url?:      string
  source:    string
  real:      boolean
}

// Puntuación transparente derivada del crecimiento real de la señal.
// Deliberadamente NO se llama "Opportunity Score" (ese nombre está
// reservado al análisis del motor Multi-IA en lib/ai.ts, que sí evalúa
// margen/competencia/escalabilidad) — aquí es solo un índice de fuerza
// de la señal de tendencia, para no mezclar ambos conceptos de cara al usuario.
function signalStrength(growth: number, source: string): number {
  const base = source === 'amazon' ? Math.min(30, growth / 150) : Math.min(30, growth / 4)
  return Math.max(60, Math.min(97, Math.round(65 + base)))
}

function toRadarNiche(s: TrendSignal): RadarNiche {
  const trendLabel = s.source === 'amazon' ? `↑ ${s.volume}` : `↑${s.growth}%`
  return {
    name:     s.keyword.replace(/^#/, ''),
    score:    signalStrength(s.growth, s.source),
    category: s.category,
    trend:    trendLabel,
    volume:   s.volume,
    geo:      s.geo,
    url:      s.url,
    source:   s.source,
    real:     true,
  }
}

export async function GET(req: NextRequest) {
  const geo = (req.nextUrl.searchParams.get('geo') ?? 'US').toUpperCase().slice(0, 2)

  try {
    const trends = await getTrends(geo)

    const byCategory: Record<string, RadarNiche[]> = {
      tiktok:   trends.tiktok.map(toRadarNiche),
      amazon:   trends.amazon.map(toRadarNiche),
      seo:      trends.google.map(toRadarNiche),
      emerging: trends.google.slice(0, 6).map(toRadarNiche),
      viral: [...trends.tiktok, ...trends.amazon]
        .sort((a, b) => b.growth - a.growth)
        .slice(0, 6)
        .map(toRadarNiche),
    }

    return NextResponse.json({
      geo,
      fetched_at:  trends.fetched_at,
      from_cache:  trends.from_cache,
      categories:  byCategory,
      // Categorías que hoy no tienen una señal real equivalente — el
      // frontend debe mostrarlas claramente marcadas como muestra.
      sample_only: ['low_comp', 'high_margin', 'ai'],
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' },
    })
  } catch (err) {
    console.error('[api/radar]', err)
    return NextResponse.json({ error: 'Error al cargar el radar de nichos' }, { status: 500 })
  }
}
