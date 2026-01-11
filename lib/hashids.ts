import Hashids from 'hashids'

if (!process.env.HASHIDS_SALT) {
  throw new Error('HASHIDS_SALT is not defined')
}

/**
 * Hashids encoder for generating collision-free, URL-safe IDs
 *
 * Process:
 * 1. Redis INCR gives us a unique integer (e.g., 100001)
 * 2. Hashids encodes it into a short string (e.g., "x9Lk2")
 * 3. The encoding is deterministic and bijective (reversible)
 *
 * Scale: 6 characters @ base62 = 56.8 billion unique URLs
 */
export const hashids = new Hashids(
  process.env.HASHIDS_SALT,
  6, // minimum length
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
)

/**
 * Generate a unique slug from a Redis counter value
 */
export function generateSlug(counter: number): string {
  return hashids.encode(counter)
}

/**
 * Decode a slug back to its counter value
 */
export function decodeSlug(slug: string): number {
  const decoded = hashids.decode(slug)
  return Array.isArray(decoded) && decoded.length > 0 ? (decoded[0] as number) : 0
}
