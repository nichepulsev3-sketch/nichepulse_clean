'use client'
import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

type Outcome = 'exito' | 'fracaso' | 'en_curso' | 'no_probado'

const OUTCOME_OPTIONS: { value: Outcome; label: string; icon: string }[] = [
  { value: 'exito',      label: 'Sí, funcionó',        icon: '✅' },
  { value: 'en_curso',   label: 'Lo estoy probando',    icon: '⏳' },
  { value: 'fracaso',    label: 'No funcionó',          icon: '❌' },
]

/**
 * Motor propio (Fase 1) — ver MOTOR_PROPIO_PROPUESTA.md.
 * Página a la que llega el usuario desde el email de seguimiento
 * 30/60/90 días. Captura el resultado REAL de un nicho que vigiló —
 * el dato que hoy no existe y que algún día permitirá entrenar un
 * modelo propio en vez de depender solo de la opinión de la IA.
 */
export default function FeedbackPage() {
  const params = useParams<{ watchlistId: string }>()
  const searchParams = useSearchParams()
  const milestone = (Number(searchParams.get('milestone')) || 30) as 30 | 60 | 90

  const [loading, setLoading]   = useState(true)
  const [nicheName, setNicheName] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [tried, setTried]       = useState<boolean | null>(null)
  const [outcome, setOutcome]   = useState<Outcome | null>(null)
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone]         = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        window.location.href = `/auth/login?redirect=/feedback/${params.watchlistId}?milestone=${milestone}`
        return
      }
      load()
    })
  }, [])

  async function load() {
    // RLS ya garantiza que solo se puede leer si el watchlist es del
    // usuario autenticado — no hace falta ninguna comprobación extra aquí.
    const { data } = await supabase.from('watchlist').select('niche_name').eq('id', params.watchlistId).single()
    if (!data) { setNotFound(true); setLoading(false); return }
    setNicheName(data.niche_name)
    setLoading(false)
  }

  async function submit() {
    if (tried === null) return
    setSubmitting(true)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/niche-outcomes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          watchlistId: params.watchlistId,
          milestoneDays: milestone,
          tried,
          outcome: tried ? (outcome ?? 'en_curso') : 'no_probado',
          notes: notes.trim() || undefined,
        }),
      })
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'Error al enviar') }
      setDone(true)
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo enviar. Inténtalo de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--txt-1)', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.25rem' }}>
      <div style={{ maxWidth: 440, width: '100%', background: 'var(--bg-subtle)', border: '1px solid var(--brd-1)', borderRadius: 20, padding: '2rem 1.75rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: 'var(--txt-3)', fontSize: 13 }}>Cargando...</div>
        ) : notFound ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12, opacity: .5 }}>🔍</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>No encontramos este nicho</div>
            <div style={{ fontSize: 13, color: 'var(--txt-3)' }}>Puede que ya no esté en tu watchlist.</div>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 12 }}>🙏</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: 6 }}>¡Gracias por tu respuesta!</div>
            <div style={{ fontSize: 13, color: 'var(--txt-3)' }}>Nos ayuda a que el análisis de nichos sea cada vez más preciso.</div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 8 }}>Ayúdanos a mejorar</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.15rem', marginBottom: 20 }}>
              Hace {milestone} días vigilabas<br />"{nicheName}"
            </div>

            <div style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 10 }}>¿Llegaste a probarlo?</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              <button onClick={() => { setTried(true) }} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${tried === true ? 'var(--brand)' : 'var(--brd-1)'}`, background: tried === true ? 'var(--brand-soft)' : 'transparent', color: tried === true ? 'var(--brand)' : 'var(--txt-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}>Sí, lo probé</button>
              <button onClick={() => { setTried(false); setOutcome(null) }} style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: `1px solid ${tried === false ? 'var(--brand)' : 'var(--brd-1)'}`, background: tried === false ? 'var(--brand-soft)' : 'transparent', color: tried === false ? 'var(--brand)' : 'var(--txt-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)' }}>No, todavía no</button>
            </div>

            {tried === true && (
              <>
                <div style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 10 }}>¿Qué tal te fue?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
                  {OUTCOME_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => setOutcome(o.value)}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: `1px solid ${outcome === o.value ? 'var(--brand)' : 'var(--brd-1)'}`, background: outcome === o.value ? 'var(--brand-soft)' : 'transparent', color: outcome === o.value ? 'var(--brand)' : 'var(--txt-2)', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', textAlign: 'left' }}>
                      <span>{o.icon}</span>{o.label}
                    </button>
                  ))}
                </div>
              </>
            )}

            <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Algo más que quieras contarnos (opcional)"
              className="input" style={{ width: '100%', minHeight: 70, marginBottom: 16, resize: 'vertical' }} maxLength={500} />

            {error && <div style={{ fontSize: 12, color: '#f43f5e', marginBottom: 12 }}>{error}</div>}

            <button onClick={submit} disabled={tried === null || submitting}
              style={{ width: '100%', padding: '12px 20px', borderRadius: 10, border: 'none', background: tried === null ? 'var(--bg-subtle)' : 'var(--g-brand)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: tried === null ? 'not-allowed' : 'pointer', opacity: submitting ? .6 : 1 }}>
              {submitting ? 'Enviando...' : 'Enviar respuesta'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
