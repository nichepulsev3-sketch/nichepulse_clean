'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Cabecera compartida de las sub-páginas (Favoritos, Watchlist, Radar...):
 * "← Dashboard | icono Título" a la izquierda, contenido libre a la derecha.
 * Extraído de favorites/page.tsx y watchlist/page.tsx, que tenían el mismo
 * markup duplicado carácter por carácter — mismos valores exactos, cero
 * cambio visual, solo deja de estar repetido en 3 archivos.
 */
export default function SubPageNav({ icon, title, right }: { icon: string; title: string; right?: ReactNode }) {
  return (
    <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--brd-1)', background:'var(--bg-float)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <Link href="/dashboard" style={{ color:'var(--txt-3)', textDecoration:'none', fontSize:13 }}>← Dashboard</Link>
        <span style={{ color:'var(--brd-2)' }}>|</span>
        <span style={{ fontFamily:'var(--font-display)', fontWeight:700 }}>{icon} {title}</span>
      </div>
      {right}
    </nav>
  )
}
