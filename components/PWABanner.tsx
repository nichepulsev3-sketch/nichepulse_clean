'use client'
import { useEffect, useState } from 'react'

export default function PWABanner() {
  const [show, setShow] = useState(false)
  const [prompt, setPrompt] = useState<any>(null)

  useEffect(() => {
    // Registrar SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // Capturar evento de instalación
    const handler = (e: any) => {
      e.preventDefault()
      setPrompt(e)
      if (!localStorage.getItem('pwa-dismissed')) {
        setTimeout(() => setShow(true), 4000)
      }
    }

    const installed = () => setShow(false)

    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  if (!show) return null

  async function handleInstall() {
    if (!prompt) return
    prompt.prompt()
    await prompt.userChoice
    setPrompt(null)
    setShow(false)
  }

  function handleDismiss() {
    setShow(false)
    localStorage.setItem('pwa-dismissed', '1')
  }

  return (
    <div style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(12,12,24,0.97)', border: '1px solid rgba(124,111,255,0.45)',
      borderRadius: '18px', padding: '10px 16px', zIndex: 9999,
      backdropFilter: 'blur(16px)', boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', gap: '10px',
      fontSize: '14px', color: '#f0f0ff', whiteSpace: 'nowrap',
    }}>
      <span>📲 Instala NichePulse en tu dispositivo</span>
      <button
        onClick={handleInstall}
        style={{
          background: 'linear-gradient(90deg,#7c6fff,#ff6b9d)',
          color: '#fff', border: 'none', padding: '7px 16px',
          borderRadius: '14px', fontSize: '13px', cursor: 'pointer', fontWeight: 700,
          fontFamily: 'inherit',
        }}>
        Instalar
      </button>
      <button
        onClick={handleDismiss}
        style={{
          background: 'none', border: 'none', color: '#a0a0c0',
          cursor: 'pointer', fontSize: '18px', lineHeight: 1, padding: 0,
        }}>
        ✕
      </button>
    </div>
  )
}
