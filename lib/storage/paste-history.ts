/**
 * Client-side paste history storage using IndexedDB
 *
 * Strategy:
 * - Store last 50 pastes (FIFO eviction)
 * - Track both created & viewed pastes
 * - Keep metadata for search (slug, language, preview)
 * - Use for signup conversion ("Sign up to save unlimited pastes")
 */

const DB_NAME = 'paste-history'
const STORE_NAME = 'pastes'
const DB_VERSION = 1
const MAX_HISTORY_SIZE = 50

export interface PasteHistoryEntry {
  slug: string                 // DB reference (primary key)
  language: string
  contentPreview: string       // First 300 chars for search
  createdAt: string           // ISO timestamp (when paste was created)
  viewedAt: string            // ISO timestamp (last viewed)
  isOwned: boolean            // true = created by user, false = just viewed
  metadata: {
    lineCount: number
    byteSize: number
    detectedLanguage?: string
    detectedConfidence?: number
  }
}

export interface HistoryStats {
  totalCount: number
  ownedCount: number
  viewedCount: number
  oldestPaste: string | null
  newestPaste: string | null
}

/**
 * Open IndexedDB database
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'slug' })

        // Create indexes for efficient queries
        store.createIndex('viewedAt', 'viewedAt', { unique: false })
        store.createIndex('isOwned', 'isOwned', { unique: false })
        store.createIndex('language', 'language', { unique: false })
      }
    }
  })
}

/**
 * Add or update paste in history
 * Enforces 50 paste limit with FIFO eviction
 */
export async function addToHistory(entry: PasteHistoryEntry): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    // Check if paste already exists
    const existing = await new Promise<PasteHistoryEntry | undefined>((resolve, reject) => {
      const request = store.get(entry.slug)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (existing) {
      // Update existing entry (preserve isOwned if already true)
      const updated: PasteHistoryEntry = {
        ...entry,
        isOwned: existing.isOwned || entry.isOwned,
        viewedAt: new Date().toISOString(),
      }

      await new Promise<void>((resolve, reject) => {
        const request = store.put(updated)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } else {
      // Add new entry
      await new Promise<void>((resolve, reject) => {
        const request = store.add(entry)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      // Enforce size limit
      await enforceHistoryLimit(db)
    }
  } catch (error) {
    console.error('Failed to add to history:', error)
    // Non-critical - don't throw
  }
}

/**
 * Remove oldest pastes if over limit
 */
async function enforceHistoryLimit(db: IDBDatabase): Promise<void> {
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)
  const index = store.index('viewedAt')

  // Get all entries sorted by viewedAt (oldest first)
  const allEntries = await new Promise<PasteHistoryEntry[]>((resolve, reject) => {
    const request = index.openCursor()
    const entries: PasteHistoryEntry[] = []

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        entries.push(cursor.value)
        cursor.continue()
      } else {
        resolve(entries)
      }
    }
    request.onerror = () => reject(request.error)
  })

  // Delete oldest entries if over limit
  if (allEntries.length > MAX_HISTORY_SIZE) {
    const toDelete = allEntries.slice(0, allEntries.length - MAX_HISTORY_SIZE)

    for (const entry of toDelete) {
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(entry.slug)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    }
  }
}

/**
 * Get all paste history entries
 * Sorted by viewedAt (newest first)
 */
export async function getHistory(limit?: number): Promise<PasteHistoryEntry[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('viewedAt')

    const entries = await new Promise<PasteHistoryEntry[]>((resolve, reject) => {
      const request = index.openCursor(null, 'prev') // Newest first
      const results: PasteHistoryEntry[] = []

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor && (!limit || results.length < limit)) {
          results.push(cursor.value)
          cursor.continue()
        } else {
          resolve(results)
        }
      }
      request.onerror = () => reject(request.error)
    })

    return entries
  } catch (error) {
    console.error('Failed to get history:', error)
    return []
  }
}

/**
 * Get paste by slug
 */
export async function getPasteFromHistory(slug: string): Promise<PasteHistoryEntry | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    return await new Promise<PasteHistoryEntry | null>((resolve, reject) => {
      const request = store.get(slug)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to get paste from history:', error)
    return null
  }
}

/**
 * Clear all history
 */
export async function clearHistory(): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to clear history:', error)
  }
}

/**
 * Get history statistics
 */
export async function getHistoryStats(): Promise<HistoryStats> {
  try {
    const entries = await getHistory()

    const ownedCount = entries.filter(e => e.isOwned).length
    const viewedCount = entries.filter(e => !e.isOwned).length

    const oldest = entries.length > 0
      ? entries.reduce((a, b) => new Date(a.createdAt) < new Date(b.createdAt) ? a : b).slug
      : null

    const newest = entries.length > 0
      ? entries.reduce((a, b) => new Date(a.createdAt) > new Date(b.createdAt) ? a : b).slug
      : null

    return {
      totalCount: entries.length,
      ownedCount,
      viewedCount,
      oldestPaste: oldest,
      newestPaste: newest,
    }
  } catch (error) {
    console.error('Failed to get history stats:', error)
    return {
      totalCount: 0,
      ownedCount: 0,
      viewedCount: 0,
      oldestPaste: null,
      newestPaste: null,
    }
  }
}

/**
 * Export all history as JSON (for backup before signup)
 */
export async function exportHistory(): Promise<string> {
  const entries = await getHistory()
  return JSON.stringify(entries, null, 2)
}

/**
 * Import history from JSON
 */
export async function importHistory(json: string): Promise<{ success: number, failed: number }> {
  try {
    const entries = JSON.parse(json) as PasteHistoryEntry[]

    let success = 0
    let failed = 0

    for (const entry of entries) {
      try {
        await addToHistory(entry)
        success++
      } catch {
        failed++
      }
    }

    return { success, failed }
  } catch (error) {
    console.error('Failed to import history:', error)
    return { success: 0, failed: 0 }
  }
}
