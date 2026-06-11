import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center', background:'var(--c1)' }}>

      <div style={{ fontSize:11, letterSpacing:'2px', color:'var(--acc3)', textTransform:'uppercase', fontWeight:500, marginBottom:'1rem' }}>
        IA en tiempo real · Google Trends · TikTok · Amazon · 180+ países
      </div>

      <h1 style={{ fontSize:'clamp(2.2rem,6vw,4.5rem)', fontWeight:800, lineHeight:1.05, letterSpacing:'-2px', marginBottom:'1.25rem', maxWidth:700 }}>
        El radar de nichos<br />
        <span style={{ color:'var(--acc)' }}>dropshipping</span> más preciso
      </h1>

      <p style={{ color:'var(--t2)', fontSize:'1.05rem', maxWidth:500, lineHeight:1.7, marginBottom:'2.5rem' }}>
        Claude AI cruza señales de Google Trends, TikTok Shop y Amazon Movers en tiempo real para encontrar nichos rentables antes que nadie.
      </p>

      <div style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center', marginBottom:'2.5rem' }}>
        <Link href="/dashboard" className="np-btn-primary" style={{ fontSize:'1rem', padding:'14px 32px' }}>
          ✦ Empezar gratis — sin tarjeta
        </Link>
        <Link href="/pricing" className="np-btn-outline" style={{ fontSize:'1rem', padding:'14px 32px' }}>
          Ver planes →
        </Link>
      </div>

      <div style={{ display:'flex', gap:24, flexWrap:'wrap', justifyContent:'center' }}>
        {['✓ 5 búsquedas gratis / día','✓ Sin tarjeta de crédito','✓ Funciona en 180+ países'].map(f => (
          <span key={f} style={{ fontSize:13, color:'var(--acc3)' }}>{f}</span>
        ))}
      </div>

    </main>
  )
}
