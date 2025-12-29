import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Routes that require authentication
const protectedRoutes = ['/dashboard']

// Routes that should redirect authenticated users away
const authRoutes = ['/login', '/signup', '/auth/login', '/auth/signup']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Skip middleware for static files and API routes (except auth-related ones)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  // Check if the route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some(route => pathname === route)

  // Get session from cookies
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If Supabase is not configured, allow access (development mode)
    console.warn('Supabase not configured, skipping auth middleware')
    return NextResponse.next()
  }

  // Create a Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })

  // Try to get session from cookie-based tokens
  const accessToken = req.cookies.get('sb-access-token')?.value
  const refreshToken = req.cookies.get('sb-refresh-token')?.value

  let isAuthenticated = false

  if (accessToken) {
    try {
      // Verify the access token by getting the user
      const { data: { user }, error } = await supabase.auth.getUser(accessToken)
      isAuthenticated = !error && !!user
    } catch {
      // Token verification failed
      isAuthenticated = false
    }
  }

  // If not authenticated via custom tokens, check for Supabase's default storage
  // This handles cases where the client-side session exists
  if (!isAuthenticated) {
    // Check for the auth token in the standard Supabase cookie format
    const authCookie = req.cookies.get('sb-' + supabaseUrl.split('//')[1]?.split('.')[0] + '-auth-token')
    if (authCookie?.value) {
      try {
        const tokenData = JSON.parse(authCookie.value)
        if (tokenData?.access_token) {
          const { data: { user }, error } = await supabase.auth.getUser(tokenData.access_token)
          isAuthenticated = !error && !!user
        }
      } catch {
        // Cookie parsing failed
      }
    }
  }

  // Handle protected routes - redirect to login if not authenticated
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Handle auth routes - redirect to dashboard if already authenticated
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
