import { z } from 'zod'
import {
  createPasteSchema,
  type CreatePasteInput,
  SUPPORTED_LANGUAGES,
  EXPIRATION_OPTIONS
} from '@/lib/schemas/paste.schema'

/**
 * Validator for Paste operations
 *
 * Responsibilities:
 * - Input validation using Zod schemas
 * - Business rule enforcement
 * - Expiration calculation
 * - Content sanitization
 * - NO database calls
 * - NO external service calls
 *
 * Uses Zod for:
 * - Runtime type checking
 * - Better error messages
 * - Single source of truth for validation logic
 */

const CONTENT_SIZE_LIMIT = 100 * 1024 // 100KB

/**
 * Validate and parse paste creation input using Zod
 * Throws ZodError if validation fails
 */
export function validateCreatePasteInput(input: unknown): CreatePasteInput {
  return createPasteSchema.parse(input)
}

/**
 * Safe validation that returns success/error object
 */
export function safeValidateCreatePasteInput(input: unknown) {
  return createPasteSchema.safeParse(input)
}

/**
 * Validate expiration rules based on user authentication status
 *
 * Business Rule: Anonymous users cannot create "never expire" pastes
 */
export function validateExpirationRules(
  userId: string | null | undefined,
  expiresIn: string
): void {
  if (!userId && expiresIn === 'never') {
    throw new Error('Anonymous users must set an expiration time')
  }
}

/**
 * Calculate expiration timestamp based on duration
 */
export function calculateExpiration(duration: string): string | null {
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
      // Default to 7 days
      now.setDate(now.getDate() + 7)
  }
  return now.toISOString()
}

/**
 * Check if content exceeds size limit for direct storage
 * Returns true if content should be stored in object storage
 */
export function shouldUseObjectStorage(content: string): boolean {
  const contentSize = new TextEncoder().encode(content).length
  return contentSize > CONTENT_SIZE_LIMIT
}

/**
 * Get content size in bytes
 */
export function getContentSize(content: string): number {
  return new TextEncoder().encode(content).length
}

/**
 * Format Zod errors into user-friendly messages
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map(err => `${err.path.join('.')}: ${err.message}`)
    .join(', ')
}

// Re-export for convenience
export { SUPPORTED_LANGUAGES, EXPIRATION_OPTIONS }
export type { CreatePasteInput }
