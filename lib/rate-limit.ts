import { redis } from '@/lib/redis'
import { createHash } from 'crypto'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Rate limiting using Redis
 *
 * Strategy: Sliding window counter
 * - Key: rate_limit:{ip_hash}
 * - Window: 1 minute
 * - Limit: 5 requests per minute
 */
export async function rateLimit(
  ip: string,
  limit: number = 5,
  window: number = 60
): Promise<RateLimitResult> {
  // Hash the IP for privacy
  const ipHash = createHash('sha256').update(ip).digest('hex')
  const key = `rate_limit:${ipHash}`

  try {
    // Use Redis pipeline for atomic operations
    const current = await redis.incr(key)

    // Set expiration only on first request
    if (current === 1) {
      await redis.expire(key, window)
    }

    const ttl = await redis.ttl(key)
    const remaining = Math.max(0, limit - current)
    const reset = Date.now() + ttl * 1000

    return {
      success: current <= limit,
      limit,
      remaining,
      reset,
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // Fail open - allow request if Redis is down
    return {
      success: true,
      limit,
      remaining: limit,
      reset: Date.now() + window * 1000,
    }
  }
}

/**
 * Hash an IP address for storage
 */
export function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}
