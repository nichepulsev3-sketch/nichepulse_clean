'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { downloadNichePDF, downloadExecutiveReportPDF } from '@/lib/pdf'
import { getSupabaseBrowser, searchesLeft, type NicheResult, type Profile, scoreColor } from '@/lib/supabase'
import TrendsPanel from '@/components/TrendsPanel'
import ScoreGrid from '@/components/ScoreGrid'
import VerdictBadge from '@/components/VerdictBadge'
import CeoMode from '@/components/CeoMode'
import CompareModal from '@/components/CompareModal'
import OpportunityFeedBell from '@/components/OpportunityFeedBell'
import MobileBottomNav from '@/components/MobileBottomNav'
import { recordInteraction } from '@/lib/services/nicheGraph'
import { createLogger } from '@/lib/logger'

const log = createLogger('dashboard')

// ── Regiones por continente ───────────────────────────────────
const GEO_REGIONS: Record<string, {code:string;label:string;currency:string}[]> = {
  '🌎 América del Norte': [
    {code:'US',label:'🇺🇸 Estados Unidos',currency:'USD $'},
    {code:'CA',label:'🇨🇦 Canadá',currency:'CAD $'},
    {code:'MX',label:'🇲🇽 México',currency:'MXN $'},
  ],
  '🌎 América Latina': [
    {code:'BR',label:'🇧🇷 Brasil',currency:'BRL R$'},
    {code:'AR',label:'🇦🇷 Argentina',currency:'ARS $'},
    {code:'CO',label:'🇨🇴 Colombia',currency:'COP $'},
    {code:'CL',label:'🇨🇱 Chile',currency:'CLP $'},
    {code:'PE',label:'🇵🇪 Perú',currency:'PEN S/'},
    {code:'VE',label:'🇻🇪 Venezuela',currency:'USD $'},
    {code:'EC',label:'🇪🇨 Ecuador',currency:'USD $'},
    {code:'UY',label:'🇺🇾 Uruguay',currency:'UYU $'},
    {code:'BO',label:'🇧🇴 Bolivia',currency:'BOB Bs'},
    {code:'PY',label:'🇵🇾 Paraguay',currency:'PYG ₲'},
  ],
  '🌍 Europa': [
    {code:'ES',label:'🇪🇸 España',currency:'EUR €'},
    {code:'FR',label:'🇫🇷 Francia',currency:'EUR €'},
    {code:'DE',label:'🇩🇪 Alemania',currency:'EUR €'},
    {code:'IT',label:'🇮🇹 Italia',currency:'EUR €'},
    {code:'GB',label:'🇬🇧 Reino Unido',currency:'GBP £'},
    {code:'PT',label:'🇵🇹 Portugal',currency:'EUR €'},
    {code:'NL',label:'🇳🇱 Países Bajos',currency:'EUR €'},
    {code:'PL',label:'🇵🇱 Polonia',currency:'PLN zł'},
    {code:'SE',label:'🇸🇪 Suecia',currency:'SEK kr'},
    {code:'NO',label:'🇳🇴 Noruega',currency:'NOK kr'},
    {code:'CH',label:'🇨🇭 Suiza',currency:'CHF Fr'},
    {code:'BE',label:'🇧🇪 Bélgica',currency:'EUR €'},
    {code:'AT',label:'🇦🇹 Austria',currency:'EUR €'},
    {code:'RO',label:'🇷🇴 Rumanía',currency:'RON lei'},
    {code:'CZ',label:'🇨🇿 Chequia',currency:'CZK Kč'},
    {code:'GR',label:'🇬🇷 Grecia',currency:'EUR €'},
    {code:'HU',label:'🇭🇺 Hungría',currency:'HUF Ft'},
    {code:'DK',label:'🇩🇰 Dinamarca',currency:'DKK kr'},
    {code:'FI',label:'🇫🇮 Finlandia',currency:'EUR €'},
    {code:'RU',label:'🇷🇺 Rusia',currency:'RUB ₽'},
    {code:'TR',label:'🇹🇷 Turquía',currency:'TRY ₺'},
    {code:'UA',label:'🇺🇦 Ucrania',currency:'UAH ₴'},
  ],
  '🌏 Oriente Medio': [
    {code:'AE',label:'🇦🇪 Emiratos Árabes',currency:'AED د.إ'},
    {code:'SA',label:'🇸🇦 Arabia Saudí',currency:'SAR ﷼'},
    {code:'IL',label:'🇮🇱 Israel',currency:'ILS ₪'},
    {code:'QA',label:'🇶🇦 Qatar',currency:'QAR ﷼'},
    {code:'KW',label:'🇰🇼 Kuwait',currency:'KWD د.ك'},
  ],
  '🌏 Asia': [
    {code:'CN',label:'🇨🇳 China',currency:'CNY ¥'},
    {code:'JP',label:'🇯🇵 Japón',currency:'JPY ¥'},
    {code:'KR',label:'🇰🇷 Corea del Sur',currency:'KRW ₩'},
    {code:'IN',label:'🇮🇳 India',currency:'INR ₹'},
    {code:'SG',label:'🇸🇬 Singapur',currency:'SGD $'},
    {code:'PH',label:'🇵🇭 Filipinas',currency:'PHP ₱'},
    {code:'TH',label:'🇹🇭 Tailandia',currency:'THB ฿'},
    {code:'ID',label:'🇮🇩 Indonesia',currency:'IDR Rp'},
    {code:'MY',label:'🇲🇾 Malasia',currency:'MYR RM'},
    {code:'VN',label:'🇻🇳 Vietnam',currency:'VND ₫'},
    {code:'PK',label:'🇵🇰 Pakistán',currency:'PKR ₨'},
    {code:'BD',label:'🇧🇩 Bangladesh',currency:'BDT ৳'},
    {code:'LK',label:'🇱🇰 Sri Lanka',currency:'LKR ₨'},
    {code:'TW',label:'🇹🇼 Taiwán',currency:'TWD $'},
    {code:'HK',label:'🇭🇰 Hong Kong',currency:'HKD $'},
  ],
  '🌏 Oceanía': [
    {code:'AU',label:'🇦🇺 Australia',currency:'AUD $'},
    {code:'NZ',label:'🇳🇿 Nueva Zelanda',currency:'NZD $'},
  ],
  '🌍 África': [
    {code:'ZA',label:'🇿🇦 Sudáfrica',currency:'ZAR R'},
    {code:'NG',label:'🇳🇬 Nigeria',currency:'NGN ₦'},
    {code:'EG',label:'🇪🇬 Egipto',currency:'EGP £'},
    {code:'MA',label:'🇲🇦 Marruecos',currency:'MAD د.م.'},
    {code:'KE',label:'🇰🇪 Kenia',currency:'KES KSh'},
    {code:'GH',label:'🇬🇭 Ghana',currency:'GHS ₵'},
    {code:'TN',label:'🇹🇳 Túnez',currency:'TND د.ت'},
    {code:'ET',label:'🇪🇹 Etiopía',currency:'ETB Br'},
  ],
}

const GEO_MAP: Record<string,{label:string;currency:string}> = {}
Object.values(GEO_REGIONS).flat().forEach(g=>{ GEO_MAP[g.code]={label:g.label,currency:g.currency} })

// ── Tags ─────────────────────────────────────────────────────
const TAG_MAP: Record<string,[string,string]> = {
  trending:    ['tag-hot',      '🔥 Tendencia'  ],
  low_comp:    ['tag-low',      '🎯 Baja comp.' ],
  high_margin: ['tag-trend',    '💰 Alto margen'],
  evergreen:   ['tag-seasonal', '🌿 Evergreen'  ],
  seasonal:    ['tag-seasonal', '📅 Estacional' ],
  viral:       ['tag-hot',      '🚀 Viral'      ],
}
const FILTERS = [
  {key:'trending',    label:'🔥 Tendencia'      },
  {key:'low_comp',   label:'🎯 Baja competencia'},
  {key:'high_margin',label:'💰 Alto margen'     },
  {key:'global',     label:'🌍 Global'          },
  {key:'evergreen',  label:'🌿 Evergreen'       },
]
const SRC_PILL: Record<string,[string,string]> = {
  google: ['#4285F4','📈 Google'],
  tiktok: ['#ff3b5c','📱 TikTok'],
  amazon: ['#ff9900','📦 Amazon'],
  organic:['#7c6fff','🤖 IA'    ],
}
type Tab = 'search'|'history'|'affiliate'|'plans'

// ── Link directo al proveedor ─────────────────────────────────
function supplierUrl(name: string, keyword: string): string {
  const q = encodeURIComponent(keyword)
  const n = name.toLowerCase()
  if (n.includes('aliexpress')) return `https://www.aliexpress.com/wholesale?SearchText=${q}`
  if (n.includes('amazon'))     return `https://www.amazon.com/s?k=${q}`
  if (n.includes('spocket'))    return `https://app.spocket.co/products?search=${q}`
  if (n.includes('cj'))         return `https://cjdropshipping.com/search?q=${q}`
  if (n.includes('zendrop'))    return `https://app.zendrop.com/search?q=${q}`
  return `https://www.google.com/search?q=${q}+dropshipping`
}

