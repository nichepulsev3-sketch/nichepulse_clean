import type { Metadata, Viewport } from 'next'
import { Syne, DM_Sans } from 'next/font/google'
import PWABanner from '@/components/PWABanner'
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
  title:       'NichepulseV.3 — Nichos de Dropshipping con IA',
  description: 'Encuentra nichos rentables de dropshipping en tiempo real con Claude AI, Google Trends, TikTok y Amazon.',
  manifest:    '/manifest.json',
  appleWebApp: {
    capable:        true,
    statusBarStyle: 'black-translucent',
    title:          'NichepulseV.3',
  },
  icons: {
    icon:    [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple:    '/icon-192.png',
    shortcut: '/icon-192.png',
  },
  openGraph: {
    title:       'NichepulseV.3 — Nichos de Dropshipping con IA',
    description: 'Señales de mercado en tiempo real para encontrar nichos rentables.',
    type:        'website',
    siteName:    'NichepulseV.3',
  },
  twitter: {
    card:  'summary_large_image',
    title: 'NichepulseV.3 — Nichos de Dropshipping con IA',
  },
  keywords: ['dropshipping','niche finder','IA','ecommerce','nichos rentables'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${syne.variable} ${dmSans.variable}`}>
      <head>
        <meta name="application-name"                      content="NichepulseV.3"/>
        <meta name="mobile-web-app-capable"                content="yes"/>
        <meta name="apple-mobile-web-app-capable"          content="yes"/>
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
        <meta name="apple-mobile-web-app-title"            content="NichepulseV.3"/>
        <meta name="msapplication-TileColor"               content="#7c6fff"/>
      </head>
      <body style={{ fontFamily: 'var(--font-dm,DM Sans),sans-serif' }}>
        {children}
        {/* Banner de instalación PWA — componente cliente */}
        <PWABanner />
      </body>
    </html>
  )
}
