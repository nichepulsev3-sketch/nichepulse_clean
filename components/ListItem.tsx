'use client'
import type { ReactNode } from 'react'
import { scoreColor } from '@/lib/types'

/**
 * Fila de lista compartida — extraído de favorites/page.tsx y
 * watchlist/page.tsx, que repetían el mismo contenedor y el mismo bloque
 * "score + borrar" carácter por carácter. Mismos valores exactos.
 */
export function ListRow({ children }: { children: ReactNode }) {
  return (
    <div style={{ background:'var(--bg-subtle)', border:'1px solid var(--brd-1)', borderRadius:14, padding:'1rem 1.25rem', display:'flex', gap:14, alignItems:'flex-start' }}>
      {children}
    </div>
  )
}

export function ScoreDeleteAction({ score, display, onDelete, deleteTitle }: { score: number; display?: string | number; onDelete: () => void; deleteTitle: string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
      <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:800, color:scoreColor(score) }}>{display ?? score}</div>
      <button onClick={onDelete} title={deleteTitle}
        style={{ background:'none', border:'none', color:'var(--txt-3)', cursor:'pointer', fontSize:14, padding:4 }}>
        🗑️
      </button>
    </div>
  )
}
