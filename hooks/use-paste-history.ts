import { useState, useEffect, useCallback } from 'react'
import type { PasteHistoryEntry, HistoryStats } from '@/lib/storage/paste-history'
import {
  addToHistory,
  getHistory,
  clearHistory,
  getHistoryStats,
  exportHistory,
  importHistory,
} from '@/lib/storage/paste-history'
import {
  searchPastes,
  type SearchOptions,
  type SearchResult,
} from '@/lib/storage/paste-search'

/**
 * React hook for managing paste history
 *
 * Provides:
 * - History entries with search/filter/sort
 * - Stats (count, owned, viewed)
 * - Add/clear operations
 * - Export/import functionality
 */
export function usePasteHistory() {
  const [entries, setEntries] = useState<PasteHistoryEntry[]>([])
  const [stats, setStats] = useState<HistoryStats>({
    totalCount: 0,
    ownedCount: 0,
    viewedCount: 0,
    oldestPaste: null,
    newestPaste: null,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Load history on mount
  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const [historyEntries, historyStats] = await Promise.all([
        getHistory(),
        getHistoryStats(),
      ])
      setEntries(historyEntries)
      setStats(historyStats)
    } catch (error) {
      console.error('Failed to load history:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Add paste to history
  const addPaste = useCallback(async (entry: PasteHistoryEntry) => {
    await addToHistory(entry)
    await loadHistory() // Refresh
  }, [loadHistory])

  // Clear all history
  const clear = useCallback(async () => {
    await clearHistory()
    await loadHistory() // Refresh
  }, [loadHistory])

  // Search pastes
  const search = useCallback((query: string, options?: SearchOptions): SearchResult[] => {
    return searchPastes(entries, query, options)
  }, [entries])

  // Export history as JSON
  const exportAsJson = useCallback(async (): Promise<string> => {
    return await exportHistory()
  }, [])

  // Import history from JSON
  const importFromJson = useCallback(async (json: string) => {
    const result = await importHistory(json)
    await loadHistory() // Refresh
    return result
  }, [loadHistory])

  return {
    entries,
    stats,
    isLoading,
    addPaste,
    clear,
    search,
    exportAsJson,
    importFromJson,
    refresh: loadHistory,
  }
}
