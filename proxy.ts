import { NextResponse, type NextRequest } from 'next/server'
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions, expirySeconds, signToken, verifyToken } from '@/lib/auth/tokens'

/**
 * Optimistic gate for /admin: sends visitors without a valid token to the login page
 * and renews an expired access token from the refresh token. Pages and actions still
 * check the account itself through requireAdmin().
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // The login page decides for itself: a token can be valid while its account is gone.
  if (pathname === '/admin/login') return NextResponse.next()

  let session = await verifyToken('access', request.cookies.get(ACCESS_COOKIE)?.value)
  let renewed: string | undefined
  if (!session) {
    session = await verifyToken('refresh', request.cookies.get(REFRESH_COOKIE)?.value)
    if (session) renewed = await signToken('access', session)
  }

  if (!session) {
    const login = new URL('/admin/login', request.url)
    if (pathname !== '/admin') login.searchParams.set('next', pathname + search)
    return NextResponse.redirect(login)
  }

  if (!renewed) return NextResponse.next()

  // Pass the new token to this request's render as well as back to the browser.
  request.cookies.set(ACCESS_COOKIE, renewed)
  const response = NextResponse.next({ request: { headers: request.headers } })
  response.cookies.set(ACCESS_COOKIE, renewed, cookieOptions(expirySeconds('access')))
  return response
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
