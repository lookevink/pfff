/**
 * Client-side caching for WASM binaries using IndexedDB
 *
 * Allows Magika WASM to be cached locally, avoiding re-download
 * on subsequent visits (5MB saved per visit!)
 */

const DB_NAME = 'language-detectors'
const STORE_NAME = 'wasm-cache'
const DB_VERSION = 1

interface CacheEntry {
  key: string
  blob: Blob
  timestamp: number
}

/**
 * Save WASM blob to IndexedDB
 */
export async function saveToCache(key: string, blob: Blob): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.put({ key, blob, timestamp: Date.now() })
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to save to cache:', error)
    // Non-critical - don't throw
  }
}

/**
 * Load WASM blob from IndexedDB
 * Returns null if not found or cache is stale
 */
export async function loadFromCache(key: string): Promise<Blob | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    const record = await new Promise<CacheEntry | undefined>((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    if (!record) return null

    // Check if cache is stale (older than 7 days)
    const age = Date.now() - record.timestamp
    const MAX_AGE = 7 * 24 * 60 * 60 * 1000 // 7 days

    if (age > MAX_AGE) {
      await clearCache(key)
      return null
    }

    return record.blob
  } catch (error) {
    console.error('Failed to load from cache:', error)
    return null
  }
}

/**
 * Clear specific cache entry
 */
export async function clearCache(key: string): Promise<void> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  } catch (error) {
    console.error('Failed to clear cache:', error)
  }
}

/**
 * Clear all cached WASM
 */
export async function clearAllCache(): Promise<void> {
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
    console.error('Failed to clear all cache:', error)
  }
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
        db.createObjectStore(STORE_NAME, { keyPath: 'key' })
      }
    }
  })
}
