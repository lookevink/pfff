import { Database } from './database.types'

/**
 * Domain types for Paste entity
 *
 * These types extend Supabase auto-generated types to maintain type safety
 * with the actual database schema. Always regenerate database.types.ts
 * after schema changes using:
 *
 * npx supabase gen types typescript --project-id "jowgpljfoscedeebvhdb" --schema public > types/database.types.ts
 */

// Use Supabase-generated types as source of truth
export type PasteRow = Database['public']['Tables']['pastes']['Row']
export type PasteInsert = Database['public']['Tables']['pastes']['Insert']
export type PasteUpdate = Database['public']['Tables']['pastes']['Update']

// Domain model (what the application works with)
export interface Paste {
  id: PasteRow['id']
  slug: PasteRow['slug']
  content: string // Never null in domain model
  language: string // Never null in domain model
  userId: PasteRow['user_id']
  createdAt: Date // Transformed from string
  expiresAt: Date | null // Transformed from string
  viewCount: number // Never null in domain model
  lastViewedAt: Date | null // Transformed from string
  metadata: PasteRow['metadata'] // JSONB metadata
}

// API response format (serialized Paste with ISO date strings)
// Used for API responses and component props that receive serialized data
export type PasteApiResponse = {
  slug: Paste['slug']
  content: Paste['content']
  language: Paste['language']
  createdAt: string // ISO string
  expiresAt: string | null // ISO string or null
  viewCount: Paste['viewCount']
  lastViewedAt?: string | null // ISO string or null (optional in some responses)
  metadata?: Paste['metadata'] // Optional in some responses
}

// Re-export for convenience
export type { Database }
