'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { getSupabaseBrowser, searchesLeft, type NicheResult, type Profile } from '@/lib/supabase'
import TrendsPanel from '@/components/TrendsPanel'

const TAG_MAP: Record<string,[string,string]> = {
  trending:    ['tag-hot',      '🔥 Tendencia'  ],
  low_comp:    ['tag-low',      '🎯 Baja comp.' ],
  high_margin: ['tag-trend',    '💰 Alto margen'],
  evergreen:   ['tag-seasonal', '🌿 Evergreen'  ],
  seasonal:    ['tag-seasonal', '📅 Estacional' ],
  viral:       ['tag-hot',      '🚀 Viral'      ],
}
const FILTERS = [
  { key:'trending',    label:'🔥 Tendencia'       },
  { key:'low_comp',   label:'🎯 Baja competencia' },
  { key:'high_margin',label:'💰 Alto margen'      },
  { key:'global',     label:'🌍 Global'           },
  { key:'evergreen',  label:'🌿 Evergreen'        },
]
const GEOS = [
  { code:'US',label:'🇺🇸 EE.UU.'   },
  { code:'ES',label:'🇪🇸 España'    },
  { code:'MX',label:'🇲🇽 México'    },
  { code:'GB',label:'🇬🇧 UK'        },
  { code:'DE',label:'🇩🇪 Alemania'  },
  { code:'BR',label:'🇧🇷 Brasil'    },
  { code:'AR',label:'🇦🇷 Argentina' },
  { code:'FR',label:'🇫🇷 Francia'   },
]
const SRC_PILL: Record<string,[string,string]> = {
  google: ['#4285F4','📈 Google'],
  tiktok: ['#ff3b5c','📱 TikTok'],
  amazon: ['#ff9900','📦 Amazon'],
  organic:['#7c6fff','🤖 IA'    ],
}
function scoreColor(s:number){ return s>=90?'#00e5c3':s>=80?'#7c6fff':'#ff6b9d' }
type Tab = 'search'|'history'|'affiliate'

