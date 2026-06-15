import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url)
  const code     = searchParams.get('code')
  const redirect = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await getSupabaseServer()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${redirect}`)
  }

  return NextResponse.redirect(`${origin}/auth/login?error=1`)
}
