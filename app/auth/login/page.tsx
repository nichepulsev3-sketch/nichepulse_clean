'use client'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

function LoginForm() {
  const params   = useSearchParams()
  const router   = useRouter()
  const redirect = params.get('redirect') ?? '/dashboard'
  const ref      = params.get('ref')      ?? ''

  const [mode,    setMode]    = useState<'login'|'signup'>('login')
  const [email,   setEmail]   = useState('')
  const [password,setPassword]= useState('')
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
          options: { data: { referred_by: ref || undefined } },
        })
        if (error) { setErr(error.message); return }
        setMsg('¡Revisa tu email para confirmar tu cuenta!')
      }
    } finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', background:'var(--c1)', position:'relative', overflow:'hidden' }}>

      {/* Blobs de color de fondo */}
      <div style={{ position:'absolute', top:'-20%', left:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,111,255,0.12) 0%,transparent 70%)', pointerEvents:'none' }} />
      <div style={{ position:'absolute', bottom:'-20%', right:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,107,157,0.1) 0%,transparent 70%)', pointerEvents:'none' }} />

      <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:1 }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <a href="/" style={{ textDecoration:'none', display:'inline-block' }}>
            <div style={{ fontFamily:'var(--font-display)', fontSize:'2rem', fontWeight:800, letterSpacing:'-1px' }}>
              <span style={{ background:'var(--g1)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>NichepulseV.3</span>
            </div>
          </a>
          <div style={{ fontSize:14, color:'var(--t2)', marginTop:'.5rem' }}>
            {mode==='login'?'Bienvenido de vuelta 👋':'Empieza gratis hoy 🚀'}
          </div>
        </div>

        {/* Card */}
        <div style={{ background:'var(--c2)', border:'1px solid rgba(124,111,255,0.2)', borderRadius:20, padding:'2rem', boxShadow:'0 20px 60px rgba(0,0,0,0.4)' }}>

          {/* Tabs login/signup */}
          <div style={{ display:'flex', background:'var(--c3)', borderRadius:12, padding:4, marginBottom:'1.5rem' }}>
            {(['login','signup'] as const).map(m => (
              <button key={m} onClick={()=>{setMode(m);setErr('');setMsg('')}}
                style={{ flex:1, padding:'8px', borderRadius:9, border:'none', cursor:'pointer', fontFamily:'var(--font-body)', fontSize:14, fontWeight:500, transition:'all .2s',
                  background: mode===m ? 'var(--g1)' : 'transparent',
                  color: mode===m ? '#fff' : 'var(--t2)',
                  boxShadow: mode===m ? '0 2px 8px rgba(124,111,255,0.4)' : 'none',
                }}>
                {m==='login'?'Iniciar sesión':'Crear cuenta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:12, color:'var(--t3)', display:'block', marginBottom:5, fontWeight:500, letterSpacing:'.5px', textTransform:'uppercase' }}>Email</label>
              <input className="np-input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="tu@email.com"/>
            </div>
            <div style={{ marginBottom:'1.5rem' }}>
              <label style={{ fontSize:12, color:'var(--t3)', display:'block', marginBottom:5, fontWeight:500, letterSpacing:'.5px', textTransform:'uppercase' }}>Contraseña</label>
              <input className="np-input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Mínimo 8 caracteres" minLength={8}/>
            </div>

            {err && (
              <div style={{ background:'rgba(255,60,104,0.12)', border:'1px solid rgba(255,107,157,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:13, color:'#ff9dc0', lineHeight:1.5 }}>
                {err}
              </div>
            )}
            {msg && (
              <div style={{ background:'rgba(0,229,195,0.1)', border:'1px solid rgba(0,229,195,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:'1rem', fontSize:13, color:'var(--acc3)', lineHeight:1.5 }}>
                ✓ {msg}
              </div>
            )}

            <button type="submit" disabled={loading} className="np-btn-primary" style={{ width:'100%', justifyContent:'center', fontSize:15, padding:'13px' }}>
              {loading ? <><span className="spinner" style={{ width:18, height:18, borderWidth:2 }}/> Cargando...</> : mode==='login' ? '→ Entrar' : '✦ Crear cuenta gratis'}
            </button>
          </form>

          {/* Features para convencer */}
          {mode==='signup' && (
            <div style={{ marginTop:'1.25rem', display:'flex', flexDirection:'column', gap:6 }}>
              {['✓ 5 búsquedas gratis cada día','✓ Sin tarjeta de crédito','✓ Cancela cuando quieras'].map(f=>(
                <div key={f} style={{ fontSize:12, color:'var(--acc3)', display:'flex', alignItems:'center', gap:6 }}>{f}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ textAlign:'center', marginTop:'1.25rem', fontSize:13, color:'var(--t3)' }}>
          ¿Problemas para entrar?{' '}
          <a href="mailto:soporte@nichepulse.com" style={{ color:'var(--acc)', textDecoration:'none' }}>Contactar soporte</a>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight:'100vh', background:'var(--c1)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t2)' }}>Cargando...</div>}>
      <LoginForm/>
    </Suspense>
  )
}
