/**
 * lib/supabase-server.ts
 * ✅ Solo para archivos del SERVIDOR: API routes, middleware, callbacks.
 * ❌ NUNCA importes esto en un componente 'use client'.
 */

import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import { env } from './env'

export async function getSupabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll()     { return cookieStore.getAll() },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {}
      },
    },
  })
}
