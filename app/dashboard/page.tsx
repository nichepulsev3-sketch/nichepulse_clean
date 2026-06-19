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
  {code:'US',label:'🇺🇸 EE.UU.'  },{code:'ES',label:'🇪🇸 España'   },
  {code:'MX',label:'🇲🇽 México'  },{code:'GB',label:'🇬🇧 UK'       },
  {code:'DE',label:'🇩🇪 Alemania'},{code:'BR',label:'🇧🇷 Brasil'    },
  {code:'AR',label:'🇦🇷 Argentina'},{code:'FR',label:'🇫🇷 Francia'  },
]
const SRC_PILL: Record<string,[string,string]> = {
  google: ['#4285F4','📈 Google'],
  tiktok: ['#ff3b5c','📱 TikTok'],
  amazon: ['#ff9900','📦 Amazon'],
  organic:['#7c6fff','🤖 IA'    ],
}
function scoreColor(s:number){ return s>=90?'#00e5c3':s>=80?'#7c6fff':'#ff6b9d' }
function scoreGlow(s:number){ return s>=90?'0 0 12px rgba(0,229,195,0.5)':s>=80?'0 0 12px rgba(124,111,255,0.5)':'0 0 12px rgba(255,107,157,0.5)' }
type Tab = 'search'|'history'|'affiliate'|'plans'

