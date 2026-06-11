'use client'
import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

/* ─── Formulario (necesita Suspense por useSearchParams) ─── */
function LoginForm() {
  const params   = useSearchParams()
  const router   = useRouter()
  const redirect = params.get('redirect') ?? '/dashboard'
  const ref      = params.get('ref') ?? ''

  const [mode,     setMode]     = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')
  const [err,      setErr]      = useState('')

  const supabase = getSupabaseBrowser()

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
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${redirect}` },
    })
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--c1)' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <a href="/" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 800, color: 'var(--t1)', textDecoration: 'none' }}>
            Niche<span style={{ color: 'var(--acc)' }}>Pulse</span>
          </a>
          <div style={{ fontSize: 14, color: 'var(--t2)', marginTop: '.5rem' }}>
            {mode === 'login' ? 'Bienvenido de vuelta' : 'Crea tu cuenta gratis'}
          </div>
        </div>

        <div className="card" style={{ padding: '1.75rem' }}>

          {/* Botón Google */}
          <button onClick={handleGoogle} style={{ width: '100%', padding: '11px', borderRadius: 8, fontSize: 14, cursor: 'pointer', background: 'var(--c3)', border: '0.5px solid rgba(255,255,255,0.15)', color: 'var(--t1)', fontFamily: 'var(--font-body)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuar con Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '1.25rem' }}>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 12, color: 'var(--t3)' }}>o con email</span>
            <div style={{ flex: 1, height: '0.5px', background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Email</label>
              <input className="np-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="tu@email.com" />
            </div>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ fontSize: 12, color: 'var(--t3)', display: 'block', marginBottom: 4 }}>Contraseña</label>
              <input className="np-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mínimo 8 caracteres" minLength={8} />
            </div>

            {err && <div style={{ background: 'rgba(255,60,104,0.12)', border: '0.5px solid rgba(255,107,157,0.4)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: '#ff9dc0' }}>{err}</div>}
            {msg && <div style={{ background: 'rgba(0,229,195,0.1)', border: '0.5px solid rgba(0,229,195,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: '#00e5c3' }}>{msg}</div>}

            <button type="submit" disabled={loading} className="np-btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? .7 : 1 }}>
              {loading ? 'Cargando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta gratis'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: 14, color: 'var(--t2)' }}>
          {mode === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setErr(''); setMsg('') }}
            style={{ background: 'none', border: 'none', color: 'var(--acc)', cursor: 'pointer', fontSize: 14, fontFamily: 'var(--font-body)' }}>
            {mode === 'login' ? 'Regístrate gratis' : 'Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Export con Suspense (obligatorio para useSearchParams en Next 14) ─── */
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0a0c0' }}>Cargando...</div>}>
      <LoginForm />
    </Suspense>
  )
}
