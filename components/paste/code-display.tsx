'use client'

import { useEffect, useRef } from 'react'
import 'highlight.js/styles/atom-one-dark.css'

interface CodeDisplayProps {
  code: string
  language: string
  highlightedHtml?: string
  showLineNumbers?: boolean
  className?: string
}

/**
 * Display syntax-highlighted code
 *
 * Can accept either:
 * - Pre-highlighted HTML (from server-side highlighting)
 * - Raw code + language (for client-side highlighting)
 *
 * Features:
 * - Line numbers (optional)
 * - Horizontal scroll for long lines
 * - Copy-friendly (preserves original code when copying)
 */
export function CodeDisplay({
  code,
  language,
  highlightedHtml,
  showLineNumbers = true,
  className = '',
}: CodeDisplayProps) {
  const codeRef = useRef<HTMLElement>(null)

  useEffect(() => {
    // If no pre-highlighted HTML, client-side highlight
    if (!highlightedHtml && codeRef.current) {
      // Dynamic import to avoid SSR issues
      import('highlight.js/lib/core').then(({ default: hljs }) => {
        if (codeRef.current) {
          hljs.highlightElement(codeRef.current)
        }
      })
    }
  }, [highlightedHtml, language])

  const lines = code.split('\n')
  const lineCount = lines.length
  const lineNumberWidth = String(lineCount).length

  return (
    <div className={`relative overflow-auto p-4 ${className}`}>
      <pre className="!m-0 !p-0">
        <code
          ref={codeRef}
          className={`language-${language} block`}
          style={{
            paddingLeft: showLineNumbers ? `${lineNumberWidth + 3}ch` : undefined,
          }}
        >
          {highlightedHtml ? (
            <span dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
          ) : (
            code
          )}
        </code>
      </pre>

      {showLineNumbers && (
        <div
          className="absolute top-4 left-4 select-none pointer-events-none opacity-40"
          style={{
            width: `${lineNumberWidth + 2}ch`,
          }}
          aria-hidden="true"
        >
          {lines.map((_, i) => (
            <div key={i} className="text-right pr-2">
              {i + 1}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
