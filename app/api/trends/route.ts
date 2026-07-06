import { NextRequest, NextResponse } from 'next/server'
import { getTrends } from '@/lib/trends'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/trends')

export async function GET(req: NextRequest) {
  const geo     = (req.nextUrl.searchParams.get('geo') ?? 'US').toUpperCase().slice(0, 2)
  const refresh =  req.nextUrl.searchParams.get('refresh') === 'true'

  try {
    const trends = await getTrends(geo, refresh)
    return NextResponse.json(trends, {
      headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=3600' },
    })
  } catch (err) {
    log.error('Error obteniendo tendencias', { error: (err as any)?.message ?? String(err) })
    return NextResponse.json({ error: 'Error al obtener tendencias' }, { status: 500 })
  }
}
