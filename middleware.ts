/**
 * NichepulseV.3 — Middleware de seguridad
 * Rate limiting, autenticación y protección de rutas.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { env } from './lib/env'

/* ── Rate Limiting en memoria (para producción usar Upstash Redis) ── */
const rateStore = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateStore.get(key)

  if (!entry || now > entry.resetAt) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs })
    return true  // OK
  }
  entry.count++
  if (entry.count > limit) return false  // Bloqueado
  return true
}

/* Limpiar entradas expiradas cada 5 minutos */
setInterval(() => {
  const now = Date.now()
  rateStore.forEach((v, k) => { if (now > v.resetAt) rateStore.delete(k) })
}, 5 * 60 * 1000)

/* ── Rutas protegidas ──────────────────────────────────────────── *
 * '/compare' y '/alerts' se quitaron: nunca existieron como páginas
 * (el comparador es un modal dentro de /dashboard, no una ruta propia)
 * — eran referencias muertas de una iteración anterior. Se añadió
 * '/watchlist' porque sí es una página real que necesita protección
 * a nivel de middleware, no solo el check client-side de la propia
 * página (defensa en profundidad: sin esto, un usuario no autenticado
 * ve un parpadeo de la página antes de la redirección). '/feedback' se
 * añadió con el Motor propio (Fase 1, MOTOR_PROPIO_PROPUESTA.md): es
 * donde el usuario reporta el resultado real de un nicho, requiere
 * sesión igual que el resto de páginas con datos personales. '/admin' se
 * añadió con el panel de monitoreo del Motor propio: requiere sesión Y
 * que el email esté en env.ADMIN_EMAILS (comprobado abajo) — defensa en
 * profundidad, la API /api/admin/* vuelve a comprobarlo por su cuenta. */
const PROTECTED_ROUTES = ['/dashboard', '/radar', '/favorites', '/watchlist', '/feedback', '/admin']
const ADMIN_ROUTES     = ['/admin']
const AUTH_ROUTES      = ['/auth/login', '/auth/register']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'unknown'

  /* ── Rate limiting para APIs ──────────────────────────────── */
  if (pathname.startsWith('/api/')) {
    const apiKey = `api:${ip}`
    const isSearchRoute = pathname.includes('search-niches')

    // Búsquedas: 20/minuto por IP; otras APIs: 60/minuto
    const limit = isSearchRoute ? 20 : 60
    const windowMs = 60 * 1000

    if (!checkRateLimit(apiKey, limit, windowMs)) {
      return new NextResponse(
        JSON.stringify({ error: 'Demasiadas peticiones. Espera 1 minuto.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': '60',
            'X-RateLimit-Limit': String(limit),
          },
        }
      )
    }
  }

  /* ── Crear cliente Supabase SSR ───────────────────────────── */
  const res = NextResponse.next()

  // Solo ejecutar autenticación en rutas que lo necesitan
  const needsAuth = PROTECTED_ROUTES.some(r => pathname.startsWith(r))
  const isAuthPage = AUTH_ROUTES.some(r => pathname.startsWith(r))

  if (!needsAuth && !isAuthPage) return res

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll:  () => req.cookies.getAll(),
        setAll:  (list) => { list.forEach(({ name, value, options }) => { res.cookies.set(name, value, options) }) },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  /* ── Redirigir si no autenticado ──────────────────────────── */
  if (needsAuth && !user) {
    const loginUrl = req.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  /* ── /admin: además de sesión, exigir email en ADMIN_EMAILS ───── */
  const needsAdmin = ADMIN_ROUTES.some(r => pathname.startsWith(r))
  if (needsAdmin && user) {
    const isAdmin = !!user.email && env.ADMIN_EMAILS.includes(user.email.toLowerCase())
    if (!isAdmin) {
      const dashUrl = req.nextUrl.clone()
      dashUrl.pathname = '/dashboard'
      return NextResponse.redirect(dashUrl)
    }
  }

  /* ── Redirigir si ya autenticado y va al login ────────────── */
  if (isAuthPage && user) {
    const dashUrl = req.nextUrl.clone()
    dashUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashUrl)
  }

  /* ── Headers de seguridad ─────────────────────────────────── */
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('X-XSS-Protection', '1; mode=block')
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return res
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/radar/:path*',
    '/favorites/:path*',
    '/watchlist/:path*',
    '/feedback/:path*',
    '/admin/:path*',
    '/auth/:path*',
    '/api/:path*',
  ],
}
