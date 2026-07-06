import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createLogger } from '@/lib/logger'

const log = createLogger('api/opportunity-alerts')

async function authUser(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  const db = getSupabaseAdmin()
  const { data: { user }, error } = await db.auth.getUser(token)
  if (error || !user) return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  return { db, user }
}

// Lista las últimas alertas del feed de oportunidades del usuario.
// (Antes vivía en /api/opportunity-preview — renombrado porque el nombre
// no describía la función real: lee y marca alertas ya generadas por el
// cron, no "previsualiza" nada. Coincide ahora con la tabla real
// `opportunity_alerts` que consulta.)
export async function GET(req: NextRequest) {
  const auth = await authUser(req)
  if (auth.error) return auth.error
  const { db, user } = auth
  const { data, error } = await db.from('opportunity_alerts')
    .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30)
  if (error) {
    log.error('Error listando alertas', { userId: user.id, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ alerts: data ?? [], unread: (data ?? []).filter((a: any) => !a.read).length })
}

// Marca una alerta (o todas) como leída.
export async function PATCH(req: NextRequest) {
  const auth = await authUser(req)
  if (auth.error) return auth.error
  const { db, user } = auth
  const body = await req.json().catch(() => ({}))
  let q = db.from('opportunity_alerts').update({ read: true }).eq('user_id', user.id)
  q = body.id ? q.eq('id', body.id) : q.eq('read', false)
  const { error } = await q
  if (error) {
    log.error('Error marcando alertas como leídas', { userId: user.id, error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
