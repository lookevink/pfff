import { pasteDAO, PasteDAO } from '@/lib/db/daos/paste.dao'
import { Paste, PasteRow, PasteInsert } from '@/types/paste.types'

/**
 * Repository for Paste domain entity
 *
 * Responsibilities:
 * - Transform database rows to domain models
 * - Handle complex queries across tables
 * - Domain-specific data access patterns
 * - NO external services (Redis, webhooks)
 */
export class PasteRepository {
  constructor(private dao: PasteDAO = pasteDAO) {}

  /**
   * Transform database row to domain model
   */
  private toDomainModel(row: PasteRow): Paste {
    return {
      id: row.id,
      slug: row.slug,
      content: row.content ?? row.storage_path ?? '',
      language: row.language ?? 'text',
      userId: row.user_id,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : null,
      viewCount: row.view_count ?? 0,
    }
  }

  /**
   * Create a new paste
   */
  async create(data: PasteInsert): Promise<Paste> {
    const row = await this.dao.insert(data)
    return this.toDomainModel(row)
  }

  /**
   * Get paste by slug (includes expiration check)
   */
  async getBySlug(slug: string): Promise<Paste | null> {
    const row = await this.dao.findBySlug(slug)

    if (!row) {
      return null
    }

    // Check if expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null
    }

    return this.toDomainModel(row)
  }

  /**
   * Get paste by ID
   */
  async getById(id: number): Promise<Paste | null> {
    const row = await this.dao.findById(id)

    if (!row) {
      return null
    }

    // Check if expired
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return null
    }

    return this.toDomainModel(row)
  }

  /**
   * Increment view count
   */
  async incrementViewCount(id: number): Promise<void> {
    await this.dao.incrementViewCount(id)
  }

  /**
   * Delete a paste by slug
   */
  async deleteBySlug(slug: string): Promise<boolean> {
    return await this.dao.deleteBySlug(slug)
  }

  /**
   * Get user's recent pastes
   */
  async getUserPastes(userId: string, limit: number = 10): Promise<Paste[]> {
    const rows = await this.dao.findByUserId(userId, limit)

    // Filter out expired pastes and transform
    return rows
      .filter(row => !row.expires_at || new Date(row.expires_at) > new Date())
      .map(row => this.toDomainModel(row))
  }

  /**
   * Check if paste exists and is not expired
   */
  async exists(slug: string): Promise<boolean> {
    const paste = await this.getBySlug(slug)
    return paste !== null
  }
}

// Singleton instance
export const pasteRepository = new PasteRepository()