// ── Exportar PDF profesional ──────────────────────────────────
function exportPDF(n: NicheResult, plan: string) {
  const isAgency = plan === 'agency'
  const date = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  const accentColor = isAgency ? '#ff9900' : '#7c6fff'
  const gradBg = isAgency
    ? 'linear-gradient(135deg,#ff9900 0%,#ff6b9d 100%)'
    : 'linear-gradient(135deg,#7c6fff 0%,#ff6b9d 100%)'

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>NichePulse${isAgency?' AGENCY':''} — ${n.name}</title>
<style>
@page{margin:15mm 18mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;line-height:1.6;font-size:10.5pt;background:#fff}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.header{background:${gradBg};color:#fff;padding:22px 28px;border-radius:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
.header h1{font-size:17pt;font-weight:800;margin-bottom:4px}
.score-circle{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.score-num{font-size:20pt;font-weight:800;line-height:1}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.metric{background:#f5f5ff;border:1px solid #e0e0f5;border-radius:8px;padding:10px;text-align:center}
.metric .val{font-size:12pt;font-weight:700;color:${accentColor}}
.metric .lbl{font-size:8pt;color:#888;margin-top:2px}
.section{margin-bottom:14px}
.section-title{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accentColor};border-bottom:1.5px solid ${accentColor};padding-bottom:3px;margin-bottom:8px}
.insight{background:#f5f5ff;border-left:3px solid ${accentColor};padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt}
.risk{background:#fff5f5;border-left:3px solid #ff6b9d;padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt}
.step{background:#f0fff8;border-left:3px solid #00b894;padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt;display:flex;gap:8px}
.step-num{font-weight:700;color:#00b894;flex-shrink:0}
.sup-row{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #f0f0f5;font-size:10pt}
.sup-row:last-child{border-bottom:none}
.sup-table{border:1px solid #e0e0f5;border-radius:6px;overflow:hidden}
.tags{display:flex;flex-wrap:wrap;gap:5px}
.tag{background:#eeeefd;color:${accentColor};border-radius:10px;padding:3px 10px;font-size:9pt;font-weight:500}
.kws{display:flex;flex-wrap:wrap;gap:5px}
.kw{background:#f0f0f0;color:#444;border-radius:5px;padding:3px 9px;font-size:9.5pt}
.two-col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.angle-box{background:linear-gradient(135deg,#f0eeff,#fff0f5);border:1.5px solid #d0c8ff;border-radius:8px;padding:11px 14px;font-size:10.5pt;font-style:italic;color:#4a3f9f}
${isAgency?`.expert-box{background:linear-gradient(135deg,#fff8e7,#fff5f0);border:2px solid ${accentColor};border-radius:10px;padding:14px 16px;font-size:11pt;font-weight:500;color:#663300;margin-bottom:14px}
.expert-box .expert-label{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accentColor};margin-bottom:6px}
.roi-box{background:#f0fff8;border:1.5px solid #00b894;border-radius:8px;padding:11px 14px;font-size:10.5pt;color:#085041}`:``}
.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e0e0f5;display:flex;justify-content:space-between;font-size:8.5pt;color:#aaa}
.brand{font-weight:700;color:${accentColor}}
.badge{display:inline-block;background:${gradBg};color:#fff;border-radius:10px;padding:2px 10px;font-size:9pt;font-weight:700;margin-left:8px;vertical-align:middle}
</style></head><body>

<div class="header">
  <div>
    <div style="font-size:8.5pt;font-weight:600;opacity:.7;margin-bottom:5px;letter-spacing:1px;text-transform:uppercase">
      NICHEPULSE${isAgency?' · ANÁLISIS AGENCY EXPERT':' · ANÁLISIS PRO'}
    </div>
    <h1>${n.name}</h1>
    <div style="font-size:9.5pt;opacity:.85;margin-top:4px">${n.competition} competencia · ${n.trend} · Mercado: ${n.market_size}</div>
    <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
      ${n.tags.map(t=>`<span style="background:rgba(255,255,255,.2);border-radius:10px;padding:2px 8px;font-size:8pt">${t}</span>`).join('')}
    </div>
  </div>
  <div class="score-circle">
    <div class="score-num">${n.score}</div>
    <div style="font-size:8pt;opacity:.8">Score IA</div>
  </div>
</div>

<div class="metrics">
  <div class="metric"><div class="val">${n.market_size}</div><div class="lbl">Mercado</div></div>
  <div class="metric"><div class="val">${n.margin}</div><div class="lbl">Margen</div></div>
  <div class="metric"><div class="val">${n.avg_ticket??'N/D'}</div><div class="lbl">Ticket prom.</div></div>
  <div class="metric"><div class="val">${n.competition}</div><div class="lbl">Competencia</div></div>
</div>

${isAgency&&n.expert_verdict?`<div class="expert-box"><div class="expert-label">🏆 Veredicto del equipo experto</div>${n.expert_verdict}</div>`:''}
${isAgency&&n.validated_roi?`<div class="roi-box" style="margin-bottom:14px"><div style="font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00b894;margin-bottom:5px">💰 ROI validado estimado</div>${n.validated_roi}</div>`:''}

${n.winning_angle?`<div class="section"><div class="section-title">🎯 Ángulo ganador</div><div class="angle-box">"${n.winning_angle}"</div></div>`:''}
${n.target_audience?`<div class="section"><div class="section-title">👥 Público objetivo</div><div style="background:#f5f5ff;border-radius:8px;padding:10px 13px;font-size:10.5pt">${n.target_audience}</div></div>`:''}

<div class="two-col">
  <div class="section"><div class="section-title">💡 Insights${isAgency?' validados':''}</div>
    ${n.insights.map(i=>`<div class="insight">${i}</div>`).join('')}
  </div>
  <div class="section"><div class="section-title">⚠️ Riesgos</div>
    ${(n.risks??['Analiza la competencia','Verifica calidad','Considera costes de ads']).map(r=>`<div class="risk">${r}</div>`).join('')}
  </div>
</div>

${n.getting_started?`<div class="section"><div class="section-title">🚀 Cómo empezar</div>
  ${n.getting_started.map((s,i)=>`<div class="step"><div class="step-num">${i+1}.</div><div>${s}</div></div>`).join('')}
</div>`:''}

<div class="two-col">
  <div class="section"><div class="section-title">📦 Proveedores</div>
    <div class="sup-table">${n.suppliers.map(s=>`<div class="sup-row"><strong>${s.name}</strong><span style="color:#888">${s.note}</span></div>`).join('')}</div>
  </div>
  <div class="section"><div class="section-title">📅 Estacionalidad</div>
    <div style="background:#f5f5ff;border-radius:8px;padding:10px 13px;font-size:10pt">${n.seasonality??'Evergreen — demanda constante todo el año.'}</div>
  </div>
</div>

<div class="section"><div class="section-title">🔍 Keywords</div>
  <div class="kws">${n.keywords.map(k=>`<span class="kw">${k}</span>`).join('')}</div>
</div>
<div class="section"><div class="section-title">📢 Canales publicitarios</div>
  <div class="tags">${n.ad_channels.map(c=>`<span class="tag">${c}</span>`).join('')}</div>
</div>

<div class="footer">
  <span>Generado el ${date}${isAgency?' · Análisis Agency Expert':' · Plan Pro'}</span>
  <span class="brand">NichePulse AI</span>
</div>

<script>window.onload=function(){window.print()}<\/script>
</body></html>`

  const win = window.open('','_blank','width=920,height=720')
  if (!win) { alert('Activa las ventanas emergentes para descargar el PDF'); return }
  win.document.write(html)
  win.document.close()
}

// ── Countdown hasta recarga de búsquedas ─────────────────────
function useCountdown(profile: Profile|null): string {
  const [label, setLabel] = useState('')
  useEffect(() => {
    if (!profile || profile.plan !== 'free') { setLabel(''); return }
    const resetAt = new Date(profile.searches_reset_at).getTime() + 24*3600*1000
    const update = () => {
      const diff = resetAt - Date.now()
      if (diff <= 0) { setLabel('¡Ahora!'); return }
      const h = Math.floor(diff/3600000)
      const m = Math.floor((diff%3600000)/60000)
      const s = Math.floor((diff%60000)/1000)
      setLabel(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [profile])
  return label
}

export default function Dashboard() {
  const supabase = getSupabaseBrowser()
  const [profile,   setProfile]   = useState<Profile|null>(null)
  const [query,     setQuery]     = useState('')
  const [filters,   setFilters]   = useState<Record<string,boolean>>({trending:true,low_comp:true})
  const [geo,       setGeo]       = useState('US')
  const [results,   setResults]   = useState<NicheResult[]>([])
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [selected,  setSelected]  = useState<NicheResult|null>(null)
  const [tab,       setTab]       = useState<Tab>('search')
  const [history,   setHistory]   = useState<{query:string;results:NicheResult[];created_at:string}[]>([])
  const [isMobile,  setIsMobile]  = useState(false)
  const [showTrends,setShowTrends]= useState(false)
  const inputRef   = useRef<HTMLInputElement>(null)
  const lastQuery  = useRef('')
  const countdown  = useCountdown(profile)

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768)
    check(); window.addEventListener('resize',check); return ()=>window.removeEventListener('resize',check)
  },[])

  // Verificar suscripción si viene de pago
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search)
    if(p.get('success')==='1'){
      supabase.auth.getSession().then(async({data:{session}})=>{
        if(!session)return
        try{
          await fetch('/api/verify-subscription',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
          await loadProfile(session.user.id)
          window.history.replaceState({},'','/dashboard')
        }catch(e){console.error(e)}
      })
    }
  },[])

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(data.user) loadProfile(data.user.id)
      else window.location.href='/auth/login'
    })
  },[])

  // Pre-calentar caché de señales cuando cambia el país
  useEffect(()=>{ fetch(`/api/trends?geo=${geo}`).catch(()=>{}) },[geo])

  // Auto-recargar perfil cuando el countdown llega a 0
  useEffect(()=>{
    if(countdown==='¡Ahora!'&&profile){
      const id=setTimeout(()=>loadProfile(profile.id),1000)
      return ()=>clearTimeout(id)
    }
  },[countdown])

  async function loadProfile(id:string){
    const{data}=await supabase.from('profiles').select('*').eq('id',id).single()
    if(data)setProfile(data as Profile)
  }

  const runSearch = useCallback(async(override?:string)=>{
    const q=override??query
    if(!q.trim()||loading)return
    if(override)setQuery(override)
    lastQuery.current=q
    setLoading(true);setError('');setResults([])
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/search-niches',{
        method:'POST',
        headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},
        body:JSON.stringify({query:q,filters,geo}),
      })
      const json=await res.json()
      if(!res.ok){
        setError(json.error??'Error al buscar')
        return
      }
      setResults(json.results)
      if(session?.user?.id)await loadProfile(session.user.id)
    }catch{
      setError('Error de conexión. Pulsa "Reintentar" para volver a intentarlo.')
    }finally{setLoading(false)}
  },[query,filters,geo,loading])

  async function handleUpgrade(plan:'pro'|'agency'){
    const{data:{session}}=await supabase.auth.getSession()
    if(!session){window.location.href='/auth/login';return}
    const res=await fetch('/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({plan})})
    const{url,error}=await res.json()
    if(error){alert(error);return}
    window.location.href=url
  }

  async function loadHistory(){
    const{data:{user}}=await supabase.auth.getUser()
    if(!user)return
    const{data}=await supabase.from('niche_searches').select('query,results,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
    if(data)setHistory(data as any)
  }

  const isPro     = profile?.plan==='pro'||profile?.plan==='agency'
  const isAgency  = profile?.plan==='agency'
  const remaining = profile?searchesLeft(profile.plan,profile.searches_today):5
  const cs={background:'var(--c2)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:16}
  const mb={background:'var(--c3)',borderRadius:7,padding:'6px 10px'}

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--c1)'}}>

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'10px 12px':'12px 20px',borderBottom:'0.5px solid rgba(255,255,255,0.08)',position:'sticky',top:0,background:'rgba(10,10,15,0.95)',backdropFilter:'blur(14px)',zIndex:100}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:isMobile?'1rem':'1.15rem',fontWeight:800,letterSpacing:'-0.5px'}}>
          Niche<span style={{color:'var(--acc)'}}>Pulse</span>
          {!isPro&&<span style={{marginLeft:6,background:'linear-gradient(90deg,var(--acc3),#00b4d8)',color:'#000',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>FREE</span>}
          {isPro&&!isAgency&&<span style={{marginLeft:6,background:'linear-gradient(90deg,var(--acc),var(--acc2))',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>PRO</span>}
          {isAgency&&<span style={{marginLeft:6,background:'linear-gradient(90deg,#ff9900,#ff6b9d)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>AGENCY</span>}
        </div>
        <div style={{display:'flex',gap:isMobile?4:6,alignItems:'center'}}>
          {(['search','history','affiliate'] as Tab[]).map(t=>(
            <button key={t} onClick={()=>{setTab(t);if(t==='history')loadHistory()}}
              style={{padding:isMobile?'5px 8px':'6px 14px',borderRadius:20,fontSize:isMobile?11:13,cursor:'pointer',border:tab===t?'none':'0.5px solid rgba(255,255,255,0.12)',background:tab===t?'var(--acc)':'transparent',color:tab===t?'#fff':'var(--t2)',fontFamily:'var(--font-body)',transition:'all .2s'}}>
              {isMobile?(t==='search'?'🔍':t==='history'?'📋':'👥'):(t==='search'?'Buscar':t==='history'?'Historial':'Afiliados')}
            </button>
          ))}
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}}
            style={{padding:isMobile?'5px 8px':'6px 12px',borderRadius:20,fontSize:isMobile?11:12,cursor:'pointer',border:'0.5px solid rgba(255,255,255,0.12)',background:'transparent',color:'var(--t2)',fontFamily:'var(--font-body)'}}>
            {isMobile?'↩':'Salir'}
          </button>
        </div>
      </nav>

      {/* BÚSQUEDA */}
      {tab==='search'&&(
        <div style={{flex:1,display:'flex',gap:20,padding:isMobile?'1rem':'1.5rem',maxWidth:1200,margin:'0 auto',width:'100%',alignItems:'flex-start',flexDirection:isMobile?'column':'row'}}>
          <div style={{flex:1,minWidth:0}}>

            {/* Hero */}
            <div style={{textAlign:'center',marginBottom:isMobile?'1.25rem':'1.5rem'}}>
              <div style={{fontSize:10,letterSpacing:'2px',color:'var(--acc3)',textTransform:'uppercase',fontWeight:500,marginBottom:'.5rem'}}>
                IA + Google Trends + TikTok + Amazon
              </div>
              <h1 style={{fontSize:isMobile?'1.5rem':'clamp(1.5rem,4vw,2.5rem)',fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'.5rem'}}>
                Encuentra tu <span style={{color:'var(--acc)'}}>nicho perfecto</span>
              </h1>
            </div>

            {/* Banner FREE con countdown */}
            {!isPro&&(
              <div style={{background:'linear-gradient(135deg,rgba(124,111,255,0.1),rgba(255,107,157,0.08))',border:`0.5px solid ${remaining===0?'var(--acc2)':'var(--acc)'}`,borderRadius:12,padding:'10px 14px',marginBottom:'1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:13,color:'var(--t2)'}}>
                    <strong style={{color:'var(--t1)'}}>{remaining===Infinity?'∞':remaining}</strong> búsquedas restantes hoy
                  </div>
                  {remaining===0&&countdown&&(
                    <div style={{fontSize:12,color:'var(--acc3)',marginTop:3}}>
                      Se recargan en <strong>{countdown}</strong>
                    </div>
                  )}
                  <div className="score-bar" style={{marginTop:5,width:120}}>
                    <div className="score-fill" style={{width:`${(Math.min(Number(remaining),5)/5)*100}%`,background:remaining===0?'var(--acc2)':undefined}}/>
                  </div>
                </div>
                <button onClick={()=>handleUpgrade('pro')} style={{background:'var(--acc)',color:'#fff',border:'none',padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'var(--font-body)'}}>
                  Subir a Pro →
                </button>
              </div>
            )}

            {/* Banner Pro → Agency */}
            {isPro&&!isAgency&&(
              <div style={{background:'linear-gradient(135deg,rgba(255,153,0,0.08),rgba(255,107,157,0.08))',border:'0.5px solid rgba(255,153,0,0.4)',borderRadius:12,padding:'10px 14px',marginBottom:'1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <div>
                  <div style={{fontSize:13,color:'var(--t1)',fontWeight:500}}>Estás en Pro ⚡</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>Sube a Agency para análisis validados por expertos</div>
                </div>
                <button onClick={()=>handleUpgrade('agency')} style={{background:'linear-gradient(90deg,#ff9900,#ff6b9d)',color:'#fff',border:'none',padding:'6px 14px',borderRadius:20,fontSize:12,fontWeight:500,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'var(--font-body)'}}>
                  Subir a Agency →
                </button>
              </div>
            )}

            {/* Buscador */}
            <div style={{...cs,padding:'1.25rem',marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:500,marginBottom:'.6rem'}}>
                {isAgency?'Análisis experto validado — describe tu nicho':'Describe tu nicho o categoría'}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:'.9rem',flexWrap:isMobile?'wrap':'nowrap'}}>
                <input ref={inputRef} className="np-input" value={query}
                  onChange={e=>setQuery(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&runSearch()}
                  placeholder={isAgency?'ej: mascotas premium, tech sostenible...':'ej: mascotas, gadgets tech, yoga...'}
                  style={{fontSize:isMobile?14:15}}
                />
                <div style={{display:'flex',gap:8,width:isMobile?'100%':'auto'}}>
                  <select value={geo} onChange={e=>setGeo(e.target.value)}
                    style={{background:'var(--c3)',border:'0.5px solid rgba(255,255,255,0.12)',borderRadius:8,color:'var(--t1)',fontSize:13,padding:'0 8px',cursor:'pointer',fontFamily:'var(--font-body)',flex:isMobile?1:'auto'}}>
                    {GEOS.map(g=><option key={g.code} value={g.code}>{g.label}</option>)}
                  </select>
                  <button onClick={()=>runSearch()} disabled={loading||!query.trim()}
                    style={{background:isAgency?'linear-gradient(90deg,#ff9900,#ff6b9d)':'var(--acc)',color:'#fff',border:'none',padding:'0 18px',borderRadius:8,fontSize:14,fontWeight:500,cursor:loading||!query.trim()?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:loading||!query.trim()?.6:1,fontFamily:'var(--font-body)',flex:isMobile?1:'auto',height:42}}>
                    {loading?'⏳':isAgency?'🏆 Analizar':'✦ Analizar'}
                  </button>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {FILTERS.map(f=>(
                  <button key={f.key} onClick={()=>setFilters(p=>({...p,[f.key]:!p[f.key]}))}
                    style={{padding:isMobile?'4px 8px':'4px 11px',borderRadius:14,fontSize:isMobile?11:12,cursor:'pointer',border:`0.5px solid ${filters[f.key]?'var(--acc)':'rgba(255,255,255,0.1)'}`,background:filters[f.key]?'var(--acc)':'var(--c3)',color:filters[f.key]?'#fff':'var(--t2)',fontFamily:'var(--font-body)',transition:'all .15s'}}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Botón señales móvil */}
            {isMobile&&(
              <button onClick={()=>setShowTrends(v=>!v)}
                style={{width:'100%',padding:'10px',borderRadius:10,fontSize:13,cursor:'pointer',border:'0.5px solid rgba(255,255,255,0.15)',background:'var(--c2)',color:'var(--t1)',fontFamily:'var(--font-body)',marginBottom:'1rem',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
                📡 {showTrends?'Ocultar':'Ver'} señales en vivo
              </button>
            )}
            {isMobile&&showTrends&&<div style={{marginBottom:'1rem'}}><TrendsPanel geo={geo} onKeywordClick={kw=>runSearch(kw)}/></div>}

            {/* Error */}
            {error&&(
              <div style={{background:'rgba(255,60,104,0.1)',border:'0.5px solid rgba(255,107,157,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem',fontSize:13,color:'#ff9dc0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <span>{error}</span>
                <button onClick={()=>runSearch(lastQuery.current||query)}
                  style={{background:'var(--acc)',color:'#fff',border:'none',padding:'5px 12px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',whiteSpace:'nowrap'}}>
                  Reintentar
                </button>
              </div>
            )}

            {/* Loading */}
            {loading&&(
              <div style={{textAlign:'center',padding:'3rem'}}>
                <div className="spinner" style={{margin:'0 auto 1rem'}}/>
                <div style={{color:'var(--t2)',fontSize:13}}>
                  {isAgency?'Equipo experto validando nichos...':'Claude AI analizando señales en tiempo real...'}
                </div>
              </div>
            )}

            {/* Resultados */}
            {!loading&&results.length>0&&(
              <div>
                <div style={{fontSize:12,color:'var(--t3)',marginBottom:'.65rem'}}>
                  {results.length} nichos{isAgency?' · validados por expertos':' · enriquecidos con señales en vivo'}
                </div>
                <div style={{display:'grid',gap:10}}>
                  {results.map((n,i)=>{
                    const src=(n as any).trend_source??'organic'
                    const[srcColor,srcLabel]=SRC_PILL[src]??SRC_PILL.organic
                    return(
                      <div key={i} className="card card-hover fade-up" onClick={()=>setSelected(n)}
                        style={{padding:'1.1rem',position:'relative',overflow:'hidden',animationDelay:`${i*.07}s`,cursor:'pointer'}}>
                        <div style={{position:'absolute',top:0,left:0,right:0,height:2,background:isAgency?'linear-gradient(90deg,#ff9900,#ff6b9d)':'linear-gradient(90deg,var(--acc),var(--acc2))'}}/>
                        {isAgency&&<div style={{position:'absolute',top:8,right:8,fontSize:10,background:'linear-gradient(90deg,#ff9900,#ff6b9d)',color:'#fff',padding:'2px 7px',borderRadius:8,fontWeight:700}}>🏆 EXPERT</div>}
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'.6rem'}}>
                          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'.9rem',paddingRight:40}}>{n.name}</div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',fontWeight:800,color:scoreColor(n.score)}}>{n.score}</div>
                            <div style={{fontSize:9,color:'var(--t3)'}}>Score IA</div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'.6rem'}}>
                          {n.tags.map(t=>{const[cls,lbl]=TAG_MAP[t]??['tag-trend',t];return<span key={t} className={`tag ${cls}`}>{lbl}</span>})}
                          <span style={{fontSize:11,padding:'3px 7px',borderRadius:8,background:`${srcColor}20`,color:srcColor,border:`0.5px solid ${srcColor}40`,fontWeight:500}}>{srcLabel}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                          {[['Mercado',n.market_size],['Margen',n.margin]].map(([k,v])=>(
                            <div key={k} style={{...mb}}><div style={{fontSize:13,fontWeight:500}}>{v}</div><div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>{k}</div></div>
                          ))}
                        </div>
                        <div className="score-bar" style={{marginTop:8}}>
                          <div className="score-fill" style={{width:`${n.profit_score}%`}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {!isPro&&(
                  <div style={{textAlign:'center',marginTop:'1.25rem',padding:'1.25rem',...cs,border:'0.5px solid var(--acc)'}}>
                    <div style={{fontFamily:'var(--font-display)',fontWeight:700,marginBottom:'.4rem'}}>Desbloquea análisis completo</div>
                    <div style={{fontSize:13,color:'var(--t2)',marginBottom:'.9rem'}}>Proveedores, keywords, PDF descargable y más.</div>
                    <button onClick={()=>handleUpgrade('pro')} className="np-btn-primary">Ver Plan Pro — $19/mes</button>
                  </div>
                )}
              </div>
            )}

            {!loading&&results.length===0&&!error&&(
              <div style={{textAlign:'center',padding:'2.5rem',color:'var(--t3)'}}>
                <div style={{fontSize:'2rem',marginBottom:'.75rem',opacity:.35}}>◎</div>
                <div style={{fontSize:13}}>Escribe una categoría o selecciona una señal del panel</div>
              </div>
            )}
          </div>

          {/* Panel señales — escritorio */}
          {!isMobile&&(
            <div style={{width:270,flexShrink:0,position:'sticky',top:70}}>
              <div style={{fontSize:11,color:'var(--t3)',fontWeight:600,marginBottom:'.6rem',textTransform:'uppercase',letterSpacing:'.8px'}}>Señales en vivo</div>
              <TrendsPanel geo={geo} onKeywordClick={kw=>runSearch(kw)}/>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='history'&&(
        <div style={{flex:1,padding:isMobile?'1rem':'2rem 1.5rem',maxWidth:720,margin:'0 auto',width:'100%'}}>
          <h2 style={{marginBottom:'1.5rem',fontWeight:800}}>Historial</h2>
          {history.length===0
            ?<div style={{textAlign:'center',color:'var(--t3)',padding:'3rem',fontSize:13}}>Sin búsquedas guardadas.</div>
            :<div style={{display:'grid',gap:10}}>
              {history.map((h,i)=>(
                <div key={i} className="card card-hover" onClick={()=>{setResults(h.results);setTab('search')}}
                  style={{padding:'1rem 1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:500,marginBottom:3,fontSize:14}}>"{h.query}"</div>
                    <div style={{fontSize:12,color:'var(--t3)'}}>{h.results.length} nichos · {new Date(h.created_at).toLocaleDateString('es-ES')}</div>
                  </div>
                  <span style={{color:'var(--acc)',fontSize:18}}>→</span>
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* AFILIADOS */}
      {tab==='affiliate'&&(
        <div style={{flex:1,padding:isMobile?'1rem':'2rem 1.5rem',maxWidth:720,margin:'0 auto',width:'100%'}}>
          <h2 style={{marginBottom:'.5rem',fontWeight:800}}>Programa de Afiliados</h2>
          <p style={{color:'var(--t2)',fontSize:14,marginBottom:'2rem',lineHeight:1.6}}>Gana comisiones recurrentes cada mes.</p>
          {profile?.affiliate_code&&(
            <div className="card" style={{padding:'1.5rem',marginBottom:'1.5rem',border:'0.5px solid var(--acc)'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'.5rem'}}>Tu enlace de afiliado</div>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:isMobile?'wrap':'nowrap'}}>
                <code style={{flex:1,background:'var(--c3)',padding:'10px 14px',borderRadius:8,fontSize:11,color:'var(--acc3)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {typeof window!=='undefined'?window.location.origin:'https://nichepulse.com'}/ref/{profile.affiliate_code}
                </code>
                <button onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/ref/${profile.affiliate_code}`)}
                  style={{padding:'10px 14px',borderRadius:8,background:'var(--c3)',border:'0.5px solid rgba(255,255,255,0.15)',color:'var(--t1)',cursor:'pointer',fontSize:12,fontFamily:'var(--font-body)',whiteSpace:'nowrap'}}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:'1.5rem'}}>
            {[['20%','1–10 refs'],['30%','11–50 refs'],['40%','51+ refs']].map(([p,l])=>(
              <div key={p} className="card" style={{padding:'1rem',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:'1.5rem',fontWeight:800,color:'var(--acc)'}}>{p}</div>
                <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>
          {[['🔗','Link único trackeado','Seguimiento en tiempo real de clics y conversiones.'],['💸','Ingresos recurrentes','Cobras cada mes que tu referido pague.'],['🎨','Kit de contenido','Templates para Reels, TikTok, YouTube Shorts.'],['💳','Pago vía PayPal, cripto o wire','Mínimo $50. Pagos el día 1 de cada mes.']].map(([icon,title,desc])=>(
            <div key={title as string} className="card" style={{padding:'1rem 1.25rem',marginBottom:8,display:'flex',gap:'1rem',alignItems:'flex-start'}}>
              <div style={{fontSize:'1.3rem',flexShrink:0}}>{icon}</div>
              <div><div style={{fontWeight:600,marginBottom:2,fontSize:'.9rem'}}>{title}</div><div style={{fontSize:13,color:'var(--t2)',lineHeight:1.5}}>{desc}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETALLE */}
      {selected&&(
        <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.85)',zIndex:200,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',padding:isMobile?0:'1.5rem',overflowY:'auto'}}>
          <div onClick={e=>e.stopPropagation()} className="card fade-up"
            style={{width:'100%',maxWidth:isMobile?'100%':500,padding:'1.5rem',borderRadius:isMobile?'16px 16px 0 0':'16px',maxHeight:isMobile?'90vh':'none',overflowY:'auto'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'.95rem'}}>{selected.name}</div>
                {isAgency&&<div style={{fontSize:11,color:'#ff9900',marginTop:2,fontWeight:600}}>🏆 Análisis validado por expertos</div>}
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'var(--c3)',border:'none',color:'var(--t1)',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
            </div>

            {/* Veredicto experto — solo Agency */}
            {isAgency&&selected.expert_verdict&&(
              <div style={{background:'linear-gradient(135deg,rgba(255,153,0,0.1),rgba(255,107,157,0.08))',border:'1.5px solid rgba(255,153,0,0.5)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#ff9900',marginBottom:4}}>🏆 Veredicto del equipo experto</div>
                <div style={{fontSize:13,color:'var(--t1)',lineHeight:1.5}}>{selected.expert_verdict}</div>
              </div>
            )}
            {isAgency&&selected.validated_roi&&(
              <div style={{background:'rgba(0,229,195,0.1)',border:'0.5px solid rgba(0,229,195,0.4)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'var(--acc3)',marginBottom:4}}>💰 ROI validado</div>
                <div style={{fontSize:13,color:'var(--t1)',lineHeight:1.5}}>{selected.validated_roi}</div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:'1.25rem'}}>
              {[['Mercado',selected.market_size],['Margen',selected.margin],['Competencia',selected.competition],['Tendencia',selected.trend]].map(([k,v])=>(
                <div key={k} style={{...mb}}><div style={{fontSize:13,fontWeight:500}}>{v}</div><div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{k}</div></div>
              ))}
            </div>
            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>{isAgency?'Insights validados':'Insights IA'}</div>
              {selected.insights.map((ins,i)=><div key={i} style={{background:'var(--c3)',borderRadius:8,padding:'.75rem',marginBottom:5,fontSize:13,color:'var(--t2)',borderLeft:'2px solid var(--acc)'}}>{ins}</div>)}
            </div>
            {selected.getting_started&&(
              <div style={{marginBottom:'1.25rem'}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Cómo empezar</div>
                {selected.getting_started.map((s,i)=><div key={i} style={{background:'rgba(0,229,195,0.08)',borderRadius:8,padding:'.75rem',marginBottom:5,fontSize:13,color:'var(--t2)',borderLeft:'2px solid var(--acc3)',display:'flex',gap:8}}><strong style={{color:'var(--acc3)',flexShrink:0}}>{i+1}.</strong><span>{s}</span></div>)}
              </div>
            )}
            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Proveedores</div>
              {selected.suppliers.map((s,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--c3)',borderRadius:8,padding:'.75rem',marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:500}}>{s.name}</span><span style={{fontSize:11,color:'var(--acc3)'}}>{s.note}</span>
                </div>
              ))}
            </div>
            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Keywords</div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{selected.keywords.map(k=><span key={k} style={{background:'var(--c4)',borderRadius:7,padding:'3px 9px',fontSize:12,color:'var(--t2)'}}>{k}</span>)}</div>
            </div>
            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Canales publicitarios</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{selected.ad_channels.map(ch=><span key={ch} className="tag tag-trend">{ch}</span>)}</div>
            </div>
            {isPro?(
              <button onClick={()=>exportPDF(selected,profile?.plan??'pro')}
                className="np-btn-primary"
                style={{width:'100%',justifyContent:'center',background:isAgency?'linear-gradient(90deg,#ff9900,#ff6b9d)':undefined}}>
                ⬇ Descargar análisis PDF{isAgency?' Expert':''}
              </button>
            ):(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:13,color:'var(--t2)',marginBottom:'.75rem'}}>Actualiza a Pro para exportar el análisis en PDF</div>
                <button onClick={()=>{setSelected(null);handleUpgrade('pro')}} className="np-btn-primary" style={{width:'100%',justifyContent:'center'}}>✦ Subir a Pro — $19/mes</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badge Agency — esquina superior derecha (PC) / inferior centro (móvil) */}
      {isAgency&&(
        <div onClick={()=>window.location.href='/pricing'}
          style={{
            position:'fixed',
            // Desktop: top right  |  Mobile: bottom center
            ...(isMobile
              ? {bottom:16, left:'50%', transform:'translateX(-50%)'}
              : {top:70, right:16}
            ),
            background:'linear-gradient(135deg,#ff9900,#ff6b9d)',
            color:'#fff',
            padding: isMobile ? '7px 16px' : '6px 14px',
            borderRadius:20,
            fontSize: isMobile ? 13 : 12,
            fontWeight:700,
            cursor:'pointer',
            zIndex:50,
            boxShadow:'0 4px 14px rgba(255,153,0,0.45)',
            display:'flex',
            alignItems:'center',
            gap:6,
            userSelect:'none' as const,
            backdropFilter:'blur(8px)',
            whiteSpace:'nowrap' as const,
          }}>
          🏆 <span>{isMobile ? 'Plan Agency' : 'Agency'}</span>
          <span style={{opacity:.75,fontSize:isMobile?11:10}}>· Ver plan</span>
        </div>
      )}
    </div>
  )
}
