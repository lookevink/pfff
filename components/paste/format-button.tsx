'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatCode, isFormattingSupported } from '@/lib/formatting/prettier-formatter'

interface FormatButtonProps {
  code: string
  language: string
  onFormat: (formattedCode: string) => void
  disabled?: boolean
}

export function FormatButton({ code, language, onFormat, disabled = false }: FormatButtonProps) {
  const [isFormatting, setIsFormatting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supported = isFormattingSupported(language)

  const handleFormat = async () => {
    if (!supported || !code.trim()) return

    setIsFormatting(true)
    setError(null)

    try {
      const result = await formatCode(code, language)

      if (result.error) {
        setError(result.error)
        return
      }

      if (result.changed) {
        onFormat(result.formatted)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Formatting failed')
      console.error('Format error:', err)
    } finally {
      setIsFormatting(false)
    }
  }

  if (!supported) {
    return (
      <Button variant="outline" size="sm" disabled title={`Formatting not supported for ${language}`}>
        Format
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleFormat}
        disabled={disabled || isFormatting || !code.trim()}
      >
        {isFormatting ? 'Formatting...' : 'Format'}
      </Button>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
