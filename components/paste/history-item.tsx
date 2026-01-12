'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { FileCode, Clock, User } from 'lucide-react'
import type { PasteHistoryEntry } from '@/lib/storage/paste-history'

interface HistoryItemProps {
  entry: PasteHistoryEntry
  highlightedPreview?: string
}

export function HistoryItem({ entry, highlightedPreview }: HistoryItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }

  // Truncate preview to 3 lines
  const preview = entry.contentPreview.slice(0, 200)
  const displayPreview = highlightedPreview || preview

  return (
    <Link
      href={`/${entry.slug}`}
      className="block p-4 border rounded-lg hover:bg-accent transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="font-mono text-sm font-medium truncate">
              {entry.slug}
            </span>
            <Badge variant="outline" className="text-xs shrink-0">
              {entry.language.toUpperCase()}
            </Badge>
            {entry.isOwned && (
              <Badge variant="secondary" className="text-xs shrink-0">
                <User className="w-3 h-3 mr-1" />
                Owned
              </Badge>
            )}
          </div>

          {/* Preview */}
          <div className="text-sm text-muted-foreground mb-2 line-clamp-3 font-mono">
            {highlightedPreview ? (
              <span dangerouslySetInnerHTML={{ __html: displayPreview }} />
            ) : (
              displayPreview
            )}
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDate(entry.viewedAt)}
            </span>
            <span>{entry.metadata.lineCount} lines</span>
            <span>{(entry.metadata.byteSize / 1024).toFixed(1)} KB</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
