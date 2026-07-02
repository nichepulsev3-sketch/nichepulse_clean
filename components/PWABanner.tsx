'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function PWABanner() {
  const [show,   setShow]   = useState(false)
  const [prompt, setPrompt] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    const handler = (e: any) => {
      e.preventDefault()
      setPrompt(e)
      if (!localStorage.getItem('pwa-dismissed')) {
        setTimeout(() => setShow(true), 5000)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => setShow(false))
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!show) return null

  async function handleInstall() {
    if (!prompt) { router.push('/download'); return }
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setPrompt(null)
  }

  return (
    <div style={{
      position:'fixed', bottom:20, left:'50%', transform:'translateX(-50%)',
      background:'rgba(12,12,24,0.97)',
      border:'1px solid rgba(124,111,255,0.5)',
      borderRadius:18, padding:'12px 18px', zIndex:9999,
      backdropFilter:'blur(20px)',
      boxShadow:'0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,111,255,0.1)',
      display:'flex', alignItems:'center', gap:12,
      fontSize:14, color:'#f0f0ff', whiteSpace:'nowrap',
      animation:'slideUp .4s ease',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ width:36, height:36, borderRadius:10, background:'var(--g1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem', fontWeight:800, color:'#fff', fontFamily:'var(--font-display)', flexShrink:0 }}>N</div>
        <div>
          <div style={{ fontWeight:600, fontSize:13 }}>Instala NichepulseV.3</div>
          <div style={{ fontSize:11, color:'rgba(160,160,192,0.8)' }}>Acceso rápido desde tu dispositivo</div>
        </div>
      </div>
      <button onClick={handleInstall}
        style={{ background:'var(--g1)', color:'#fff', border:'none', padding:'8px 16px', borderRadius:12, fontSize:13, cursor:'pointer', fontWeight:700, fontFamily:'inherit', boxShadow:'0 2px 10px rgba(124,111,255,0.4)', flexShrink:0 }}>
        Instalar
      </button>
      <button onClick={() => { setShow(false); localStorage.setItem('pwa-dismissed','1') }}
        style={{ background:'none', border:'none', color:'rgba(160,160,192,0.6)', cursor:'pointer', fontSize:18, lineHeight:1, padding:0, flexShrink:0 }}>
        ✕
      </button>
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`}</style>
    </div>
  )
}
