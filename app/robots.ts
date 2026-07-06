import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://nichepulse.app'
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
