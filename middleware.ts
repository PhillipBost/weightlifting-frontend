import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables in middleware')
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  // Check cookies directly instead of calling getSession()
  const authCookieName = request.cookies.getAll()
    .find(c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.name;
  const hasAuthToken = !!authCookieName;

  console.log('[MIDDLEWARE] Cookie check:', hasAuthToken ? 'Found auth token' : 'No auth token');

  // Protected routes that require authentication
  const protectedRoutes = ['/admin', '/rankings', '/upcoming-meets'];
  const isProtectedRoute = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  );

  if (isProtectedRoute && !hasAuthToken) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/';
    redirectUrl.searchParams.set('auth', 'required');
    return NextResponse.redirect(redirectUrl);
  }

  // Special protection for LiftTilYaDie mirror - strict Role Based Access Control
  if (request.nextUrl.pathname.startsWith('/LiftTilYaDie')) {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      redirectUrl.searchParams.set('auth', 'required');
      return NextResponse.redirect(redirectUrl);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // Roles allowed to access the mirror
    const allowedRoles = ['admin', 'vip', 'researcher', 'usaw_national_team_coach'];
    if (!profile || !allowedRoles.includes(profile.role)) {
      console.log(`[MIDDLEWARE] Access denied to /LiftTilYaDie for user ${user.id} with role ${profile?.role}`);
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = '/';
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Only run middleware on protected routes that require authentication.
     * This significantly improves performance by avoiding auth checks on public pages.
     */
    '/admin/:path*',
    '/rankings/:path*',
    '/upcoming-meets/:path*',
    '/LiftTilYaDie/:path*',
  ],
}
