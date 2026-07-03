'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'
import { scoreColor } from '@/lib/types'
import type { FavoriteNiche } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteNiche[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [collection,setCollection]= useState<string|null>(null)
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
    const { data } = await supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    if (data) setFavorites(data as any)
    setLoading(false)
  }

  async function removeFavorite(id: string) {
    await supabase.from('favorites').delete().eq('id', id)
    setFavorites(f => f.filter(x => x.id !== id))
  }

  const collections = Array.from(new Set(favorites.map(f => f.collection).filter(Boolean)))
  const filtered = favorites.filter(f => {
    const matchSearch = !search || f.niche?.name?.toLowerCase().includes(search.toLowerCase())
    const matchColl = !collection || f.collection === collection
    return matchSearch && matchColl
  })

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--txt-1)', fontFamily:'var(--font-body)' }}>
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--brd-1)', background:'var(--bg-float)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/dashboard" style={{ color:'var(--txt-3)', textDecoration:'none', fontSize:13 }}>← Dashboard</Link>
          <span style={{ color:'var(--brd-2)' }}>|</span>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700 }}>⭐ Favoritos</span>
        </div>
        <span className="badge badge-brand">{favorites.length} guardados</span>
      </nav>

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
          <div style={{ textAlign:'center', padding:'4rem', color:'var(--txt-3)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'1rem', opacity:.4 }}>⭐</div>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1.1rem', marginBottom:'.5rem', color:'var(--txt-2)' }}>
              {favorites.length === 0 ? 'Sin favoritos guardados' : 'Sin resultados'}
            </div>
            <div style={{ fontSize:13 }}>
              {favorites.length === 0 ? 'Guarda nichos desde el dashboard para verlos aquí.' : 'Prueba con otro término de búsqueda.'}
            </div>
            {favorites.length === 0 && (
              <Link href="/dashboard" style={{ display:'inline-block', marginTop:'1rem', padding:'10px 20px', background:'var(--g-brand)', color:'#fff', borderRadius:99, textDecoration:'none', fontSize:13, fontWeight:600, boxShadow:'var(--shadow-brand)' }}>
                Buscar nichos →
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gap:10 }}>
            {filtered.map(fav => (
              <div key={fav.id} style={{ background:'var(--bg-subtle)', border:'1px solid var(--brd-1)', borderRadius:14, padding:'1rem 1.25rem', display:'flex', gap:14, alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.92rem' }}>{fav.niche?.name ?? '—'}</span>
                    {fav.collection && <span className="badge badge-brand" style={{ fontSize:10 }}>📁 {fav.collection}</span>}
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
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6, flexShrink:0 }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'1.2rem', fontWeight:800, color:scoreColor(fav.niche?.opportunity_score ?? fav.niche?.score ?? 0) }}>
                    {fav.niche?.opportunity_score ?? fav.niche?.score ?? '—'}
                  </div>
                  <button onClick={() => removeFavorite(fav.id)} title="Eliminar favorito"
                    style={{ background:'none', border:'none', color:'var(--txt-3)', cursor:'pointer', fontSize:14, padding:4 }}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
