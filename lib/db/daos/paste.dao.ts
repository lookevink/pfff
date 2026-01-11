import { supabaseAdmin } from '@/lib/supabase-server'
import { PasteRow, PasteInsert, PasteUpdate } from '@/types/paste.types'

/**
 * Data Access Object for pastes table
 *
 * Responsibilities:
 * - Raw CRUD operations on pastes table using Supabase types
 * - NO business logic
 * - NO validation (validation happens in validator layer)
 * - NO external service calls (Redis, webhooks)
 *
 * Type Safety:
 * - Uses Supabase auto-generated types for compile-time safety
 * - Types are regenerated when schema changes
 */
export class PasteDAO {
  /**
   * Insert a new paste record
   */
  async insert(data: PasteInsert): Promise<PasteRow> {
    const { data: paste, error } = await supabaseAdmin
      .from('pastes')
      .insert(data)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to insert paste: ${error.message}`)
    }

    return paste
  }

  /**
   * Find a paste by slug
   */
  async findBySlug(slug: string): Promise<PasteRow | null> {
    const { data, error } = await supabaseAdmin
      .from('pastes')
      .select('*')
      .eq('slug', slug)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return null
      }
      throw new Error(`Failed to find paste: ${error.message}`)
    }

    return data
  }

  /**
   * Find a paste by ID
   */
  async findById(id: number): Promise<PasteRow | null> {
    const { data, error } = await supabaseAdmin
      .from('pastes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      throw new Error(`Failed to find paste: ${error.message}`)
    }

    return data
  }

  /**
   * Update a paste
   */
  async update(id: number, data: PasteUpdate): Promise<PasteRow> {
    const { data: paste, error } = await supabaseAdmin
      .from('pastes')
      .update(data)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update paste: ${error.message}`)
    }

    return paste
  }

  /**
   * Increment view count for a paste
   */
  async incrementViewCount(id: number): Promise<void> {
    // Use raw SQL for atomic increment
    const { error } = await supabaseAdmin.rpc('increment_view_count', {
      paste_id: id
    })

    if (error) {
      // Non-critical operation - log but don't throw
      console.error('Failed to increment view count:', error)
    }
  }

  /**
   * Delete expired pastes (called by cron job)
   * Returns the number of deleted pastes
   */
  async deleteExpired(): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from('pastes')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    if (error) {
      throw new Error(`Failed to delete expired pastes: ${error.message}`)
    }

    return data?.length ?? 0
  }

  /**
   * Delete a paste by slug
   */
  async deleteBySlug(slug: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('pastes')
      .delete()
      .eq('slug', slug)

    if (error) {
      throw new Error(`Failed to delete paste: ${error.message}`)
    }

    return true
  }

  /**
   * Find recent pastes by user ID
   */
  async findByUserId(userId: string, limit: number = 10, offset: number = 0): Promise<PasteRow[]> {
    const { data, error } = await supabaseAdmin
      .from('pastes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to find pastes by user: ${error.message}`)
    }

    return data ?? []
  }

  /**
   * Count total pastes by user ID
   */
  async countByUserId(userId: string): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('pastes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to count pastes: ${error.message}`)
    }

    return count ?? 0
  }
}

// Singleton instance
export const pasteDAO = new PasteDAO()