// ── PDF export ────────────────────────────────────────────────
function exportPDF(n: NicheResult, plan: string) {
  const isAgency = plan==='agency'
  const date = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})
  const grad = isAgency?'linear-gradient(135deg,#ff9900,#ff6b9d)':'linear-gradient(135deg,#7c6fff,#ff6b9d)'
  const accent = isAgency?'#ff9900':'#7c6fff'

  const html=`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<title>NichePulse — ${n.name}</title>
<style>
@page{margin:15mm 18mm;size:A4}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;color:#1a1a2e;line-height:1.6;font-size:10.5pt}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.hdr{background:${grad};color:#fff;padding:22px 28px;border-radius:10px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:flex-start}
.hdr h1{font-size:17pt;font-weight:800;margin-bottom:4px}
.sc{width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0}
.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
.m{background:#f5f5ff;border:1px solid #e0e0f5;border-radius:8px;padding:10px;text-align:center}
.mv{font-size:12pt;font-weight:700;color:${accent}}.ml{font-size:8pt;color:#888;margin-top:2px}
.sec{margin-bottom:14px}
.st{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accent};border-bottom:1.5px solid ${accent};padding-bottom:3px;margin-bottom:8px}
.ins{background:#f5f5ff;border-left:3px solid ${accent};padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt}
.risk{background:#fff5f5;border-left:3px solid #ff6b9d;padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt}
.stp{background:#f0fff8;border-left:3px solid #00b894;padding:6px 10px;margin-bottom:4px;border-radius:0 6px 6px 0;font-size:10pt;display:flex;gap:8px}
.srow{display:flex;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #f0f0f5;font-size:10pt}
.srow:last-child{border-bottom:none}.stable{border:1px solid #e0e0f5;border-radius:6px;overflow:hidden}
.tags{display:flex;flex-wrap:wrap;gap:5px}.tag{background:#eeeefd;color:${accent};border-radius:10px;padding:3px 10px;font-size:9pt;font-weight:500}
.kws{display:flex;flex-wrap:wrap;gap:5px}.kw{background:#f0f0f0;color:#444;border-radius:5px;padding:3px 9px;font-size:9.5pt}
.tc{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ang{background:linear-gradient(135deg,#f0eeff,#fff0f5);border:1.5px solid #d0c8ff;border-radius:8px;padding:11px 14px;font-size:10.5pt;font-style:italic;color:#4a3f9f}
${isAgency?`.exp{background:linear-gradient(135deg,#fff8e7,#fff5f0);border:2px solid ${accent};border-radius:10px;padding:14px 16px;font-size:10.5pt;font-weight:500;color:#663300;margin-bottom:14px}
.expl{font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${accent};margin-bottom:6px}
.roi{background:#f0fff8;border:1.5px solid #00b894;border-radius:8px;padding:11px 14px;font-size:10.5pt;color:#085041;margin-bottom:14px}`:''}
.footer{margin-top:20px;padding-top:8px;border-top:1px solid #e0e0f5;display:flex;justify-content:space-between;font-size:8.5pt;color:#aaa}
</style></head><body>
<div class="hdr">
  <div>
    <div style="font-size:8.5pt;font-weight:600;opacity:.7;margin-bottom:5px;letter-spacing:1px;text-transform:uppercase">NICHEPULSE${isAgency?' · AGENCY EXPERT':' · PRO'}</div>
    <h1>${n.name}</h1>
    <div style="font-size:9.5pt;opacity:.85;margin-top:4px">${n.competition} competencia · ${n.trend} · ${n.market_size}</div>
    <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">${n.tags.map(t=>`<span style="background:rgba(255,255,255,.2);border-radius:10px;padding:2px 8px;font-size:8pt">${t}</span>`).join('')}</div>
  </div>
  <div class="sc"><div style="font-size:20pt;font-weight:800;line-height:1">${n.score}</div><div style="font-size:8pt;opacity:.8">Score IA</div></div>
</div>
<div class="metrics">
  <div class="m"><div class="mv">${n.market_size}</div><div class="ml">Mercado</div></div>
  <div class="m"><div class="mv">${n.margin}</div><div class="ml">Margen</div></div>
  <div class="m"><div class="mv">${n.avg_ticket??'N/D'}</div><div class="ml">Ticket prom.</div></div>
  <div class="m"><div class="mv">${n.competition}</div><div class="ml">Competencia</div></div>
</div>
${isAgency&&n.expert_verdict?`<div class="exp"><div class="expl">🏆 Veredicto del equipo experto</div>${n.expert_verdict}</div>`:''}
${isAgency&&n.validated_roi?`<div class="roi"><div style="font-size:8.5pt;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#00b894;margin-bottom:5px">💰 ROI validado</div>${n.validated_roi}</div>`:''}
${n.winning_angle?`<div class="sec"><div class="st">🎯 Ángulo ganador</div><div class="ang">"${n.winning_angle}"</div></div>`:''}
${n.target_audience?`<div class="sec"><div class="st">👥 Público objetivo</div><div style="background:#f5f5ff;border-radius:8px;padding:10px 13px;font-size:10.5pt">${n.target_audience}</div></div>`:''}
<div class="tc">
  <div class="sec"><div class="st">💡 Insights</div>${n.insights.map(i=>`<div class="ins">${i}</div>`).join('')}</div>
  <div class="sec"><div class="st">⚠️ Riesgos</div>${(n.risks??[]).map(r=>`<div class="risk">${r}</div>`).join('')}</div>
</div>
${n.getting_started?`<div class="sec"><div class="st">🚀 Cómo empezar</div>${n.getting_started.map((s,i)=>`<div class="stp"><span style="font-weight:700;color:#00b894;flex-shrink:0">${i+1}.</span><span>${s}</span></div>`).join('')}</div>`:''}
<div class="tc">
  <div class="sec"><div class="st">📦 Proveedores</div><div class="stable">${n.suppliers.map(s=>`<div class="srow"><strong>${s.name}</strong><span style="color:#888">${s.note}</span></div>`).join('')}</div></div>
  <div class="sec"><div class="st">📅 Estacionalidad</div><div style="background:#f5f5ff;border-radius:8px;padding:10px 13px;font-size:10pt">${n.seasonality??'Evergreen'}</div></div>
</div>
<div class="sec"><div class="st">🔍 Keywords</div><div class="kws">${n.keywords.map(k=>`<span class="kw">${k}</span>`).join('')}</div></div>
<div class="sec"><div class="st">📢 Canales</div><div class="tags">${n.ad_channels.map(c=>`<span class="tag">${c}</span>`).join('')}</div></div>
<div class="footer"><span>Generado el ${date}${isAgency?' · Agency Expert':' · Pro'}</span><span style="font-weight:700;color:${accent}">NichePulse AI</span></div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`

  const win=window.open('','_blank','width=920,height=720')
  if(!win){alert('Activa las ventanas emergentes');return}
  win.document.write(html); win.document.close()
}

// ── Countdown ─────────────────────────────────────────────────
function useCountdown(profile:Profile|null):string{
  const [label,setLabel]=useState('')
  useEffect(()=>{
    if(!profile||profile.plan!=='free'){setLabel('');return}
    const resetAt=new Date(profile.searches_reset_at).getTime()+24*3600*1000
    const update=()=>{
      const diff=resetAt-Date.now()
      if(diff<=0){setLabel('¡Ahora!');return}
      const h=Math.floor(diff/3600000),m=Math.floor((diff%3600000)/60000),s=Math.floor((diff%60000)/1000)
      setLabel(`${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`)
    }
    update(); const id=setInterval(update,1000); return()=>clearInterval(id)
  },[profile])
  return label
}

// ── Planes inline ─────────────────────────────────────────────
function PlansTab({ onUpgrade }: { onUpgrade:(plan:'pro'|'agency')=>void }) {
  const PLANS = [
    { key:'free' as const, name:'Free', price:'$0', period:'/ siempre', color:'var(--t3)', grad:'',
      features:['5 búsquedas / día','Top 3 nichos','Score IA básico','❌ Análisis completo','❌ Exportar PDF','❌ Señales en vivo full'],
      cta:'Plan actual', disabled:true },
    { key:'pro' as const, name:'Pro', price:'$19', period:'/ mes', color:'var(--acc)', grad:'var(--g1)',
      features:['Búsquedas ilimitadas','Top 8 nichos detallados','Análisis completo','✓ Exportar PDF','✓ Señales en vivo','✓ Alertas tendencias'],
      cta:'Subir a Pro', disabled:false },
    { key:'agency' as const, name:'Agency', price:'$79', period:'/ mes', color:'#ff9900', grad:'var(--g2)',
      features:['Todo en Pro','Análisis Expert validado','Veredicto del equipo experto','ROI validado 90 días','Hasta 10 usuarios','API + white-label'],
      cta:'Subir a Agency', disabled:false },
  ]
  return (
    <div style={{flex:1,padding:'2rem 1.5rem',maxWidth:900,margin:'0 auto',width:'100%'}}>
      <div style={{textAlign:'center',marginBottom:'2rem'}}>
        <h2 style={{fontSize:'clamp(1.5rem,4vw,2.25rem)',fontWeight:800,letterSpacing:'-1px',marginBottom:'.5rem'}}>
          Elige tu <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>plan</span>
        </h2>
        <p style={{color:'var(--t2)',fontSize:14}}>Empieza gratis. Cancela cuando quieras. Sin compromisos.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,marginBottom:'2rem'}}>
        {PLANS.map(p=>(
          <div key={p.key} style={{background:'var(--c2)',border:`1px solid ${p.key==='pro'?'rgba(124,111,255,0.5)':p.key==='agency'?'rgba(255,153,0,0.5)':'rgba(255,255,255,0.08)'}`,borderRadius:16,padding:'1.5rem',position:'relative',boxShadow:p.key==='pro'?'0 0 30px rgba(124,111,255,0.1)':p.key==='agency'?'0 0 30px rgba(255,153,0,0.1)':'none'}}>
            {p.key==='pro'&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--g1)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 16px',borderRadius:10,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(124,111,255,0.4)'}}>⚡ Más popular</div>}
            {p.key==='agency'&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--g2)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 16px',borderRadius:10,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(255,153,0,0.4)'}}>🏆 Expert</div>}
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,marginBottom:'.25rem',fontSize:'1rem'}}>{p.name}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'2.25rem',fontWeight:800,lineHeight:1,marginBottom:'.75rem',background:p.grad||'none',WebkitBackgroundClip:p.grad?'text':'none',WebkitTextFillColor:p.grad?'transparent':'var(--t1)'}}>
              {p.price}<span style={{fontSize:13,fontWeight:400,color:'var(--t3)',WebkitTextFillColor:'var(--t3)'}}> {p.period}</span>
            </div>
            <ul style={{listStyle:'none',marginBottom:'1.25rem',display:'flex',flexDirection:'column',gap:7}}>
              {p.features.map(f=>(
                <li key={f} style={{fontSize:13,color:f.startsWith('❌')?'var(--t3)':'var(--t2)',display:'flex',alignItems:'center',gap:7}}>
                  {!f.startsWith('❌')&&!f.startsWith('✓')&&<span style={{color:'var(--acc3)',fontSize:14}}>✓</span>}
                  {f.startsWith('✓')&&<span style={{color:'var(--acc3)',fontSize:14}}>✓</span>}
                  {f.startsWith('❌')&&<span style={{color:'var(--t3)',fontSize:14}}>✕</span>}
                  {f.replace(/^[✓❌] /,'')}
                </li>
              ))}
            </ul>
            <button onClick={()=>!p.disabled&&onUpgrade(p.key as 'pro'|'agency')} disabled={p.disabled}
              style={{width:'100%',padding:11,borderRadius:9,fontSize:14,fontWeight:600,cursor:p.disabled?'default':'pointer',fontFamily:'var(--font-body)',border:'none',
                background:p.disabled?'var(--c3)':p.grad||'var(--acc)',
                color:p.disabled?'var(--t3)':'#fff',
                opacity:p.disabled?.6:1,
                boxShadow:p.disabled?'none':p.key==='pro'?'0 4px 14px rgba(124,111,255,0.35)':'0 4px 14px rgba(255,153,0,0.35)',
              }}>
              {p.cta}
            </button>
          </div>
        ))}
      </div>
      {/* Métodos de pago */}
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'1rem'}}>Métodos de pago aceptados</div>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          {[['💳','Tarjetas'],['📱','PayPal'],['₿','Crypto'],['🏦','Wire/SEPA'],['🇧🇷','PIX/OXXO'],['🌐','Stripe']].map(([i,n])=>(
            <div key={n} style={{background:'var(--c2)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 14px',textAlign:'center',minWidth:80}}>
              <div style={{fontSize:'1.1rem',marginBottom:2}}>{i}</div>
              <div style={{fontSize:11,color:'var(--t2)'}}>{n}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const supabase = getSupabaseBrowser()
  const [profile,  setProfile]  = useState<Profile|null>(null)
  const [query,    setQuery]    = useState('')
  const [filters,  setFilters]  = useState<Record<string,boolean>>({trending:true,low_comp:true})
  const [geo,      setGeo]      = useState('US')
  const [results,  setResults]  = useState<NicheResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<NicheResult|null>(null)
  const [tab,      setTab]      = useState<Tab>('search')
  const [history,  setHistory]  = useState<{query:string;results:NicheResult[];created_at:string}[]>([])
  const [isMobile, setIsMobile] = useState(false)
  const [showTrends,setShowTrends]=useState(false)
  const lastQuery  = useRef('')
  const countdown  = useCountdown(profile)

  useEffect(()=>{
    const check=()=>setIsMobile(window.innerWidth<768)
    check(); window.addEventListener('resize',check); return()=>window.removeEventListener('resize',check)
  },[])

  useEffect(()=>{
    const p=new URLSearchParams(window.location.search)
    if(p.get('success')==='1'){
      supabase.auth.getSession().then(async({data:{session}})=>{
        if(!session)return
        try{ await fetch('/api/verify-subscription',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}}); await loadProfile(session.user.id); window.history.replaceState({},'','/dashboard') }catch{}
      })
    }
  },[])

  useEffect(()=>{
    supabase.auth.getUser().then(({data})=>{
      if(data.user)loadProfile(data.user.id)
      else window.location.href='/auth/login'
    })
  },[])

  useEffect(()=>{ fetch(`/api/trends?geo=${geo}`).catch(()=>{}) },[geo])

  useEffect(()=>{ if(countdown==='¡Ahora!'&&profile){ const id=setTimeout(()=>loadProfile(profile.id),1000); return()=>clearTimeout(id) } },[countdown])

  async function loadProfile(id:string){
    const{data}=await supabase.from('profiles').select('*').eq('id',id).single()
    if(data)setProfile(data as Profile)
  }

  const runSearch=useCallback(async(override?:string)=>{
    const q=override??query
    if(!q.trim()||loading)return
    if(override)setQuery(override)
    lastQuery.current=q
    setLoading(true);setError('');setResults([])
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/search-niches',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({query:q,filters,geo})})
      const json=await res.json()
      if(!res.ok){setError(json.error??'Error al buscar');return}
      setResults(json.results)
      if(session?.user?.id)await loadProfile(session.user.id)
    }catch{setError('Error de conexión.')}
    finally{setLoading(false)}
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

  const isPro    = profile?.plan==='pro'||profile?.plan==='agency'
  const isAgency = profile?.plan==='agency'
  const remaining= profile?searchesLeft(profile.plan,profile.searches_today):5
  const noSearches = remaining===0

  const TABS: {key:Tab;label:string;icon:string}[] = [
    {key:'search',   label:'Buscar',   icon:'🔍'},
    {key:'history',  label:'Historial',icon:'📋'},
    {key:'affiliate',label:'Afiliados',icon:'👥'},
    {key:'plans',    label:'Planes',   icon:'💎'},
  ]

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--c1)'}}>

      {/* NAV */}
      <nav style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'10px 12px':'12px 20px',borderBottom:'1px solid rgba(124,111,255,0.15)',position:'sticky',top:0,background:'rgba(8,8,15,0.95)',backdropFilter:'blur(16px)',zIndex:100,boxShadow:'0 1px 20px rgba(0,0,0,0.3)'}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:isMobile?'1rem':'1.15rem',fontWeight:800,letterSpacing:'-0.5px',display:'flex',alignItems:'center',gap:8}}>
          <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Niche</span>
          <span style={{color:'var(--t1)'}}>Pulse</span>
          {!isPro&&<span style={{background:'linear-gradient(90deg,var(--acc3),#00b4d8)',color:'#000',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>FREE</span>}
          {isPro&&!isAgency&&<span style={{background:'var(--g1)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,boxShadow:'0 2px 8px rgba(124,111,255,0.4)'}}>PRO</span>}
          {isAgency&&<span style={{background:'var(--g2)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10,boxShadow:'0 2px 8px rgba(255,153,0,0.4)'}}>AGENCY</span>}
        </div>
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);if(t.key==='history')loadHistory()}}
              style={{padding:isMobile?'6px 8px':'6px 14px',borderRadius:20,fontSize:isMobile?11:13,cursor:'pointer',
                border:tab===t.key?'none':'1px solid rgba(124,111,255,0.2)',
                background:tab===t.key?'var(--g1)':'transparent',
                color:tab===t.key?'#fff':'var(--t2)',
                fontFamily:'var(--font-body)',fontWeight:tab===t.key?600:400,
                boxShadow:tab===t.key?'0 2px 10px rgba(124,111,255,0.35)':'none',
                transition:'all .2s',
              }}>
              {isMobile?t.icon:t.label}
            </button>
          ))}
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}}
            style={{padding:isMobile?'6px 8px':'6px 12px',borderRadius:20,fontSize:isMobile?11:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'var(--t3)',fontFamily:'var(--font-body)'}}>
            {isMobile?'↩':'Salir'}
          </button>
        </div>
      </nav>

      {/* BÚSQUEDA */}
      {tab==='search'&&(
        <div style={{flex:1,display:'flex',gap:20,padding:isMobile?'1rem':'1.5rem',maxWidth:1200,margin:'0 auto',width:'100%',alignItems:'flex-start',flexDirection:isMobile?'column':'row'}}>
          <div style={{flex:1,minWidth:0}}>

            {/* Hero colorido */}
            <div style={{textAlign:'center',marginBottom:'1.75rem',position:'relative',padding:'1.5rem 1rem',borderRadius:20,background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(255,107,157,0.06),rgba(0,229,195,0.05))',border:'1px solid rgba(124,111,255,0.15)'}}>
              <div style={{fontSize:10,letterSpacing:'2px',color:'var(--acc3)',textTransform:'uppercase',fontWeight:600,marginBottom:'.6rem'}}>
                IA · Google Trends · TikTok · Amazon
              </div>
              <h1 style={{fontSize:isMobile?'1.5rem':'clamp(1.6rem,4vw,2.6rem)',fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'.5rem'}}>
                Encuentra tu{' '}
                <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
                  nicho perfecto
                </span>
              </h1>
              <p style={{color:'var(--t2)',fontSize:'0.85rem',lineHeight:1.6}}>
                {isAgency?'Análisis validado por expertos con ROI garantizado':'Señales en tiempo real cruzadas con Claude AI'}
              </p>
              {/* Stats */}
              {!isMobile&&(
                <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:'1rem'}}>
                  {[{n:'12K+',l:'Nichos',cls:'stat-purple'},{n:'180+',l:'Países',cls:'stat-pink'},{n:'Live',l:'Señales',cls:'stat-teal'}].map(s=>(
                    <div key={s.n} className={`card ${s.cls}`} style={{padding:'8px 16px',textAlign:'center',minWidth:80}}>
                      <div style={{fontFamily:'var(--font-display)',fontSize:'1.1rem',fontWeight:700,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{s.n}</div>
                      <div style={{fontSize:11,color:'var(--t3)',marginTop:1}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banner FREE con countdown — solo cuando se acaban */}
            {!isPro&&noSearches&&(
              <div style={{background:'linear-gradient(135deg,rgba(124,111,255,0.15),rgba(255,107,157,0.12))',border:'1px solid rgba(124,111,255,0.4)',borderRadius:14,padding:'16px',marginBottom:'1.25rem',textAlign:'center',boxShadow:'0 4px 20px rgba(124,111,255,0.15)'}}>
                <div style={{fontSize:'1.5rem',marginBottom:6}}>⏰</div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'1rem',marginBottom:4}}>
                  Has usado tus 5 búsquedas de hoy
                </div>
                {countdown&&countdown!=='¡Ahora!'&&(
                  <div style={{fontSize:13,color:'var(--t2)',marginBottom:'1rem'}}>
                    Se recargan en{' '}
                    <strong style={{color:'var(--acc3)',fontFamily:'var(--font-display)',fontSize:'1.1rem'}}>{countdown}</strong>
                  </div>
                )}
                {countdown==='¡Ahora!'&&(
                  <div style={{fontSize:13,color:'var(--acc3)',marginBottom:'1rem',fontWeight:600}}>¡Ya se recargaron! Recarga la página.</div>
                )}
                <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>handleUpgrade('pro')} className="np-btn-primary" style={{fontSize:14,padding:'10px 20px'}}>
                    ⚡ Pro ilimitado — $19/mes
                  </button>
                  <button onClick={()=>setTab('plans')} style={{padding:'10px 20px',borderRadius:24,fontSize:14,cursor:'pointer',border:'1px solid rgba(124,111,255,0.4)',background:'transparent',color:'var(--t1)',fontFamily:'var(--font-body)'}}>
                    Ver todos los planes
                  </button>
                </div>
              </div>
            )}

            {/* Banner FREE con búsquedas restantes (discreto) */}
            {!isPro&&!noSearches&&(
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderRadius:10,background:'rgba(124,111,255,0.06)',border:'0.5px solid rgba(124,111,255,0.15)',marginBottom:'1rem'}}>
                <div style={{display:'flex',gap:4}}>
                  {Array.from({length:5}).map((_,i)=>(
                    <div key={i} style={{width:8,height:8,borderRadius:'50%',background:i<Number(remaining)?'var(--acc3)':'rgba(255,255,255,0.1)',transition:'background .3s'}}/>
                  ))}
                </div>
                <div style={{fontSize:12,color:'var(--t2)'}}><strong style={{color:'var(--t1)'}}>{remaining}</strong> de 5 búsquedas restantes</div>
                <button onClick={()=>setTab('plans')} style={{marginLeft:'auto',fontSize:11,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>
                  Ver Pro →
                </button>
              </div>
            )}

            {/* Banner Pro → Agency */}
            {isPro&&!isAgency&&(
              <div style={{background:'linear-gradient(135deg,rgba(255,153,0,0.08),rgba(255,107,157,0.08))',border:'1px solid rgba(255,153,0,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:'1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <div>
                  <div style={{fontSize:13,color:'var(--t1)',fontWeight:500}}>Estás en Pro ⚡</div>
                  <div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>Sube a Agency para análisis validados por expertos</div>
                </div>
                <button onClick={()=>handleUpgrade('agency')} className="np-btn-agency" style={{fontSize:12,padding:'7px 14px'}}>
                  Subir →
                </button>
              </div>
            )}

            {/* Buscador */}
            <div style={{background:'var(--c2)',border:'1px solid rgba(124,111,255,0.2)',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem',boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:600,marginBottom:'.6rem'}}>
                {isAgency?'🏆 Análisis expert — describe tu nicho':'Describe tu nicho o categoría'}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:'.9rem',flexWrap:isMobile?'wrap':'nowrap'}}>
                <input ref={null} className="np-input" value={query}
                  onChange={e=>setQuery(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&runSearch()}
                  placeholder={isAgency?'ej: mascotas premium, tech sostenible...':'ej: mascotas, gadgets tech, yoga...'}
                  style={{fontSize:isMobile?14:15}}
                />
                <div style={{display:'flex',gap:8,width:isMobile?'100%':'auto'}}>
                  <select value={geo} onChange={e=>setGeo(e.target.value)}
                    style={{background:'var(--c3)',border:'1px solid rgba(124,111,255,0.2)',borderRadius:8,color:'var(--t1)',fontSize:13,padding:'0 8px',cursor:'pointer',fontFamily:'var(--font-body)',flex:isMobile?1:'auto'}}>
                    {GEOS.map(g=><option key={g.code} value={g.code}>{g.label}</option>)}
                  </select>
                  <button onClick={()=>runSearch()} disabled={loading||!query.trim()||noSearches}
                    style={{background:isAgency?'var(--g2)':'var(--g1)',color:'#fff',border:'none',padding:'0 18px',borderRadius:9,fontSize:14,fontWeight:600,cursor:loading||!query.trim()||noSearches?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:loading||!query.trim()||noSearches?.5:1,fontFamily:'var(--font-body)',flex:isMobile?1:'auto',height:42,boxShadow:loading?'none':'0 4px 14px rgba(124,111,255,0.35)',transition:'all .2s'}}>
                    {loading?'⏳':isAgency?'🏆 Analizar':'✦ Analizar'}
                  </button>
                </div>
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {FILTERS.map(f=>(
                  <button key={f.key} onClick={()=>setFilters(p=>({...p,[f.key]:!p[f.key]}))}
                    style={{padding:isMobile?'4px 9px':'5px 12px',borderRadius:14,fontSize:isMobile?11:12,cursor:'pointer',
                      border:`1px solid ${filters[f.key]?'rgba(124,111,255,0.6)':'rgba(255,255,255,0.08)'}`,
                      background:filters[f.key]?'rgba(124,111,255,0.2)':'var(--c3)',
                      color:filters[f.key]?'var(--acc)':'var(--t2)',
                      fontFamily:'var(--font-body)',transition:'all .15s',fontWeight:filters[f.key]?500:400,
                    }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Señales móvil */}
            {isMobile&&(
              <button onClick={()=>setShowTrends(v=>!v)}
                style={{width:'100%',padding:'10px',borderRadius:10,fontSize:13,cursor:'pointer',border:'1px solid rgba(0,229,195,0.25)',background:'rgba(0,229,195,0.05)',color:'var(--acc3)',fontFamily:'var(--font-body)',marginBottom:'1rem',fontWeight:500}}>
                📡 {showTrends?'Ocultar':'Ver'} señales en vivo
              </button>
            )}
            {isMobile&&showTrends&&<div style={{marginBottom:'1rem'}}><TrendsPanel geo={geo} onKeywordClick={kw=>runSearch(kw)}/></div>}

            {/* Error */}
            {error&&(
              <div style={{background:'rgba(255,60,104,0.1)',border:'1px solid rgba(255,107,157,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem',fontSize:13,color:'#ff9dc0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <span>{error}</span>
                <button onClick={()=>runSearch(lastQuery.current||query)} style={{background:'var(--g1)',color:'#fff',border:'none',padding:'5px 12px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',whiteSpace:'nowrap',fontWeight:600}}>
                  Reintentar
                </button>
              </div>
            )}

            {/* Loading */}
            {loading&&(
              <div style={{textAlign:'center',padding:'3rem'}}>
                <div style={{width:48,height:48,border:'3px solid rgba(124,111,255,0.2)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .75s linear infinite',margin:'0 auto 1rem'}}/>
                <div style={{color:'var(--t2)',fontSize:13}}>
                  {isAgency?'🏆 Equipo experto validando nichos...':'✦ Claude AI analizando señales en tiempo real...'}
                </div>
              </div>
            )}

            {/* Resultados */}
            {!loading&&results.length>0&&(
              <div>
                <div style={{fontSize:12,color:'var(--t3)',marginBottom:'.75rem',display:'flex',alignItems:'center',gap:8}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:'var(--acc3)',display:'inline-block',boxShadow:'0 0 6px var(--acc3)'}}/>
                  {results.length} nichos{isAgency?' · validados por expertos':' · señales en vivo'}
                </div>
                <div style={{display:'grid',gap:12}}>
                  {results.map((n,i)=>{
                    const src=(n as any).trend_source??'organic'
                    const[srcColor,srcLabel]=SRC_PILL[src]??SRC_PILL.organic
                    return(
                      <div key={i} className="card card-hover fade-up" onClick={()=>setSelected(n)}
                        style={{padding:'1.2rem',position:'relative',overflow:'hidden',animationDelay:`${i*.07}s`}}>
                        {/* Borde superior gradiente */}
                        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:isAgency?'var(--g2)':'var(--g1)'}}/>
                        {isAgency&&<div style={{position:'absolute',top:8,right:8,fontSize:10,background:'var(--g2)',color:'#fff',padding:'2px 7px',borderRadius:8,fontWeight:700}}>🏆 EXPERT</div>}

                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'.7rem'}}>
                          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'.92rem',paddingRight:isAgency?50:10}}>{n.name}</div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',fontWeight:800,color:scoreColor(n.score),textShadow:scoreGlow(n.score)}}>{n.score}</div>
                            <div style={{fontSize:9,color:'var(--t3)'}}>Score</div>
                          </div>
                        </div>

                        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'.7rem'}}>
                          {n.tags.map(t=>{const[cls,lbl]=TAG_MAP[t]??['tag-trend',t];return<span key={t} className={`tag ${cls}`}>{lbl}</span>})}
                          <span style={{fontSize:11,padding:'3px 8px',borderRadius:8,background:`${srcColor}20`,color:srcColor,border:`0.5px solid ${srcColor}40`,fontWeight:500}}>{srcLabel}</span>
                        </div>

                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                          {[['Mercado',n.market_size,'rgba(124,111,255,0.1)'],['Margen',n.margin,'rgba(0,229,195,0.08)']].map(([k,v,bg])=>(
                            <div key={k} style={{background:bg,border:'0.5px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'7px 10px'}}>
                              <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                              <div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>{k}</div>
                            </div>
                          ))}
                        </div>

                        <div className="score-bar" style={{marginTop:10}}>
                          <div className="score-fill" style={{width:`${n.profit_score}%`}}/>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {!loading&&results.length===0&&!error&&(
              <div style={{textAlign:'center',padding:'3rem',color:'var(--t3)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:'1rem',opacity:.3}}>◎</div>
                <div style={{fontSize:14}}>Escribe una categoría o selecciona una señal del panel →</div>
              </div>
            )}
          </div>

          {/* Panel señales — escritorio */}
          {!isMobile&&(
            <div style={{width:275,flexShrink:0,position:'sticky',top:70}}>
              <div style={{fontSize:11,color:'var(--acc3)',fontWeight:600,marginBottom:'.6rem',textTransform:'uppercase',letterSpacing:'.8px',display:'flex',alignItems:'center',gap:5}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'var(--acc3)',display:'inline-block',boxShadow:'0 0 6px var(--acc3)'}}/>
                Señales en vivo
              </div>
              <TrendsPanel geo={geo} onKeywordClick={kw=>runSearch(kw)}/>
            </div>
          )}
        </div>
      )}

      {/* HISTORIAL */}
      {tab==='history'&&(
        <div style={{flex:1,padding:isMobile?'1rem':'2rem 1.5rem',maxWidth:720,margin:'0 auto',width:'100%'}}>
          <h2 style={{marginBottom:'1.5rem',fontWeight:800,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Historial</h2>
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
          <h2 style={{marginBottom:'.5rem',fontWeight:800,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Programa de Afiliados</h2>
          <p style={{color:'var(--t2)',fontSize:14,marginBottom:'2rem',lineHeight:1.6}}>Gana comisiones recurrentes cada mes.</p>
          {profile?.affiliate_code&&(
            <div style={{background:'var(--c2)',border:'1px solid rgba(124,111,255,0.3)',borderRadius:16,padding:'1.5rem',marginBottom:'1.5rem',boxShadow:'0 4px 20px rgba(124,111,255,0.1)'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'.5rem'}}>Tu enlace de afiliado</div>
              <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:isMobile?'wrap':'nowrap'}}>
                <code style={{flex:1,background:'var(--c3)',padding:'10px 14px',borderRadius:8,fontSize:11,color:'var(--acc3)',fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {typeof window!=='undefined'?window.location.origin:'https://nichepulse.com'}/ref/{profile.affiliate_code}
                </code>
                <button onClick={()=>navigator.clipboard.writeText(`${window.location.origin}/ref/${profile.affiliate_code}`)}
                  style={{padding:'10px 14px',borderRadius:8,background:'var(--g1)',border:'none',color:'#fff',cursor:'pointer',fontSize:12,fontFamily:'var(--font-body)',whiteSpace:'nowrap',fontWeight:600}}>
                  Copiar
                </button>
              </div>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:'1.5rem'}}>
            {[['20%','1–10 refs','rgba(124,111,255,0.1)'],['30%','11–50 refs','rgba(255,107,157,0.1)'],['40%','51+ refs','rgba(0,229,195,0.1)']].map(([p,l,bg])=>(
              <div key={p} style={{background:bg,border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,padding:'1rem',textAlign:'center'}}>
                <div style={{fontFamily:'var(--font-display)',fontSize:'1.75rem',fontWeight:800,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{p}</div>
                <div style={{fontSize:11,color:'var(--t3)',marginTop:4}}>{l}</div>
              </div>
            ))}
          </div>
          {[['🔗','Link único trackeado','Seguimiento en tiempo real.'],['💸','Ingresos recurrentes','Cobras cada mes que tu referido pague.'],['🎨','Kit de contenido','Templates para Reels, TikTok, YouTube.'],['💳','Pago vía PayPal, cripto o wire','Mínimo $50. El día 1 de cada mes.']].map(([icon,title,desc])=>(
            <div key={title as string} style={{background:'var(--c2)',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'1rem 1.25rem',marginBottom:8,display:'flex',gap:'1rem',alignItems:'flex-start'}}>
              <div style={{fontSize:'1.3rem',flexShrink:0}}>{icon}</div>
              <div><div style={{fontWeight:600,marginBottom:2,fontSize:'.9rem'}}>{title}</div><div style={{fontSize:13,color:'var(--t2)',lineHeight:1.5}}>{desc}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* PLANES */}
      {tab==='plans'&&<PlansTab onUpgrade={handleUpgrade}/>}

      {/* MODAL */}
      {selected&&(
        <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:200,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',padding:isMobile?0:'1.5rem',overflowY:'auto',backdropFilter:'blur(4px)'}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:'100%',maxWidth:isMobile?'100%':500,background:'var(--c2)',border:'1px solid rgba(124,111,255,0.25)',padding:'1.5rem',borderRadius:isMobile?'20px 20px 0 0':'20px',maxHeight:isMobile?'92vh':'none',overflowY:'auto',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',animation:'fadeUp .3s ease both'}}>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'1.25rem'}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'.95rem'}}>{selected.name}</div>
                {isAgency&&<div style={{fontSize:11,color:'#ff9900',marginTop:2,fontWeight:600}}>🏆 Análisis validado por expertos</div>}
              </div>
              <button onClick={()=>setSelected(null)} style={{background:'var(--c3)',border:'none',color:'var(--t1)',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
            </div>

            {isAgency&&selected.expert_verdict&&(
              <div style={{background:'linear-gradient(135deg,rgba(255,153,0,0.1),rgba(255,107,157,0.08))',border:'1.5px solid rgba(255,153,0,0.4)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'#ff9900',marginBottom:4}}>🏆 Veredicto experto</div>
                <div style={{fontSize:13,color:'var(--t1)',lineHeight:1.5}}>{selected.expert_verdict}</div>
              </div>
            )}
            {isAgency&&selected.validated_roi&&(
              <div style={{background:'rgba(0,229,195,0.08)',border:'0.5px solid rgba(0,229,195,0.35)',borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem'}}>
                <div style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',color:'var(--acc3)',marginBottom:4}}>💰 ROI validado</div>
                <div style={{fontSize:13,color:'var(--t1)',lineHeight:1.5}}>{selected.validated_roi}</div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:'1.25rem'}}>
              {[['Mercado',selected.market_size,'rgba(124,111,255,0.1)'],['Margen',selected.margin,'rgba(0,229,195,0.08)'],['Competencia',selected.competition,'rgba(255,209,102,0.08)'],['Tendencia',selected.trend,'rgba(255,107,157,0.08)']].map(([k,v,bg])=>(
                <div key={k} style={{background:bg,border:'0.5px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{k}</div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>{isAgency?'Insights validados':'Insights IA'}</div>
              {selected.insights.map((ins,i)=><div key={i} style={{background:'rgba(124,111,255,0.06)',borderRadius:8,padding:'.75rem',marginBottom:5,fontSize:13,color:'var(--t2)',borderLeft:'2px solid var(--acc)'}}>{ins}</div>)}
            </div>

            {selected.getting_started&&(
              <div style={{marginBottom:'1.25rem'}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Cómo empezar</div>
                {selected.getting_started.map((s,i)=><div key={i} style={{background:'rgba(0,229,195,0.06)',borderRadius:8,padding:'.75rem',marginBottom:5,fontSize:13,color:'var(--t2)',borderLeft:'2px solid var(--acc3)',display:'flex',gap:8}}><strong style={{color:'var(--acc3)',flexShrink:0}}>{i+1}.</strong><span>{s}</span></div>)}
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
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{selected.keywords.map(k=><span key={k} style={{background:'rgba(124,111,255,0.1)',border:'0.5px solid rgba(124,111,255,0.3)',borderRadius:7,padding:'3px 10px',fontSize:12,color:'var(--acc)'}}>{k}</span>)}</div>
            </div>

            <div style={{marginBottom:'1.25rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Canales</div>
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>{selected.ad_channels.map(ch=><span key={ch} className="tag tag-trend">{ch}</span>)}</div>
            </div>

            {isPro?(
              <button onClick={()=>exportPDF(selected,profile?.plan??'pro')}
                style={{width:'100%',padding:12,borderRadius:10,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontSize:14,fontWeight:600,color:'#fff',background:isAgency?'var(--g2)':'var(--g1)',boxShadow:isAgency?'0 4px 14px rgba(255,153,0,0.35)':'0 4px 14px rgba(124,111,255,0.35)',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                ⬇ Descargar PDF{isAgency?' Expert':''}
              </button>
            ):(
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:13,color:'var(--t2)',marginBottom:'.75rem'}}>Actualiza a Pro para exportar PDF</div>
                <button onClick={()=>{setSelected(null);handleUpgrade('pro')}} className="np-btn-primary" style={{width:'100%',justifyContent:'center'}}>✦ Subir a Pro — $19/mes</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Badge Agency — responsive */}
      {isAgency&&(
        <div onClick={()=>setTab('plans')}
          style={{position:'fixed',...(isMobile?{bottom:16,left:'50%',transform:'translateX(-50%)'}:{top:70,right:16}),background:'var(--g2)',color:'#fff',padding:isMobile?'8px 18px':'6px 14px',borderRadius:20,fontSize:isMobile?13:12,fontWeight:700,cursor:'pointer',zIndex:50,boxShadow:'0 4px 14px rgba(255,153,0,0.45)',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',userSelect:'none' as const}}>
          🏆 <span>{isMobile?'Plan Agency':'Agency'}</span><span style={{opacity:.75,fontSize:10}}>· Ver plan</span>
        </div>
      )}
    </div>
  )
}
