'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'
import { scoreColor, VERDICT_META } from '@/lib/types'
import type { Verdict } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'

interface WatchRow {
  id: string
  niche_name: string
  query: string
  geo: string
  last_score: number | null
  last_verdict: Verdict | null
  niche_data: any
  created_at: string
}

export default function WatchlistPage() {
  const [rows,    setRows]    = useState<WatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { window.location.href = '/auth/login'; return }
      load()
    })
  }, [])

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('watchlist').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (data) setRows(data as any)
    setLoading(false)
  }

  async function remove(id: string) {
    await supabase.from('watchlist').delete().eq('id', id)
    setRows(r => r.filter(x => x.id !== id))
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--txt-1)', fontFamily: 'var(--font-body)' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--brd-1)', background: 'var(--bg-float)', backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/dashboard" style={{ color: 'var(--txt-3)', textDecoration: 'none', fontSize: 13 }}>← Dashboard</Link>
          <span style={{ color: 'var(--brd-2)' }}>|</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700 }}>👁 Watchlist</span>
        </div>
        <span className="badge badge-brand">{rows.length} vigilados</span>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ fontSize: 13, color: 'var(--txt-3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Cada día revisamos estos nichos con el Motor de Inteligencia. Si el veredicto o el score cambian de forma relevante, te avisamos aquí y por email.
        </div>

        {loading ? (
          <SkeletonCard variant="list" count={4} />
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--txt-3)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: .4 }}>👁</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '.5rem', color: 'var(--txt-2)' }}>
              Sin nichos en vigilancia
            </div>
            <div style={{ fontSize: 13 }}>Pulsa "👁 Vigilar" en cualquier resultado del dashboard para añadirlo aquí.</div>
            <Link href="/dashboard" style={{ display: 'inline-block', marginTop: '1rem', padding: '10px 20px', background: 'var(--g-brand)', color: '#fff', borderRadius: 99, textDecoration: 'none', fontSize: 13, fontWeight: 600, boxShadow: 'var(--shadow-brand)' }}>
              Buscar nichos →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map(row => {
              const meta = row.last_verdict ? VERDICT_META[row.last_verdict] : null
              return (
                <div key={row.id} style={{ background: 'var(--bg-subtle)', border: '1px solid var(--brd-1)', borderRadius: 14, padding: '1rem 1.25rem', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.92rem' }}>{row.niche_name}</span>
                      {meta && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`, borderRadius: 8, padding: '2px 7px' }}>
                          {meta.icon} {meta.label}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--txt-3)', flexWrap: 'wrap' }}>
                      <span>🔍 "{row.query}"</span>
                      <span>🌍 {row.geo}</span>
                      <span>📅 vigilando desde {new Date(row.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 800, color: scoreColor(row.last_score ?? 0) }}>
                      {row.last_score ?? '—'}
                    </div>
                    <button onClick={() => remove(row.id)} title="Dejar de vigilar"
                      style={{ background: 'none', border: 'none', color: 'var(--txt-3)', cursor: 'pointer', fontSize: 14, padding: 4 }}>
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
