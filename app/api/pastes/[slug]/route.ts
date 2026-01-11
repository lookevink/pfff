import { NextRequest, NextResponse } from 'next/server'
import { pasteService } from '@/lib/services/paste.service'

/**
 * GET /api/pastes/[slug] - Fetch a paste by slug
 *
 * Thin controller that:
 * 1. Validates slug parameter
 * 2. Delegates to service layer
 * 3. Returns formatted response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    // Validate slug
    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Invalid slug' },
        { status: 400 }
      )
    }

    // Fetch paste from service layer (handles cache-aside pattern)
    const paste = await pasteService.getPaste(slug)

    if (!paste) {
      return NextResponse.json(
        { success: false, error: 'Paste not found or expired' },
        { status: 404 }
      )
    }

    // Return paste data
    return NextResponse.json(
      {
        success: true,
        data: {
          slug: paste.slug,
          content: paste.content,
          language: paste.language,
          createdAt: paste.createdAt.toISOString(),
          expiresAt: paste.expiresAt?.toISOString() ?? null,
          viewCount: paste.viewCount,
          lastViewedAt: paste.lastViewedAt?.toISOString() ?? null,
          metadata: paste.metadata,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching paste:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
