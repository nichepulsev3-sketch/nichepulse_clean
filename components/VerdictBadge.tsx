'use client'
import { VERDICT_META, type Verdict } from '@/lib/types'

/**
 * Cada pantalla debe responder "¿qué debería hacer ahora mismo?" — este
 * es el componente que convierte un score en una decisión explícita
 * (Invertir / Esperar / Evitar) en vez de dejar que el usuario interprete
 * un número por su cuenta.
 */
export default function VerdictBadge({ verdict, reason, size='sm' }: { verdict?: Verdict; reason?: string; size?: 'sm'|'lg' }) {
  if (!verdict) return null
  const meta = VERDICT_META[verdict]

  if (size === 'sm') {
    return (
      <span style={{
        display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700,
        color: meta.color, background: meta.bg, border:`1px solid ${meta.color}40`,
        borderRadius:8, padding:'2px 8px', whiteSpace:'nowrap', fontFamily:'var(--font-body)',
      }}>
        {meta.icon} {meta.label}
      </span>
    )
  }

  return (
    <div style={{
      display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:12,
      background: meta.bg, border:`1px solid ${meta.color}45`, marginBottom:'1rem',
    }}>
      <div style={{
        width:38, height:38, borderRadius:'50%', flexShrink:0, fontSize:18,
        display:'flex', alignItems:'center', justifyContent:'center',
        background: meta.color, color:'#08080f',
      }}>{meta.icon}</div>
      <div>
        <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color: meta.color }}>
          {meta.label} — veredicto del Motor de Inteligencia
        </div>
        {reason && <div style={{ fontSize:12.5, color:'var(--t2)', marginTop:2, lineHeight:1.5 }}>{reason}</div>}
      </div>
    </div>
  )
}
