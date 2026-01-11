import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Edge proxy for early request filtering
 *
 * Responsibilities:
 * - IP blocking (future: check against blocklist)
 * - Security headers
 * - Early rejection of suspicious requests
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  // TODO: Check IP against blocklist in Redis
  // const ip = request.ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1'
  // const isBlocked = await redis.get(`blocked_ip:${hashIP(ip)}`)
  // if (isBlocked) {
  //   return new NextResponse('Forbidden', { status: 403 })
  // }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
