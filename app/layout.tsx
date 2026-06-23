import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const syne   = Syne({ subsets:['latin'], variable:'--font-syne', weight:['400','500','600','700','800'] })
const dmSans = DM_Sans({ subsets:['latin'], variable:'--font-dm',  weight:['300','400','500'] })

export const viewport: Viewport = {
  themeColor:   '#7c6fff',
  colorScheme:  'dark',
  width:        'device-width',
  initialScale: 1,
  viewportFit:  'cover',
}

export const metadata: Metadata = {
  title:       'NichePulse — Nichos de Dropshipping con IA',
  description: 'Encuentra nichos rentables de dropshipping en tiempo real con Claude AI, Google Trends, TikTok y Amazon.',
  manifest:    '/manifest.json',
  appleWebApp: { capable:true, statusBarStyle:'black-translucent', title:'NichePulse' },
  icons: {
    icon:    [{ url:'/icon-192.png',sizes:'192x192',type:'image/png' },{ url:'/icon-512.png',sizes:'512x512',type:'image/png' }],
    apple:   '/icon-192.png',
    shortcut:'/icon-192.png',
  },
  openGraph: { title:'NichePulse — Nichos de Dropshipping con IA', description:'Señales de mercado en tiempo real.', type:'website', siteName:'NichePulse' },
  twitter:   { card:'summary_large_image', title:'NichePulse — Nichos de Dropshipping con IA' },
  keywords:  ['dropshipping','niche finder','IA','ecommerce','nichos rentables'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <meta name="application-name"                       content="NichePulse"/>
        <meta name="mobile-web-app-capable"                 content="yes"/>
        <meta name="apple-mobile-web-app-capable"           content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style"  content="black-translucent"/>
        <meta name="apple-mobile-web-app-title"             content="NichePulse"/>
        <meta name="msapplication-TileColor"                content="#7c6fff"/>
      </head>
      <body style={{ fontFamily:'var(--font-dm,DM Sans),sans-serif' }}>
        {children}

        {/* Service Worker */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('/sw.js')
                .then(r => console.log('[SW] OK', r.scope))
                .catch(e => console.warn('[SW] Error', e))
            })
          }
        `}</Script>

        {/* Banner de instalación PWA */}
        <Script id="pwa-install" strategy="afterInteractive">{`
          let deferredPrompt = null;
          window.addEventListener('beforeinstallprompt', e => {
            e.preventDefault();
            deferredPrompt = e;
            if (localStorage.getItem('pwa-dismissed')) return;
            setTimeout(() => {
              const b = document.getElementById('pwa-banner');
              if (b) b.style.display = 'flex';
            }, 4000);
          });
          window.addEventListener('appinstalled', () => {
            const b = document.getElementById('pwa-banner');
            if (b) b.style.display = 'none';
          });
          function pwaInstall() {
            if (deferredPrompt) {
              deferredPrompt.prompt();
              deferredPrompt.userChoice.then(() => {
                deferredPrompt = null;
                document.getElementById('pwa-banner').style.display = 'none';
              });
            }
          }
          function pwaDismiss() {
            document.getElementById('pwa-banner').style.display = 'none';
            localStorage.setItem('pwa-dismissed', '1');
          }
        `}</Script>

        {/* Banner HTML — oculto hasta que el JS lo muestre */}
        <div id="pwa-banner" style={{
          display:'none', position:'fixed', bottom:'20px', left:'50%', transform:'translateX(-50%)',
          background:'rgba(12,12,24,0.97)', border:'1px solid rgba(124,111,255,0.45)',
          borderRadius:'18px', padding:'10px 16px', zIndex:9999,
          backdropFilter:'blur(16px)', boxShadow:'0 4px 24px rgba(0,0,0,0.5)',
          alignItems:'center', gap:'10px', fontSize:'14px', color:'#f0f0ff',
          whiteSpace:'nowrap',
        } as React.CSSProperties}>
          <span>📲 Instala NichePulse en tu dispositivo</span>
          <button onClick={() => (window as any).pwaInstall()} style={{ background:'linear-gradient(90deg,#7c6fff,#ff6b9d)', color:'#fff', border:'none', padding:'7px 16px', borderRadius:'14px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>
            Instalar
          </button>
          <button onClick={() => (window as any).pwaDismiss()} style={{ background:'none', border:'none', color:'#a0a0c0', cursor:'pointer', fontSize:'18px', lineHeight:1 }}>
            ✕
          </button>
        </div>
      </body>
    </html>
  )
}
