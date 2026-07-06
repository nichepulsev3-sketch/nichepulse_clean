'use client'
import { useState, useEffect } from 'react'
import type { ReactNode } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

type Stats = {
  generatedAt: string
  totals: { totalOutcomes: number; tried: number; notTried: number }
  byOutcome: { exito: number; fracaso: number; en_curso: number; no_probado: number }
  byMilestone: { milestone: number; emailsSent: number; responses: number; responseRate: number | null }[]
  eligibleWatchlist: number
  recent: { niche_name: string; milestone_days: number; tried: boolean; outcome: string; revenue_range: string | null; reported_at: string }[]
}

const OUTCOME_LABELS: Record<string, string> = {
  exito: '✅ Éxito',
  fracaso: '❌ Fracaso',
  en_curso: '⏳ En curso',
  no_probado: '⬜ No probado',
}

/**
 * Motor propio — panel de monitoreo (ver MOTOR_PROPIO_PROPUESTA.md).
 * Página de solo lectura, protegida en middleware.ts + por email en
 * env.ADMIN_EMAILS (comprobado también en la API). Sirve para vigilar,
 * sin entrar a Supabase a mano, cuántos resultados reales van llegando
 * antes de decidir si ya hay masa crítica para entrenar algo (Camino B).
 */
export default function MotorPropioAdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowser()

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth/login?redirect=/admin/motor-propio'; return }
      const res = await fetch('/api/admin/motor-propio-stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.status === 403) { setError('No tienes acceso a este panel.'); setLoading(false); return }
      if (!res.ok) throw new Error('No se pudo cargar')
      setStats(await res.json())
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--txt-1)', fontFamily: 'var(--font-body)', padding: '2.5rem 1.25rem' }}>
      <div style={{ maxWidth: 880, margin: '0 auto' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 8 }}>Motor propio</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.6rem', marginBottom: 4 }}>Captura de resultados reales</h1>
        <div style={{ fontSize: 13, color: 'var(--txt-3)', marginBottom: 28 }}>
          Cuántos usuarios Pro/Agency responden si un nicho vigilado funcionó o no. Ver <code>MOTOR_PROPIO_PROPUESTA.md</code> para el contexto completo.
        </div>

        {loading && <div style={{ color: 'var(--txt-3)', fontSize: 13 }}>Cargando...</div>}

        {error && (
          <div style={{ padding: '14px 16px', borderRadius: 10, border: '1px solid var(--brd-1)', background: 'var(--bg-subtle)', fontSize: 13, color: '#f43f5e' }}>
            {error}
          </div>
        )}

        {stats && (
          <>
            {/* Totales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
              <Card label="Resultados capturados" value={stats.totals.totalOutcomes} />
              <Card label="Probaron el nicho" value={stats.totals.tried} />
              <Card label="No lo probaron" value={stats.totals.notTried} />
              <Card label="En pipeline (Pro/Agency)" value={stats.eligibleWatchlist} />
            </div>

            {/* Por resultado */}
            <SectionTitle>Desglose por resultado</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
              {Object.entries(stats.byOutcome).map(([k, v]) => (
                <Card key={k} label={OUTCOME_LABELS[k] ?? k} value={v} />
              ))}
            </div>

            {/* Tasa de respuesta por hito */}
            <SectionTitle>Tasa de respuesta por hito</SectionTitle>
            <div style={{ border: '1px solid var(--brd-1)', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
                    <Th>Hito</Th><Th>Emails enviados</Th><Th>Respuestas</Th><Th>Tasa</Th>
                  </tr>
                </thead>
                <tbody>
                  {stats.byMilestone.map(m => (
                    <tr key={m.milestone} style={{ borderTop: '1px solid var(--brd-1)' }}>
                      <Td>{m.milestone} días</Td>
                      <Td>{m.emailsSent}</Td>
                      <Td>{m.responses}</Td>
                      <Td>{m.responseRate !== null ? `${m.responseRate}%` : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Últimas respuestas */}
            <SectionTitle>Últimas respuestas</SectionTitle>
            {stats.recent.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--txt-3)' }}>Todavía no ha llegado ninguna respuesta.</div>
            ) : (
              <div style={{ border: '1px solid var(--brd-1)', borderRadius: 14, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-subtle)', textAlign: 'left' }}>
                      <Th>Nicho</Th><Th>Hito</Th><Th>Resultado</Th><Th>Fecha</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid var(--brd-1)' }}>
                        <Td>{r.niche_name}</Td>
                        <Td>{r.milestone_days}d</Td>
                        <Td>{OUTCOME_LABELS[r.outcome] ?? r.outcome}</Td>
                        <Td>{new Date(r.reported_at).toLocaleDateString('es-ES')}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 20 }}>
              Generado {new Date(stats.generatedAt).toLocaleString('es-ES')} · <button onClick={load} style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', padding: 0, fontSize: 11, textDecoration: 'underline' }}>refrescar</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--brd-1)', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.4rem' }}>{value}</div>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt-2)', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>{children}</div>
}

function Th({ children }: { children: ReactNode }) {
  return <th style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--txt-2)' }}>{children}</th>
}

function Td({ children }: { children: ReactNode }) {
  return <td style={{ padding: '10px 14px' }}>{children}</td>
}
