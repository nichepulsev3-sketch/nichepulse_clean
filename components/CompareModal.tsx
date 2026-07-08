'use client'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser, SCORE_ORDER, SCORE_META, scoreCardColor, scoreColor, type NicheResult, type Plan, type CompareVerdict } from '@/lib/supabase'

/**
 * Comparador de nichos — pone 2-3 resultados lado a lado con sus 12
 * scores superpuestos y pide a la IA un veredicto corto sobre cuál
 * elegiría. Cierra la promesa de "Comparador" que pricing/page.tsx
 * ya vendía sin que existiera la funcionalidad.
 */
export default function CompareModal({
  niches, plan, onClose, onSelectNiche,
}: {
  niches: NicheResult[]
  plan:   Plan
  onClose: () => void
  onSelectNiche: (n: NicheResult) => void
}) {
  const [verdict, setVerdict] = useState<CompareVerdict | null>(null)
  const [loading, setLoading] = useState(true)
  const [err,     setErr]     = useState('')

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true); setErr('')
      try {
        const supabase = getSupabaseBrowser()
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/compare-niches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ niches }),
        })
        const json = await res.json()
        if (!cancelled) {
          if (!res.ok) setErr(json.error ?? 'No se pudo comparar')
          else setVerdict(json.verdict)
        }
      } catch {
        if (!cancelled) setErr('Error de conexión.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflowY: 'auto', backdropFilter: 'blur(4px)' }}>
      {/* Alto acotado (nunca 'none') + cabecera fija con el botón de cerrar
          fuera del área con scroll — mismo patrón que el modal de detalle
          de nicho: si el contenido (tabla de 3 nichos x 12 scores) es más
          alto que el hueco disponible, antes el cierre podía quedar fuera
          de alcance por el clipping de flexbox centrado + overflow. */}
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 780, background: 'var(--c2)', border: '1px solid rgba(0,229,195,0.25)', borderRadius: 20, maxHeight: '90vh', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem 1.5rem 1rem', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem' }}>🆚 Comparador de nichos</div>
          <button onClick={onClose} style={{ background: 'var(--c3)', border: 'none', color: 'var(--t1)', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', padding: '1rem 1.5rem 1.5rem' }}>

        {/* Veredicto IA */}
        <div style={{ marginBottom: '1.25rem', borderRadius: 12, padding: '14px 16px', background: 'rgba(0,229,195,0.08)', border: '1px solid rgba(0,229,195,0.3)' }}>
          {loading && <div style={{ fontSize: 13, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 14, height: 14, border: '2px solid rgba(0,229,195,0.3)', borderTopColor: 'var(--acc3)', borderRadius: '50%', display: 'inline-block', animation: 'spin .7s linear infinite' }} />La IA está comparando los nichos...</div>}
          {!loading && err && <div style={{ fontSize: 13, color: '#ff9dc0' }}>{err}</div>}
          {!loading && verdict && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--acc3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
                🏆 La IA elegiría: {verdict.winner}
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>{verdict.reasoning}</div>
            </div>
          )}
        </div>

        {/* Tabla comparativa */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
            <thead>
              <tr>
                <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.6px' }}></td>
                {niches.map(n => (
                  <td key={n.name} style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, color: verdict?.winner === n.name ? 'var(--acc3)' : 'var(--t1)' }}>
                      {verdict?.winner === n.name ? '🏆 ' : ''}{n.name}
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--t3)' }}>Opportunity</td>
                {niches.map(n => (
                  <td key={n.name} style={{ padding: '6px 8px', textAlign: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: scoreColor(n.opportunity_score ?? n.profit_score ?? 0) }}>
                      {n.opportunity_score ?? n.profit_score ?? 0}
                    </span>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCORE_ORDER.filter(k => k !== 'opportunity').map(key => (
                <tr key={key} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--t2)', whiteSpace: 'nowrap' }}>
                    {SCORE_META[key].icon} {SCORE_META[key].label}
                  </td>
                  {niches.map(n => {
                    const card = n.scores?.[key]
                    const val = card?.value
                    return (
                      <td key={n.name} style={{ padding: '7px 8px', textAlign: 'center' }}>
                        {typeof val === 'number' ? (
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: scoreCardColor(key, val) }}>{val}</span>
                        ) : <span style={{ fontSize: 12, color: 'var(--t3)' }}>—</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
              <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--t2)' }}>Margen</td>
                {niches.map(n => <td key={n.name} style={{ padding: '7px 8px', textAlign: 'center', fontSize: 12 }}>{n.margin}</td>)}
              </tr>
              <tr>
                <td style={{ padding: '7px 8px', fontSize: 12, color: 'var(--t2)' }}>Mercado</td>
                {niches.map(n => <td key={n.name} style={{ padding: '7px 8px', textAlign: 'center', fontSize: 12 }}>{n.market_size}</td>)}
              </tr>
            </tbody>
          </table>
        </div>

        {/* CTA por nicho */}
        <div style={{ display: 'flex', gap: 8, marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {niches.map(n => (
            <button key={n.name} onClick={() => onSelectNiche(n)}
              style={{ flex: '1 1 auto', padding: '9px 14px', borderRadius: 10, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(124,111,255,0.3)', background: 'rgba(124,111,255,0.08)', color: 'var(--acc)', fontFamily: 'var(--font-body)' }}>
              Ver detalle de {n.name} →
            </button>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
