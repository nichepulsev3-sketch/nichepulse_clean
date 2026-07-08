'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'
import { scoreColor, scoreGradient } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'
import SubPageNav from '@/components/SubPageNav'

const CATEGORIES = [
  { id:'emerging',   icon:'🌱', label:'Emergentes',      color:'var(--teal)',   desc:'Nichos con crecimiento acelerado en las últimas semanas.' },
  { id:'viral',      icon:'🔥', label:'Virales',          color:'var(--red)',    desc:'Máxima tracción en redes sociales y plataformas.' },
  { id:'seo',        icon:'🔍', label:'Top SEO',          color:'var(--brand)',  desc:'Mejor posicionamiento orgánico y búsqueda sostenida.' },
  { id:'amazon',     icon:'📦', label:'Amazon Movers',    color:'var(--amber)',  desc:'Categorías con mejor desempeño en marketplaces.' },
  { id:'tiktok',     icon:'📱', label:'TikTok Trends',    color:'var(--pink)',   desc:'Productos virales detectados en TikTok Shop.' },
  { id:'low_comp',   icon:'🎯', label:'Baja Competencia', color:'var(--green)',  desc:'Nichos con mínima competencia y alta oportunidad.' },
  { id:'high_margin',icon:'💰', label:'Alto Margen',      color:'var(--amber)',  desc:'Nichos con margen superior al 50%.' },
  { id:'ai',         icon:'🤖', label:'Recomendados IA',  color:'var(--brand)',  desc:'Selección exclusiva del motor Multi-IA.' },
]

// Categorías respaldadas por señales reales de lib/trends.ts vía /api/radar.
// El resto (low_comp, high_margin, ai) requeriría el motor Multi-IA completo
// para cada combinación posible — hasta que eso exista, se muestran como
// muestra ilustrativa y NUNCA se presentan como datos en vivo.
const REAL_CATEGORIES = new Set(['emerging', 'viral', 'seo', 'amazon', 'tiktok'])

type RadarNiche = {
  name: string; score: number; category: string; trend: string
  market_size?: string; volume?: string; geo?: string; source?: string
}

// Muestra ilustrativa — solo para categorías sin señal real disponible todavía.
const SAMPLE: Record<string, RadarNiche[]> = {
  low_comp:    [{name:'Niche Pet Supplements', score:86,category:'Mascotas',  trend:'↑34%',market_size:'$2.3B'},{name:'Specialty Coffee Tools', score:83,category:'Cocina',   trend:'↑28%',market_size:'$680M'},{name:'Recovery Fitness Gear', score:80,category:'Deporte',   trend:'↑19%',market_size:'$1.4B'}],
  high_margin: [{name:'Premium Candles',       score:88,category:'Lifestyle', trend:'↑29%',market_size:'$510M'},{name:'Custom Jewelry',        score:85,category:'Moda',      trend:'↑22%',market_size:'$3.7B'},{name:'Digital Products',      score:82,category:'Digital',   trend:'↑18%',market_size:'$6.2B'}],
  ai:          [{name:'AR Home Décor Try-on',  score:92,category:'Hogar',     trend:'↑78%',market_size:'$890M'},{name:'Personalized Nutrition', score:89,category:'Salud',    trend:'↑56%',market_size:'$2.8B'},{name:'Smart Baby Monitor',    score:86,category:'Bebés',     trend:'↑43%',market_size:'$1.6B'}],
}

