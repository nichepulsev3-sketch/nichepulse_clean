import type { MetadataRoute } from 'next'
import { env } from '@/lib/env'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = env.NEXT_PUBLIC_APP_URL
  const now = new Date()
  // Solo páginas públicas indexables — el resto (dashboard, favorites,
  // watchlist, onboarding, auth) son privadas y ya están en robots.ts
  // como disallow.
  return [
    { url: `${base}/`,        lastModified: now, changeFrequency: 'weekly',  priority: 1   },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/download`,lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    // AUDITORIA_LANZAMIENTO_V1.md, Fase 13/15 (P0.7): páginas legales,
    // públicas y sin datos personales — indexables como cualquier otra
    // página estática.
    { url: `${base}/legal/privacidad`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/legal/terminos`,   lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
