'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

type Platform = 'android' | 'ios' | 'pc' | 'unknown'

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  if (/Android/.test(ua)) return 'android'
  const isIpad = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
  if (/iPad|iPhone|iPod/.test(ua) || isIpad) return 'ios'
  return 'pc'
}

const STEPS = {
  android: [
    { icon:'🌐', title:'Abre Chrome',        desc:'Asegúrate de usar Google Chrome en tu Android.' },
    { icon:'⋮',  title:'Toca el menú',       desc:'Pulsa los tres puntos (⋮) arriba a la derecha de Chrome.' },
    { icon:'📲', title:'Añadir a inicio',    desc:'Selecciona "Añadir a pantalla de inicio" o "Instalar app".' },
    { icon:'✅', title:'¡Instalada!',         desc:'NichePulse aparecerá en tu escritorio como una app nativa.' },
  ],
  ios: [
    { icon:'🌐', title:'Abre Safari',        desc:'Abre esta página en Safari (no funciona en Chrome para iOS).' },
    { icon:'📤', title:'Pulsa Compartir',    desc:'Toca el botón compartir ⬆ en la barra inferior de Safari.' },
    { icon:'🏠', title:'Añadir a inicio',   desc:'Desplázate y toca "Añadir a pantalla de inicio".' },
    { icon:'✅', title:'¡Instalada!',         desc:'NichePulse aparecerá en tu pantalla de inicio de iPhone/iPad.' },
  ],
  pc: [
    { icon:'🌐', title:'Abre Chrome o Edge', desc:'Usa Google Chrome o Microsoft Edge en tu ordenador.' },
    { icon:'💻', title:'Mira la barra',      desc:'Verás un icono de instalación (⊕) en la barra de direcciones.' },
    { icon:'📥', title:'Haz clic e instala', desc:'Haz clic en el icono e instala NichePulse como app de escritorio.' },
    { icon:'✅', title:'¡Instalada!',         desc:'NichePulse abrirá en su propia ventana sin barra del navegador.' },
  ],
  unknown: [],
}

const PLATFORM_LABELS = {
  android: { name:'Android',    icon:'🤖', color:'#3ddc84', bg:'rgba(61,220,132,0.1)',  border:'rgba(61,220,132,0.3)'  },
  ios:     { name:'iPhone/iPad',icon:'🍎', color:'#555',    bg:'rgba(100,100,100,0.12)',border:'rgba(150,150,150,0.3)' },
  pc:      { name:'PC / Mac',   icon:'💻', color:'#7c6fff', bg:'rgba(124,111,255,0.1)',  border:'rgba(124,111,255,0.3)' },
  unknown: { name:'Dispositivo',icon:'📱', color:'#7c6fff', bg:'rgba(124,111,255,0.1)',  border:'rgba(124,111,255,0.3)' },
}

