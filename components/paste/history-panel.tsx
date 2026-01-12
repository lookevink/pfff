'use client'

import { useState, useMemo } from 'react'
import { usePasteHistory } from '@/hooks/use-paste-history'
import { HistoryItem } from './history-item'
import { HistorySearch } from './history-search'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Trash2, Download, Upload, Loader2 } from 'lucide-react'
import { getUniqueLanguages, filterByLanguage, highlightMatches } from '@/lib/storage/paste-search'
import type { FilterType, SortOrder } from '@/lib/storage/paste-search'

export function HistoryPanel() {
  const { entries, stats, isLoading, clear, search, exportAsJson, importFromJson } = usePasteHistory()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortOrder>('recent')
  const [selectedLanguage, setSelectedLanguage] = useState<string>()

  // Search & filter
  const searchResults = useMemo(() => {
    const results = search(query, { filter, sort })

    // Apply language filter
    if (selectedLanguage) {
      return results.filter(r => r.item.language === selectedLanguage)
    }

    return results
  }, [query, filter, sort, selectedLanguage, search])

  // Get unique languages
  const languages = useMemo(() => getUniqueLanguages(entries), [entries])

  // Handle clear
  const handleClear = async () => {
    if (confirm('Are you sure you want to clear all history? This cannot be undone.')) {
      await clear()
    }
  }

  // Handle export
  const handleExport = async () => {
    const json = await exportAsJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paste-history-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Handle import
  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      const text = await file.text()
      const result = await importFromJson(text)
      alert(`Imported ${result.success} pastes (${result.failed} failed)`)
    }
    input.click()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">No paste history yet</p>
        <p className="text-sm text-muted-foreground">
          Pastes you create or view will appear here
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats & Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">{stats.totalCount}</span> pastes •{' '}
          <span className="font-medium">{stats.ownedCount}</span> owned •{' '}
          <span className="font-medium">{stats.viewedCount}</span> viewed
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-8"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleImport}
            className="h-8"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="h-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear
          </Button>
        </div>
      </div>

      {/* Limit Warning */}
      {stats.totalCount >= 45 && (
        <Alert>
          <AlertDescription>
            You have {stats.totalCount} of 50 local pastes.{' '}
            <strong>Sign up to save unlimited pastes and sync across devices!</strong>
          </AlertDescription>
        </Alert>
      )}

      {/* Search & Filters */}
      <HistorySearch
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        languages={languages}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
        resultCount={searchResults.length}
      />

      {/* Results */}
      <div className="space-y-2">
        {searchResults.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pastes found matching your search
          </div>
        ) : (
          searchResults.map((result) => {
            // Highlight matches in preview
            const highlightedPreview = result.matches
              ? highlightMatches(result.item.contentPreview, result.matches)
              : undefined

            return (
              <HistoryItem
                key={result.item.slug}
                entry={result.item}
                highlightedPreview={highlightedPreview}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
