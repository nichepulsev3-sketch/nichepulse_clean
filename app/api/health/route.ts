import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/lib/supabase'
import { cache } from '@/lib/services/cache'
import { queue } from '@/lib/queue/QueueService'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'
import pkg from '@/package.json'

const log = createLogger('api/health')

// Cuánto puede tardar como máximo el ping a Supabase antes de darlo por caído.
const DB_PING_TIMEOUT_MS = 3000
// Si el cron diario no ha corrido con éxito en este plazo, algo va mal
// (debería correr una vez cada 24h) — 30h de margen para no marcar falso
// positivo por un retraso normal del disparador externo.
const CRON_STALE_MS = 30 * 60 * 60 * 1000

async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
  const start = Date.now()
  try {
    const db = getSupabaseAdmin()
    const query = db.from('profiles').select('id', { count: 'exact', head: true }).limit(1)
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), DB_PING_TIMEOUT_MS)
    )
    const { error } = await Promise.race([query, timeout]) as any
    const latencyMs = Date.now() - start
    if (error) return { ok: false, latencyMs, error: error.message }
    return { ok: true, latencyMs }
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err?.message ?? String(err) }
  }
}

async function checkCron(): Promise<{ ok: boolean; lastRun?: string; status?: string; error?: string }> {
  try {
    const db = getSupabaseAdmin()
    const { data, error } = await db
      .from('cron_logs')
      .select('status, started_at, finished_at')
      .eq('job_name', 'opportunity-feed')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Si la tabla no existe todavía (migración 008 no ejecutada) no
    // consideramos esto un fallo crítico del health check general — se
    // reporta como "desconocido", no como caído.
    if (error) return { ok: true, error: `no verificable: ${error.message}` }
    if (!data) return { ok: true, status: 'sin ejecuciones registradas todavía' }

    const lastRun = data.finished_at ?? data.started_at
    const ageMs = Date.now() - new Date(lastRun).getTime()
    const stale = ageMs > CRON_STALE_MS
    return { ok: data.status !== 'error' && !stale, lastRun, status: data.status }
  } catch (err: any) {
    return { ok: true, error: err?.message ?? String(err) }
  }
}

function checkCriticalEnv(): { ok: boolean; missing: string[] } {
  const missing: string[] = []
  const check = (name: string, value: string) => { if (!value) missing.push(name) }
  try { check('NEXT_PUBLIC_SUPABASE_URL', env.NEXT_PUBLIC_SUPABASE_URL) } catch { missing.push('NEXT_PUBLIC_SUPABASE_URL') }
  try { check('NEXT_PUBLIC_SUPABASE_ANON_KEY', env.NEXT_PUBLIC_SUPABASE_ANON_KEY) } catch { missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY') }
  try { check('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY) } catch { missing.push('SUPABASE_SERVICE_ROLE_KEY') }
  return { ok: missing.length === 0, missing }
}

export async function GET() {
  const [db, cron] = await Promise.all([checkDatabase(), checkCron()])
  const envCheck = checkCriticalEnv()
  const mem = process.memoryUsage()

  const criticalOk = db.ok && envCheck.ok
  const degraded = !cron.ok

  const body = {
    status: !criticalOk ? 'down' : degraded ? 'degraded' : 'ok',
    timestamp: new Date().toISOString(),
    uptime_s: Math.round(process.uptime()),
    version: (pkg as any).version ?? 'unknown',
    environment: process.env.NODE_ENV ?? 'unknown',
    node: process.version,
    railway: {
      environment: process.env.RAILWAY_ENVIRONMENT_NAME ?? null,
      service: process.env.RAILWAY_SERVICE_NAME ?? null,
      deployment_id: process.env.RAILWAY_DEPLOYMENT_ID ?? null,
      git_commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    database: { supabase: db },
    cron: { opportunity_feed: cron },
    cache: cache.stats(),
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
    },
    env_check: envCheck,
    // Cola en memoria de proceso único (ver lib/queue/QueueService.ts).
    // Real, no un placeholder — pero sin persistencia entre reinicios,
    // y todavía sin ningún flujo existente migrado a pasar por ella.
    queue: { backend: 'in-memory (sin Redis todavía)', ...queue.stats() },
  }

  if (!criticalOk) {
    log.error('Health check crítico', { db, envCheck })
  } else if (degraded) {
    log.warn('Health check degradado', { cron })
  }

  return NextResponse.json(body, { status: criticalOk ? 200 : 503 })
}