// PDF generado por lib/pdf.ts

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
function PlansTab({onUpgrade,onManageBilling,billingLoading,currentPlan='free'}:{onUpgrade:(p:'pro'|'agency')=>void;onManageBilling:()=>void;billingLoading?:boolean;currentPlan?:string}){
  const PLANS=[
    {key:'free' as const,name:'Free',price:'$0',period:'/ siempre',grad:'',features:['5 búsquedas / día','Top 3 nichos','Score IA','❌ Análisis completo','❌ PDF exportable','❌ Links a proveedores'],cta:'Empezar gratis',dis:false},
    {key:'pro' as const,name:'Pro',price:'$19',period:'/ mes',grad:'var(--g1)',features:['Búsquedas ilimitadas','Top 4 nichos con 12 scores IA','Análisis completo en PDF','✓ Links directos a proveedores','✓ Keywords y cómo empezar','✓ Señales en vivo'],cta:'Subir a Pro',dis:false},
    {key:'agency' as const,name:'Agency',price:'$79',period:'/ mes',grad:'var(--g2)',features:['Todo en Pro','Análisis Expert validado','Veredicto equipo experto','ROI validado 90 días','Hasta 10 usuarios','API + white-label'],cta:'Subir a Agency',dis:false},
  ]
  return(
    <div style={{flex:1,padding:'2rem 1.5rem',maxWidth:900,margin:'0 auto',width:'100%'}}>
      <div style={{textAlign:'center',marginBottom:'2rem'}}>
        <h2 style={{fontSize:'clamp(1.5rem,4vw,2.25rem)',fontWeight:800,letterSpacing:'-1px',marginBottom:'.5rem'}}>
          Elige tu <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>plan</span>
        </h2>
        <p style={{color:'var(--t2)',fontSize:14}}>Empieza gratis. Cancela cuando quieras.</p>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:16,marginBottom:'2rem'}}>
        {PLANS.map(p=>(
          <div key={p.key} style={{background:'var(--c2)',border:`${p.key===currentPlan?'2px solid rgba(0,229,195,0.6)':'1px solid '+(p.key==='pro'?'rgba(124,111,255,0.5)':p.key==='agency'?'rgba(255,153,0,0.5)':'rgba(255,255,255,0.08)')}`,borderRadius:16,padding:'1.5rem',position:'relative',boxShadow:p.key===currentPlan?'0 0 30px rgba(0,229,195,0.15)':p.key==='pro'?'0 0 30px rgba(124,111,255,0.1)':p.key==='agency'?'0 0 30px rgba(255,153,0,0.1)':'none'}}>
            {p.key===currentPlan&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'linear-gradient(135deg,#00b894,#00e5c3)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 16px',borderRadius:10,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(0,229,195,0.4)'}}>✓ Tu plan actual</div>}
            {p.key==='pro'&&currentPlan!=='pro'&&currentPlan!=='agency'&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--g1)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 16px',borderRadius:10,whiteSpace:'nowrap',boxShadow:'0 2px 8px rgba(124,111,255,0.4)'}}>⚡ Más popular</div>}
            {p.key==='agency'&&currentPlan!=='agency'&&<div style={{position:'absolute',top:-12,left:'50%',transform:'translateX(-50%)',background:'var(--g2)',color:'#fff',fontSize:11,fontWeight:700,padding:'3px 16px',borderRadius:10,whiteSpace:'nowrap'}}>🏆 Expert</div>}
            <div style={{fontFamily:'var(--font-display)',fontWeight:700,marginBottom:'.25rem'}}>{p.name}</div>
            <div style={{fontFamily:'var(--font-display)',fontSize:'2.25rem',fontWeight:800,lineHeight:1,marginBottom:'.75rem',background:p.grad||'none',WebkitBackgroundClip:p.grad?'text':'none',WebkitTextFillColor:p.grad?'transparent':'var(--t1)'}}>
              {p.price}<span style={{fontSize:13,fontWeight:400,color:'var(--t3)',WebkitTextFillColor:'var(--t3)'}}> {p.period}</span>
            </div>
            <ul style={{listStyle:'none',marginBottom:'1.25rem',display:'flex',flexDirection:'column',gap:7}}>
              {p.features.map(f=>(
                <li key={f} style={{fontSize:13,color:f.startsWith('❌')?'var(--t3)':'var(--t2)',display:'flex',alignItems:'center',gap:7}}>
                  <span style={{color:f.startsWith('❌')?'var(--t3)':'var(--acc3)',fontSize:13}}>{f.startsWith('❌')?'✕':'✓'}</span>
                  {f.replace(/^[✓❌] /,'')}
                </li>
              ))}
            </ul>
            {(()=>{
              const isCurrent=p.key===currentPlan
              const isLower=(p.key==='free'&&currentPlan!=='free')||(p.key==='pro'&&currentPlan==='agency')
              return(
                <button onClick={()=>{ if(!isCurrent&&!isLower&&p.key!=='free') onUpgrade(p.key as 'pro'|'agency') }} disabled={isCurrent||isLower}
                  style={{width:'100%',padding:11,borderRadius:9,fontSize:14,fontWeight:600,
                    cursor:isCurrent||isLower?'default':'pointer',
                    fontFamily:'var(--font-body)',border:'none',
                    background:isCurrent?'linear-gradient(135deg,#00b894,#00e5c3)':isLower?'var(--c3)':p.grad||'var(--acc)',
                    color:isLower?'var(--t3)':'#fff',opacity:isLower?.4:1,
                    boxShadow:isCurrent?'0 4px 14px rgba(0,229,195,0.35)':isLower?'none':p.key==='pro'?'0 4px 14px rgba(124,111,255,0.35)':'0 4px 14px rgba(255,153,0,0.35)'}}>
                  {isCurrent?'✓ Tu plan actual':isLower?'Plan inferior':p.cta}
                </button>
              )
            })()}
          </div>
        ))}
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',marginBottom:'1rem'}}>Métodos de pago</div>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          {[['💳','Tarjetas'],['📱','PayPal'],['₿','Crypto'],['🏦','Wire'],['🇧🇷','PIX/OXXO'],['🌐','Stripe 135+']].map(([i,n])=>(
            <div key={n} style={{background:'var(--c2)',border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'8px 14px',textAlign:'center'}}>
              <div style={{fontSize:'1.1rem',marginBottom:2}}>{i}</div>
              <div style={{fontSize:11,color:'var(--t2)'}}>{n}</div>
            </div>
          ))}
        </div>
      </div>

      {currentPlan!=='free'&&(
        <div style={{textAlign:'center',marginTop:'2rem'}}>
          <button onClick={onManageBilling} disabled={billingLoading}
            style={{padding:'10px 22px',borderRadius:24,fontSize:13,cursor:billingLoading?'wait':'pointer',border:'1px solid rgba(124,111,255,0.35)',background:'rgba(124,111,255,0.08)',color:'var(--acc)',fontFamily:'var(--font-body)',fontWeight:500,opacity:billingLoading?.6:1}}>
            {billingLoading?'Abriendo...':'⚙️ Gestionar facturación'}
          </button>
          <div style={{fontSize:11,color:'var(--t3)',marginTop:6}}>Cambia tu tarjeta, descarga facturas o cancela cuando quieras.</div>
        </div>
      )}
    </div>
  )
}

// ── Historial con paginación ──────────────────────────────────
function dateLabel(dateStr: string): string {
  const d = new Date(dateStr), now = new Date()
  const diff = Math.floor((now.getTime()-d.getTime())/86400000)
  if (diff===0) return 'Hoy'
  if (diff===1) return 'Ayer'
  if (diff<7)   return 'Esta semana'
  if (diff<30)  return 'Este mes'
  return 'Más antiguas'
}

