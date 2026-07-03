'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'

function LoginForm() {
  const params   = useSearchParams()
  const router   = useRouter()
  const redirect = params.get('redirect') ?? '/dashboard'
  const ref      = params.get('ref')      ?? ''
  const [mode,    setMode]    = useState<'login'|'signup'>('login')
  const [email,   setEmail]   = useState('')
  const [password,setPassword]= useState('')
  const [name,    setName]    = useState('')
  const [loading, setLoading] = useState(false)
  const [msg,     setMsg]     = useState('')
  const [err,     setErr]     = useState('')
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    const e = params.get('oauth_error')
    if (e) setErr(`Error de acceso: ${decodeURIComponent(e)}`)
  }, [params])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErr(''); setMsg('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) { setErr(error.message); return }
        router.push(redirect)
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: name, referred_by: ref || undefined } },
        })
        if (error) { setErr(error.message); return }
        setMsg('¡Revisa tu email para confirmar tu cuenta y empieza gratis!')
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100dvh', display:'flex', background:'var(--bg-base)', position:'relative', overflow:'hidden' }}>
      {/* Left panel - decorative (desktop only) */}
      <div style={{ flex:'0 0 45%', display:'none', position:'relative', overflow:'hidden' }} className="login-hero">
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,var(--bg-subtle) 0%,var(--bg-muted) 100%)' }}/>
        <div className="bg-grid" style={{ position:'absolute', inset:0, opacity:.5 }}/>
        <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'3rem', zIndex:1 }}>
          <div style={{ width:72, height:72, borderRadius:20, background:'var(--g-brand)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'2rem', color:'#fff', marginBottom:'1.5rem', boxShadow:'var(--shadow-brand)' }}>N</div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1.6rem', letterSpacing:'-0.03em', marginBottom:'.75rem', background:'var(--g-brand)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NichepulseV.3</div>
          <p style={{ color:'var(--txt-2)', fontSize:14, textAlign:'center', lineHeight:1.7, maxWidth:300 }}>
            El motor Multi-IA más avanzado para encontrar nichos rentables de dropshipping.
          </p>
          <div style={{ marginTop:'2.5rem', display:'flex', flexDirection:'column', gap:12, width:'100%', maxWidth:300 }}>
            {['Motor Claude + GPT en paralelo','Opportunity Score propio 0-100','Radar de nichos en tiempo real','Análisis consultor con SWOT','Favoritos y alertas inteligentes'].map(f => (
              <div key={f} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color:'var(--txt-2)' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--green-soft)', border:'1px solid rgba(16,185,129,0.3)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <span style={{ color:'var(--green)', fontSize:11 }}>✓</span>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem' }}>
        <div style={{ width:'100%', maxWidth:400 }}>
          {/* Mobile logo */}
          <div style={{ textAlign:'center', marginBottom:'2rem' }}>
            <Link href="/" style={{ textDecoration:'none', display:'inline-block' }}>
              <div style={{ width:48, height:48, borderRadius:14, background:'var(--g-brand)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.3rem', color:'#fff', boxShadow:'var(--shadow-brand)' }}>N</div>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', marginTop:8, background:'var(--g-brand)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NichepulseV.3</div>
            </Link>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', background:'var(--bg-muted)', borderRadius:12, padding:4, marginBottom:'1.75rem' }}>
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setErr(''); setMsg('') }}
                style={{ flex:1, padding:'9px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:13, fontWeight:500, transition:'all var(--t-base)',
                  background: mode===m ? 'var(--g-brand)' : 'transparent',
                  color: mode===m ? '#fff' : 'var(--txt-2)',
                  boxShadow: mode===m ? 'var(--shadow-brand)' : 'none',
                }}>
                {m==='login' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {mode==='signup' && (
              <div>
                <label style={{ fontSize:12, color:'var(--txt-3)', display:'block', marginBottom:5, fontWeight:500, textTransform:'uppercase', letterSpacing:'.5px' }}>Nombre</label>
                <input className="input" type="text" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" required/>
              </div>
            )}
            <div>
              <label style={{ fontSize:12, color:'var(--txt-3)', display:'block', marginBottom:5, fontWeight:500, textTransform:'uppercase', letterSpacing:'.5px' }}>Email</label>
              <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@email.com" required/>
            </div>
            <div>
              <label style={{ fontSize:12, color:'var(--txt-3)', display:'block', marginBottom:5, fontWeight:500, textTransform:'uppercase', letterSpacing:'.5px' }}>Contraseña</label>
              <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" minLength={8} required/>
            </div>

            {err && (
              <div style={{ background:'var(--red-soft)', border:'1px solid rgba(244,63,94,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, color:' var(--red)', lineHeight:1.5 }}>
                {err}
              </div>
            )}
            {msg && (
              <div style={{ background:'var(--green-soft)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'10px 14px', fontSize:13, color:'var(--green)', lineHeight:1.5 }}>
                ✓ {msg}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ background:'var(--g-brand)', color:'#fff', border:'none', padding:'13px', borderRadius:10, fontSize:14, fontWeight:600, cursor:loading?'wait':'pointer', fontFamily:'var(--font-body)', boxShadow:'var(--shadow-brand)', transition:'opacity var(--t-fast)', opacity:loading?.7:1, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading
                ? <><span style={{ width:16,height:16,border:'2px solid rgba(255,255,255,.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin .7s linear infinite',display:'inline-block' }}/> Cargando...</>
                : mode==='login' ? '→ Entrar' : '✦ Crear cuenta gratis'
              }
            </button>
          </form>

          {mode === 'signup' && (
            <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:6 }}>
              {['✓ 5 búsquedas gratis al día','✓ Sin tarjeta de crédito','✓ Análisis Multi-IA incluido'].map(f => (
                <div key={f} style={{ fontSize:12, color:'var(--teal)', display:'flex', alignItems:'center', gap:6 }}>{f}</div>
              ))}
            </div>
          )}

          <div style={{ textAlign:'center', marginTop:'1.25rem', fontSize:13, color:'var(--txt-3)' }}>
            ¿Tienes problemas?{' '}
            <a href="mailto:soporte@nichepulse.com" style={{ color:'var(--brand)', textDecoration:'none' }}>Contactar soporte</a>
          </div>
        </div>
      </div>

      <style>{`
        @media (min-width: 900px) { .login-hero { display: flex !important; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100dvh', background:'var(--bg-base)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--txt-2)' }}>Cargando...</div>}>
      <LoginForm/>
    </Suspense>
  )
}
