'use client'
import Link from 'next/link'

/**
 * Estado vacío compartido — extraído de favorites/page.tsx (markup idéntico
 * repetido en watchlist/page.tsx). Mismos valores exactos que ya existían,
 * solo deja de estar duplicado.
 */
export default function EmptyState({
  icon, title, description, ctaLabel, ctaHref,
}: {
  icon: string
  title: string
  description: string
  ctaLabel?: string
  ctaHref?: string
}) {
  return (
    <div style={{ textAlign:'center', padding:'4rem', color:'var(--txt-3)' }}>
      <div style={{ fontSize:'2.5rem', marginBottom:'1rem', opacity:.4 }}>{icon}</div>
      <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', marginBottom:'.5rem', color:'var(--txt-2)' }}>
        {title}
      </div>
      <div style={{ fontSize:13 }}>{description}</div>
      {ctaLabel && ctaHref && (
        <Link href={ctaHref} style={{ display:'inline-block', marginTop:'1rem', padding:'10px 20px', background:'var(--g-brand)', color:'#fff', borderRadius:99, textDecoration:'none', fontSize:13, fontWeight:600, boxShadow:'var(--shadow-brand)' }}>
          {ctaLabel}
        </Link>
      )}
    </div>
  )
}
