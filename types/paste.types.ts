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
// Transform database types to more ergonomic domain types
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

// Re-export for convenience
export type { Database }
