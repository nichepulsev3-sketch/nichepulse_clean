'use client'
import { useState } from 'react'
import { SCORE_META, SCORE_ORDER, scoreCardColor, type IntelligenceScores, type ScoreKey } from '@/lib/types'

/**
 * Motor de Inteligencia — Grid de 12 scores explicados.
 * Filosofía: nunca mostrar un número sin su motivo. Cada score es
 * pulsable para expandir/colapsar los "reasons" que lo justifican —
 * así el usuario puede escanear en 5 segundos (colapsado) o profundizar
 * en el que le importe (expandido), sin saturar la pantalla de golpe.
 */
export default function ScoreGrid({ scores, compact=false }: { scores?: IntelligenceScores; compact?: boolean }) {
  const [expanded, setExpanded] = useState<ScoreKey | null>(null)

  if (!scores) {
    return (
      <div style={{ fontSize:12, color:'var(--t3)', textAlign:'center', padding:'10px', background:'rgba(255,255,255,0.03)', borderRadius:10 }}>
        Esta búsqueda es de antes del Motor de Inteligencia — vuelve a analizar este nicho para ver el desglose completo de 12 scores.
      </div>
    )
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns: compact ? 'repeat(auto-fill,minmax(120px,1fr))' : 'repeat(auto-fill,minmax(150px,1fr))', gap:8 }}>
      {SCORE_ORDER.map(key => {
        const card = scores[key]
        if (!card) return null
        const meta  = SCORE_META[key]
        const color = scoreCardColor(key, card.value)
        const isOpen = expanded === key
        return (
          <button
            key={key}
            onClick={() => setExpanded(isOpen ? null : key)}
            title={meta.help}
            style={{
              textAlign:'left', cursor:'pointer', fontFamily:'var(--font-body)',
              background:'var(--c3)', border:`1px solid ${isOpen ? color+'80' : 'rgba(255,255,255,0.08)'}`,
              borderRadius:10, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4,
              gridColumn: isOpen ? '1 / -1' : undefined,
              transition:'border-color .15s',
            }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:6 }}>
              <span style={{ fontSize:11, color:'var(--t2)', display:'flex', alignItems:'center', gap:4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                <span>{meta.icon}</span>{meta.label}
              </span>
              <span style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, color, flexShrink:0 }}>{card.value}</span>
            </div>
            <div style={{ height:4, borderRadius:2, background:'rgba(255,255,255,0.08)', overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${card.value}%`, background:color, borderRadius:2, transition:'width .3s' }} />
            </div>
            {isOpen && card.reasons.length > 0 && (
              <ul style={{ listStyle:'none', marginTop:4, display:'flex', flexDirection:'column', gap:3 }}>
                {card.reasons.map((r, i) => (
                  <li key={i} style={{ fontSize:12, color:'var(--t2)', display:'flex', gap:6, alignItems:'flex-start' }}>
                    <span style={{ color, flexShrink:0 }}>•</span>{r}
                  </li>
                ))}
              </ul>
            )}
          </button>
        )
      })}
    </div>
  )
}
