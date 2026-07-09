'use client'
import { useState, useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'
import { recordInteraction } from '@/lib/services/nicheGraph'
import type { FavoriteNiche } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'
import SubPageNav from '@/components/SubPageNav'
import EmptyState from '@/components/EmptyState'
import { ListRow, ScoreDeleteAction } from '@/components/ListItem'
import ScoreGrid from '@/components/ScoreGrid'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteNiche[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [collection,setCollection]= useState<string|null>(null)
  const [expanded,  setExpanded]  = useState<string|null>(null)
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user) { window.location.href='/auth/login'; return }
      loadFavorites()
    })
  }, [])

  async function loadFavorites() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    // NOTA: la columna real en la tabla es `niche_data` (ver migración 003),
    // pero el resto de este componente (y el tipo FavoriteNiche) siempre
    // esperó un campo `niche` — sin el alias de abajo, `fav.niche` era
    // siempre undefined y esta página nunca mostró de verdad nombre, market
    // size ni margin de ningún favorito. Bug preexistente encontrado al
    // conectar el Niche Intelligence Graph, corregido de paso.
    // AUDITORIA_LANZAMIENTO_V1.md, P0.5: sin .limit() esta consulta traía
    // TODOS los favoritos del usuario sin cota -- inofensivo con pocos,
    // una consulta cada vez más pesada según crece la cuenta. 500 es muy
    // por encima de cualquier uso real hoy, pero pone un techo explícito.
    const { data } = await supabase.from('favorites').select('id, user_id, niche:niche_data, note, tags, collection, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500)
    if (data) setFavorites(data as any)
    setLoading(false)
  }

  async function removeFavorite(id: string) {
    const fav = favorites.find(f => f.id === id)
    await supabase.from('favorites').delete().eq('id', id)
    setFavorites(f => f.filter(x => x.id !== id))
    if (fav?.niche?.name) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) recordInteraction(supabase, { userId: user.id, nicheName: fav.niche.name, type: 'favorite_remove' })
    }
  }

  const collections = Array.from(new Set(favorites.map(f => f.collection).filter(Boolean)))
  const filtered = favorites.filter(f => {
    const matchSearch = !search || f.niche?.name?.toLowerCase().includes(search.toLowerCase())
    const matchColl = !collection || f.collection === collection
    return matchSearch && matchColl
  })

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--txt-1)', fontFamily:'var(--font-body)' }}>
      <SubPageNav icon="⭐" title="Favoritos" right={<span className="badge badge-brand">{favorites.length} guardados</span>} />

      <div style={{ maxWidth:900, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Search + filter */}
        <div style={{ display:'flex', gap:10, marginBottom:'1.5rem', flexWrap:'wrap' }}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar en favoritos..."
            className="input" style={{ maxWidth:280 }}/>
          {collections.map(c => (
            <button key={c!} onClick={() => setCollection(collection===c?null:c!)}
              style={{ padding:'6px 14px', borderRadius:99, border:`1px solid ${collection===c?'var(--brand)':'var(--brd-1)'}`, background:collection===c?'var(--brand-soft)':'var(--bg-subtle)', color:collection===c?'var(--brand)':'var(--txt-2)', fontFamily:'var(--font-body)', fontSize:12, cursor:'pointer' }}>
              📁 {c}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonCard variant="list" count={4}/>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="⭐"
            title={favorites.length === 0 ? 'Sin favoritos guardados' : 'Sin resultados'}
            description={favorites.length === 0 ? 'Guarda nichos desde el dashboard para verlos aquí.' : 'Prueba con otro término de búsqueda.'}
            ctaLabel={favorites.length === 0 ? 'Buscar nichos →' : undefined}
            ctaHref={favorites.length === 0 ? '/dashboard' : undefined}
          />
        ) : (
          <div style={{ display:'grid', gap:10 }}>
            {filtered.map(fav => {
              const isOpen = expanded === fav.id
              const hasScores = !!fav.niche?.scores
              return (
                <div key={fav.id}>
                  <ListRow>
                    <div style={{ flex:1, cursor: hasScores ? 'pointer' : 'default' }} onClick={() => hasScores && setExpanded(isOpen ? null : fav.id)}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.92rem' }}>{fav.niche?.name ?? '—'}</span>
                        {fav.collection && <span className="badge badge-brand" style={{ fontSize:10 }}>📁 {fav.collection}</span>}
                        {hasScores && (
                          <span style={{ fontSize: 11, color: 'var(--brand)' }}>{isOpen ? '▲ ocultar por qué' : '▼ ver por qué'}</span>
                        )}
                      </div>
                      <div style={{ display:'flex', gap:10, fontSize:12, color:'var(--txt-3)', flexWrap:'wrap' }}>
                        {fav.niche?.market_size && <span>📊 {fav.niche.market_size}</span>}
                        {fav.niche?.margin      && <span>💰 {fav.niche.margin}</span>}
                        <span>📅 {new Date(fav.created_at).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</span>
                      </div>
                      {fav.note && <div style={{ fontSize:12, color:'var(--txt-2)', marginTop:6, fontStyle:'italic' }}>"{fav.note}"</div>}
                      {fav.tags?.length > 0 && (
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
                          {fav.tags.map(t => <span key={t} className="badge badge-teal" style={{ fontSize:10 }}>{t}</span>)}
                        </div>
                      )}
                    </div>
                    <ScoreDeleteAction
                      score={fav.niche?.opportunity_score ?? fav.niche?.profit_score ?? 0}
                      display={fav.niche?.opportunity_score ?? fav.niche?.profit_score ?? '—'}
                      onDelete={() => removeFavorite(fav.id)}
                      deleteTitle="Eliminar favorito"
                    />
                  </ListRow>
                  {isOpen && hasScores && (
                    <div style={{ marginTop: 8, padding: '10px 4px' }}>
                      <ScoreGrid scores={fav.niche.scores} compact />
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
