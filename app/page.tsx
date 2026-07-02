'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const TEXTS = {
  es:{ title1:'El radar de nichos', title2:'dropshipping', title3:'más preciso del mundo', sub:'Motor Multi-IA (Claude + GPT) cruza señales en tiempo real para encontrar nichos rentables.', cta:'Iniciar sesión', dl:'⬇ Descargar app', plans:'Ver planes →', features:['✓ 5 búsquedas gratis al día','✓ Sin tarjeta de crédito','✓ 180+ países disponibles'] },
  en:{ title1:'The most precise', title2:'dropshipping niche', title3:'radar in the world', sub:'Multi-AI engine (Claude + GPT) cross-references real-time signals to find profitable niches.', cta:'Sign in', dl:'⬇ Download app', plans:'View plans →', features:['✓ 5 free searches per day','✓ No credit card','✓ 180+ countries'] },
  pt:{ title1:'O radar de nichos', title2:'dropshipping', title3:'mais preciso do mundo', sub:'Motor Multi-IA cruza sinais em tempo real para encontrar nichos lucrativos.', cta:'Entrar', dl:'⬇ Baixar app', plans:'Ver planos →', features:['✓ 5 pesquisas grátis por dia','✓ Sem cartão','✓ 180+ países'] },
  fr:{ title1:'Le radar de niches', title2:'dropshipping', title3:'le plus précis au monde', sub:"Moteur Multi-IA croise des signaux en temps réel pour trouver des niches rentables.", cta:'Se connecter', dl:'⬇ Télécharger', plans:'Voir plans →', features:['✓ 5 recherches gratuites/jour','✓ Sans carte','✓ 180+ pays'] },
  de:{ title1:'Der präziseste', title2:'Dropshipping-Nischen', title3:'Radar der Welt', sub:'Multi-KI-Motor verknüpft Echtzeit-Signale, um profitable Nischen zu finden.', cta:'Anmelden', dl:'⬇ App herunterladen', plans:'Pläne ansehen →', features:['✓ 5 kostenlose Suchen/Tag','✓ Keine Kreditkarte','✓ 180+ Länder'] },
}

export default function Home() {
  const [t, setT] = useState(TEXTS.es)
  useEffect(() => {
    const lang = navigator.language.toLowerCase().slice(0,2)
    setT(TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.es)
  }, [])

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--c1)', position:'relative', overflow:'hidden' }}>
      {/* Blobs de fondo */}
      <div style={{ position:'absolute', top:'-15%', left:'-10%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,111,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,107,157,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

      {/* Contenido principal */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem 1.5rem', textAlign:'center', position:'relative', zIndex:1 }}>

        {/* Icono app */}
        <div style={{ width:72, height:72, borderRadius:20, background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'1.5rem', boxShadow:'0 8px 28px rgba(124,111,255,0.4)', fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:800, color:'#fff' }}>N</div>

        <h1 style={{ fontSize:'clamp(2rem,6vw,4.5rem)', fontWeight:800, lineHeight:1.05, letterSpacing:'-2px', marginBottom:'1.25rem', maxWidth:700 }}>
          {t.title1}<br/>
          <span style={{ background:'var(--g1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{t.title2}</span><br/>
          {t.title3}
        </h1>

        <p style={{ color:'var(--t2)', fontSize:'1.05rem', maxWidth:480, margin:'0 auto 2.5rem', lineHeight:1.7 }}>{t.sub}</p>

        {/* CTAs */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, marginBottom:'2rem' }}>
          <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
            <Link href="/auth/login" className="np-btn-primary" style={{ fontSize:'1rem', padding:'13px 32px', textDecoration:'none' }}>
              {t.cta}
            </Link>
            <Link href="/download" style={{
              display:'inline-flex', alignItems:'center', gap:7,
              background:'rgba(124,111,255,0.1)', color:'var(--acc)',
              border:'1px solid rgba(124,111,255,0.35)', padding:'13px 24px',
              borderRadius:24, fontSize:'1rem', fontWeight:600,
              textDecoration:'none', transition:'all .2s',
            }}>
              {t.dl}
            </Link>
          </div>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
            <Link href="/pricing" style={{ fontSize:14, color:'var(--t3)', textDecoration:'none' }}>{t.plans}</Link>
          </div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>Sin tarjeta de crédito · Cancela cuando quieras</div>
        </div>

        {/* Features */}
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'center', marginBottom:'3rem' }}>
          {t.features.map(f => <span key={f} style={{ fontSize:13, color:'var(--acc3)' }}>{f}</span>)}
        </div>

        {/* Plataformas disponibles */}
        <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
          {[['🤖','Android'],['🍎','iOS'],['💻','PC / Mac']].map(([icon,name]) => (
            <Link key={name} href="/download" style={{ display:'flex', alignItems:'center', gap:6, background:'var(--c2)', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 14px', textDecoration:'none', color:'var(--t2)', fontSize:13, transition:'all .2s' }}>
              <span>{icon}</span><span>{name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* FOOTER CEO */}
      <footer style={{ borderTop:'1px solid rgba(255,255,255,0.06)', padding:'1.5rem', textAlign:'center', position:'relative', zIndex:1 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom:8 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.9rem', color:'#fff' }}>M</div>
          <div style={{ textAlign:'left' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--t1)' }}>Manel Solsona Joya</div>
            <div style={{ fontSize:11, color:'var(--acc)', fontWeight:500 }}>CEO & Fundador · NichepulseV.3</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:'var(--t3)' }}>
          © 2024 NichepulseV.3 · Multi-motor de IA para dropshipping ·{' '}
          <Link href="/download" style={{ color:'var(--acc)', textDecoration:'none' }}>Descargar app</Link>
          {' '}·{' '}
          <Link href="/pricing" style={{ color:'var(--t3)', textDecoration:'none' }}>Planes</Link>
        </div>
      </footer>
    </main>
  )
}
