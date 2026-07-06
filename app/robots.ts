import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default function robots(): MetadataRoute.Robots {
  const base = env.NEXT_PUBLIC_APP_URL
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Rutas privadas/autenticadas y APIs no deben indexarse.
        disallow: ['/api/', '/dashboard', '/favorites', '/watchlist', '/onboarding', '/auth/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
