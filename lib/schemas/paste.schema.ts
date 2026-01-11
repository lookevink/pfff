import { z } from 'zod'

/**
 * Zod schemas for Paste validation
 *
 * Benefits:
 * - Runtime validation with TypeScript inference
 * - Single source of truth for validation logic
 * - Better error messages for API consumers
 * - Can generate OpenAPI schemas if needed
 */

const CONTENT_SIZE_LIMIT = 100 * 1024 // 100KB

/**
 * Supported programming languages
 */
export const SUPPORTED_LANGUAGES = [
  'text',
  'javascript',
  'typescript',
  'python',
  'java',
  'go',
  'rust',
  'cpp',
  'c',
  'csharp',
  'php',
  'ruby',
  'swift',
  'kotlin',
  'sql',
  'html',
  'css',
  'json',
  'yaml',
  'markdown',
  'bash',
  'shell',
] as const

export const EXPIRATION_OPTIONS = ['1h', '1d', '7d', 'never'] as const

/**
 * Schema for creating a paste
 */
export const createPasteSchema = z.object({
  content: z
    .string()
    .min(1, 'Content cannot be empty')
    .max(CONTENT_SIZE_LIMIT, `Content exceeds maximum size of ${CONTENT_SIZE_LIMIT / 1024}KB`)
    .transform(val => val.trim()),

  language: z
    .enum(SUPPORTED_LANGUAGES, {
      message: `Language must be one of: ${SUPPORTED_LANGUAGES.join(', ')}`,
    })
    .optional()
    .default('text'),

  expiresIn: z
    .enum(EXPIRATION_OPTIONS, {
      message: `Expiration must be one of: ${EXPIRATION_OPTIONS.join(', ')}`,
    })
    .optional()
    .default('7d'),

  userId: z
    .string()
    .uuid('Invalid user ID format')
    .nullable()
    .optional(),
})

/**
 * Infer TypeScript type from Zod schema
 * This is the input type for the API
 */
export type CreatePasteInput = z.infer<typeof createPasteSchema>

/**
 * Schema for paste slug parameter
 */
export const pasteSlugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(50, 'Slug is too long')
  .regex(/^[a-zA-Z0-9]+$/, 'Slug must contain only alphanumeric characters')

/**
 * Schema for pagination parameters
 */
export const paginationSchema = z.object({
  limit: z
    .number()
    .int()
    .positive()
    .max(100, 'Limit cannot exceed 100')
    .optional()
    .default(10),

  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .default(0),
})

/**
 * Schema for user ID parameter
 */
export const userIdSchema = z
  .string()
  .uuid('Invalid user ID format')
