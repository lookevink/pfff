'use client'

import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FilterType, SortOrder } from '@/lib/storage/paste-search'

interface HistorySearchProps {
  query: string
  onQueryChange: (query: string) => void
  filter: FilterType
  onFilterChange: (filter: FilterType) => void
  sort: SortOrder
  onSortChange: (sort: SortOrder) => void
  languages: string[]
  selectedLanguage?: string
  onLanguageChange: (language?: string) => void
  resultCount: number
}

export function HistorySearch({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  languages,
  selectedLanguage,
  onLanguageChange,
  resultCount,
}: HistorySearchProps) {
  return (
    <div className="space-y-3">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search pastes by content, slug, or language..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          className="pl-9 pr-9"
        />
        {query && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
            onClick={() => onQueryChange('')}
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Filter */}
        <Select value={filter} onValueChange={onFilterChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Pastes</SelectItem>
            <SelectItem value="owned">Owned Only</SelectItem>
            <SelectItem value="viewed">Viewed Only</SelectItem>
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="language">By Language</SelectItem>
          </SelectContent>
        </Select>

        {/* Language Filter */}
        {languages.length > 0 && (
          <Select
            value={selectedLanguage || 'all-languages'}
            onValueChange={(value) => onLanguageChange(value === 'all-languages' ? undefined : value)}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-languages">All Languages</SelectItem>
              {languages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {lang.charAt(0).toUpperCase() + lang.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Result Count */}
        <span className="text-sm text-muted-foreground ml-auto">
          {resultCount} {resultCount === 1 ? 'result' : 'results'}
        </span>
      </div>
    </div>
  )
}
