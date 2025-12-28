import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard'

  if (code) {
    // The Supabase client will automatically handle the code exchange
    // and set the session cookies
  }

  // Redirect to dashboard or specified URL
  return NextResponse.redirect(new URL(redirectTo, request.url))
}
