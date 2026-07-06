import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/lib/env'
import { createLogger } from '@/lib/logger'

const log = createLogger('auth/callback')

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code     = searchParams.get('code')
  const error    = searchParams.get('error')
  const errorDesc= searchParams.get('error_description')
  const redirect = searchParams.get('next') ?? '/dashboard'

  // Capturar errores OAuth de Supabase (p.ej. proveedor no habilitado)
  if (error) {
    log.error('OAuth error', { error, errorDesc })
    const msg = errorDesc ?? error
    return NextResponse.redirect(
      `${origin}/auth/login?oauth_error=${encodeURIComponent(msg)}`
    )
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll()     { return cookieStore.getAll() },
          setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
        },
      }
    )
    const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeErr) return NextResponse.redirect(`${origin}${redirect}`)
    log.error('Exchange error', { error: exchangeErr.message })
  }

  return NextResponse.redirect(`${origin}/auth/login?oauth_error=login_failed`)
}
