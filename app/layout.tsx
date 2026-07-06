import type { Metadata, Viewport } from 'next'
import PWABanner from '@/components/PWABanner'
import CommandPalette from '@/components/CommandPalette'
import { env } from '@/lib/env'
import './globals.css'

export const viewport: Viewport = {
  themeColor:    [
    { media:'(prefers-color-scheme: dark)',  color:'#7c6fff' },
    { media:'(prefers-color-scheme: light)', color:'#7c6fff' },
  ],
  colorScheme:   'dark',
  width:         'device-width',
  initialScale:  1,
  // maximumScale:1 + userScalable:false bloqueaban el pinch-to-zoom —
  // rompe WCAG 2.1 (1.4.4) para usuarios con baja visión. Permitir zoom
  // hasta 5x no afecta el look de la app en uso normal.
  maximumScale:  5,
  viewportFit:   'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  title:       'NichepulseV.3 — Motor Multi-IA de Dropshipping',
  description: 'El sistema más avanzado de análisis de nichos dropshipping. Motor Multi-IA, Opportunity Score, Radar de Nichos y más.',
  manifest:    '/manifest.json',
  appleWebApp: { capable:true, statusBarStyle:'black-translucent', title:'NichepulseV.3' },
  icons: {
    icon:     [{ url:'/icon-192.png',sizes:'192x192',type:'image/png' },{ url:'/icon-512.png',sizes:'512x512',type:'image/png' }],
    apple:    [{ url:'/icon-192.png',sizes:'180x180',type:'image/png' }],
    shortcut:  '/icon-192.png',
  },
  openGraph: {
    title:       'NichepulseV.3 — Motor Multi-IA de Dropshipping',
    description: 'Encuentra nichos rentables con el sistema más avanzado del mercado.',
    type:        'website',
    siteName:    'NichepulseV.3',
  },
  twitter: { card:'summary_large_image', title:'NichepulseV.3 — Motor Multi-IA de Dropshipping' },
  keywords:  ['dropshipping','niche finder','IA','ecommerce','nichos rentables','opportunity score'],
  formatDetection: { telephone:false, email:false, address:false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="application-name"                      content="NichepulseV.3"/>
        <meta name="mobile-web-app-capable"                content="yes"/>
        <meta name="apple-mobile-web-app-capable"          content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title"            content="NichepulseV.3"/>
        <meta name="msapplication-TileColor"               content="#7c6fff"/>
        <meta name="theme-color"                           content="#07070e"/>
        <meta name="format-detection"                      content="telephone=no,email=no,address=no"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin=""/>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
      </head>
      <body style={{ overscrollBehavior:'none' }}>
        {children}
        <PWABanner />
        <CommandPalette />
      </body>
    </html>
  )
}
