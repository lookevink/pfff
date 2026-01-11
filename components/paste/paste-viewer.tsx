'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileCode, Calendar, Eye, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { PasteApiResponse } from '@/types/paste.types'

type PasteViewerProps = Pick<PasteApiResponse, 'slug' | 'content' | 'language' | 'createdAt' | 'expiresAt' | 'viewCount'>

export function PasteViewer({
  slug,
  content,
  language,
  createdAt,
  expiresAt,
  viewCount,
}: PasteViewerProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileCode className="w-5 h-5" />
              {slug}
            </CardTitle>
            <CardDescription className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {viewCount} {viewCount === 1 ? 'view' : 'views'}
              </span>
              {expiresAt && (
                <span className="text-yellow-600 dark:text-yellow-500">
                  Expires: {formatDate(expiresAt)}
                </span>
              )}
            </CardDescription>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase">
              {language}
            </span>
            <span className="text-xs text-muted-foreground">
              {(new TextEncoder().encode(content).length / 1024).toFixed(1)}KB
            </span>
          </div>

          <pre className="p-4 bg-zinc-100 dark:bg-zinc-900 rounded-md overflow-x-auto">
            <code className="text-sm font-mono">{content}</code>
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
