'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Command {
  id:       string
  label:    string
  icon:     string
  category: string
  action:   () => void
  shortcut?: string
}

export default function CommandPalette({ onSearch }: { onSearch?: (q: string) => void }) {
  const [open,    setOpen]    = useState(false)
  const [query,   setQuery]   = useState('')
  const [selected,setSelected]= useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  const commands: Command[] = [
    { id:'search',    label:'Buscar nicho con IA',       icon:'🔍', category:'Acción',      action:()=>{ setOpen(false); document.querySelector<HTMLInputElement>('#main-search')?.focus() } },
    { id:'radar',     label:'Radar de Nichos',            icon:'📡', category:'Navegación',  action:()=>{ router.push('/radar');     setOpen(false) } },
    { id:'favorites', label:'Mis Favoritos',              icon:'⭐', category:'Navegación',  action:()=>{ router.push('/favorites'); setOpen(false) } },
    { id:'history',   label:'Historial de búsquedas',    icon:'📋', category:'Navegación',  action:()=>{ router.push('/dashboard?tab=history'); setOpen(false) } },
    { id:'alerts',    label:'Alertas inteligentes',       icon:'🔔', category:'Navegación',  action:()=>{ router.push('/alerts');   setOpen(false) } },
    { id:'compare',   label:'Comparador de nichos',       icon:'⚖️', category:'Navegación',  action:()=>{ router.push('/compare');  setOpen(false) } },
    { id:'plans',     label:'Ver planes y precios',       icon:'💎', category:'Cuenta',      action:()=>{ router.push('/pricing');  setOpen(false) } },
    { id:'download',  label:'Descargar app móvil',        icon:'📲', category:'Cuenta',      action:()=>{ router.push('/download'); setOpen(false) } },
    { id:'dashboard', label:'Volver al dashboard',        icon:'🏠', category:'Navegación',  action:()=>{ router.push('/dashboard');setOpen(false) } },
  ]

  const filtered = query.length > 0
    ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()) || c.category.toLowerCase().includes(query.toLowerCase()))
    : commands

  const handleKey = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); setOpen(o => !o); setQuery(''); setSelected(0)
    }
    if (e.key === 'Escape') setOpen(false)
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  const handleItemKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s+1, filtered.length-1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s-1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); filtered[selected]?.action() }
  }

  if (!open) return null

  return (
    <div className="cmd-overlay" onClick={() => setOpen(false)}>
      <div className="cmd-box" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderBottom:'1px solid var(--brd-1)' }}>
          <span style={{ fontSize:16, color:'var(--txt-3)', flexShrink:0 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0) }}
            onKeyDown={handleItemKey}
            placeholder="Busca una acción o navega a..."
            style={{ flex:1, background:'none', border:'none', outline:'none', color:'var(--txt-1)', fontSize:15, fontFamily:'var(--font-body)' }}
          />
          <kbd style={{ fontSize:11, color:'var(--txt-3)', background:'var(--bg-raised)', border:'1px solid var(--brd-2)', borderRadius:4, padding:'2px 6px' }}>ESC</kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight:320, overflowY:'auto', padding:'6px' }}>
          {filtered.length === 0 && (
            <div style={{ textAlign:'center', padding:'24px', color:'var(--txt-3)', fontSize:13 }}>
              Sin resultados para "{query}"
            </div>
          )}
          {filtered.map((cmd, i) => (
            <button key={cmd.id} onClick={cmd.action}
              style={{
                width:'100%', display:'flex', alignItems:'center', gap:10,
                padding:'9px 12px', borderRadius:8, border:'none', cursor:'pointer',
                background: i===selected ? 'var(--brand-soft)' : 'transparent',
                color: i===selected ? 'var(--txt-1)' : 'var(--txt-2)',
                fontFamily:'var(--font-body)', fontSize:13, textAlign:'left',
                transition:'background var(--t-fast)',
              }}
              onMouseEnter={() => setSelected(i)}
            >
              <span style={{ fontSize:16, width:22, textAlign:'center', flexShrink:0 }}>{cmd.icon}</span>
              <span style={{ flex:1 }}>{cmd.label}</span>
              <span style={{ fontSize:11, color:'var(--txt-3)', background:'var(--bg-muted)', borderRadius:4, padding:'1px 6px' }}>
                {cmd.category}
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 16px', borderTop:'1px solid var(--brd-1)' }}>
          {[['↑↓','Navegar'],['↵','Abrir'],['⌘K','Cerrar']].map(([k,l]) => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--txt-3)' }}>
              <kbd style={{ background:'var(--bg-raised)', border:'1px solid var(--brd-2)', borderRadius:4, padding:'1px 5px', fontSize:10 }}>{k}</kbd>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
