'use client'
import { useEffect, useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase'

interface Alert {
  id: string
  niche_name: string
  message: string
  new_verdict: string | null
  read: boolean
  created_at: string
}

/**
 * Campana del Feed de oportunidades (IA proactiva, P1.1). Muestra las
 * alertas que genera el cron diario (app/api/cron/opportunity-feed)
 * cuando un nicho que el usuario ya analizó cambia de veredicto o de
 * score de forma relevante — el corazón de "la IA no espera preguntas".
 */
export default function OpportunityFeedBell() {
  const [open,   setOpen]   = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)

  async function load() {
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const res = await fetch('/api/opportunity-alerts', { headers: { Authorization: `Bearer ${session.access_token}` } })
      const json = await res.json()
      if (res.ok) { setAlerts(json.alerts ?? []); setUnread(json.unread ?? 0) }
    } catch {}
    finally { setLoaded(true) }
  }

  useEffect(() => { load(); const id = setInterval(load, 5 * 60 * 1000); return () => clearInterval(id) }, [])

  async function markAllRead() {
    try {
      const supabase = getSupabaseBrowser()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      await fetch('/api/opportunity-alerts', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({}) })
      setAlerts(a => a.map(x => ({ ...x, read: true }))); setUnread(0)
    } catch {}
  }

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} title="Feed de oportunidades"
        style={{ position: 'relative', padding: '6px 9px', borderRadius: 20, border: '1px solid rgba(124,111,255,0.3)', background: 'rgba(124,111,255,0.08)', color: 'var(--acc)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center' }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -3, right: -3, background: '#f43f5e', color: '#fff', fontSize: 9, fontWeight: 700, borderRadius: 10, minWidth: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
          <div style={{ position: 'absolute', top: 40, right: 0, width: 320, maxHeight: 420, overflowY: 'auto', background: 'var(--c2)', border: '1px solid rgba(124,111,255,0.25)', borderRadius: 14, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', zIndex: 151, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>📡 Feed de oportunidades</div>
              {unread > 0 && <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--acc)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}>Marcar leídas</button>}
            </div>
            {!loaded && <div style={{ fontSize: 12, color: 'var(--t3)', padding: '1rem', textAlign: 'center' }}>Cargando...</div>}
            {loaded && alerts.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--t3)', padding: '1.5rem 1rem', textAlign: 'center', lineHeight: 1.5 }}>
                Sin novedades todavía. Cuando un nicho que ya analizaste cambie de veredicto o de score, aparecerá aquí.
              </div>
            )}
            {alerts.map(a => (
              <div key={a.id} style={{ padding: '8px 8px', borderRadius: 8, background: a.read ? 'transparent' : 'rgba(124,111,255,0.06)', marginBottom: 2 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)', marginBottom: 2 }}>{a.niche_name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.4 }}>{a.message}</div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{new Date(a.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
