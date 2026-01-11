'use client'

import { useEffect, useState, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { DetectionBadge } from './detection-badge'
import { DetectorFactory } from '@/lib/detection/detector-factory'
import { debounce } from '@/lib/utils/debounce'
import type { DetectionResult } from '@/lib/detection/types'
import type { CreatePasteInput } from '@/lib/schemas/paste.schema'

interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  onLanguageDetected?: (language: string, result: DetectionResult) => void
  placeholder?: string
  error?: string
  disabled?: boolean
  isAuthenticated?: boolean
}

export function CodeEditor({
  value,
  onChange,
  onLanguageDetected,
  placeholder = 'Paste your code here...',
  error,
  disabled = false,
  isAuthenticated = false,
}: CodeEditorProps) {
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [isDetecting, setIsDetecting] = useState(false)

  // Debounced detection function
  const detectLanguage = useCallback(
    debounce(async (code: string) => {
      if (!code.trim()) {
        setDetectionResult(null)
        setIsDetecting(false)
        return
      }

      setIsDetecting(true)

      try {
        // Get appropriate detector based on auth status
        const detector = await DetectorFactory.getDetector({
          preferredDetector: isAuthenticated ? 'magika' : undefined,
          fallbackToHighlightJs: true,
        })

        const result = await detector.detect(code)
        setDetectionResult(result)

        // Notify parent component
        if (onLanguageDetected) {
          onLanguageDetected(result.language, result)
        }
      } catch (error) {
        console.error('Language detection failed:', error)
        setDetectionResult(null)
      } finally {
        setIsDetecting(false)
      }
    }, 1000), // 1 second debounce
    [isAuthenticated, onLanguageDetected]
  )

  // Trigger detection when content changes
  useEffect(() => {
    detectLanguage(value)
  }, [value, detectLanguage])

  // Preload Magika for authenticated users
  useEffect(() => {
    if (isAuthenticated && !DetectorFactory.isMagikaReady()) {
      DetectorFactory.preloadMagika().catch((error) => {
        console.error('Failed to preload Magika:', error)
      })
    }
  }, [isAuthenticated])

  const contentLength = new TextEncoder().encode(value).length
  const maxSize = 100 * 1024 // 100KB
  const sizePercent = (contentLength / maxSize) * 100
  const sizeColor = sizePercent > 90 ? 'text-destructive' : sizePercent > 75 ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`font-mono min-h-[400px] ${error ? 'border-destructive' : ''}`}
      />

      <div className="flex items-center justify-between text-sm">
        <DetectionBadge result={detectionResult} isDetecting={isDetecting} />

        <span className={sizeColor}>
          {(contentLength / 1024).toFixed(2)} KB / {maxSize / 1024} KB
        </span>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  )
}
