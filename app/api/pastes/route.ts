import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-server'
import { redis } from '@/lib/redis'
import { generateSlug } from '@/lib/hashids'
import { rateLimit, hashIP } from '@/lib/rate-limit'

const CONTENT_SIZE_LIMIT = 100 * 1024 // 100KB

interface CreatePasteRequest {
  content: string
  language?: string
  expiresIn?: '1h' | '1d' | '7d' | 'never'
  userId?: string | null
}

/**
 * Calculate expiration timestamp based on duration
 */
function calculateExpiration(duration: string): string | null {
  if (duration === 'never') return null

  const now = new Date()
  switch (duration) {
    case '1h':
      now.setHours(now.getHours() + 1)
      break
    case '1d':
      now.setDate(now.getDate() + 1)
      break
    case '7d':
      now.setDate(now.getDate() + 7)
      break
    default:
      // Default to 7 days for anonymous users
      now.setDate(now.getDate() + 7)
  }
  return now.toISOString()
}

/**
 * POST /api/pastes - Create a new paste
 *
 * Flow (The Gatekeeper Pattern):
 * 1. Extract IP and check rate limit
 * 2. Validate business rules (anonymous users must have expiration)
 * 3. Generate collision-free ID via Redis INCR + Hashids
 * 4. Write to database using service_role (bypassing RLS)
 * 5. Cache in Redis for fast reads
 * 6. Emit event for AI processing (future)
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
          }
        }
      )
    }

    // 3. Parse request body
    let body: CreatePasteRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // 4. Validate input
    if (!body.content || body.content.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Content cannot be empty' },
        { status: 400 }
      )
    }

    // 5. Enforce business rules: Anonymous users cannot create "never expire" pastes
    const expiresIn = body.expiresIn ?? '7d'
    if (!body.userId && expiresIn === 'never') {
      return NextResponse.json(
        {
          success: false,
          error: 'Anonymous users must set an expiration time',
        },
        { status: 403 }
      )
    }

    // 6. Check content size
    const contentSize = new TextEncoder().encode(body.content).length
    if (contentSize > CONTENT_SIZE_LIMIT) {
      // TODO: Implement S3 upload for large files
      return NextResponse.json(
        {
          success: false,
          error: 'Content too large. Maximum size is 100KB.',
        },
        { status: 413 }
      )
    }

    // 7. Generate unique ID using Redis atomic increment
    const counter = await redis.incr('paste_counter')
    const slug = generateSlug(counter)

    // 8. Calculate expiration
    const expiresAt = calculateExpiration(expiresIn)

    // 9. Insert into database using service_role (The Gatekeeper)
    const { data, error } = await supabaseAdmin
      .from('pastes')
      .insert({
        slug,
        content: body.content,
        language: body.language ?? 'text',
        user_id: body.userId ?? null,
        ip_hash: hashIP(ip),
        expires_at: expiresAt,
      })
      .select('slug, created_at, expires_at, language')
      .single()

    if (error) {
      console.error('Database insert error:', error)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create paste. Please try again.',
        },
        { status: 500 }
      )
    }

    // 10. Cache the paste in Redis for fast reads
    await redis.set(
      `paste:${slug}`,
      JSON.stringify({
        content: body.content,
        language: data.language,
        created_at: data.created_at,
        expires_at: data.expires_at,
      }),
      { ex: 3600 } // Cache for 1 hour
    )

    // TODO: 11. Emit webhook event for AI processing
    // await emitPasteCreatedEvent({ slug, language: data.language })

    return NextResponse.json(
      {
        success: true,
        data: {
          slug: data.slug,
          url: `${request.nextUrl.origin}/${data.slug}`,
          createdAt: data.created_at,
          expiresAt: data.expires_at,
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
        }
      }
    )
  } catch (error) {
    console.error('Unexpected error in POST /api/pastes:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      },
      { status: 500 }
    )
  }
}
