'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { recordInteraction } from '@/lib/services/nicheGraph'
import { VERDICT_META } from '@/lib/types'
import type { Verdict } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'
import SubPageNav from '@/components/SubPageNav'
import EmptyState from '@/components/EmptyState'
import { ListRow, ScoreDeleteAction } from '@/components/ListItem'
import ScoreGrid from '@/components/ScoreGrid'

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
  const [rows,     setRows]     = useState<WatchRow[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
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
    // AUDITORIA_LANZAMIENTO_V1.md, P0.5: mismo fix que favorites/page.tsx --
    // techo explícito en vez de traer la tabla completa sin cota.
    const { data } = await supabase.from('watchlist').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
    if (data) setRows(data as any)
    setLoading(false)
  }

  async function remove(id: string) {
    const row = rows.find(r => r.id === id)
    await supabase.from('watchlist').delete().eq('id', id)
    setRows(r => r.filter(x => x.id !== id))
    if (row) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) recordInteraction(supabase, { userId: user.id, nicheName: row.niche_name, type: 'watchlist_remove', geo: row.geo })
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-base)', color: 'var(--txt-1)', fontFamily: 'var(--font-body)' }}>
      <SubPageNav icon="👁" title="Watchlist" right={<span className="badge badge-brand">{rows.length} vigilados</span>} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <div style={{ fontSize: 13, color: 'var(--txt-3)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Cada día revisamos estos nichos con el Motor de Inteligencia. Si el veredicto o el score cambian de forma relevante, te avisamos aquí y por email.
        </div>

        {loading ? (
          <SkeletonCard variant="list" count={4} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon="👁"
            title="Sin nichos en vigilancia"
            description='Pulsa "👁 Vigilar" en cualquier resultado del dashboard para añadirlo aquí.'
            ctaLabel="Buscar nichos →"
            ctaHref="/dashboard"
          />
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {rows.map(row => {
              const meta = row.last_verdict ? VERDICT_META[row.last_verdict] : null
              const isOpen = expanded === row.id
              const hasScores = !!row.niche_data?.scores
              return (
                <div key={row.id}>
                  <ListRow>
                    <div style={{ flex: 1, cursor: hasScores ? 'pointer' : 'default' }} onClick={() => hasScores && setExpanded(isOpen ? null : row.id)}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '.92rem' }}>{row.niche_name}</span>
                        {meta && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}40`, borderRadius: 8, padding: '2px 7px' }}>
                            {meta.icon} {meta.label}
                          </span>
                        )}
                        {hasScores && (
                          <span style={{ fontSize: 11, color: 'var(--brand)' }}>{isOpen ? '▲ ocultar por qué' : '▼ ver por qué'}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--txt-3)', flexWrap: 'wrap' }}>
                        <span>🔍 "{row.query}"</span>
                        <span>🌍 {row.geo}</span>
                        <span>📅 vigilando desde {new Date(row.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}</span>
                      </div>
                    </div>
                    <ScoreDeleteAction
                      score={row.last_score ?? 0}
                      display={row.last_score ?? '—'}
                      onDelete={() => remove(row.id)}
                      deleteTitle="Dejar de vigilar"
                    />
                  </ListRow>
                  {isOpen && hasScores && (
                    <div style={{ marginTop: 8, padding: '10px 4px' }}>
                      <ScoreGrid scores={row.niche_data.scores} compact />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
