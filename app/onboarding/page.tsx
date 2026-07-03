'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowser } from '@/lib/supabase'

const STEPS = [
  { id:'goal', title:'¿Cuál es tu objetivo principal?', subtitle:'Personalizamos tu experiencia según lo que buscas conseguir.',
    options:[
      {value:'launch_first',   icon:'🚀', label:'Lanzar mi primer nicho',    desc:'Quiero empezar desde cero y encontrar mi primer producto exitoso.'},
      {value:'scale_existing', icon:'📈', label:'Escalar mi negocio actual', desc:'Ya vendo y quiero expandirme a nuevos nichos.'},
      {value:'research',       icon:'🔍', label:'Investigar el mercado',     desc:'Quiero analizar tendencias y oportunidades.'},
      {value:'agency',         icon:'🏢', label:'Trabajo con clientes',      desc:'Gestiono nichos para mis clientes o varias tiendas.'},
    ]},
  { id:'budget', title:'¿Cuál es tu presupuesto inicial?', subtitle:'Priorizamos nichos con la inversión adecuada para ti.',
    options:[
      {value:'under_500', icon:'💵', label:'Menos de $500',     desc:'Nichos de bajo coste de entrada, alta rentabilidad relativa.'},
      {value:'500_2000',  icon:'💰', label:'$500 — $2.000',     desc:'Opciones equilibradas en riesgo y potencial de retorno.'},
      {value:'2000_10k',  icon:'💎', label:'$2.000 — $10.000',  desc:'Mayor potencial de retorno, mercados más consolidados.'},
      {value:'over_10k',  icon:'🏆', label:'Más de $10.000',    desc:'Nichos de alto volumen y escala rápida.'},
    ]},
  { id:'experience', title:'¿Cuál es tu nivel en dropshipping?', subtitle:'Ajustamos la profundidad del análisis a tu experiencia.',
    options:[
      {value:'beginner',     icon:'🌱', label:'Principiante',   desc:'Empezando. Quiero análisis claros con pasos muy concretos.'},
      {value:'intermediate', icon:'⚡', label:'Intermedio',     desc:'Tengo experiencia. Quiero profundidad y datos detallados.'},
      {value:'expert',       icon:'🎯', label:'Experto',        desc:'Veterano. Quiero el análisis más sofisticado disponible.'},
    ]},
  { id:'geo', title:'¿En qué mercado quieres vender?', subtitle:'Priorizamos señales en tiempo real de tu mercado objetivo.',
    options:[
      {value:'US', icon:'🇺🇸', label:'Estados Unidos', desc:'El mayor mercado de ecommerce del mundo. Alta competencia, altos márgenes.'},
      {value:'ES', icon:'🇪🇸', label:'España',          desc:'Mercado hispanohablante maduro con nichos de oportunidad.'},
      {value:'MX', icon:'🇲🇽', label:'México',          desc:'LATAM con enorme potencial de crecimiento y baja saturación.'},
      {value:'GB', icon:'🇬🇧', label:'Reino Unido',     desc:'Mercado anglófono de alto poder adquisitivo.'},
      {value:'DE', icon:'🇩🇪', label:'Alemania',        desc:'Mayor mercado de ecommerce en Europa continental.'},
      {value:'BR', icon:'🇧🇷', label:'Brasil',          desc:'Mayor mercado de LATAM, crecimiento acelerado.'},
    ]},
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = getSupabaseBrowser()
  const [step,    setStep]    = useState(0)
  const [data,    setData]    = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [hover,   setHover]   = useState<string|null>(null)
  const current = STEPS[step]
  const progress = (step / STEPS.length) * 100

  async function handleSelect(value: string) {
    const newData = { ...data, [current.id]: value }
    setData(newData)
    if (step < STEPS.length - 1) { setStep(s => s+1); return }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await Promise.all([
          supabase.from('onboarding').upsert({ user_id:user.id, ...newData, market:newData.geo, business_type:newData.goal==='agency'?'agency':'solo' }),
          supabase.from('profiles').update({ onboarding_done:true, preferences:{ default_geo:newData.geo } }).eq('id', user.id),
        ])
      }
    } catch {}
    router.push('/dashboard')
  }

  return (
    <div style={{ minHeight:'100dvh', background:'var(--bg-base)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'1.5rem', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:'-15%', left:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(124,111,255,0.08) 0%,transparent 70%)', pointerEvents:'none' }}/>
      <div style={{ position:'absolute', bottom:'-15%', right:'-10%', width:500, height:500, borderRadius:'50%', background:'radial-gradient(circle,rgba(244,113,181,0.05) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div style={{ width:'100%', maxWidth:560, position:'relative', zIndex:1 }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:52, height:52, borderRadius:15, background:'var(--g-brand)', display:'inline-flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:'1.4rem', color:'#fff', marginBottom:'0.75rem', boxShadow:'var(--shadow-brand)' }}>N</div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:700, background:'var(--g-brand)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', fontSize:'1.1rem' }}>NichepulseV.3</div>
        </div>

        {/* Progress */}
        <div style={{ marginBottom:'2.5rem' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontSize:12, color:'var(--txt-3)', fontWeight:500 }}>Configuración {step+1}/{STEPS.length}</span>
            <span style={{ fontSize:12, color:'var(--brand)', fontWeight:600 }}>{Math.round(progress + 25)}%</span>
          </div>
          <div style={{ height:3, background:'var(--bg-raised)', borderRadius:99, overflow:'hidden' }}>
            <div style={{ width:`${progress+25}%`, height:'100%', background:'var(--g-brand)', borderRadius:99, transition:'width 0.5s var(--ease-out)' }}/>
          </div>
          {/* Step dots */}
          <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:12 }}>
            {STEPS.map((_,i) => (
              <div key={i} style={{ width: i===step?20:6, height:6, borderRadius:99, background: i<=step?'var(--brand)':'var(--bg-raised)', transition:'all 0.3s var(--ease-out)' }}/>
            ))}
          </div>
        </div>

        {/* Question */}
        <div key={step} className="fade-up">
          <h1 style={{ fontFamily:'var(--font-display)', fontSize:'clamp(1.4rem,4vw,1.9rem)', fontWeight:800, letterSpacing:'-0.03em', marginBottom:'.6rem', lineHeight:1.15 }}>
            {current.title}
          </h1>
          <p style={{ fontSize:14, color:'var(--txt-2)', marginBottom:'1.5rem', lineHeight:1.6 }}>{current.subtitle}</p>

          <div style={{ display:'grid', gap:9 }}>
            {current.options.map(opt => (
              <button key={opt.value}
                onClick={() => !loading && handleSelect(opt.value)}
                onMouseEnter={() => setHover(opt.value)}
                onMouseLeave={() => setHover(null)}
                style={{
                  display:'flex', alignItems:'center', gap:14, padding:'13px 16px',
                  background: hover===opt.value ? 'var(--bg-raised)' : 'var(--bg-subtle)',
                  border: `1px solid ${hover===opt.value ? 'var(--brd-brand)' : 'var(--brd-1)'}`,
                  borderRadius:12, cursor:loading?'wait':'pointer', textAlign:'left', width:'100%',
                  fontFamily:'var(--font-body)', transition:'all var(--t-base)',
                  boxShadow: hover===opt.value ? 'var(--shadow-glow)' : 'none',
                }}>
                <span style={{ fontSize:'1.4rem', flexShrink:0 }}>{opt.icon}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'var(--txt-1)', marginBottom:2 }}>{opt.label}</div>
                  <div style={{ fontSize:12, color:'var(--txt-3)', lineHeight:1.5 }}>{opt.desc}</div>
                </div>
                <span style={{ color:hover===opt.value?'var(--brand)':'var(--txt-3)', fontSize:16, transition:'color var(--t-fast)' }}>›</span>
              </button>
            ))}
          </div>
        </div>

        {step === 0 && (
          <div style={{ textAlign:'center', marginTop:'1.5rem' }}>
            <button onClick={() => router.push('/dashboard')} style={{ background:'none', border:'none', color:'var(--txt-3)', fontSize:13, cursor:'pointer', fontFamily:'var(--font-body)' }}>
              Omitir por ahora →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
