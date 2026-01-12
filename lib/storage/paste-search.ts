import Fuse, { type IFuseOptions, type FuseResultMatch } from 'fuse.js'
import type { PasteHistoryEntry } from './paste-history'

/**
 * Paste search utilities using Fuse.js for fuzzy matching
 */

export type SortOrder = 'recent' | 'oldest' | 'language'
export type FilterType = 'all' | 'owned' | 'viewed'

export interface SearchOptions {
  filter?: FilterType
  sort?: SortOrder
  limit?: number
}

export interface SearchResult {
  item: PasteHistoryEntry
  score?: number
  matches?: readonly FuseResultMatch[]
}

/**
 * Configure Fuse.js for paste search
 */
const fuseOptions: IFuseOptions<PasteHistoryEntry> = {
  keys: [
    { name: 'slug', weight: 0.3 },
    { name: 'contentPreview', weight: 0.5 },
    { name: 'language', weight: 0.2 },
  ],
  threshold: 0.4,  // 0 = exact match, 1 = match anything
  includeScore: true,
  includeMatches: true,
  minMatchCharLength: 2,
}

/**
 * Search pastes with fuzzy matching
 */
export function searchPastes(
  entries: PasteHistoryEntry[],
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  // Apply filters first
  let filtered = entries

  if (options.filter === 'owned') {
    filtered = filtered.filter(e => e.isOwned)
  } else if (options.filter === 'viewed') {
    filtered = filtered.filter(e => !e.isOwned)
  }

  // If no query, just return filtered results
  if (!query.trim()) {
    const results = filtered.map(item => ({ item }))
    return applySortAndLimit(results, options)
  }

  // Perform fuzzy search
  const fuse = new Fuse(filtered, fuseOptions)
  const fuseResults = fuse.search(query)

  const results: SearchResult[] = fuseResults.map(result => ({
    item: result.item,
    score: result.score,
    matches: result.matches,
  }))

  return applySortAndLimit(results, options)
}

/**
 * Apply sorting and limit to results
 */
function applySortAndLimit(
  results: SearchResult[],
  options: SearchOptions
): SearchResult[] {
  let sorted = [...results]

  // Sort
  switch (options.sort) {
    case 'recent':
      sorted.sort((a, b) =>
        new Date(b.item.viewedAt).getTime() - new Date(a.item.viewedAt).getTime()
      )
      break
    case 'oldest':
      sorted.sort((a, b) =>
        new Date(a.item.viewedAt).getTime() - new Date(b.item.viewedAt).getTime()
      )
      break
    case 'language':
      sorted.sort((a, b) => a.item.language.localeCompare(b.item.language))
      break
    default:
      // If search results, they're already sorted by relevance
      // Otherwise, sort by recent
      if (!results[0]?.score) {
        sorted.sort((a, b) =>
          new Date(b.item.viewedAt).getTime() - new Date(a.item.viewedAt).getTime()
        )
      }
  }

  // Apply limit
  if (options.limit) {
    sorted = sorted.slice(0, options.limit)
  }

  return sorted
}

/**
 * Get unique languages from entries
 */
export function getUniqueLanguages(entries: PasteHistoryEntry[]): string[] {
  const languages = new Set(entries.map(e => e.language))
  return Array.from(languages).sort()
}

/**
 * Filter pastes by language
 */
export function filterByLanguage(
  entries: PasteHistoryEntry[],
  language: string
): PasteHistoryEntry[] {
  return entries.filter(e => e.language === language)
}

/**
 * Highlight search matches in text
 */
export function highlightMatches(text: string, matches?: readonly FuseResultMatch[]): string {
  if (!matches || matches.length === 0) return text

  // Find all match indices
  const highlights: [number, number][] = []

  for (const match of matches) {
    if (match.indices) {
      highlights.push(...match.indices)
    }
  }

  // Sort and merge overlapping ranges
  highlights.sort((a, b) => a[0] - b[0])

  const merged: [number, number][] = []
  for (const range of highlights) {
    if (merged.length === 0) {
      merged.push(range)
    } else {
      const last = merged[merged.length - 1]
      if (range[0] <= last[1] + 1) {
        // Merge overlapping/adjacent ranges
        last[1] = Math.max(last[1], range[1])
      } else {
        merged.push(range)
      }
    }
  }

  // Build highlighted string
  let result = ''
  let lastIndex = 0

  for (const [start, end] of merged) {
    result += text.slice(lastIndex, start)
    result += `<mark class="bg-yellow-200 dark:bg-yellow-900/50">${text.slice(start, end + 1)}</mark>`
    lastIndex = end + 1
  }

  result += text.slice(lastIndex)
  return result
}
