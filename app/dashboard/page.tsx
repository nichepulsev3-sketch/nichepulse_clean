'use client'
import { useState, useEffect, useRef } from 'react'
import { getSupabaseBrowser, searchesLeft, type NicheResult, type Profile } from '@/lib/supabase'
import TrendsPanel from '@/components/TrendsPanel'

const TAG_MAP: Record<string, [string,string]> = {
  trending:    ['tag-hot',      '🔥 Tendencia'   ],
  low_comp:    ['tag-low',      '🎯 Baja comp.'  ],
  high_margin: ['tag-trend',    '💰 Alto margen' ],
  evergreen:   ['tag-seasonal', '🌿 Evergreen'   ],
  seasonal:    ['tag-seasonal', '📅 Estacional'  ],
  viral:       ['tag-hot',      '🚀 Viral'       ],
}
const FILTERS = [
  { key:'trending',     label:'🔥 Tendencia'        },
  { key:'low_comp',     label:'🎯 Baja competencia' },
  { key:'high_margin',  label:'💰 Alto margen'      },
  { key:'global',       label:'🌍 Global'           },
  { key:'evergreen',    label:'🌿 Evergreen'        },
]
const GEOS = [
  { code:'US', label:'🇺🇸 EE.UU.'      },
  { code:'ES', label:'🇪🇸 España'       },
  { code:'MX', label:'🇲🇽 México'       },
  { code:'GB', label:'🇬🇧 Reino Unido'  },
  { code:'DE', label:'🇩🇪 Alemania'     },
  { code:'BR', label:'🇧🇷 Brasil'       },
  { code:'AR', label:'🇦🇷 Argentina'    },
  { code:'FR', label:'🇫🇷 Francia'      },
]
const SRC_PILL: Record<string,[string,string]> = {
  google:  ['#4285F4', '📈 Google'],
  tiktok:  ['#ff3b5c', '📱 TikTok'],
  amazon:  ['#ff9900', '📦 Amazon'],
  organic: ['#7c6fff', '🤖 IA'    ],
}
function scoreColor(s: number) { return s >= 90 ? '#00e5c3' : s >= 80 ? '#7c6fff' : '#ff6b9d' }

type Tab = 'search' | 'history' | 'affiliate'

