'use client'
import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

const PLANS = [
  { key:'free',   name:'Free',   price:'$0',  period:'/ siempre', desc:'Para empezar sin riesgo.',
    features:[{ok:true,t:'5 búsquedas / día'},{ok:true,t:'Top 3 nichos'},{ok:true,t:'Score IA básico'},{ok:false,t:'Análisis completo'},{ok:false,t:'Proveedores recomendados'},{ok:false,t:'Keywords + canales ads'},{ok:false,t:'Exportar CSV/PDF'}],
    cta:'Empezar gratis', featured:false },
  { key:'pro',    name:'Pro',    price:'$19', period:'/ mes',     desc:'Para emprendedores serios.',
    features:[{ok:true,t:'Búsquedas ilimitadas'},{ok:true,t:'Top 4 nichos con 12 scores IA'},{ok:true,t:'Análisis completo'},{ok:true,t:'Proveedores (Ali, Spocket, CJ...)'},{ok:true,t:'Keywords + canales ads'},{ok:true,t:'Exportar CSV/PDF'},{ok:true,t:'Alertas de tendencias'}],
    cta:'Empezar Pro', featured:true },
  { key:'agency', name:'Agency', price:'$79', period:'/ mes',     desc:'Para agencias y equipos.',
    features:[{ok:true,t:'Todo en Pro'},{ok:true,t:'Hasta 10 usuarios'},{ok:true,t:'Acceso API REST'},{ok:true,t:'White-label disponible'},{ok:true,t:'Soporte prioritario 24/7'},{ok:true,t:'Informes personalizados'},{ok:true,t:'SLA garantizado'}],
    cta:'Empezar Agency', featured:false },
]
const PAYS = [
  { icon:'💳', name:'Tarjetas',     note:'Visa · MC · Amex'   },
  { icon:'📱', name:'PayPal',       note:'Global'             },
  { icon:'₿',  name:'Crypto',       note:'BTC · ETH · USDT'  },
  { icon:'🏦', name:'Wire / SEPA',  note:'Transferencia'     },
  { icon:'🇧🇷', name:'PIX / OXXO',   note:'Brasil · México'   },
  { icon:'🌐', name:'Stripe',       note:'135+ países'       },
]

export default function PricingPage() {
  const [loading, setLoading] = useState<string|null>(null)
  const supabase = getSupabaseBrowser()

  async function handlePlan(key: string) {
    if (key === 'free') { window.location.href = '/dashboard'; return }
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { window.location.href = `/auth/login?redirect=/pricing`; return }
    setLoading(key)
    try {
      const res = await fetch('/api/create-checkout', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${session.access_token}` },
        body: JSON.stringify({ plan: key }),
      })
      const { url, error } = await res.json()
      if (error) { alert(error); return }
      window.location.href = url
    } finally { setLoading(null) }
  }

  return (
    <div style={{ minHeight:'100vh', padding:'2rem 1.5rem', background:'var(--c1)' }}>
      <div style={{ maxWidth:860, margin:'0 auto' }}>

        <div style={{ textAlign:'center', marginBottom:'2.5rem' }}>
          <a href="/" style={{ color:'var(--t3)', fontSize:14, textDecoration:'none', display:'inline-block', marginBottom:'1.5rem' }}>← Volver</a>
          <h1 style={{ fontSize:'clamp(1.8rem,4vw,2.75rem)', fontWeight:800, letterSpacing:'-1px', marginBottom:'.75rem' }}>Elige tu plan</h1>
          <p style={{ color:'var(--t2)', fontSize:15 }}>Empieza gratis. Sin tarjeta obligatoria. Cancela cuando quieras.</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:14, marginBottom:'2.5rem' }}>
          {PLANS.map(p => (
            <div key={p.key} style={{ background:'var(--c2)', border: p.featured?'1.5px solid var(--acc)':'0.5px solid rgba(255,255,255,0.1)', borderRadius:16, padding:'1.5rem', position:'relative' }}>
              {p.featured && <div style={{ position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)', background:'var(--acc)', color:'#fff', fontSize:11, fontWeight:600, padding:'3px 16px', borderRadius:10, whiteSpace:'nowrap' }}>⚡ Más popular</div>}
              <div style={{ fontFamily:'var(--font-display)', fontWeight:700, marginBottom:'.25rem' }}>{p.name}</div>
              <div style={{ fontFamily:'var(--font-display)', fontSize:'2.25rem', fontWeight:800, lineHeight:1, marginBottom:'.25rem' }}>
                {p.price} <span style={{ fontSize:13, fontWeight:400, color:'var(--t3)' }}>{p.period}</span>
              </div>
              <div style={{ fontSize:13, color:'var(--t2)', marginBottom:'1rem', lineHeight:1.5 }}>{p.desc}</div>
              <ul style={{ listStyle:'none', marginBottom:'1.25rem', display:'flex', flexDirection:'column', gap:6 }}>
                {p.features.map(f => (
                  <li key={f.t} style={{ fontSize:13, color: f.ok?'var(--t2)':'var(--t3)', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ color: f.ok?'var(--acc3)':'var(--t3)', fontSize:14 }}>{f.ok?'✓':'✕'}</span>{f.t}
                  </li>
                ))}
              </ul>
              <button onClick={() => handlePlan(p.key)} disabled={loading===p.key}
                style={{ width:'100%', padding:11, borderRadius:8, fontSize:14, fontWeight:500, cursor: loading===p.key?'wait':'pointer', fontFamily:'var(--font-body)', transition:'all .2s', border: p.featured?'none':'0.5px solid rgba(255,255,255,0.2)', background: p.featured?'var(--acc)':'transparent', color: p.featured?'#fff':'var(--t1)' }}>
                {loading===p.key ? 'Redirigiendo...' : p.cta}
              </button>
            </div>
          ))}
        </div>

        <div>
          <div style={{ fontSize:11, color:'var(--t3)', textTransform:'uppercase', letterSpacing:'1px', fontWeight:600, marginBottom:'1rem', textAlign:'center' }}>Métodos de pago aceptados globalmente</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
            {PAYS.map(pm => (
              <div key={pm.name} style={{ background:'var(--c2)', border:'0.5px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'.75rem', textAlign:'center' }}>
                <div style={{ fontSize:'1.25rem', marginBottom:3 }}>{pm.icon}</div>
                <div style={{ fontSize:12, fontWeight:500 }}>{pm.name}</div>
                <div style={{ fontSize:11, color:'var(--t3)' }}>{pm.note}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
