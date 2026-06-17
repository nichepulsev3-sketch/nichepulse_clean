'use client'
import { useState, useEffect, useCallback } from 'react'
import type { AggregatedTrends, TrendSignal } from '@/lib/trends'

const SRC = {
  google: { label:'Google Trends', icon:'📈', color:'#4285F4', bg:'rgba(66,133,244,0.1)',  border:'rgba(66,133,244,0.3)' },
  tiktok: { label:'TikTok Shop',   icon:'📱', color:'#ff3b5c', bg:'rgba(255,59,92,0.1)',   border:'rgba(255,59,92,0.3)'  },
  amazon: { label:'Amazon Movers', icon:'📦', color:'#ff9900', bg:'rgba(255,153,0,0.1)',   border:'rgba(255,153,0,0.3)'  },
}

function Signal({ s, onClick }: { s: TrendSignal; onClick: () => void }) {
  const cfg = SRC[s.source]
  return (
    <button onClick={onClick} title={`Buscar: ${s.keyword.replace('#','')}`}
      style={{ width:'100%', textAlign:'left', padding:'8px 10px', background:'var(--c3)', border:'0.5px solid rgba(255,255,255,0.07)', borderRadius:8, cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, fontFamily:'var(--font-body)', transition:'border-color .15s, background .15s' }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor=cfg.color; el.style.background='var(--c4)' }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor='rgba(255,255,255,0.07)'; el.style.background='var(--c3)' }}
    >
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--t1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.keyword}</div>
        <div style={{ fontSize:11, color:'var(--t3)', marginTop:1 }}>{s.volume}</div>
      </div>
      <div style={{ flexShrink:0, textAlign:'right' }}>
        <div style={{ fontSize:11, fontWeight:600, color:'var(--acc3)' }}>↑{s.growth>999?`${(s.growth/1000).toFixed(1)}K`:s.growth}%</div>
        <div style={{ fontSize:10, color:'var(--t3)', marginTop:1 }}>{s.category}</div>
      </div>
    </button>
  )
}

