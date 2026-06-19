'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const TEXTS = {
  es:{ title1:'El radar de nichos',   title2:'dropshipping',           title3:'más preciso del mundo', sub:'Claude AI cruza señales de mercado en tiempo real para encontrar nichos rentables antes que nadie.', cta:'Iniciar sesión', ctaSub:'Plan gratuito disponible · Sin tarjeta', plans:'Ver planes →', features:['✓ 5 búsquedas gratis al día','✓ Sin tarjeta de crédito','✓ 180+ países disponibles'] },
  en:{ title1:'The most precise',     title2:'dropshipping niche',     title3:'radar in the world',    sub:'Claude AI cross-references real-time market signals to find profitable niches before anyone else.',  cta:'Sign in',       ctaSub:'Free plan available · No credit card', plans:'View plans →',  features:['✓ 5 free searches per day','✓ No credit card','✓ 180+ countries'] },
  pt:{ title1:'O radar de nichos',    title2:'dropshipping',           title3:'mais preciso do mundo', sub:'Claude AI cruza sinais de mercado em tempo real para encontrar nichos lucrativos antes de todos.',    cta:'Entrar',        ctaSub:'Plano gratuito disponível · Sem cartão', plans:'Ver planos →',  features:['✓ 5 pesquisas grátis por dia','✓ Sem cartão','✓ 180+ países'] },
  fr:{ title1:'Le radar de niches',   title2:'dropshipping',           title3:'le plus précis au monde',sub:"Claude AI croise des signaux de marché en temps réel pour trouver des niches rentables.",           cta:'Se connecter',  ctaSub:'Plan gratuit disponible · Sans carte', plans:'Voir plans →',   features:['✓ 5 recherches gratuites/jour','✓ Sans carte de crédit','✓ 180+ pays'] },
  de:{ title1:'Der präziseste',        title2:'Dropshipping-Nischen',   title3:'Radar der Welt',         sub:'Claude AI verknüpft Echtzeit-Marktsignale, um profitable Nischen zu finden.',                       cta:'Anmelden',      ctaSub:'Kostenloser Plan · Keine Kreditkarte', plans:'Pläne ansehen →',features:['✓ 5 kostenlose Suchen/Tag','✓ Keine Kreditkarte','✓ 180+ Länder'] },
}

export default function Home() {
  const [t, setT] = useState(TEXTS.es)
  useEffect(() => {
    const lang = navigator.language.toLowerCase().slice(0,2)
    setT(TEXTS[lang as keyof typeof TEXTS] ?? TEXTS.es)
  }, [])

  return (
    <main style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'2rem', textAlign:'center', background:'var(--c1)', position:'relative', overflow:'hidden' }}>
      {/* Blobs */}
      <div style={{ position:'absolute', top:'-15%', left:'-10%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,111,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,107,157,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1, maxWidth:700, width:'100%' }}>
        <h1 style={{ fontSize:'clamp(2rem,6vw,4.5rem)', fontWeight:800, lineHeight:1.05, letterSpacing:'-2px', marginBottom:'1.25rem' }}>
          {t.title1}<br/>
          <span style={{ background:'var(--g1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{t.title2}</span><br/>
          {t.title3}
        </h1>
        <p style={{ color:'var(--t2)', fontSize:'1.05rem', maxWidth:480, margin:'0 auto 2.5rem', lineHeight:1.7 }}>{t.sub}</p>

        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, marginBottom:'2rem' }}>
          <div style={{ display:'flex', gap:14, flexWrap:'wrap', justifyContent:'center' }}>
            <Link href="/auth/login" className="np-btn-primary" style={{ fontSize:'1.05rem', padding:'14px 36px', textDecoration:'none' }}>{t.cta}</Link>
            <Link href="/pricing" className="np-btn-outline" style={{ fontSize:'1rem', padding:'14px 28px' }}>{t.plans}</Link>
          </div>
          <div style={{ fontSize:12, color:'var(--t3)' }}>{t.ctaSub}</div>
        </div>

        <div style={{ display:'flex', gap:20, flexWrap:'wrap', justifyContent:'center' }}>
          {t.features.map(f=><span key={f} style={{ fontSize:13, color:'var(--acc3)' }}>{f}</span>)}
        </div>
      </div>
    </main>
  )
}