export default function Dashboard() {
  const supabase = getSupabaseBrowser()
  const [profile,  setProfile]  = useState<Profile|null>(null)
  const [query,    setQuery]    = useState('')
  const [filters,  setFilters]  = useState<Record<string,boolean>>({ trending:true, low_comp:true })
  const [geo,      setGeo]      = useState('US')
  const [results,  setResults]  = useState<NicheResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<NicheResult|null>(null)
  const [tab,      setTab]      = useState<Tab>('search')
  const [history,  setHistory]  = useState<{query:string;results:NicheResult[];created_at:string}[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // Verificar suscripción si el usuario viene de un pago exitoso
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('success') === '1') {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return
        try {
          await fetch('/api/verify-subscription', {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          await loadProfile(session.user.id)
          window.history.replaceState({}, document.title, '/dashboard')
        } catch (e) { console.error('verify-sub error', e) }
      })
    }
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) loadProfile(data.user.id)
      else window.location.href = '/auth/login'
    })
  }, [])

  async function loadProfile(id: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) setProfile(data as Profile)
  }

  async function runSearch(override?: string) {
    const q = override ?? query
    if (!q.trim() || loading) return
    if (override) setQuery(override)
    setLoading(true); setError(''); setResults([])
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/search-niches', {
        method: 'POST',
        headers: { 'Content-Type':'application/json', Authorization:`Bearer ${session?.access_token}` },
        body: JSON.stringify({ query: q, filters, geo }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error al buscar'); return }
      setResults(json.results)
      if (session?.user?.id) await loadProfile(session.user.id)
    } catch { setError('Error de conexión. Inténtalo de nuevo.') }
    finally  { setLoading(false) }
  }

  async function loadHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('niche_searches').select('query,results,created_at').eq('user_id', user.id).order('created_at',{ascending:false}).limit(20)
    if (data) setHistory(data as any)
  }

  const isPro      = profile?.plan === 'pro' || profile?.plan === 'agency'
  const remaining  = profile ? searchesLeft(profile.plan, profile.searches_today) : 5

  /* ── Render ── */
  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'var(--c1)' }}>

      {/* NAV */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 20px', borderBottom:'0.5px solid rgba(255,255,255,0.08)', position:'sticky', top:0, background:'rgba(10,10,15,0.94)', backdropFilter:'blur(14px)', zIndex:100 }}>
        <div style={{ fontFamily:'var(--font-display)', fontSize:'1.15rem', fontWeight:800, letterSpacing:'-0.5px' }}>
          Niche<span style={{ color:'var(--acc)' }}>Pulse</span>
          {isPro
            ? <span style={{ marginLeft:8, background:'linear-gradient(90deg,var(--acc),var(--acc2))', color:'#fff', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>{profile?.plan?.toUpperCase()}</span>
            : <span style={{ marginLeft:8, background:'linear-gradient(90deg,var(--acc3),#00b4d8)', color:'#000', fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10 }}>FREE</span>
          }
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {(['search','history','affiliate'] as Tab[]).map(t => (
            <button key={t} onClick={() => { setTab(t); if(t==='history') loadHistory() }}
              style={{ padding:'6px 14px', borderRadius:20, fontSize:13, cursor:'pointer', border: tab===t?'none':'0.5px solid rgba(255,255,255,0.12)', background: tab===t?'var(--acc)':'transparent', color: tab===t?'#fff':'var(--t2)', fontFamily:'var(--font-body)', transition:'all .2s' }}>
              {t==='search'?'Buscar':t==='history'?'Historial':'Afiliados'}
            </button>
          ))}
          <button onClick={async () => { await supabase.auth.signOut(); window.location.href='/' }}
            style={{ padding:'6px 14px', borderRadius:20, fontSize:13, cursor:'pointer', border:'0.5px solid rgba(255,255,255,0.12)', background:'transparent', color:'var(--t2)', fontFamily:'var(--font-body)' }}>
            Salir
          </button>
        </div>
      </nav>

      {/* ═══ BÚSQUEDA ═══ */}
      {tab === 'search' && (
        <div style={{ flex:1, display:'flex', gap:20, padding:'1.5rem', maxWidth:1200, margin:'0 auto', width:'100%', alignItems:'flex-start' }}>

          {/* Columna principal */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* Hero */}
            <div style={{ textAlign:'center', marginBottom:'1.75rem' }}>
              <div style={{ fontSize:11, letterSpacing:'2px', color:'var(--acc3)', textTransform:'uppercase', fontWeight:500, marginBottom:'.6rem' }}>IA + Google Trends + TikTok + Amazon · Tiempo real</div>
              <h1 style={{ fontSize:'clamp(1.5rem,4vw,2.5rem)', fontWeight:800, lineHeight:1.1, letterSpacing:'-1px', marginBottom:'.6rem' }}>
                Encuentra tu <span style={{ color:'var(--acc)' }}>nicho perfecto</span>
              </h1>
              <p style={{ color:'var(--t2)', fontSize:'0.9rem', lineHeight:1.7 }}>
                Señales de mercado en tiempo real cruzadas con Claude AI.
              </p>
            </div>

            {/* Stats */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:'1.25rem' }}>
              {[['12K+','Nichos'],['180+','Países'],['3 fuentes','Live data']].map(([n,l]) => (
                <div key={n} className="card" style={{ padding:'.75rem', textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--font-display)', fontSize:'1.1rem', fontWeight:700, color:'var(--acc)' }}>{n}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{l}</div>
                </div>
              ))}
            </div>

            {/* Banner límite gratis */}
            {!isPro && (
              <div style={{ background:'linear-gradient(135deg,rgba(124,111,255,0.1),rgba(255,107,157,0.08))', border:`0.5px solid ${remaining===0?'var(--acc2)':'var(--acc)'}`, borderRadius:12, padding:'10px 14px', marginBottom:'1.25rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10 }}>
                <div>
                  <div style={{ fontSize:13, color:'var(--t2)' }}><strong style={{ color:'var(--t1)' }}>{remaining === Infinity ? '∞' : remaining}</strong> búsquedas restantes hoy (Plan Free)</div>
                  <div className="score-bar" style={{ marginTop:5, width:130 }}>
                    <div className="score-fill" style={{ width:`${(Math.min(remaining,5)/5)*100}%`, background: remaining===0?'var(--acc2)':undefined }} />
                  </div>
                </div>
                <a href="/pricing" style={{ background:'var(--acc)', color:'#fff', border:'none', padding:'6px 14px', borderRadius:20, fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap', textDecoration:'none' }}>
                  Subir a Pro →
                </a>
              </div>
            )}

            {/* Caja de búsqueda */}
            <div className="card" style={{ padding:'1.25rem', marginBottom:'1.25rem' }}>
              <div style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:500, marginBottom:'.6rem' }}>Describe tu nicho o categoría</div>
              <div style={{ display:'flex', gap:8, marginBottom:'.9rem' }}>
                <input ref={inputRef} className="np-input" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key==='Enter' && runSearch()} placeholder="ej: accesorios para mascotas, gadgets tech..." />
                <select value={geo} onChange={e => setGeo(e.target.value)}
                  style={{ background:'var(--c3)', border:'0.5px solid rgba(255,255,255,0.12)', borderRadius:8, color:'var(--t1)', fontSize:13, padding:'0 10px', cursor:'pointer', fontFamily:'var(--font-body)', minWidth:120 }}>
                  {GEOS.map(g => <option key={g.code} value={g.code}>{g.label}</option>)}
                </select>
                <button onClick={() => runSearch()} disabled={loading || !query.trim()}
                  style={{ background:'var(--acc)', color:'#fff', border:'none', padding:'0 18px', borderRadius:8, fontSize:14, fontWeight:500, cursor: loading||!query.trim()?'not-allowed':'pointer', whiteSpace:'nowrap', opacity: loading||!query.trim()?.6:1, fontFamily:'var(--font-body)', transition:'all .2s' }}>
                  {loading ? '⏳' : '✦ Analizar'}
                </button>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {FILTERS.map(f => (
                  <button key={f.key} onClick={() => setFilters(prev => ({ ...prev, [f.key]:!prev[f.key] }))}
                    style={{ padding:'4px 11px', borderRadius:14, fontSize:12, cursor:'pointer', border:`0.5px solid ${filters[f.key]?'var(--acc)':'rgba(255,255,255,0.1)'}`, background: filters[f.key]?'var(--acc)':'var(--c3)', color: filters[f.key]?'#fff':'var(--t2)', fontFamily:'var(--font-body)', transition:'all .15s' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:'rgba(255,60,104,0.1)', border:'0.5px solid rgba(255,107,157,0.3)', borderRadius:10, padding:'10px 14px', marginBottom:'1.25rem', fontSize:13, color:'#ff9dc0' }}>
                {error}
                {error.includes('Límite') && <a href="/pricing" style={{ marginLeft:8, color:'var(--acc)', textDecoration:'underline' }}>Ver planes →</a>}
              </div>
            )}

            {/* Cargando */}
            {loading && (
              <div style={{ textAlign:'center', padding:'3rem' }}>
                <div className="spinner" style={{ margin:'0 auto 1rem' }} />
                <div style={{ color:'var(--t2)', fontSize:13 }}>Claude AI analizando señales de Google, TikTok y Amazon...</div>
              </div>
            )}

            {/* Resultados */}
            {!loading && results.length > 0 && (
              <div>
                <div style={{ fontSize:12, color:'var(--t3)', marginBottom:'.65rem' }}>
                  {results.length} nichos · enriquecidos con señales en tiempo real
                </div>
                <div style={{ display:'grid', gap:10 }}>
                  {results.map((n, i) => {
                    const src = (n as any).trend_source ?? 'organic'
                    const [srcColor, srcLabel] = SRC_PILL[src] ?? SRC_PILL.organic
                    return (
                      <div key={i} className="card card-hover fade-up" onClick={() => setSelected(n)}
                        style={{ padding:'1.1rem', position:'relative', overflow:'hidden', animationDelay:`${i*.07}s` }}>
                        <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:'linear-gradient(90deg,var(--acc),var(--acc2))' }} />
                        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'.6rem' }}>
                          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.95rem', paddingRight:10 }}>{n.name}</div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <div style={{ fontFamily:'var(--font-display)', fontSize:'1.05rem', fontWeight:800, color:scoreColor(n.score) }}>{n.score}</div>
                            <div style={{ fontSize:9, color:'var(--t3)' }}>Score IA</div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:'.65rem' }}>
                          {n.tags.map(t => { const [cls,lbl] = TAG_MAP[t] ?? ['tag-trend',t]; return <span key={t} className={`tag ${cls}`}>{lbl}</span> })}
                          <span style={{ fontSize:11, padding:'3px 8px', borderRadius:8, background:`${srcColor}20`, color:srcColor, border:`0.5px solid ${srcColor}40`, fontWeight:500 }}>{srcLabel}</span>
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
                          {[['Mercado',n.market_size],['Margen',n.margin]].map(([k,v]) => (
                            <div key={k} style={{ background:'var(--c3)', borderRadius:7, padding:'6px 10px' }}>
                              <div style={{ fontSize:13, fontWeight:500 }}>{v}</div>
                              <div style={{ fontSize:10, color:'var(--t3)', marginTop:1 }}>{k}</div>
                            </div>
                          ))}
                        </div>
                        <div className="score-bar" style={{ marginTop:8 }}>
                          <div className="score-fill" style={{ width:`${n.profit_score}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                {!isPro && (
                  <div style={{ textAlign:'center', marginTop:'1.25rem', padding:'1.25rem', background:'var(--c2)', borderRadius:12, border:'0.5px solid var(--acc)' }}>
                    <div style={{ fontFamily:'var(--font-display)', fontWeight:700, marginBottom:'.4rem' }}>Desbloquea 10 nichos + análisis completo</div>
                    <div style={{ fontSize:13, color:'var(--t2)', marginBottom:'.9rem' }}>Proveedores, palabras clave y canales de publicidad.</div>
                    <a href="/pricing" className="np-btn-primary" style={{ textDecoration:'none' }}>Ver Plan Pro — $19/mes</a>
                  </div>
                )}
              </div>
            )}

            {/* Estado vacío */}
            {!loading && results.length === 0 && !error && (
              <div style={{ textAlign:'center', padding:'2.5rem', color:'var(--t3)' }}>
                <div style={{ fontSize:'2rem', marginBottom:'.75rem', opacity:.35 }}>◎</div>
                <div style={{ fontSize:13 }}>Escribe una categoría o haz clic en una señal del panel →</div>
              </div>
            )}
          </div>

          {/* Columna de señales en vivo */}
          <div style={{ width:270, flexShrink:0, position:'sticky', top:70 }}>
            <div style={{ fontSize:11, color:'var(--t3)', fontWeight:600, marginBottom:'.6rem', textTransform:'uppercase', letterSpacing:'.8px' }}>Señales en vivo</div>
            <TrendsPanel geo={geo} onKeywordClick={kw => runSearch(kw)} />
          </div>
        </div>
      )}

      {/* ═══ HISTORIAL ═══ */}
      {tab === 'history' && (
        <div style={{ flex:1, padding:'2rem 1.5rem', maxWidth:720, margin:'0 auto', width:'100%' }}>
          <h2 style={{ marginBottom:'1.5rem', fontWeight:800 }}>Historial de búsquedas</h2>
          {history.length === 0
            ? <div style={{ textAlign:'center', color:'var(--t3)', padding:'3rem', fontSize:13 }}>Aún no tienes búsquedas guardadas.</div>
            : <div style={{ display:'grid', gap:10 }}>
                {history.map((h,i) => (
                  <div key={i} className="card card-hover" onClick={() => { setResults(h.results); setTab('search') }}
                    style={{ padding:'1rem 1.25rem', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div>
                      <div style={{ fontWeight:500, marginBottom:3 }}>"{h.query}"</div>
                      <div style={{ fontSize:12, color:'var(--t3)' }}>{h.results.length} nichos · {new Date(h.created_at).toLocaleDateString('es-ES')}</div>
                    </div>
                    <span style={{ color:'var(--acc)', fontSize:18 }}>→</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* ═══ AFILIADOS ═══ */}
      {tab === 'affiliate' && (
        <div style={{ flex:1, padding:'2rem 1.5rem', maxWidth:720, margin:'0 auto', width:'100%' }}>
          <h2 style={{ marginBottom:'.5rem', fontWeight:800 }}>Programa de Afiliados</h2>
          <p style={{ color:'var(--t2)', fontSize:14, marginBottom:'2rem', lineHeight:1.6 }}>
            Gana comisiones recurrentes cada mes que tus referidos mantengan su plan activo.
          </p>
          {profile?.affiliate_code && (
            <div className="card" style={{ padding:'1.5rem', marginBottom:'1.5rem', border:'0.5px solid var(--acc)' }}>
              <div style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'1px', marginBottom:'.5rem' }}>Tu enlace de afiliado</div>
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <code style={{ flex:1, background:'var(--c3)', padding:'10px 14px', borderRadius:8, fontSize:12, color:'var(--acc3)', fontFamily:'monospace', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {typeof window !== 'undefined' ? window.location.origin : 'https://nichepulse.com'}/ref/{profile.affiliate_code}
                </code>
                <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/ref/${profile.affiliate_code}`)}
                  style={{ padding:'10px 14px', borderRadius:8, background:'var(--c3)', border:'0.5px solid rgba(255,255,255,0.15)', color:'var(--t1)', cursor:'pointer', fontSize:12, fontFamily:'var(--font-body)', whiteSpace:'nowrap' }}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:'1.5rem' }}>
            {[['20%','1–10 refs'],['30%','11–50 refs'],['40%','51+ refs']].map(([p,l]) => (
              <div key={p} className="card" style={{ padding:'1rem', textAlign:'center' }}>
                <div style={{ fontFamily:'var(--font-display)', fontSize:'1.75rem', fontWeight:800, color:'var(--acc)' }}>{p}</div>
                <div style={{ fontSize:11, color:'var(--t3)', marginTop:4 }}>{l}</div>
              </div>
            ))}
          </div>
          {[['🔗','Link único trackeado','Seguimiento en tiempo real de clics, registros y conversiones.'],['💸','Ingresos recurrentes','Cobras cada mes que tu referido pague. No es un pago único.'],['🎨','Kit de contenido','Templates para Reels, TikTok, YouTube Shorts y posts.'],['💳','Pago vía PayPal, cripto o wire','Mínimo $50. Pagos el día 1 de cada mes.']].map(([icon,title,desc]) => (
            <div key={title} className="card" style={{ padding:'1rem 1.25rem', marginBottom:8, display:'flex', gap:'1rem', alignItems:'flex-start' }}>
              <div style={{ fontSize:'1.4rem', flexShrink:0 }}>{icon}</div>
              <div><div style={{ fontWeight:600, marginBottom:2, fontSize:'.9rem' }}>{title}</div><div style={{ fontSize:13, color:'var(--t2)', lineHeight:1.5 }}>{desc}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ MODAL DETALLE ═══ */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.82)', zIndex:200, display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'2rem 1.5rem', overflowY:'auto' }}>
          <div onClick={e => e.stopPropagation()} className="card fade-up" style={{ width:'100%', maxWidth:480, padding:'1.5rem' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
              <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'1rem' }}>{selected.name}</div>
              <button onClick={() => setSelected(null)} style={{ background:'var(--c3)', border:'none', color:'var(--t1)', width:32, height:32, borderRadius:'50%', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:'1.25rem' }}>
              {[['Mercado',selected.market_size],['Margen',selected.margin],['Competencia',selected.competition],['Tendencia',selected.trend]].map(([k,v]) => (
                <div key={k} style={{ background:'var(--c3)', borderRadius:8, padding:'8px 10px' }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{v}</div>
                  <div style={{ fontSize:11, color:'var(--t3)', marginTop:2 }}>{k}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--t3)', marginBottom:'.5rem' }}>Insights IA + Señales Live</div>
              {selected.insights.map((ins,i) => <div key={i} style={{ background:'var(--c3)', borderRadius:8, padding:'.75rem', marginBottom:5, fontSize:13, color:'var(--t2)', borderLeft:'2px solid var(--acc)' }}>{ins}</div>)}
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--t3)', marginBottom:'.5rem' }}>Proveedores</div>
              {selected.suppliers.map((s,i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--c3)', borderRadius:8, padding:'.75rem', marginBottom:5 }}>
                  <span style={{ fontSize:13, fontWeight:500 }}>{s.name}</span>
                  <span style={{ fontSize:11, color:'var(--acc3)' }}>{s.note}</span>
                </div>
              ))}
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--t3)', marginBottom:'.5rem' }}>Keywords</div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {selected.keywords.map(k => <span key={k} style={{ background:'var(--c4)', borderRadius:7, padding:'3px 9px', fontSize:12, color:'var(--t2)' }}>{k}</span>)}
              </div>
            </div>
            <div style={{ marginBottom:'1.25rem' }}>
              <div style={{ fontSize:11, textTransform:'uppercase', letterSpacing:'1px', color:'var(--t3)', marginBottom:'.5rem' }}>Canales publicitarios</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {selected.ad_channels.map(ch => <span key={ch} className="tag tag-trend">{ch}</span>)}
              </div>
            </div>
            <a href="/pricing" className="np-btn-primary" style={{ width:'100%', justifyContent:'center', textDecoration:'none', display:'flex' }}>
              ✦ Exportar análisis completo →
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