function Section({ source, signals, onKw }: { source: keyof typeof SRC; signals: TrendSignal[]; onKw:(k:string)=>void }) {
  const [open, setOpen] = useState(true)
  const cfg = SRC[source]
  if (!signals.length) return null
  return (
    <div style={{ marginBottom:'1rem' }}>
      <button onClick={()=>setOpen(v=>!v)} style={{ width:'100%', background:'none', border:'none', cursor:'pointer', padding:'0 0 .5rem', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:'var(--font-body)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span>{cfg.icon}</span>
          <span style={{ fontSize:12, fontWeight:600, color:cfg.color }}>{cfg.label}</span>
          <span style={{ fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8, background:cfg.bg, color:cfg.color, border:`0.5px solid ${cfg.border}` }}>{signals.length}</span>
        </div>
        <span style={{ fontSize:12, color:'var(--t3)', display:'inline-block', transform:open?'rotate(0deg)':'rotate(-90deg)', transition:'transform .2s' }}>▾</span>
      </button>
      {open && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {signals.slice(0,6).map((s,i)=><Signal key={i} s={s} onClick={()=>onKw(s.keyword.replace('#','').trim())} />)}
        </div>
      )}
    </div>
  )
}

export default function TrendsPanel({ geo='US', onKeywordClick }: { geo?:string; onKeywordClick?:(kw:string)=>void }) {
  const [trends,     setTrends]     = useState<AggregatedTrends|null>(null)
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<string|null>(null)
  const [fromCache,  setFromCache]  = useState(false)

  const load = useCallback(async (force=false) => {
    try {
      if (force) setRefreshing(true)
      // Añadir timestamp para evitar caché del navegador
      const ts  = Date.now()
      const url = `/api/trends?geo=${geo}${force?'&refresh=true':''}&_t=${ts}`
      const res = await fetch(url, { cache: force ? 'no-store' : 'default' })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data: AggregatedTrends = await res.json()
      setTrends(data)
      setLastUpdate(new Date().toLocaleTimeString('es-ES', { hour:'2-digit', minute:'2-digit' }))
      setFromCache(data.from_cache ?? false)
    } catch (e) {
      console.warn('[TrendsPanel] Error cargando señales:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [geo])

  // Cargar al montar y cuando cambie el geo
  useEffect(() => { setLoading(true); load(false) }, [load])

  // Auto-refresh cada 30 minutos
  useEffect(() => {
    const id = setInterval(() => load(true), 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  const total = trends ? trends.google.length + trends.tiktok.length + trends.amazon.length : 0

  return (
    <div style={{ background:'var(--c2)', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:16, overflow:'hidden', display:'flex', flexDirection:'column' }}>

      {/* Cabecera */}
      <div style={{ padding:'12px 14px', borderBottom:'0.5px solid rgba(255,255,255,0.07)', background:'linear-gradient(135deg,rgba(124,111,255,0.08),rgba(255,107,157,0.05))', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ width:7, height:7, borderRadius:'50%', background: loading?'#606080':'#00e5c3', boxShadow: loading?'none':'0 0 6px #00e5c3', transition:'all .5s' }} />
          <span style={{ fontFamily:'var(--font-display)', fontSize:13, fontWeight:700 }}>Live Signals</span>
          {!loading && <span style={{ fontSize:11, color:'var(--t3)' }}>{total} señales</span>}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing || loading}
          title="Actualizar señales ahora"
          style={{ background:'none', border:'none', cursor: refreshing||loading?'not-allowed':'pointer', color: refreshing?'var(--acc)':'var(--t3)', fontSize:16, opacity: refreshing||loading?.6:1, display:'flex', alignItems:'center', gap:4, fontFamily:'var(--font-body)', padding:'2px 6px', borderRadius:6, transition:'all .2s' }}>
          <span style={{ display:'inline-block', animation: refreshing?'spin .7s linear infinite':'none' }}>⟳</span>
          {!refreshing && <span style={{ fontSize:10 }}>actualizar</span>}
        </button>
      </div>

      {/* Última actualización */}
      {lastUpdate && (
        <div style={{ padding:'5px 14px', fontSize:10, color:'var(--t3)', borderBottom:'0.5px solid rgba(255,255,255,0.04)', display:'flex', justifyContent:'space-between' }}>
          <span>Actualizado: {lastUpdate}</span>
          {fromCache && <span style={{ color:'var(--acc)' }}>· caché activa</span>}
          {!fromCache && <span style={{ color:'var(--acc3)' }}>· datos frescos ✓</span>}
        </div>
      )}

      {/* Cuerpo */}
      <div style={{ padding:'12px 14px', flex:1, overflowY:'auto', maxHeight:500 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'2rem' }}>
            <div className="spinner" style={{ margin:'0 auto 10px', width:28, height:28 }} />
            <div style={{ fontSize:12, color:'var(--t3)' }}>Cargando señales en vivo...</div>
          </div>
        ) : trends ? (
          <>
            <Section source="google" signals={trends.google} onKw={kw=>onKeywordClick?.(kw)} />
            <Section source="tiktok" signals={trends.tiktok} onKw={kw=>onKeywordClick?.(kw)} />
            <Section source="amazon" signals={trends.amazon} onKw={kw=>onKeywordClick?.(kw)} />
          </>
        ) : (
          <div style={{ textAlign:'center', color:'var(--t3)', fontSize:13, padding:'2rem' }}>
            No se pudieron cargar las señales
            <br />
            <button onClick={()=>load(true)} style={{ marginTop:8, fontSize:12, color:'var(--acc)', background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font-body)', textDecoration:'underline' }}>
              Reintentar
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'7px 14px', borderTop:'0.5px solid rgba(255,255,255,0.05)', fontSize:10, color:'var(--t3)', textAlign:'center' }}>
        Haz clic en una señal para buscar ese nicho
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