export default function Dashboard() {
  const supabase = getSupabaseBrowser()
  const [profile,      setProfile]      = useState<Profile|null>(null)
  const [profileLoaded,setProfileLoaded]= useState(false)
  const [query,        setQuery]        = useState('')
  const [filters,      setFilters]      = useState<Record<string,boolean>>({trending:true,low_comp:true})
  const [geo,          setGeo]          = useState('US')
  const [results,      setResults]      = useState<NicheResult[]>([])
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  // Camino A del Motor propio (vista previa instantánea, sin IA — ver
  // MOTOR_PROPIO_PROPUESTA.md). Estado 100% separado del de la búsqueda
  // con IA: nunca puede interferir con `results`/`loading`/`error`.
  const [fastPreview,        setFastPreview]        = useState<any>(null)
  const [fastPreviewLoading, setFastPreviewLoading] = useState(false)
  // true cuando el último intento de búsqueda con IA falló específicamente
  // por falta de crédito/clave inválida/límite (code:'ai_unavailable' desde
  // lib/ai.ts) — distingue "la IA no puede responder ahora" de un error real,
  // para mostrar un aviso informativo en vez de un error rojo genérico.
  const [aiUnavailable,      setAiUnavailable]      = useState(false)
  const [selected,     setSelected]     = useState<NicheResult|null>(null)
  const [tab,          setTab]          = useState<Tab>('search')
  const [history,      setHistory]      = useState<{query:string;results:NicheResult[];created_at:string}[]>([])
  const [historyTotal, setHistoryTotal] = useState(0)
  const [historyPage,  setHistoryPage]  = useState(1)
  const [isMobile,     setIsMobile]     = useState(false)
  const [showTrends,   setShowTrends]   = useState(false)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [isIOSDevice,  setIsIOSDevice]  = useState(false)
  const [billingLoading,setBillingLoading]=useState(false)
  const [savedNiches,  setSavedNiches]  = useState<Set<string>>(new Set())
  const [watchedNiches,setWatchedNiches]= useState<Set<string>>(new Set())
  const [ceoMode,      setCeoMode]      = useState(false)
  const [compareSet,   setCompareSet]   = useState<Set<string>>(new Set())
  const [showCompare,  setShowCompare]  = useState(false)
  const [reportLoading,setReportLoading]=useState(false)
  const lastQuery = useRef('')
  const autoSearchedRef = useRef(false)
  const countdown = useCountdown(profile)
  const HIST_PER_PAGE = 10
  const currency = GEO_MAP[geo]?.currency ?? 'USD $'

  useEffect(()=>{ const c=()=>setIsMobile(window.innerWidth<768); c(); window.addEventListener('resize',c); return()=>window.removeEventListener('resize',c) },[])
  useEffect(()=>{
    const ua = navigator.userAgent
    const ipadOS = ua.includes('Macintosh') && navigator.maxTouchPoints > 1
    setIsIOSDevice(/iPad|iPhone|iPod/.test(ua) || ipadOS)
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
  useEffect(()=>{ supabase.auth.getUser().then(({data})=>{ if(data.user)loadProfile(data.user.id); else window.location.href='/auth/login' }) },[])
  useEffect(()=>{ fetch(`/api/trends?geo=${geo}`).catch(()=>{}) },[geo])
  // Abrir pestaña concreta al llegar con ?tab=history (usado por el Command Palette)
  useEffect(()=>{
    const p=new URLSearchParams(window.location.search)
    const t=p.get('tab') as Tab|null
    if(t&&['search','history','affiliate','plans'].includes(t)){
      setTab(t); if(t==='history')loadHistory(1)
      window.history.replaceState({},'','/dashboard')
    }
  },[])
  useEffect(()=>{ if(countdown==='¡Ahora!'&&profile){ const id=setTimeout(()=>loadProfile(profile.id),1000); return()=>clearTimeout(id) } },[countdown])

  async function loadProfile(id:string){
    const{data}=await supabase.from('profiles').select('*').eq('id',id).single()
    if(data)setProfile(data as Profile)
    setProfileLoaded(true)
  }

  async function saveFavorite(niche:NicheResult){
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return
    const key=niche.name
    if(savedNiches.has(key))return
    setSavedNiches(s=>new Set(s).add(key))
    const{error}=await supabase.from('favorites').insert({user_id:user.id,niche_data:niche})
    if(error){ setSavedNiches(s=>{const n=new Set(s);n.delete(key);return n}); log.error('Error guardando favorito', { error: error.message }) }
    // Niche Intelligence Graph (Fase 1b, ver NICHEPULSE_PLATFORM_STRATEGY.md):
    // best-effort, nunca debe bloquear ni afectar el guardado real del favorito.
    else recordInteraction(supabase, { userId: user.id, nicheName: niche.name, type: 'favorite_add', geo })
  }

  async function watchNiche(niche:NicheResult){
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return
    const key=niche.name
    if(watchedNiches.has(key))return
    setWatchedNiches(s=>new Set(s).add(key))
    const{error}=await supabase.from('watchlist').upsert({
      user_id:user.id, niche_name:niche.name, query:lastQuery.current||query, geo,
      last_score:niche.opportunity_score??niche.profit_score??0, last_verdict:niche.verdict??null,
      niche_data:niche,
    },{onConflict:'user_id,niche_name'})
    if(error){ setWatchedNiches(s=>{const n=new Set(s);n.delete(key);return n}); log.error('Error guardando en watchlist', { error: error.message }) }
    else recordInteraction(supabase, { userId: user.id, nicheName: niche.name, type: 'watchlist_add', geo })
  }

  async function handleManageBilling(){
    setBillingLoading(true)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      if(!session){window.location.href='/auth/login';return}
      const res=await fetch('/api/create-portal-session',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}})
      const{url,error}=await res.json()
      if(error){alert(error);return}
      window.location.href=url
    }catch{ alert('No se pudo abrir el portal de facturación.') }
    finally{ setBillingLoading(false) }
  }

  async function handleExecutiveReport(){
    if(reportLoading||results.length===0)return
    setReportLoading(true)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/executive-report',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({niches:results})})
      const json=await res.json()
      if(!res.ok){alert(json.error??'No se pudo generar el informe');return}
      await downloadExecutiveReportPDF(results,profile?.plan??'pro',currency,lastQuery.current||query,json.actionPlan??[])
    }catch(e){ log.error('Error generando informe ejecutivo', { error: (e as any)?.message ?? String(e) }); alert('No se pudo generar el informe ejecutivo. Inténtalo de nuevo.') }
    finally{ setReportLoading(false) }
  }

  const runSearch=useCallback(async(override?:string)=>{
    const q=override??query; if(!q.trim()||loading)return
    if(override)setQuery(override); lastQuery.current=q
    setLoading(true);setError('');setAiUnavailable(false);setResults([])
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/search-niches',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({query:q,filters,geo})})
      const json=await res.json()
      if(!res.ok){
        if(json.code==='ai_unavailable'){
          // Fallback automático al motor propio (Camino A, sin IA): la IA no
          // puede responder ahora mismo (sin crédito/clave inválida/límite),
          // así que en vez de un error seco mostramos lo que sí sabemos con
          // datos reales de tendencias, mismo mecanismo que "⚡ Vista rápida"
          // pero disparado solo. Ver MOTOR_PROPIO_PROPUESTA.md.
          setAiUnavailable(true)
          setError(`El análisis con IA no está disponible ahora mismo (${json.error??'sin crédito'}). Te mostramos una vista rápida sin IA basada en tendencias en tiempo real mientras tanto.`)
          try{
            const res2=await fetch('/api/search-preview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({query:q,geo})})
            const json2=await res2.json()
            if(res2.ok)setFastPreview(json2)
          }catch{ /* el fallback nunca debe tapar el aviso de arriba */ }
        }else{
          setError(json.error??'Error al buscar')
        }
        return
      }
      setResults(json.results)
      if(session?.user?.id)await loadProfile(session.user.id)
    }catch{setError('Error de conexión.')}
    finally{setLoading(false)}
  },[query,filters,geo,loading])

  // Camino A del Motor propio: vista previa instantánea sin IA, gratis,
  // basada en señales reales de trends.ts (ver MOTOR_PROPIO_PROPUESTA.md).
  // No consume cuota de búsquedas ni reemplaza el análisis completo.
  const runFastPreview=useCallback(async()=>{
    if(!query.trim()||fastPreviewLoading)return
    setFastPreviewLoading(true);setFastPreview(null)
    try{
      const{data:{session}}=await supabase.auth.getSession()
      const res=await fetch('/api/search-preview',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session?.access_token}`},body:JSON.stringify({query,geo})})
      const json=await res.json()
      if(res.ok)setFastPreview(json)
    }catch{ /* no bloqueante: la vista previa rápida nunca debe interrumpir el flujo normal */ }
    finally{setFastPreviewLoading(false)}
  },[query,geo,fastPreviewLoading])

  // Auto-búsqueda al llegar desde /radar o el Command Palette con ?q=palabra
  // (declarado después de runSearch porque es un const y no se puede referenciar antes)
  useEffect(()=>{
    if(autoSearchedRef.current||!profileLoaded)return
    const p=new URLSearchParams(window.location.search)
    const q=p.get('q')
    if(q){ autoSearchedRef.current=true; runSearch(q); window.history.replaceState({},'','/dashboard') }
  },[profileLoaded,runSearch])

  async function handleUpgrade(plan:'pro'|'agency'){
    const{data:{session}}=await supabase.auth.getSession()
    if(!session){window.location.href='/auth/login';return}
    const res=await fetch('/api/create-checkout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({plan})})
    const{url,error}=await res.json()
    if(error){alert(error);return}
    window.location.href=url
  }

  async function loadHistory(page=1){
    const{data:{user}}=await supabase.auth.getUser(); if(!user)return
    const from=(page-1)*HIST_PER_PAGE, to=from+HIST_PER_PAGE-1
    const{data,count}=await supabase.from('niche_searches').select('query,results,created_at',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).range(from,to)
    if(data){ setHistory(page===1?data as any:[...history,...data as any]); setHistoryTotal(count??0); setHistoryPage(page) }
  }

  const isPro    = profile?.plan==='pro'||profile?.plan==='agency'
  const isAgency = profile?.plan==='agency'
  const remaining= profile?searchesLeft(profile.plan,profile.searches_today):5
  const noSearches = remaining===0

  const TABS: {key:Tab;label:string;icon:string}[]=[
    {key:'search',   label:'Buscar',   icon:'🔍'},
    {key:'history',  label:'Historial',icon:'📋'},
    {key:'affiliate',label:'Afiliados',icon:'👥'},
    {key:'plans',    label:'Planes',   icon:'💎'},
  ]

  // Agrupar historial por fecha
  const historyGrouped = history.reduce((acc,h)=>{
    const label=dateLabel(h.created_at)
    if(!acc[label])acc[label]=[]
    acc[label].push(h)
    return acc
  },{} as Record<string,typeof history>)
  const GROUP_ORDER=['Hoy','Ayer','Esta semana','Este mes','Más antiguas']

  return(
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column',background:'var(--c1)',paddingBottom:isMobile?64:0}}>

      {/* NAV — en móvil solo logo + campana: el resto de accesos vive en
          la barra inferior (MobileBottomNav) para que nada se corte ni
          quede fuera de alcance. En escritorio se mantiene todo inline. */}
      <nav className='np-nav-sticky' style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:isMobile?'10px 12px':'12px 20px',borderBottom:'1px solid rgba(124,111,255,0.15)',position:'sticky',top:0,background:'rgba(8,8,15,0.96)',backdropFilter:'blur(16px)',zIndex:100,boxShadow:'0 1px 20px rgba(0,0,0,0.3)'}}>
        <div style={{fontFamily:'var(--font-display)',fontSize:isMobile?'1rem':'1.15rem',fontWeight:800,letterSpacing:'-0.5px',display:'flex',alignItems:'center',gap:6}}>
          <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>NichepulseV.3</span>
          {profileLoaded&&!isPro&&<span style={{background:'linear-gradient(90deg,var(--acc3),#00b4d8)',color:'#000',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>FREE</span>}
          {profileLoaded&&isPro&&!isAgency&&<span style={{background:'var(--g1)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>PRO</span>}
          {profileLoaded&&isAgency&&<span style={{background:'var(--g2)',color:'#fff',fontSize:9,fontWeight:700,padding:'2px 7px',borderRadius:10}}>AGENCY</span>}
        </div>
        {isMobile?(
          profileLoaded&&isPro&&<OpportunityFeedBell/>
        ):(
        <div style={{display:'flex',gap:4,alignItems:'center'}}>
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);if(t.key==='history')loadHistory(1)}}
              style={{padding:'6px 14px',borderRadius:20,fontSize:13,cursor:'pointer',border:tab===t.key?'none':'1px solid rgba(124,111,255,0.2)',background:tab===t.key?'var(--g1)':'transparent',color:tab===t.key?'#fff':'var(--t2)',fontFamily:'var(--font-body)',fontWeight:tab===t.key?600:400,boxShadow:tab===t.key?'0 2px 10px rgba(124,111,255,0.35)':'none',transition:'all .2s'}}>
              {t.label}
            </button>
          ))}
          {profileLoaded&&isPro&&<OpportunityFeedBell/>}
          <Link href="/radar" title="Radar de nichos"
            style={{padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid rgba(0,229,195,0.3)',background:'rgba(0,229,195,0.08)',color:'var(--acc3)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',fontWeight:500}}>
            📡 Radar
          </Link>
          <Link href="/favorites" title="Mis favoritos"
            style={{padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid rgba(255,209,102,0.3)',background:'rgba(255,209,102,0.08)',color:'#ffd166',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',fontWeight:500}}>
            ⭐ Favoritos
          </Link>
          {profileLoaded&&isPro&&(
            <Link href="/watchlist" title="Mi watchlist"
              style={{padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid rgba(124,111,255,0.3)',background:'rgba(124,111,255,0.08)',color:'var(--acc)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',fontWeight:500}}>
              👁 Watchlist
            </Link>
          )}
          {profileLoaded&&isPro&&(
            <Link href="/copilot" title="Copiloto de negocio"
              style={{padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid rgba(244,113,181,0.3)',background:'rgba(244,113,181,0.08)',color:'var(--pink)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',fontWeight:500}}>
              🧭 Copiloto
            </Link>
          )}
          <a href="/download" title="Descargar app"
            style={{padding:'6px 12px',borderRadius:20,fontSize:12,border:'1px solid rgba(124,111,255,0.3)',background:'rgba(124,111,255,0.08)',color:'var(--acc)',textDecoration:'none',display:'inline-flex',alignItems:'center',gap:4,fontFamily:'var(--font-body)',fontWeight:500}}>
            ⬇ App
          </a>
          <button onClick={async()=>{await supabase.auth.signOut();window.location.href='/'}}
            style={{padding:'6px 12px',borderRadius:20,fontSize:12,cursor:'pointer',border:'1px solid rgba(255,255,255,0.1)',background:'transparent',color:'var(--t3)',fontFamily:'var(--font-body)'}}>
            Salir
          </button>
        </div>
        )}
      </nav>

      {isMobile&&(
        <MobileBottomNav
          tab={tab} setTab={setTab} isPro={isPro} isAgency={isAgency}
          onSignOut={async()=>{await supabase.auth.signOut();window.location.href='/'}}
        />
      )}

      {/* BÚSQUEDA */}
      {tab==='search'&&(
        <div style={{flex:1,display:'flex',gap:20,padding:isMobile?'1rem':'1.5rem',maxWidth:1200,margin:'0 auto',width:'100%',alignItems:isMobile?'stretch':'flex-start',flexDirection:isMobile?'column':'row'}}>
          <div style={{flex:1,minWidth:0}}>

            {/* Hero */}
            <div style={{textAlign:'center',marginBottom:'1.5rem',padding:'1.5rem 1rem',borderRadius:20,background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(255,107,157,0.06),rgba(0,229,195,0.04))',border:'1px solid rgba(124,111,255,0.12)'}}>
              <h1 style={{fontSize:isMobile?'1.5rem':'clamp(1.6rem,4vw,2.5rem)',fontWeight:800,lineHeight:1.1,letterSpacing:'-1px',marginBottom:'.5rem'}}>
                Encuentra tu{' '}
                <span style={{background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>nicho perfecto</span>
              </h1>
              <p style={{color:'var(--t2)',fontSize:'0.85rem',lineHeight:1.6}}>
                {isAgency?'Multi-IA Expert · Análisis validado con ROI calculado':'Señales de mercado en tiempo real con Multi-motor de IA'}
              </p>
              {!isMobile&&(
                <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:'1rem'}}>
                  {[{n:'12K+',l:'Nichos',c:'rgba(124,111,255,0.12)'},{n:'50+',l:'Regiones',c:'rgba(255,107,157,0.1)'},{n:'Live',l:'Señales',c:'rgba(0,229,195,0.1)'}].map(s=>(
                    <div key={s.n} style={{background:s.c,border:'0.5px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'7px 14px',textAlign:'center',minWidth:80}}>
                      <div style={{fontFamily:'var(--font-display)',fontSize:'1rem',fontWeight:700,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{s.n}</div>
                      <div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Banner sin búsquedas */}
            {profileLoaded&&!isPro&&noSearches&&(
              <div style={{background:'linear-gradient(135deg,rgba(124,111,255,0.15),rgba(255,107,157,0.12))',border:'1px solid rgba(124,111,255,0.4)',borderRadius:14,padding:'16px',marginBottom:'1.25rem',textAlign:'center',boxShadow:'0 4px 20px rgba(124,111,255,0.15)'}}>
                <div style={{fontSize:'1.5rem',marginBottom:6}}>⏰</div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'1rem',marginBottom:4}}>Has usado tus 5 búsquedas de hoy</div>
                {countdown&&countdown!=='¡Ahora!'&&<div style={{fontSize:13,color:'var(--t2)',marginBottom:'1rem'}}>Se recargan en{' '}<strong style={{color:'var(--acc3)',fontFamily:'var(--font-display)',fontSize:'1.1rem'}}>{countdown}</strong></div>}
                {countdown==='¡Ahora!'&&<div style={{fontSize:13,color:'var(--acc3)',marginBottom:'1rem',fontWeight:600}}>¡Se recargaron! Recarga la página.</div>}
                <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
                  <button onClick={()=>handleUpgrade('pro')} className="np-btn-primary" style={{fontSize:13,padding:'9px 18px'}}>⚡ Pro ilimitado — $19/mes</button>
                  <button onClick={()=>setTab('plans')} style={{padding:'9px 18px',borderRadius:24,fontSize:13,cursor:'pointer',border:'1px solid rgba(124,111,255,0.4)',background:'transparent',color:'var(--t1)',fontFamily:'var(--font-body)'}}>Ver planes</button>
                </div>
              </div>
            )}

            {/* Barra searches restantes (discreta) */}
            {profileLoaded&&!isPro&&!noSearches&&(
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'7px 12px',borderRadius:10,background:'rgba(124,111,255,0.06)',border:'0.5px solid rgba(124,111,255,0.12)',marginBottom:'1rem'}}>
                <div style={{display:'flex',gap:3}}>{Array.from({length:5}).map((_,i)=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:i<Number(remaining)?'var(--acc3)':'rgba(255,255,255,0.1)'}}/>)}</div>
                <div style={{fontSize:12,color:'var(--t2)'}}><strong style={{color:'var(--t1)'}}>{remaining}</strong> búsquedas restantes hoy</div>
                <button onClick={()=>setTab('plans')} style={{marginLeft:'auto',fontSize:11,color:'var(--acc)',background:'none',border:'none',cursor:'pointer',fontFamily:'var(--font-body)'}}>Ver Pro →</button>
              </div>
            )}

            {/* Banner Pro → Agency */}
            {profileLoaded&&isPro&&!isAgency&&(
              <div style={{background:'linear-gradient(135deg,rgba(255,153,0,0.08),rgba(255,107,157,0.08))',border:'1px solid rgba(255,153,0,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:'1.25rem',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <div><div style={{fontSize:13,color:'var(--t1)',fontWeight:500}}>Estás en Pro ⚡</div><div style={{fontSize:12,color:'var(--t2)',marginTop:2}}>Sube a Agency para análisis expert validados</div></div>
                <button onClick={()=>handleUpgrade('agency')} className="np-btn-agency" style={{fontSize:12,padding:'7px 14px'}}>Subir →</button>
              </div>
            )}

            {/* Buscador */}
            <div style={{background:'var(--c2)',border:'1px solid rgba(124,111,255,0.2)',borderRadius:16,padding:'1.25rem',marginBottom:'1.25rem',boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
              <div style={{fontSize:11,color:'var(--t3)',textTransform:'uppercase',letterSpacing:'1px',fontWeight:600,marginBottom:'.6rem'}}>
                {isAgency?'🏆 Análisis expert — describe tu nicho':'Describe tu nicho o categoría'}
              </div>
              <div style={{display:'flex',gap:8,marginBottom:'.9rem',flexWrap:isMobile?'wrap':'nowrap'}}>
                <input className="np-input" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&runSearch()}
                  placeholder={isAgency?'ej: mascotas premium, tech sostenible...':'ej: mascotas, gadgets tech, yoga...'} style={{fontSize:isMobile?14:15}}/>
                <div style={{display:'flex',gap:8,width:isMobile?'100%':'auto',alignItems:'center',flexWrap:isMobile?'wrap':'nowrap'}}>
                  {/* Selector región por continente */}
                  <div style={{position:'relative',flex:isMobile?'1 1 100%':'auto',display:'flex',alignItems:'center',gap:6,minWidth:0}}>
                    <select value={geo} onChange={e=>setGeo(e.target.value)}
                      style={{background:'var(--c3)',border:'1px solid rgba(124,111,255,0.2)',borderRadius:8,color:'var(--t1)',fontSize:12,padding:'0 10px',cursor:'pointer',fontFamily:'var(--font-body)',height:42,flex:isMobile?1:'auto',minWidth:isMobile?'auto':160}}>
                      <option value="">🌍 Escoger región</option>
                      {Object.entries(GEO_REGIONS).map(([continent,countries])=>(
                        <optgroup key={continent} label={continent}>
                          {countries.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {/* Badge moneda */}
                    {geo&&<span style={{fontSize:11,color:'var(--acc3)',background:'rgba(0,229,195,0.1)',border:'0.5px solid rgba(0,229,195,0.3)',borderRadius:6,padding:'3px 7px',whiteSpace:'nowrap',flexShrink:0,fontWeight:600}}>{currency}</span>}
                  </div>
                  <button onClick={runFastPreview} disabled={fastPreviewLoading||!query.trim()} title="Vista previa instantánea sin IA, gratis — señales en vivo de Google/TikTok/Amazon"
                    style={{background:'transparent',color:'var(--acc3)',border:'1px solid rgba(0,229,195,0.35)',padding:isMobile?'0 10px':'0 14px',borderRadius:9,fontSize:13,fontWeight:600,cursor:fastPreviewLoading||!query.trim()?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:fastPreviewLoading||!query.trim()?.5:1,fontFamily:'var(--font-body)',height:42}}>
                    {fastPreviewLoading?'⚡...':isMobile?'⚡':'⚡ Vista rápida'}
                  </button>
                  <button onClick={()=>runSearch()} disabled={loading||!query.trim()||noSearches}
                    style={{background:isAgency?'var(--g2)':'var(--g1)',color:'#fff',border:'none',padding:'0 18px',borderRadius:9,fontSize:14,fontWeight:600,cursor:loading||!query.trim()||noSearches?'not-allowed':'pointer',whiteSpace:'nowrap',opacity:loading||!query.trim()||noSearches?.5:1,fontFamily:'var(--font-body)',height:42,boxShadow:loading?'none':'0 4px 14px rgba(124,111,255,0.35)'}}>
                    {loading?'⏳ Multi-IA...':isAgency?'🏆 Expert Analizar':'✦ Analizar'}
                  </button>
                </div>
              </div>

              {/* Camino A: vista previa instantánea sin IA (Motor propio) */}
              {fastPreview&&(
                <div style={{background:'var(--c3)',border:`1px solid ${fastPreview.matched?'rgba(0,229,195,0.3)':'rgba(255,255,255,0.08)'}`,borderRadius:10,padding:'10px 14px',marginBottom:'.9rem',fontSize:12.5}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:6}}>
                    <span style={{fontWeight:700,color:'var(--acc3)'}}>⚡ Vista rápida (sin IA, gratis)</span>
                    <button onClick={()=>setFastPreview(null)} style={{background:'none',border:'none',color:'var(--t3)',cursor:'pointer',fontSize:13,padding:0}}>✕</button>
                  </div>
                  {fastPreview.matched?(
                    <>
                      <div style={{color:'var(--t2)',marginBottom:6}}>
                        Momentum score: <strong style={{color:'var(--t1)'}}>{fastPreview.fastOpportunityScore}</strong> · Confianza: <strong style={{color:'var(--t1)'}}>{fastPreview.confidence}</strong>
                      </div>
                      <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:3}}>
                        {fastPreview.reasons.map((r:string,i:number)=><li key={i} style={{color:'var(--t3)'}}>• {r}</li>)}
                      </ul>
                    </>
                  ):(
                    <div style={{color:'var(--t3)'}}>{fastPreview.reasons[0]}</div>
                  )}
                </div>
              )}
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {FILTERS.map(f=>(
                  <button key={f.key} onClick={()=>setFilters(p=>({...p,[f.key]:!p[f.key]}))}
                    style={{padding:'4px 11px',borderRadius:14,fontSize:12,cursor:'pointer',border:`1px solid ${filters[f.key]?'rgba(124,111,255,0.6)':'rgba(255,255,255,0.08)'}`,background:filters[f.key]?'rgba(124,111,255,0.2)':'var(--c3)',color:filters[f.key]?'var(--acc)':'var(--t2)',fontFamily:'var(--font-body)',fontWeight:filters[f.key]?500:400,transition:'all .15s'}}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Señales móvil */}
            {isMobile&&<button onClick={()=>setShowTrends(v=>!v)} style={{width:'100%',padding:'9px',borderRadius:10,fontSize:13,cursor:'pointer',border:'1px solid rgba(0,229,195,0.25)',background:'rgba(0,229,195,0.05)',color:'var(--acc3)',fontFamily:'var(--font-body)',marginBottom:'1rem',fontWeight:500}}>📡 {showTrends?'Ocultar':'Ver'} señales en vivo</button>}
            {isMobile&&showTrends&&<div style={{marginBottom:'1rem'}}><TrendsPanel geo={geo} onKeywordClick={kw=>runSearch(kw)}/></div>}

            {/* Error / aviso de IA no disponible (fallback a Camino A) */}
            {error&&(
              <div style={{background:aiUnavailable?'rgba(251,191,36,0.1)':'rgba(255,60,104,0.1)',border:`1px solid ${aiUnavailable?'rgba(251,191,36,0.35)':'rgba(255,107,157,0.3)'}`,borderRadius:10,padding:'10px 14px',marginBottom:'1.25rem',fontSize:13,color:aiUnavailable?'#fbbf24':'#ff9dc0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                <span>{aiUnavailable?'⚡ ':''}{error}</span>
                <button onClick={()=>runSearch(lastQuery.current||query)} style={{background:'var(--g1)',color:'#fff',border:'none',padding:'5px 12px',borderRadius:8,fontSize:12,cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:600,flexShrink:0}}>Reintentar</button>
              </div>
            )}

            {/* Loading */}
            {loading&&(
              <div style={{textAlign:'center',padding:'3rem'}}>
                <div style={{width:48,height:48,border:'3px solid rgba(124,111,255,0.2)',borderTopColor:'var(--acc)',borderRadius:'50%',animation:'spin .75s linear infinite',margin:'0 auto 1rem'}}/>
                <div style={{color:'var(--t2)',fontSize:13}}>{isAgency?'🏆 Multi-IA Expert validando nichos...':'✦ Multi-motor de IA analizando...'}</div>
              </div>
            )}

            {/* Resultados */}
            {!loading&&results.length>0&&(
              <div>
                <div style={{fontSize:12,color:'var(--t3)',marginBottom:'.75rem',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:'var(--acc3)',display:'inline-block',boxShadow:'0 0 6px var(--acc3)'}}/>
                  {results.length} nichos{isAgency?' · expert':''} · Región: {GEO_MAP[geo]?.label??geo} · {currency}
                  <div style={{marginLeft:isMobile?0:'auto',width:isMobile?'100%':'auto',display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
                    {isPro&&results.length>1&&(
                      <button onClick={handleExecutiveReport} disabled={reportLoading}
                        style={{padding:'5px 12px',borderRadius:14,fontSize:11,fontWeight:600,cursor:reportLoading?'wait':'pointer',border:'1px solid rgba(124,111,255,0.3)',background:'rgba(124,111,255,0.1)',color:'var(--acc)',fontFamily:'var(--font-body)',opacity:reportLoading?.6:1}}>
                        {reportLoading?'⏳':(isMobile?'📊 Informe':'📊 Informe ejecutivo')}
                      </button>
                    )}
                    {compareSet.size>=2&&(
                      <button onClick={()=>setShowCompare(true)}
                        style={{padding:'5px 12px',borderRadius:14,fontSize:11,fontWeight:700,cursor:'pointer',border:'1px solid rgba(0,229,195,0.4)',background:'rgba(0,229,195,0.12)',color:'var(--acc3)',fontFamily:'var(--font-body)'}}>
                        🆚 {isMobile?compareSet.size:`Comparar (${compareSet.size})`}
                      </button>
                    )}
                    <button onClick={()=>setCeoMode(v=>!v)}
                      style={{padding:'5px 12px',borderRadius:14,fontSize:11,fontWeight:600,cursor:'pointer',border:`1px solid ${ceoMode?'rgba(124,111,255,0.55)':'rgba(255,255,255,0.1)'}`,background:ceoMode?'rgba(124,111,255,0.18)':'transparent',color:ceoMode?'var(--acc)':'var(--t3)',fontFamily:'var(--font-body)'}}>
                      💼 {isMobile?'CEO':(ceoMode?'Modo CEO ✓':'Modo CEO')}
                    </button>
                  </div>
                </div>
                {ceoMode?(
                  <CeoMode results={results} onSelect={setSelected}/>
                ):(
                <div style={{display:'grid',gap:12}}>
                  {results.map((n,i)=>{
                    const src=(n as any).trend_source??'organic'
                    const[srcColor,srcLabel]=SRC_PILL[src]??SRC_PILL.organic
                    return(
                      <div key={i} className="card card-hover fade-up" onClick={()=>setSelected(n)}
                        style={{padding:'1.2rem',position:'relative',overflow:'hidden',animationDelay:`${i*.07}s`}}>
                        <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:isAgency?'var(--g2)':'var(--g1)'}}/>
                        {isAgency&&<div style={{position:'absolute',top:8,right:8,fontSize:10,background:'var(--g2)',color:'#fff',padding:'2px 7px',borderRadius:8,fontWeight:700}}>🏆 EXPERT</div>}
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'.7rem'}}>
                          <div style={{fontFamily:'var(--font-display)',fontWeight:700,fontSize:'.92rem',paddingRight:isAgency?50:10}}>{n.name}</div>
                          <div style={{textAlign:'right',flexShrink:0}}>
                            <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',fontWeight:800,color:scoreColor(n.opportunity_score??n.profit_score??0)}}>{n.opportunity_score??n.profit_score??0}</div>
                            <div style={{fontSize:9,color:'var(--t3)'}}>Score</div>
                          </div>
                        </div>
                        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'.7rem',alignItems:'center'}}>
                          <VerdictBadge verdict={n.verdict} />
                          {n.tags.map(t=>{const[cls,lbl]=TAG_MAP[t]??['tag-trend',t];return<span key={t} className={`tag ${cls}`}>{lbl}</span>})}
                          <span style={{fontSize:11,padding:'3px 7px',borderRadius:8,background:`${srcColor}20`,color:srcColor,border:`0.5px solid ${srcColor}40`,fontWeight:500}}>{srcLabel}</span>
                        </div>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                          {[['Mercado',n.market_size,'rgba(124,111,255,0.1)'],['Margen',n.margin,'rgba(0,229,195,0.08)']].map(([k,v,bg])=>(
                            <div key={k} style={{background:bg,border:'0.5px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'7px 10px'}}>
                              <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                              <div style={{fontSize:10,color:'var(--t3)',marginTop:1}}>{k}</div>
                            </div>
                          ))}
                        </div>
                        <div className="score-bar" style={{marginTop:10}}><div className="score-fill" style={{width:`${n.profit_score}%`}}/></div>
                        <div style={{display:'flex',alignItems:'center',justifyContent:isMobile?'flex-end':'space-between',flexWrap:'wrap',rowGap:6,marginTop:8}}>
                          {!isMobile&&<span style={{fontSize:11,color:'var(--t3)'}}>Pulsa para ver detalles →</span>}
                          <div style={{display:'flex',gap:isMobile?5:6,flexWrap:'wrap',flexShrink:0,width:isMobile?'100%':'auto',justifyContent:isMobile?'flex-start':'flex-end'}}>
                            <button
                              onClick={(e)=>{ e.stopPropagation(); saveFavorite(n) }}
                              disabled={savedNiches.has(n.name)}
                              title={savedNiches.has(n.name)?'Guardado en favoritos':'Guardar en favoritos'}
                              style={{
                                display:'flex',alignItems:'center',gap:5,
                                background:savedNiches.has(n.name)?'rgba(255,209,102,0.18)':'rgba(255,255,255,0.06)',
                                border:`1px solid ${savedNiches.has(n.name)?'rgba(255,209,102,0.4)':'rgba(255,255,255,0.12)'}`,
                                color:savedNiches.has(n.name)?'#ffd166':'var(--t2)',
                                borderRadius:8,padding:isMobile?'5px 8px':'4px 10px',fontSize:11,fontWeight:600,
                                cursor:savedNiches.has(n.name)?'default':'pointer',fontFamily:'var(--font-body)',
                              }}>
                              {isMobile?(savedNiches.has(n.name)?'★':'☆'):(savedNiches.has(n.name)?'★ Guardado':'☆ Favorito')}
                            </button>
                            {isPro&&(
                              <button
                                onClick={(e)=>{ e.stopPropagation(); watchNiche(n) }}
                                disabled={watchedNiches.has(n.name)}
                                title={watchedNiches.has(n.name)?'Vigilando este nicho':'Vigilar cambios en este nicho'}
                                style={{
                                  display:'flex',alignItems:'center',gap:5,
                                  background:watchedNiches.has(n.name)?'rgba(124,111,255,0.18)':'rgba(255,255,255,0.06)',
                                  border:`1px solid ${watchedNiches.has(n.name)?'rgba(124,111,255,0.4)':'rgba(255,255,255,0.12)'}`,
                                  color:watchedNiches.has(n.name)?'var(--acc)':'var(--t2)',
                                  borderRadius:8,padding:isMobile?'5px 8px':'4px 10px',fontSize:11,fontWeight:600,
                                  cursor:watchedNiches.has(n.name)?'default':'pointer',fontFamily:'var(--font-body)',
                                }}>
                                {isMobile?'👁':(watchedNiches.has(n.name)?'👁 Vigilando':'👁 Vigilar')}
                              </button>
                            )}
                            {isPro&&(
                              <button
                                onClick={(e)=>{ e.stopPropagation(); setCompareSet(s=>{ const n2=new Set(s); if(n2.has(n.name))n2.delete(n.name); else if(n2.size<3)n2.add(n.name); return n2 }) }}
                                title={compareSet.has(n.name)?'Quitar del comparador':'Añadir al comparador (máx. 3)'}
                                style={{
                                  display:'flex',alignItems:'center',gap:5,
                                  background:compareSet.has(n.name)?'rgba(0,229,195,0.18)':'rgba(255,255,255,0.06)',
                                  border:`1px solid ${compareSet.has(n.name)?'rgba(0,229,195,0.4)':'rgba(255,255,255,0.12)'}`,
                                  color:compareSet.has(n.name)?'var(--acc3)':'var(--t2)',
                                  borderRadius:8,padding:isMobile?'5px 8px':'4px 10px',fontSize:11,fontWeight:600,
                                  cursor:'pointer',fontFamily:'var(--font-body)',
                                }}>
                                {isMobile?'🆚':(compareSet.has(n.name)?'✓ Comparando':'🆚 Comparar')}
                              </button>
                            )}
                            {isPro&&(
                              <button
                                onClick={async(e)=>{
                                  e.stopPropagation()
                                  setPdfLoading(true)
                                  try { await downloadNichePDF(n,profile?.plan??'pro',currency) }
                                  catch(err){ log.error('Error generando PDF', { error: (err as any)?.message ?? String(err) }); alert('No se pudo generar el PDF. Inténtalo de nuevo.') }
                                  finally { setPdfLoading(false) }
                                }}
                                disabled={pdfLoading}
                                title="Descargar PDF de este nicho"
                                style={{
                                  display:'flex',alignItems:'center',gap:5,
                                  background:isAgency?'rgba(255,153,0,0.12)':'rgba(124,111,255,0.12)',
                                  border:`1px solid ${isAgency?'rgba(255,153,0,0.35)':'rgba(124,111,255,0.35)'}`,
                                  color:isAgency?'#ff9900':'var(--acc)',
                                  borderRadius:8,padding:isMobile?'5px 8px':'4px 10px',fontSize:11,fontWeight:600,
                                  cursor:pdfLoading?'wait':'pointer',fontFamily:'var(--font-body)',
                                  opacity:pdfLoading?.6:1,
                                }}>
                                {pdfLoading?'⏳':'⬇'}{!isMobile&&' PDF'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                )}
              </div>
            )}

            {!loading&&results.length===0&&!error&&(
              <div style={{textAlign:'center',padding:'3rem',color:'var(--t3)'}}>
                <div style={{fontSize:'2.5rem',marginBottom:'1rem',opacity:.3}}>◎</div>
                <div style={{fontSize:14}}>Escribe una categoría o selecciona una señal del panel →</div>
              </div>
            )}
          </div>

          {/* Panel señales */}
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

      {/* HISTORIAL con paginación */}
      {tab==='history'&&(
        <div style={{flex:1,padding:isMobile?'1rem':'2rem 1.5rem',maxWidth:720,margin:'0 auto',width:'100%'}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'1.5rem'}}>
            <h2 style={{fontWeight:800,background:'var(--g1)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>Historial</h2>
            {historyTotal>0&&<div style={{fontSize:12,color:'var(--t3)'}}>{historyTotal} búsquedas en total</div>}
          </div>
          {history.length===0
            ?<div style={{textAlign:'center',color:'var(--t3)',padding:'3rem',fontSize:13}}>Sin búsquedas guardadas.</div>
            :<div>
              {GROUP_ORDER.filter(g=>historyGrouped[g]?.length).map(group=>(
                <div key={group} style={{marginBottom:'1.5rem'}}>
                  <div style={{fontSize:11,color:'var(--acc)',fontWeight:700,textTransform:'uppercase',letterSpacing:'1px',marginBottom:'.6rem',paddingLeft:4}}>{group}</div>
                  <div style={{display:'grid',gap:8}}>
                    {historyGrouped[group].map((h,i)=>(
                      <div key={i} className="card card-hover" onClick={()=>{setResults(h.results);setTab('search')}}
                        style={{padding:'.9rem 1.25rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div>
                          <div style={{fontWeight:500,marginBottom:2,fontSize:13}}>"{h.query}"</div>
                          <div style={{fontSize:11,color:'var(--t3)'}}>{h.results.length} nichos · {new Date(h.created_at).toLocaleString('es-ES',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'})}</div>
                        </div>
                        <span style={{color:'var(--acc)',fontSize:16}}>→</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {history.length<historyTotal&&(
                <div style={{textAlign:'center',marginTop:'1rem'}}>
                  <button onClick={()=>loadHistory(historyPage+1)}
                    style={{padding:'9px 24px',borderRadius:20,fontSize:13,cursor:'pointer',border:'1px solid rgba(124,111,255,0.3)',background:'transparent',color:'var(--acc)',fontFamily:'var(--font-body)',fontWeight:500}}>
                    Cargar más ({historyTotal-history.length} restantes)
                  </button>
                </div>
              )}
              {history.length>=50&&(
                <div style={{textAlign:'center',marginTop:'1rem',fontSize:12,color:'var(--t3)'}}>Mostrando las últimas 50 búsquedas</div>
              )}
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
          {[['🔗','Link único trackeado','Seguimiento en tiempo real.'],['💸','Ingresos recurrentes','Cobras cada mes que tu referido pague.'],['🎨','Kit de contenido','Templates para Reels, TikTok, YouTube.'],['💳','PayPal, cripto o wire','Mínimo $50. El día 1 de cada mes.']].map(([icon,title,desc])=>(
            <div key={title as string} style={{background:'var(--c2)',border:'0.5px solid rgba(255,255,255,0.07)',borderRadius:12,padding:'1rem 1.25rem',marginBottom:8,display:'flex',gap:'1rem',alignItems:'flex-start'}}>
              <div style={{fontSize:'1.3rem',flexShrink:0}}>{icon}</div>
              <div><div style={{fontWeight:600,marginBottom:2,fontSize:'.9rem'}}>{title}</div><div style={{fontSize:13,color:'var(--t2)',lineHeight:1.5}}>{desc}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* PLANES */}
      {tab==='plans'&&<PlansTab onUpgrade={handleUpgrade} onManageBilling={handleManageBilling} billingLoading={billingLoading} currentPlan={profile?.plan??'free'}/>}

      {/* MODAL — info básica + links */}
      {/* Estructura: overlay centrado (ya no hace scroll él mismo) → caja del
          modal con alto acotado (antes 'none' en desktop, por eso el
          contenido largo del Motor de Inteligencia empujaba la cabecera
          fuera de la pantalla sin forma de volver a ella) → dentro, cabecera
          fija (nombre/score/favorito/cerrar, siempre visible) + cuerpo con
          su propio scroll interno. Así el botón de cerrar nunca deja de
          verse ni de poder pulsarse, en web y en móvil. */}
      {selected&&(
        <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.88)',zIndex:200,display:'flex',alignItems:isMobile?'flex-end':'center',justifyContent:'center',padding:isMobile?0:'1.5rem',overflowY:'auto',backdropFilter:'blur(4px)'}}>
          <div onClick={e=>e.stopPropagation()}
            className={isMobile?'np-modal-sheet':''} style={{width:'100%',maxWidth:isMobile?'100%':480,background:'var(--c2)',border:'1px solid rgba(124,111,255,0.25)',borderRadius:isMobile?'20px 20px 0 0':'20px',maxHeight:isMobile?'88vh':'85vh',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,0.5)',display:'flex',flexDirection:'column'}}>

            {/* Cabecera fija — nunca se va con el scroll */}
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'1.25rem 1.5rem 1rem',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.06)',background:'var(--c2)',borderRadius:isMobile?'20px 20px 0 0':'20px 20px 0 0'}}>
              <div>
                <div style={{fontFamily:'var(--font-display)',fontWeight:800,fontSize:'1rem'}}>{selected.name}</div>
                {isAgency&&<div style={{fontSize:11,color:'#ff9900',marginTop:2,fontWeight:600}}>🏆 Análisis expert</div>}
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{textAlign:'right'}}>
                  <div style={{fontFamily:'var(--font-display)',fontSize:'1.4rem',fontWeight:800,color:scoreColor(selected.opportunity_score??selected.profit_score??0)}}>{selected.opportunity_score??selected.profit_score??0}</div>
                  <div style={{fontSize:9,color:'var(--t3)'}}>Score IA</div>
                </div>
                <button onClick={()=>saveFavorite(selected)} disabled={savedNiches.has(selected.name)}
                  title={savedNiches.has(selected.name)?'Guardado en favoritos':'Guardar en favoritos'}
                  style={{background:savedNiches.has(selected.name)?'rgba(255,209,102,0.18)':'var(--c3)',border:savedNiches.has(selected.name)?'1px solid rgba(255,209,102,0.4)':'none',color:savedNiches.has(selected.name)?'#ffd166':'var(--t1)',width:32,height:32,borderRadius:'50%',cursor:savedNiches.has(selected.name)?'default':'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  {savedNiches.has(selected.name)?'★':'☆'}
                </button>
                <button onClick={()=>setSelected(null)} style={{background:'var(--c3)',border:'none',color:'var(--t1)',width:32,height:32,borderRadius:'50%',cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</button>
              </div>
            </div>

            {/* Cuerpo — todo lo demás, con scroll propio e independiente de la cabecera */}
            <div style={{overflowY:'auto',padding:'1rem 1.5rem 1.5rem'}}>

            {/* Veredicto — qué hacer con este nicho, antes que ningún otro dato */}
            <VerdictBadge verdict={selected.verdict} reason={selected.verdict_reason} size="lg" />

            {/* Tags */}
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:'1rem'}}>
              {selected.tags.map(t=>{const[cls,lbl]=TAG_MAP[t]??['tag-trend',t];return<span key={t} className={`tag ${cls}`}>{lbl}</span>})}
              <span style={{fontSize:11,padding:'3px 8px',borderRadius:8,background:'rgba(0,229,195,0.1)',color:'var(--acc3)',border:'0.5px solid rgba(0,229,195,0.3)',fontWeight:600}}>{currency}</span>
            </div>

            {/* Explicabilidad del motor propio (AUDITORIA_INTELLIGENCE_ENGINE.md
                Fase 6/10, P0.2): antes esta información se calculaba pero se
                descartaba tras convertirse en texto de prompt para el LLM —
                nunca llegaba hasta aquí. Se muestra solo si el motor propio
                pudo reunir contexto para esta búsqueda (ver lib/ai.ts). */}
            {selected.engine_confidence && (()=>{
              const c = selected.engine_confidence!
              const exp = selected.engine_explanation
              const LEVEL_COLOR: Record<string,string> = {sin_datos:'var(--t3)',baja:'#fbbf24',media:'#7c6fff',alta:'#2dd4bf'}
              const LEVEL_LABEL: Record<string,string> = {sin_datos:'Sin datos propios',baja:'Confianza baja',media:'Confianza media',alta:'Confianza alta'}
              const hasContradictions = !!exp?.contradictions?.length
              return (
                <div style={{marginBottom:'1rem',background:'var(--c3)',border:`1px solid ${hasContradictions?'rgba(251,191,36,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:10,padding:'10px 12px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:LEVEL_COLOR[c.level],display:'inline-block'}}/>
                    <span style={{fontSize:12,fontWeight:700,color:LEVEL_COLOR[c.level]}}>🧠 {LEVEL_LABEL[c.level]}</span>
                    {typeof c.coverage==='number'&&<span style={{fontSize:11,color:'var(--t3)'}}>· Cobertura de datos propios: {c.coverage}%</span>}
                    {c.dataQuality!=null&&<span style={{fontSize:11,color:'var(--t3)'}}>· Consistencia del histórico: {c.dataQuality}%</span>}
                  </div>
                  <div style={{fontSize:12,color:'var(--t2)',lineHeight:1.5}}>{c.reasoning}</div>
                  {hasContradictions&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(251,191,36,0.25)'}}>
                      {exp!.contradictions.map((ct,i)=>(
                        <div key={i} style={{fontSize:12,color:'#fbbf24',display:'flex',gap:6,marginBottom:4}}>
                          <span style={{flexShrink:0}}>⚠️</span><span>{ct}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {exp&&(exp.usedSources.length>0||exp.missingSources.length>0)&&(
                    <div style={{marginTop:8,paddingTop:8,borderTop:'1px solid rgba(255,255,255,0.06)',fontSize:11,color:'var(--t3)',lineHeight:1.6}}>
                      {exp.usedSources.length>0&&<div>✓ Usado: {exp.usedSources.join(' · ')}</div>}
                      {exp.missingSources.length>0&&<div style={{marginTop:2}}>✕ No disponible: {exp.missingSources.join(' · ')}</div>}
                    </div>
                  )}
                </div>
              )
            })()}

            {/* Motor de Inteligencia — 12 scores explicados (Pro/Agency) */}
            {isPro ? (
              <div style={{marginBottom:'1rem'}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Motor de Inteligencia · toca un score para ver por qué</div>
                <ScoreGrid scores={selected.scores} compact />
              </div>
            ) : (
              <div style={{marginBottom:'1rem',background:'rgba(124,111,255,0.05)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:12,color:'var(--t3)'}}>🔒 Desglose completo de 12 scores explicados disponible en Pro</div>
              </div>
            )}

            {/* Métricas básicas */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:'1rem'}}>
              {[['Mercado',selected.market_size,'rgba(124,111,255,0.1)'],['Margen',selected.margin,'rgba(0,229,195,0.08)'],['Competencia',selected.competition,'rgba(255,209,102,0.08)'],['Tendencia',selected.trend,'rgba(255,107,157,0.08)']].map(([k,v,bg])=>(
                <div key={k} style={{background:bg,border:'0.5px solid rgba(255,255,255,0.06)',borderRadius:8,padding:'8px 10px'}}>
                  <div style={{fontSize:13,fontWeight:600}}>{v}</div>
                  <div style={{fontSize:11,color:'var(--t3)',marginTop:2}}>{k}</div>
                </div>
              ))}
            </div>

            {/* Proveedores con links (Pro/Agency) */}
            <div style={{marginBottom:'1rem'}}>
              <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Proveedores</div>
              {selected.suppliers.map((s,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--c3)',borderRadius:8,padding:'.65rem 10px',marginBottom:5}}>
                  <span style={{fontSize:13,fontWeight:500}}>{s.name}</span>
                  <div style={{display:'flex',alignItems:'center',gap:6}}>
                    <span style={{fontSize:11,color:'var(--t2)'}}>{s.note}</span>
                    {isPro&&(
                      <a href={supplierUrl(s.name,selected.keywords[0]??selected.name)} target="_blank" rel="noopener noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{fontSize:11,color:'var(--acc3)',background:'rgba(0,229,195,0.1)',border:'0.5px solid rgba(0,229,195,0.3)',borderRadius:5,padding:'2px 7px',textDecoration:'none',whiteSpace:'nowrap',fontWeight:500}}>
                        Buscar →
                      </a>
                    )}
                  </div>
                </div>
              ))}
              {!isPro&&<div style={{fontSize:12,color:'var(--t3)',textAlign:'center',padding:'6px',background:'rgba(124,111,255,0.05)',borderRadius:6}}>🔒 Links directos disponibles en Pro</div>}
            </div>

            {/* Keywords — solo Pro/Agency */}
            {isPro?(
              <div style={{marginBottom:'1rem'}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Keywords</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{selected.keywords.map(k=><a key={k} href={`https://www.google.com/search?q=${encodeURIComponent(k)}+dropshipping`} target="_blank" rel="noopener noreferrer" onClick={e=>e.stopPropagation()} style={{background:'rgba(124,111,255,0.1)',border:'0.5px solid rgba(124,111,255,0.3)',borderRadius:7,padding:'3px 10px',fontSize:12,color:'var(--acc)',textDecoration:'none'}}>{k}</a>)}</div>
              </div>
            ):(
              <div style={{marginBottom:'1rem',background:'rgba(124,111,255,0.05)',borderRadius:8,padding:'10px 12px',textAlign:'center'}}>
                <div style={{fontSize:12,color:'var(--t3)'}}>🔒 Keywords y "Cómo empezar" disponibles en Pro</div>
              </div>
            )}

            {/* Cómo empezar — solo Pro/Agency */}
            {isPro&&selected.getting_started&&(
              <div style={{marginBottom:'1rem'}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'1px',color:'var(--t3)',marginBottom:'.5rem'}}>Cómo empezar</div>
                {selected.getting_started.map((s,i)=><div key={i} style={{background:'rgba(0,229,195,0.06)',borderRadius:8,padding:'.65rem',marginBottom:4,fontSize:12,color:'var(--t2)',borderLeft:'2px solid var(--acc3)',display:'flex',gap:7}}><strong style={{color:'var(--acc3)',flexShrink:0}}>{i+1}.</strong><span>{s}</span></div>)}
              </div>
            )}

            {/* Botones finales */}
            <div style={{fontSize:12,color:'var(--t3)',textAlign:'center',marginBottom:'.75rem'}}>
              {isPro?'El análisis completo (insights, riesgos, público, ROI) está en el PDF':'Actualiza para acceder al análisis completo'}
            </div>
            {isPro?(
              <>
                <button onClick={async()=>{
                    setPdfLoading(true)
                    try { await downloadNichePDF(selected,profile?.plan??'pro',currency) }
                    catch(e){ log.error('Error generando PDF', { error: (e as any)?.message ?? String(e) }); alert('No se pudo generar el PDF. Inténtalo de nuevo.') }
                    finally { setPdfLoading(false) }
                  }}
                  disabled={pdfLoading}
                  style={{width:'100%',padding:14,borderRadius:12,border:'none',cursor:pdfLoading?'wait':'pointer',fontFamily:'var(--font-body)',fontSize:15,fontWeight:700,color:'#fff',background:isAgency?'var(--g2)':'var(--g1)',boxShadow:isAgency?'0 4px 16px rgba(255,153,0,0.4)':'0 4px 16px rgba(124,111,255,0.4)',display:'flex',alignItems:'center',justifyContent:'center',gap:8,opacity:pdfLoading?.7:1,transition:'all .2s'}}>
                  {pdfLoading
                    ? <><span style={{width:16,height:16,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .7s linear infinite'}}/> Generando PDF...</>
                    : <>⬇ Descargar PDF{isAgency?' Expert':' Pro'}</>
                  }
                </button>
                {isIOSDevice&&(
                  <div style={{fontSize:11,color:'var(--t3)',textAlign:'center',marginTop:8,lineHeight:1.5}}>
                    📱 En iPhone/iPad se abrirá el menú de compartir — elige <strong>"Guardar en Archivos"</strong>
                  </div>
                )}
              </>
            ):(
              <button onClick={()=>{setSelected(null);handleUpgrade('pro')}} className="np-btn-primary" style={{width:'100%',justifyContent:'center'}}>
                ✦ Subir a Pro — $19/mes
              </button>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Comparador de nichos — Pro/Agency */}
      {showCompare&&(
        <CompareModal
          niches={results.filter(n=>compareSet.has(n.name))}
          plan={profile?.plan??'free'}
          onClose={()=>setShowCompare(false)}
          onSelectNiche={(n)=>{ setShowCompare(false); setSelected(n) }}
        />
      )}

      {/* Badge Agency */}
      {profileLoaded&&isAgency&&(
        <div onClick={()=>setTab('plans')}
          className='np-badge-float' style={{position:'fixed',...(isMobile?{left:'50%',transform:'translateX(-50%)',bottom:'calc(76px + env(safe-area-inset-bottom, 0px))'}:{top:70,right:16}),background:'var(--g2)',color:'#fff',padding:isMobile?'8px 18px':'6px 14px',borderRadius:20,fontSize:isMobile?13:12,fontWeight:700,cursor:'pointer',zIndex:50,boxShadow:'0 4px 14px rgba(255,153,0,0.45)',display:'flex',alignItems:'center',gap:6,whiteSpace:'nowrap',userSelect:'none' as const}}>
          🏆 <span>{isMobile?'Plan Agency':'Agency'}</span><span style={{opacity:.75,fontSize:10}}>· Ver plan</span>
        </div>
      )}
    </div>
  )
}
