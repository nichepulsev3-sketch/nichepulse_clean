'use client'
import Link from 'next/link'
import { useState } from 'react'

/**
 * Navegación inferior fija, solo móvil (globals.css ya oculta .bottom-nav
 * en escritorio vía @media min-width:769px). Antes, en móvil, todos los
 * accesos (Radar, Favoritos, Watchlist, Copiloto, App, Salir) se apretaban
 * en una sola fila de la barra superior — se cortaban y algunos no se
 * podían ni ver ni pulsar. Aquí solo van los 4 accesos más usados +
 * "Más", que abre una hoja inferior con el resto — así nada se corta y
 * el móvil deja de ser "la web comprimida" para tener su propia
 * navegación, como una app nativa.
 */
export default function MobileBottomNav({
  tab, setTab, isPro, isAgency, onSignOut,
}: {
  tab: 'search'|'history'|'affiliate'|'plans'
  setTab: (t: 'search'|'history'|'affiliate'|'plans') => void
  isPro: boolean
  isAgency: boolean
  onSignOut: () => void
}) {
  const [showMore, setShowMore] = useState(false)

  return (
    <>
      <nav className="bottom-nav">
        <div className={`bottom-nav-item ${tab==='search'?'active':''}`} onClick={()=>{setTab('search');setShowMore(false)}}>
          <span className="bottom-nav-icon">🔍</span>Buscar
        </div>
        <div className={`bottom-nav-item ${tab==='history'?'active':''}`} onClick={()=>{setTab('history');setShowMore(false)}}>
          <span className="bottom-nav-icon">📋</span>Historial
        </div>
        <Link href="/radar" className="bottom-nav-item">
          <span className="bottom-nav-icon">📡</span>Radar
        </Link>
        <Link href="/favorites" className="bottom-nav-item">
          <span className="bottom-nav-icon">⭐</span>Favoritos
        </Link>
        <div className="bottom-nav-item" onClick={()=>setShowMore(true)}>
          <span className="bottom-nav-icon">☰</span>Más
        </div>
      </nav>

      {showMore && (
        <div onClick={()=>setShowMore(false)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.75)',zIndex:250,display:'flex',alignItems:'flex-end'}}>
          <div onClick={e=>e.stopPropagation()} className="modal-sheet" style={{width:'100%',padding:'0.75rem 0 0'}}>
            <div style={{width:36,height:4,borderRadius:2,background:'var(--brd-3)',margin:'0 auto 14px'}}/>
            <div style={{padding:'0 1.25rem 1.25rem',display:'flex',flexDirection:'column',gap:6}}>

              {isPro && (
                <Link href="/watchlist" onClick={()=>setShowMore(false)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,textDecoration:'none',color:'var(--t1)',fontSize:14,fontWeight:500}}>
                  <span style={{fontSize:18}}>👁</span> Mi Watchlist
                </Link>
              )}
              {isPro && (
                <Link href="/copilot" onClick={()=>setShowMore(false)} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,textDecoration:'none',color:'var(--t1)',fontSize:14,fontWeight:500}}>
                  <span style={{fontSize:18}}>🧭</span> Copiloto de negocio
                </Link>
              )}
              <div onClick={()=>{setTab('affiliate');setShowMore(false)}} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,color:'var(--t1)',fontSize:14,fontWeight:500,cursor:'pointer'}}>
                <span style={{fontSize:18}}>👥</span> Programa de afiliados
              </div>
              <div onClick={()=>{setTab('plans');setShowMore(false)}} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,color:'var(--t1)',fontSize:14,fontWeight:500,cursor:'pointer'}}>
                <span style={{fontSize:18}}>💎</span> Planes{isAgency?' · Agency':isPro?' · Pro':' · Free'}
              </div>
              <a href="/download" style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,textDecoration:'none',color:'var(--t1)',fontSize:14,fontWeight:500}}>
                <span style={{fontSize:18}}>⬇</span> Descargar app
              </a>
              <div style={{height:1,background:'var(--brd-1)',margin:'6px 0'}}/>
              <div onClick={onSignOut} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 10px',borderRadius:12,color:'var(--t3)',fontSize:14,fontWeight:500,cursor:'pointer'}}>
                <span style={{fontSize:18}}>↩</span> Cerrar sesión
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