export default function RadarPage() {
  const router = useRouter()
  const [profile,   setProfile]   = useState<any>(null)
  const [active,    setActive]    = useState('viral')
  const [loading,   setLoading]   = useState(true)
  const [nichos,    setNichos]    = useState<RadarNiche[]>([])
  const [liveData,  setLiveData]  = useState<Record<string, RadarNiche[]> | null>(null)
  const [fetchedAt, setFetchedAt] = useState<string | null>(null)
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user) window.location.href = '/auth/login'
      else supabase.from('profiles').select('plan,full_name').eq('id',data.user.id).single().then(({data}) => setProfile(data))
    })
  }, [])

  // Cargar señales reales una vez al montar (cacheadas 6h en el backend).
  useEffect(() => {
    fetch('/api/radar?geo=US')
      .then(r => r.json())
      .then(json => {
        if (json?.categories) { setLiveData(json.categories); setFetchedAt(json.fetched_at) }
      })
      .catch(() => {})
  }, [])

  const applyCategory = useCallback((id: string, live: Record<string, RadarNiche[]> | null) => {
    if (REAL_CATEGORIES.has(id)) {
      setNichos(live?.[id] ?? [])
    } else {
      setNichos(SAMPLE[id] ?? [])
    }
    setLoading(false)
  }, [])

  // Cuando llegan los datos en vivo o cambia la categoría activa, refrescar la vista.
  useEffect(() => {
    if (liveData === null && REAL_CATEGORIES.has(active)) return // esperar a que llegue la primera carga
    applyCategory(active, liveData)
  }, [active, liveData, applyCategory])

  function selectCategory(id: string) {
    setActive(id)
    if (REAL_CATEGORIES.has(id) && liveData === null) setLoading(true)
    else applyCategory(id, liveData)
  }

  const cat = CATEGORIES.find(c => c.id === active)
  const isRealCategory = REAL_CATEGORIES.has(active)

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--txt-1)', fontFamily:'var(--font-body)' }}>
      {/* Nav */}
      <SubPageNav icon="📡" title="Radar de Nichos" right={
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--txt-3)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background: isRealCategory ? 'var(--teal)' : 'var(--txt-3)', display:'inline-block', boxShadow: isRealCategory ? '0 0 6px var(--teal)' : 'none' }}/>
          {isRealCategory
            ? (fetchedAt ? `En vivo · actualizado ${new Date(fetchedAt).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}` : 'Cargando señales en vivo...')
            : 'Muestra ilustrativa'}
        </div>
      } />

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.5rem,4vw,2.5rem)', fontWeight:800, letterSpacing:'-0.04em', marginBottom:'.5rem' }}>
            Radar de <span style={{ background:'var(--g-brand)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Nichos</span>
          </h1>
          <p style={{ color:'var(--txt-2)', fontSize:14, lineHeight:1.6 }}>
            Señales reales de Google Trends, TikTok y Amazon Movers &amp; Shakers, cacheadas cada 6h. Haz clic en un nicho para analizarlo con el motor Multi-IA.
          </p>
        </div>

        {/* Category tabs */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:'2rem' }}>
          {CATEGORIES.map(c => (
            <button key={c.id} onClick={() => selectCategory(c.id)}
              style={{
                display:'flex', alignItems:'center', gap:6, padding:'7px 14px',
                borderRadius:99, border:`1px solid ${active===c.id ? c.color : 'var(--brd-1)'}`,
                background: active===c.id ? `${c.color}18` : 'var(--bg-subtle)',
                color: active===c.id ? c.color : 'var(--txt-2)',
                fontFamily:'var(--font-body)', fontSize:13, fontWeight:active===c.id?600:400,
                cursor:'pointer', transition:'all var(--t-base)',
              }}>
              {c.icon} {c.label}
              {!REAL_CATEGORIES.has(c.id) && <span style={{ fontSize:9, opacity:.7 }}>· muestra</span>}
            </button>
          ))}
        </div>

        {/* Category description */}
        {cat && (
          <div style={{ background:'var(--bg-subtle)', border:`1px solid ${cat.color}30`, borderLeft:`3px solid ${cat.color}`, borderRadius:'0 10px 10px 0', padding:'10px 14px', marginBottom:'1.5rem', fontSize:13, color:'var(--txt-2)' }}>
            {cat.icon} <strong style={{ color:'var(--txt-1)' }}>{cat.label}:</strong> {cat.desc}
            {!isRealCategory && (
              <span style={{ display:'block', marginTop:6, color:'var(--amber)', fontSize:12 }}>
                🧪 Esta categoría todavía muestra datos de ejemplo — requiere el motor Multi-IA completo para generar señales reales aquí, y está en el roadmap.
              </span>
            )}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap:14 }}>
            <SkeletonCard variant="niche" count={3}/>
          </div>
        ) : nichos.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'var(--txt-3)', fontSize:13 }}>
            No hay señales disponibles para esta categoría ahora mismo.
          </div>
        ) : (
          <div className="stagger-children" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(min(300px,100%),1fr))', gap:14 }}>
            {nichos.map((n, i) => (
              <div key={i} className="card card-interactive fade-up"
                onClick={() => router.push(`/dashboard?q=${encodeURIComponent(n.name)}`)}
                title="Analizar este nicho con el motor Multi-IA"
                style={{ padding:'1.25rem', position:'relative', overflow:'hidden', cursor:'pointer' }}>
                {/* Top accent bar */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:scoreGradient(n.score) }}/>
                {/* Rank badge */}
                <div style={{ position:'absolute', top:12, right:12, width:36, height:36, borderRadius:'50%', background:scoreGradient(n.score), display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'#fff', boxShadow:'var(--shadow-sm)' }}>
                  {n.score}
                </div>
                <div style={{ paddingRight:44 }}>
                  <div style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'.92rem', marginBottom:5 }}>{n.name}</div>
                  <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                    <span className="badge badge-brand" style={{ fontSize:10 }}>{n.category}</span>
                    <span style={{ fontSize:11, color:scoreColor(n.score), fontWeight:600 }}>{n.trend}</span>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    {[['Fuente', n.market_size ?? n.volume ?? '—','rgba(124,111,255,0.08)'],['Trend',n.trend,'rgba(45,212,191,0.08)']].map(([k,v,bg]) => (
                      <div key={k as string} style={{ background:bg as string, borderRadius:8, padding:'7px 10px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--txt-1)' }}>{v}</div>
                        <div style={{ fontSize:10, color:'var(--txt-3)', marginTop:2 }}>{k}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:10, color:'var(--txt-3)', marginTop:8 }}>Pulsa para analizar con IA →</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Free plan notice */}
        {profile?.plan === 'free' && (
          <div style={{ marginTop:'2rem', background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(244,113,181,0.06))', border:'1px solid var(--brd-brand)', borderRadius:14, padding:'1.25rem', textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-display)', fontWeight:700, marginBottom:'.5rem' }}>Acceso completo al Radar en Pro</div>
            <div style={{ fontSize:13, color:'var(--txt-2)', marginBottom:'1rem' }}>Los usuarios Pro y Agency ven actualizaciones en tiempo real y señales de todas las categorías.</div>
            <Link href="/pricing" style={{ display:'inline-flex', alignItems:'center', gap:6, background:'var(--g-brand)', color:'#fff', padding:'10px 22px', borderRadius:99, textDecoration:'none', fontSize:13, fontWeight:600, boxShadow:'var(--shadow-brand)' }}>
              ⚡ Ver Plan Pro
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
