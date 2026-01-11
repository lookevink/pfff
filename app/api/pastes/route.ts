import { NextRequest, NextResponse } from 'next/server'
import { pasteService } from '@/lib/services/paste.service'
import { rateLimit } from '@/lib/rate-limit'
import { formatZodError } from '@/lib/validators/paste.validator'
import { ZodError } from 'zod'

/**
 * POST /api/pastes - Create a new paste
 *
 * Thin controller that:
 * 1. Extracts IP and checks rate limit
 * 2. Parses request body
 * 3. Delegates to service layer (validation happens there via Zod)
 * 4. Returns formatted response
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Get IP address from headers
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const ip = forwardedFor?.split(',')[0] ?? realIP ?? '127.0.0.1'

    // 2. Rate limiting check (The Bouncer)
    const rateLimitResult = await rateLimit(ip, 5, 60) // 5 requests per minute

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          rateLimit: {
            remaining: rateLimitResult.remaining,
            reset: rateLimitResult.reset,
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          },
        }
      )
    }

    // 3. Parse request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // 4. Delegate to service layer (validation with Zod happens here)
    const paste = await pasteService.createPaste(body, ip)

    // 5. Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          slug: paste.slug,
          url: `${request.nextUrl.origin}/${paste.slug}`,
          createdAt: paste.createdAt.toISOString(),
          expiresAt: paste.expiresAt?.toISOString() ?? null,
        },
        rateLimit: {
          remaining: rateLimitResult.remaining,
          reset: rateLimitResult.reset,
        },
      },
      {
        status: 201,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
        },
      }
    )
  } catch (error) {
    // Handle Zod validation errors
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: formatZodError(error),
        },
        { status: 400 }
      )
    }

    // Handle service errors
    const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
    const statusCode = errorMessage.includes('too large') ? 413 :
      errorMessage.includes('Anonymous users') ? 403 :
        errorMessage.includes('required') || errorMessage.includes('Invalid') ? 400 :
          500

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: statusCode }
    )
  }
}
