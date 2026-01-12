'use client'

import { useEffect, useState, useMemo } from 'react'
import { CodeDisplay } from './code-display'
import { highlightCode } from '@/lib/highlighting/syntax-highlighter'
import { debounce } from '@/lib/utils/debounce'

interface LivePreviewProps {
  code: string
  language: string
  showLineNumbers?: boolean
  className?: string
}

/**
 * Live preview with debounced syntax highlighting
 *
 * Strategy:
 * - Debounce highlighting by 500ms to avoid re-highlighting on every keystroke
 * - Memoize highlighted HTML to prevent unnecessary re-renders
 * - Show loading state during debounce period
 */
export function LivePreview({
  code,
  language,
  showLineNumbers = true,
  className = '',
}: LivePreviewProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')
  const [isHighlighting, setIsHighlighting] = useState(false)

  // Debounced highlighting function
  const debouncedHighlight = useMemo(
    () =>
      debounce((codeToHighlight: string, lang: string) => {
        setIsHighlighting(true)

        // Perform highlighting
        const result = highlightCode(codeToHighlight, lang)
        setHighlightedHtml(result.html)

        setIsHighlighting(false)
      }, 500), // 500ms debounce
    []
  )

  // Trigger highlighting when code or language changes
  useEffect(() => {
    if (!code.trim()) {
      setHighlightedHtml('')
      return
    }

    debouncedHighlight(code, language)
  }, [code, language, debouncedHighlight])

  // Initial highlight (no debounce)
  useEffect(() => {
    if (code.trim() && !highlightedHtml) {
      const result = highlightCode(code, language)
      setHighlightedHtml(result.html)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!code.trim()) {
    return (
      <div className={`flex items-center justify-center min-h-[400px] text-muted-foreground text-sm ${className}`}>
        Start typing to see preview...
      </div>
    )
  }

  return (
    <>
      {isHighlighting && (
        <div className="absolute top-2 right-2 z-10 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-md border shadow-sm">
          Highlighting...
        </div>
      )}
      <CodeDisplay
        code={code}
        language={language}
        highlightedHtml={highlightedHtml}
        showLineNumbers={showLineNumbers}
        className={className}
      />
    </>
  )
}
