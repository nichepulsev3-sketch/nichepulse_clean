'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { getSupabaseBrowser } from '@/lib/supabase'
import { scoreColor, scoreGradient } from '@/lib/types'
import SkeletonCard from '@/components/SkeletonCard'

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

type RadarNiche = {
  name: string; score: number; category: string
  trend: string; market_size: string; geo?: string
}

const SAMPLE: Record<string, RadarNiche[]> = {
  emerging:    [{name:'Wearable Pet Tech',     score:89,category:'Mascotas',  trend:'↑62%',market_size:'$840M'},{name:'AI Skincare Devices',  score:87,category:'Belleza',   trend:'↑58%',market_size:'$1.2B'},{name:'Portable Sleep Aids',   score:84,category:'Salud',     trend:'↑44%',market_size:'$2.1B'}],
  viral:       [{name:'Magnetic Phone Cases',  score:91,category:'Tech',      trend:'↑88%',market_size:'$3.4B'},{name:'LED Mirror Tools',      score:86,category:'Belleza',   trend:'↑71%',market_size:'$560M'},{name:'Viral Kitchen Gadgets', score:82,category:'Hogar',     trend:'↑65%',market_size:'$1.8B'}],
  seo:         [{name:'Sustainable Packaging', score:85,category:'B2B',       trend:'↑31%',market_size:'$4.2B'},{name:'Ergonomic Office',      score:83,category:'Trabajo',   trend:'↑27%',market_size:'$8.1B'},{name:'Indoor Herb Gardens',   score:80,category:'Jardín',    trend:'↑22%',market_size:'$1.1B'}],
  amazon:      [{name:'Smart Storage Solutions',score:90,category:'Hogar',    trend:'↑47%',market_size:'$5.6B'},{name:'Wireless Car Chargers', score:87,category:'Auto',      trend:'↑38%',market_size:'$2.9B'},{name:'Kids STEM Kits',        score:84,category:'Educación', trend:'↑41%',market_size:'$3.3B'}],
  tiktok:      [{name:'Cottagecore Décor',     score:93,category:'Hogar',     trend:'↑112%',market_size:'$780M'},{name:'Y2K Fashion Accessories',score:88,category:'Moda',   trend:'↑94%', market_size:'$450M'},{name:'Aesthetic Stationery',  score:85,category:'Oficina',   trend:'↑76%', market_size:'$920M'}],
  low_comp:    [{name:'Niche Pet Supplements', score:86,category:'Mascotas',  trend:'↑34%',market_size:'$2.3B'},{name:'Specialty Coffee Tools', score:83,category:'Cocina',   trend:'↑28%',market_size:'$680M'},{name:'Recovery Fitness Gear', score:80,category:'Deporte',   trend:'↑19%',market_size:'$1.4B'}],
  high_margin: [{name:'Premium Candles',       score:88,category:'Lifestyle', trend:'↑29%',market_size:'$510M'},{name:'Custom Jewelry',        score:85,category:'Moda',      trend:'↑22%',market_size:'$3.7B'},{name:'Digital Products',      score:82,category:'Digital',   trend:'↑18%',market_size:'$6.2B'}],
  ai:          [{name:'AR Home Décor Try-on',  score:92,category:'Hogar',     trend:'↑78%',market_size:'$890M'},{name:'Personalized Nutrition', score:89,category:'Salud',    trend:'↑56%',market_size:'$2.8B'},{name:'Smart Baby Monitor',    score:86,category:'Bebés',     trend:'↑43%',market_size:'$1.6B'}],
}

export default function RadarPage() {
  const [profile, setProfile] = useState<any>(null)
  const [active,  setActive]  = useState('viral')
  const [loading, setLoading] = useState(false)
  const [nichos,  setNichos]  = useState<RadarNiche[]>(SAMPLE.viral)
  const supabase = getSupabaseBrowser()

  useEffect(() => {
    supabase.auth.getUser().then(({data}) => {
      if (!data.user) window.location.href = '/auth/login'
      else supabase.from('profiles').select('plan,full_name').eq('id',data.user.id).single().then(({data}) => setProfile(data))
    })
  }, [])

  function selectCategory(id: string) {
    setActive(id)
    setLoading(true)
    setTimeout(() => {
      setNichos(SAMPLE[id] ?? [])
      setLoading(false)
    }, 600)
  }

  const cat = CATEGORIES.find(c => c.id === active)

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', color:'var(--txt-1)', fontFamily:'var(--font-body)' }}>
      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderBottom:'1px solid var(--brd-1)', background:'var(--bg-float)', backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link href="/dashboard" style={{ color:'var(--txt-3)', textDecoration:'none', fontSize:13 }}>← Dashboard</Link>
          <span style={{ color:'var(--brd-2)' }}>|</span>
          <span style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:'1rem' }}>📡 Radar de Nichos</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'var(--txt-3)' }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background:'var(--teal)', display:'inline-block', boxShadow:'0 0 6px var(--teal)' }}/>
          Actualizado hace 2h
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2rem 1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom:'2rem' }}>
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.5rem,4vw,2.5rem)', fontWeight:800, letterSpacing:'-0.04em', marginBottom:'.5rem' }}>
            Radar de <span style={{ background:'var(--g-brand)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Nichos</span>
          </h1>
          <p style={{ color:'var(--txt-2)', fontSize:14, lineHeight:1.6 }}>
            Top nichos detectados en tiempo real por el motor Multi-IA. Actualización automática cada 24h.
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
            </button>
          ))}
        </div>

        {/* Category description */}
        {cat && (
          <div style={{ background:'var(--bg-subtle)', border:`1px solid ${cat.color}30`, borderLeft:`3px solid ${cat.color}`, borderRadius:'0 10px 10px 0', padding:'10px 14px', marginBottom:'1.5rem', fontSize:13, color:'var(--txt-2)' }}>
            {cat.icon} <strong style={{ color:'var(--txt-1)' }}>{cat.label}:</strong> {cat.desc}
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            <SkeletonCard variant="niche" count={3}/>
          </div>
        ) : (
          <div className="stagger-children" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:14 }}>
            {nichos.map((n, i) => (
              <div key={i} className="card card-interactive fade-up"
                style={{ padding:'1.25rem', position:'relative', overflow:'hidden' }}>
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
                    {[['Mercado',n.market_size,'rgba(124,111,255,0.08)'],['Trend',n.trend,'rgba(45,212,191,0.08)']].map(([k,v,bg]) => (
                      <div key={k as string} style={{ background:bg as string, borderRadius:8, padding:'7px 10px' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--txt-1)' }}>{v}</div>
                        <div style={{ fontSize:10, color:'var(--txt-3)', marginTop:2 }}>{k}</div>
                      </div>
                    ))}
                  </div>
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
