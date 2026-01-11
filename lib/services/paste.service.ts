import { pasteRepository, PasteRepository } from '@/lib/db/repositories/paste.repository'
import { redis } from '@/lib/redis'
import { generateSlug } from '@/lib/hashids'
import { hashIP } from '@/lib/rate-limit'
import {
  validateCreatePasteInput,
  validateExpirationRules,
  calculateExpiration,
  shouldUseObjectStorage,
} from '@/lib/validators/paste.validator'
import { Paste } from '@/types/paste.types'
import type { Json } from '@/types/database.types'

interface CachedPaste {
  content: string
  language: string
  created_at: string
  expires_at: string | null
}

/**
 * Service for Paste operations
 *
 * Responsibilities:
 * - Orchestrate multi-system operations (DB, Redis, webhooks)
 * - Coordinate rate limiting, validation, caching
 * - Implement full business workflows
 * - Called by API routes
 *
 * Uses:
 * - Zod validation via validator layer
 * - Supabase types via DAO/Repository layers
 * - Redis for caching and ID generation
 */
export class PasteService {
  private readonly CACHE_TTL = 3600 // 1 hour

  constructor(private repository: PasteRepository = pasteRepository) {}

  /**
   * Create a paste with full workflow:
   * 1. Validate input (Zod)
   * 2. Check business rules
   * 3. Generate unique ID
   * 4. Insert to database
   * 5. Cache in Redis
   * 6. Emit webhook (future)
   */
  async createPaste(input: unknown, ip: string): Promise<Paste> {
    // 1. Validate input using Zod
    const validatedInput = validateCreatePasteInput(input)

    // 2. Check business rules
    validateExpirationRules(validatedInput.userId, validatedInput.expiresIn)

    // 3. Check if content should go to object storage
    if (shouldUseObjectStorage(validatedInput.content)) {
      // TODO: Implement S3 upload
      throw new Error('Content too large. Object storage not yet implemented.')
    }

    // 4. Generate unique ID using Redis atomic increment
    const counter = await redis.incr('paste_counter')
    const slug = generateSlug(counter)

    // 5. Calculate expiration
    const expiresAt = calculateExpiration(validatedInput.expiresIn)

    // 6. Insert into database
    const paste = await this.repository.create({
      slug,
      content: validatedInput.content,
      language: validatedInput.language,
      user_id: validatedInput.userId ?? null,
      ip_hash: hashIP(ip),
      expires_at: expiresAt,
      metadata: (validatedInput.metadata ?? null) as Json | null,
    })

    // 7. Cache in Redis for fast reads
    await this.cachePaste(slug, {
      content: validatedInput.content,
      language: paste.language,
      created_at: paste.createdAt.toISOString(),
      expires_at: expiresAt,
    })

    // TODO: 8. Emit webhook event for AI processing
    // await this.emitPasteCreatedEvent(paste)

    return paste
  }

  /**
   * Get paste with cache-aside pattern:
   * 1. Check Redis cache
   * 2. On miss, query database
   * 3. Cache result
   * 4. Increment view count (async)
   */
  async getPaste(slug: string): Promise<Paste | null> {
    // 1. Check cache
    const cached = await this.getCachedPaste(slug)
    if (cached) {
      return this.cachedPasteToDomain(slug, cached)
    }

    // 2. Query database
    const paste = await this.repository.getBySlug(slug)
    if (!paste) {
      return null
    }

    // 3. Cache for next time
    await this.cachePaste(slug, {
      content: paste.content,
      language: paste.language,
      created_at: paste.createdAt.toISOString(),
      expires_at: paste.expiresAt?.toISOString() ?? null,
    })

    // 4. Increment view count (non-blocking)
    this.repository.incrementViewCount(paste.id).catch(err => {
      console.error('Failed to increment view count:', err)
    })

    return paste
  }

  /**
   * Delete a paste and invalidate cache
   */
  async deletePaste(slug: string): Promise<boolean> {
    // Delete from database
    const deleted = await this.repository.deleteBySlug(slug)

    // Invalidate cache
    if (deleted) {
      await redis.del(`paste:${slug}`)
    }

    return deleted
  }

  /**
   * Get user's pastes (no caching for user-specific queries)
   */
  async getUserPastes(userId: string, limit: number = 10): Promise<Paste[]> {
    return await this.repository.getUserPastes(userId, limit)
  }

  /**
   * Cache a paste in Redis
   */
  private async cachePaste(slug: string, data: CachedPaste): Promise<void> {
    try {
      await redis.set(
        `paste:${slug}`,
        JSON.stringify(data),
        { ex: this.CACHE_TTL }
      )
    } catch (error) {
      // Non-critical - log but don't throw
      console.error('Failed to cache paste:', error)
    }
  }

  /**
   * Get cached paste from Redis
   */
  private async getCachedPaste(slug: string): Promise<CachedPaste | null> {
    try {
      const cached = await redis.get(`paste:${slug}`)
      if (!cached || typeof cached !== 'string') return null

      return JSON.parse(cached) as CachedPaste
    } catch (error) {
      console.error('Failed to get cached paste:', error)
      return null
    }
  }

  /**
   * Transform cached paste to domain model
   */
  private cachedPasteToDomain(slug: string, cached: CachedPaste): Paste {
    return {
      id: 0, // Not available from cache
      slug,
      content: cached.content,
      language: cached.language,
      userId: null, // Not cached
      createdAt: new Date(cached.created_at),
      expiresAt: cached.expires_at ? new Date(cached.expires_at) : null,
      viewCount: 0, // Not cached
      lastViewedAt: null, // Not cached
      metadata: null, // Not cached
    }
  }

  /**
   * TODO: Emit webhook event for paste creation
   */
  private async emitPasteCreatedEvent(paste: Paste): Promise<void> {
    if (!process.env.WEBHOOK_URL) return

    try {
      await fetch(process.env.WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'paste.created',
          data: {
            id: paste.id,
            slug: paste.slug,
            language: paste.language,
            user_id: paste.userId,
          },
        }),
      })
    } catch (error) {
      // Non-critical - log but don't throw
      console.error('Failed to emit webhook:', error)
    }
  }
}

// Singleton instance
export const pasteService = new PasteService()