export default function DownloadPage() {
  const [platform,      setPlatform]      = useState<Platform>('unknown')
  const [active,        setActive]        = useState<Platform>('pc')
  const [deferredPrompt,setDeferredPrompt]= useState<any>(null)
  const [installed,     setInstalled]     = useState(false)
  const [installing,    setInstalling]    = useState(false)

  useEffect(() => {
    const p = detectPlatform()
    setPlatform(p)
    setActive(p === 'unknown' ? 'pc' : p)

    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler as EventListener)
    window.addEventListener('appinstalled', () => setInstalled(true))
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener)
  }, [])

  async function handleInstall() {
    if (!deferredPrompt) return
    setInstalling(true)
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setInstalled(true)
    setDeferredPrompt(null)
    setInstalling(false)
  }

  const tabs: Platform[] = ['android','ios','pc']

  return (
    <div style={{ minHeight:'100vh', background:'var(--c1)', color:'var(--t1)', fontFamily:'var(--font-body)', padding:0 }}>

      {/* NAV */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid rgba(124,111,255,0.15)', background:'rgba(8,8,15,0.96)', backdropFilter:'blur(16px)', position:'sticky', top:0, zIndex:100 }}>
        <Link href="/" style={{ fontFamily:'var(--font-display)', fontSize:'1.15rem', fontWeight:800, textDecoration:'none', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ background:'var(--g1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Niche</span>
          <span style={{ color:'var(--t1)' }}>Pulse</span>
        </Link>
        <Link href="/dashboard" className="np-btn-primary" style={{ textDecoration:'none', padding:'8px 18px', fontSize:13 }}>
          Abrir app →
        </Link>
      </nav>

      {/* HERO */}
      <div style={{ textAlign:'center', padding:'3rem 1.5rem 2rem', position:'relative', overflow:'hidden' }}>
        <div style={{ position:'absolute', top:'-20%', left:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,111,255,0.1) 0%,transparent 70%)', pointerEvents:'none' }}/>
        <div style={{ position:'absolute', bottom:'-20%', right:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,107,157,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>

        {/* Icono app */}
        <div style={{ width:88, height:88, borderRadius:24, background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.25rem', boxShadow:'0 8px 32px rgba(124,111,255,0.4)', fontFamily:'var(--font-display)', fontSize:'2.2rem', fontWeight:800, color:'#fff' }}>N</div>

        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.75rem,5vw,3rem)', fontWeight:800, letterSpacing:'-1px', marginBottom:'.75rem', lineHeight:1.1 }}>
          Descarga <span style={{ background:'var(--g1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NichePulse</span>
        </h1>
        <p style={{ color:'var(--t2)', fontSize:'1rem', maxWidth:480, margin:'0 auto 2rem', lineHeight:1.7 }}>
          Instálala gratis en tu dispositivo y accede a tu motor Multi-IA de nichos dropshipping desde cualquier lugar, como una app nativa.
        </p>

        {/* Botón de instalación directa (Chrome/Android/Edge) */}
        {!installed && deferredPrompt && (
          <button onClick={handleInstall} disabled={installing}
            style={{ background:'var(--g1)', color:'#fff', border:'none', padding:'14px 36px', borderRadius:28, fontSize:'1rem', fontWeight:700, cursor:'pointer', fontFamily:'var(--font-body)', boxShadow:'0 6px 24px rgba(124,111,255,0.45)', display:'inline-flex', alignItems:'center', gap:10, marginBottom:'1.5rem', transition:'all .2s', opacity:installing?.7:1 }}>
            {installing
              ? <><span style={{ width:18, height:18, border:'2px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .7s linear infinite' }}/> Instalando...</>
              : <>📲 Instalar ahora gratis</>
            }
          </button>
        )}
        {installed && (
          <div style={{ background:'rgba(0,229,195,0.1)', border:'1px solid rgba(0,229,195,0.4)', borderRadius:12, padding:'12px 24px', display:'inline-flex', alignItems:'center', gap:8, fontSize:15, color:'var(--acc3)', marginBottom:'1.5rem' }}>
            ✅ NichePulse instalada correctamente en tu dispositivo
          </div>
        )}

        {/* Plataforma detectada */}
        {platform !== 'unknown' && (
          <div style={{ fontSize:13, color:'var(--t3)', marginBottom:'2rem' }}>
            Hemos detectado que usas{' '}
            <span style={{ color:PLATFORM_LABELS[platform].color, fontWeight:600 }}>
              {PLATFORM_LABELS[platform].icon} {PLATFORM_LABELS[platform].name}
            </span>
            {' '}— las instrucciones de tu plataforma están marcadas abajo.
          </div>
        )}
      </div>

      {/* TABS DE PLATAFORMA */}
      <div style={{ maxWidth:680, margin:'0 auto', padding:'0 1.5rem 4rem' }}>
        <div style={{ display:'flex', gap:8, marginBottom:'1.5rem', background:'var(--c2)', borderRadius:14, padding:6 }}>
          {tabs.map(t => {
            const lbl = PLATFORM_LABELS[t]
            const isActive = active === t
            const isCurrent = platform === t
            return (
              <button key={t} onClick={() => setActive(t)}
                style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:isActive?700:400, transition:'all .2s', background:isActive?'var(--g1)':'transparent', color:isActive?'#fff':'var(--t2)', boxShadow:isActive?'0 2px 12px rgba(124,111,255,0.4)':'none', display:'flex', alignItems:'center', justifyContent:'center', gap:5 }}>
                {lbl.icon} {lbl.name}
                {isCurrent && !isActive && <span style={{ fontSize:10, background:'var(--acc3)', color:'#000', borderRadius:6, padding:'1px 5px', fontWeight:700 }}>TÚ</span>}
              </button>
            )
          })}
        </div>

        {/* PASOS */}
        <div style={{ display:'grid', gap:12, marginBottom:'2rem' }}>
          {(STEPS[active] ?? []).map((step, i) => (
            <div key={i} style={{ background:'var(--c2)', border:'1px solid rgba(124,111,255,0.15)', borderRadius:14, padding:'1rem 1.25rem', display:'flex', gap:14, alignItems:'flex-start', transition:'all .2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(124,111,255,0.4)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(124,111,255,0.15)'}
            >
              <div style={{ width:44, height:44, borderRadius:12, background:'linear-gradient(135deg,rgba(124,111,255,0.15),rgba(255,107,157,0.1))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem', flexShrink:0 }}>{step.icon}</div>
              <div style={{ flex:1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                  <span style={{ width:20, height:20, borderRadius:'50%', background:'var(--g1)', color:'#fff', fontSize:11, fontWeight:700, display:'inline-flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</span>
                  <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.9rem' }}>{step.title}</span>
                </div>
                <p style={{ fontSize:13, color:'var(--t2)', margin:0, lineHeight:1.5 }}>{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AVISO ESPECÍFICO iOS */}
        {active === 'ios' && (
          <div style={{ background:'rgba(100,100,100,0.1)', border:'1px solid rgba(150,150,150,0.25)', borderRadius:12, padding:'12px 16px', marginBottom:'1.5rem', fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>
            🍎 <strong style={{ color:'var(--t1)' }}>Solo funciona desde Safari.</strong> Chrome, Firefox y otros navegadores en iOS no permiten instalar apps en la pantalla de inicio. Copia esta URL y pégala en Safari si estás en otro navegador.
          </div>
        )}

        {/* AVISO PC */}
        {active === 'pc' && (
          <div style={{ background:'rgba(124,111,255,0.08)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:12, padding:'12px 16px', marginBottom:'1.5rem', fontSize:13, color:'var(--t2)', lineHeight:1.6 }}>
            💡 <strong style={{ color:'var(--t1)' }}>También en Firefox:</strong> ve a <em>Herramientas → Instalar este sitio como app</em>. En Safari Mac: <em>Archivo → Añadir a Dock</em>.
          </div>
        )}

        {/* CARACTERÍSTICAS */}
        <div style={{ background:'var(--c2)', border:'1px solid rgba(124,111,255,0.15)', borderRadius:16, padding:'1.5rem', marginBottom:'2rem' }}>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.95rem', marginBottom:'1rem', textAlign:'center' }}>¿Por qué instalarla como app?</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
            {[
              ['⚡','Más rápida','Sin barra del navegador, acceso instantáneo'],
              ['📴','Modo offline','Accede a tus últimas búsquedas sin internet'],
              ['🔔','Notificaciones','Alertas de tendencias en tiempo real (próx.)'],
              ['🏠','En tu inicio','Como cualquier app nativa del dispositivo'],
            ].map(([icon,title,desc]) => (
              <div key={title} style={{ background:'rgba(124,111,255,0.06)', borderRadius:10, padding:'10px 12px' }}>
                <div style={{ fontSize:'1.1rem', marginBottom:3 }}>{icon}</div>
                <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{title}</div>
                <div style={{ fontSize:11, color:'var(--t3)', lineHeight:1.4 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* SECCIÓN CEO */}
        <div style={{ background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(255,107,157,0.06))', border:'1px solid rgba(124,111,255,0.2)', borderRadius:16, padding:'1.5rem', textAlign:'center' }}>
          <div style={{ width:64, height:64, borderRadius:'50%', background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1rem', fontSize:'1.5rem', fontWeight:800, color:'#fff', fontFamily:'var(--font-display)', boxShadow:'0 4px 16px rgba(124,111,255,0.4)' }}>M</div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.1rem', marginBottom:3 }}>Manel Solsona Joya</div>
          <div style={{ fontSize:12, color:'var(--acc)', fontWeight:600, marginBottom:'.75rem', letterSpacing:'.5px', textTransform:'uppercase' }}>CEO & Fundador · NichePulse</div>
          <p style={{ fontSize:13, color:'var(--t2)', lineHeight:1.6, maxWidth:420, margin:'0 auto', marginBottom:'1rem' }}>
            NichePulse nació con la misión de democratizar el análisis de mercado para emprendedores dropshipping de todo el mundo, usando IA de última generación.
          </p>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:'var(--t3)', background:'var(--c3)', borderRadius:8, padding:'4px 10px' }}>🌍 Global</span>
            <span style={{ fontSize:11, color:'var(--t3)', background:'var(--c3)', borderRadius:8, padding:'4px 10px' }}>🤖 Multi-IA</span>
            <span style={{ fontSize:11, color:'var(--t3)', background:'var(--c3)', borderRadius:8, padding:'4px 10px' }}>📦 Dropshipping</span>
            <span style={{ fontSize:11, color:'var(--t3)', background:'var(--c3)', borderRadius:8, padding:'4px 10px' }}>🚀 2024</span>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
