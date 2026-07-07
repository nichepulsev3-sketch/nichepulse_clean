'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'
import SubPageNav from '@/components/SubPageNav'

const SUGGESTED_QUESTIONS = [
  '¿Qué negocio abrirías hoy?',
  '¿Qué nicho evitarías ahora mismo?',
  '¿Qué país elegirías para empezar?',
  '¿Dónde hay menos competencia?',
  '¿Qué tendencia está empezando ahora?',
]

interface CopilotAnswer { answer: string; basedOn: string[] }

/**
 * Fase 11 (Copiloto de negocio) — ver NICHEPULSE_PLATFORM_STRATEGY.md.
 * No es un chatbot genérico: responde con el mismo motor de IA de
 * siempre, pero con contexto real del Niche Intelligence Graph — por
 * eso cada respuesta muestra "basado en" con los datos concretos usados.
 */
export default function CopilotPage() {
  const [question,  setQuestion]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [answer,    setAnswer]    = useState<CopilotAnswer | null>(null)
  const [error,     setError]     = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/auth/login?redirect=/copilot'
    })
  }, [])

  async function ask(q: string) {
    if (!q.trim() || loading) return
    setLoading(true)
    setError(null)
    setForbidden(false)
    setAnswer(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/auth/login?redirect=/copilot'; return }
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ question: q }),
      })
      if (res.status === 403) { setForbidden(true); setLoading(false); return }
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error ?? 'No se pudo generar una respuesta') }
      setAnswer(await res.json())
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo generar una respuesta. Inténtalo de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--txt-1)', fontFamily: 'var(--font-body)' }}>
      <SubPageNav icon="🧭" title="Copiloto de negocio" />

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ fontSize: 13, color: 'var(--txt-3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Pregúntale al Copiloto como le preguntarías a un consultor: no es un chatbot genérico, responde con datos reales de los nichos analizados en NichePulse — nunca sin decir en qué se basó.
        </div>

        {forbidden ? (
          <div style={{ background: 'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(244,113,181,0.06))', border: '1px solid var(--brd-brand)', borderRadius: 14, padding: '1.25rem', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, marginBottom: '.5rem' }}>El Copiloto está disponible en Pro y Agency</div>
            <Link href="/pricing" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--g-brand)', color: '#fff', padding: '10px 22px', borderRadius: 99, textDecoration: 'none', fontSize: 13, fontWeight: 600, marginTop: 8 }}>
              ⚡ Ver Plan Pro
            </Link>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              {SUGGESTED_QUESTIONS.map(q => (
                <button key={q} onClick={() => { setQuestion(q); ask(q) }} disabled={loading}
                  style={{ padding: '7px 14px', borderRadius: 99, border: '1px solid var(--brd-1)', background: 'var(--bg-subtle)', color: 'var(--txt-2)', fontSize: 12, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font-body)' }}>
                  {q}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem' }}>
              <input value={question} onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') ask(question) }}
                placeholder="O escribe tu propia pregunta..." className="input" style={{ flex: 1 }} />
              <button onClick={() => ask(question)} disabled={loading || !question.trim()}
                style={{ padding: '0 22px', borderRadius: 10, border: 'none', background: 'var(--g-brand)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: loading ? 'default' : 'pointer', opacity: loading || !question.trim() ? .6 : 1 }}>
                {loading ? '...' : 'Preguntar'}
              </button>
            </div>

            {error && <div style={{ fontSize: 12, color: '#f43f5e', marginBottom: 16 }}>{error}</div>}

            {loading && (
              <div style={{ fontSize: 13, color: 'var(--txt-3)', textAlign: 'center', padding: '2rem 0' }}>
                Analizando señales del Graph...
              </div>
            )}

            {answer && (
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--brd-1)', borderRadius: 14, padding: '1.5rem' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: 'var(--brand)', textTransform: 'uppercase', marginBottom: 10 }}>Recomendación</div>
                <div style={{ fontSize: 15, lineHeight: 1.6, marginBottom: answer.basedOn.length ? 16 : 0 }}>{answer.answer}</div>
                {answer.basedOn.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt-3)', textTransform: 'uppercase', marginBottom: 6 }}>Basado en</div>
                    <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {answer.basedOn.map((b, i) => (
                        <li key={i} style={{ fontSize: 12, color: 'var(--txt-2)', display: 'flex', gap: 6 }}>
                          <span style={{ color: 'var(--brand)' }}>•</span>{b}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
