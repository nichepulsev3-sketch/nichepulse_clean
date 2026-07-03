'use client'
import { VERDICT_META, type NicheResult, type Verdict } from '@/lib/types'

/**
 * Modo CEO — colapsa toda la búsqueda a lo único que un CEO necesita
 * para decidir en segundos: nombre, veredicto y una frase de por qué.
 * No hay scores, no hay SWOT, no hay ruido — pulsar el nicho abre el
 * detalle completo si hace falta profundizar.
 */
export default function CeoMode({
  results, onSelect,
}: {
  results: NicheResult[]
  onSelect: (n: NicheResult) => void
}) {
  const order: Verdict[] = ['invertir', 'esperar', 'evitar']
  const grouped = order.map(v => ({
    verdict: v,
    items: results.filter(n => (n.verdict ?? 'esperar') === v),
  })).filter(g => g.items.length > 0)

  if (results.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {grouped.map(({ verdict, items }) => {
        const meta = VERDICT_META[verdict]
        return (
          <div key={verdict}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              fontSize: 12, fontWeight: 700, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.8px',
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', background: meta.color, color: '#08080f', fontSize: 12,
              }}>{meta.icon}</span>
              {meta.label} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((n, i) => (
                <div key={i} onClick={() => onSelect(n)} className="card card-hover"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 16px', borderLeft: `3px solid ${meta.color}`, cursor: 'pointer', gap: 12,
                  }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{n.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--txt-3, var(--t3))', lineHeight: 1.4 }}>
                      {n.verdict_reason || n.conclusion || 'Sin motivo detallado.'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: meta.color }}>
                      {n.opportunity_score ?? n.profit_score ?? 0}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--t3)' }}>Score</div>
                  </div>
                  <span style={{ color: 'var(--acc)', fontSize: 16, flexShrink: 0 }}>→</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
