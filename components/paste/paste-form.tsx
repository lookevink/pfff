'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { SUPPORTED_LANGUAGES, EXPIRATION_OPTIONS } from '@/lib/schemas/paste.schema'
import type { CreatePasteInput } from '@/lib/schemas/paste.schema'
import type { DetectionResult } from '@/lib/detection/types'
import { z } from 'zod'

// Form-specific schema with required fields for react-hook-form
const pasteFormSchema = z.object({
  content: z.string().min(1).max(100 * 1024),
  language: z.enum(SUPPORTED_LANGUAGES),
  expiresIn: z.enum(EXPIRATION_OPTIONS),
})

type PasteFormInput = z.infer<typeof pasteFormSchema>
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, FileCode } from 'lucide-react'
import { CodeEditor } from './code-editor'
import { FormatButton } from './format-button'
import { ViewModeToggle, type ViewMode } from './view-mode-toggle'
import { LivePreview } from './live-preview'
import { Textarea } from '@/components/ui/textarea'

export function PasteForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('editor')

  const {
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PasteFormInput>({
    resolver: zodResolver(pasteFormSchema),
    defaultValues: {
      content: '',
      language: 'text',
      expiresIn: '7d',
    },
  })

  const content = watch('content')
  const language = watch('language')

  const handleLanguageDetected = (language: string, result: DetectionResult) => {
    setDetectionResult(result)
    // Auto-update language field if confidence is high
    if (result.confidence >= 0.7) {
      setValue('language', language as any)
    }
  }

  // Trigger detection in preview/split modes too
  useEffect(() => {
    if ((viewMode === 'preview' || viewMode === 'split') && content && !detectionResult) {
      import('@/lib/detection/detector-factory').then(({ DetectorFactory }) => {
        DetectorFactory.getDetector().then((detector) => {
          detector.detect(content).then((result) => {
            handleLanguageDetected(result.language, result)
          })
        })
      })
    }
  }, [viewMode, content, detectionResult])

  const handleFormat = (formattedCode: string) => {
    setValue('content', formattedCode)
  }

  const onSubmit = async (data: PasteFormInput) => {
    // Convert form data to API format
    const payload: CreatePasteInput = {
      content: data.content,
      language: data.language,
      expiresIn: data.expiresIn,
      metadata: {
        clientVersion: '2.0.0',
        detectedLanguage: detectionResult?.language,
        languageConfidence: detectionResult?.confidence,
        languageDetector: detectionResult?.detector,
      },
    }
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/pastes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create paste')
      }

      // Redirect to paste view
      router.push(`/${result.data.slug}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileCode className="w-5 h-5" />
          Create New Paste
        </CardTitle>
        <CardDescription>
          Share code snippets with syntax highlighting and expiration options
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Code Editor with View Modes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content</Label>
              <div className="flex items-center gap-2">
                <ViewModeToggle
                  mode={viewMode}
                  onModeChange={setViewMode}
                  disabled={isSubmitting}
                />
                <FormatButton
                  code={content}
                  language={language}
                  onFormat={handleFormat}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Editor Only Mode */}
            {viewMode === 'editor' && (
              <CodeEditor
                value={content}
                onChange={(value) => setValue('content', value)}
                onLanguageDetected={handleLanguageDetected}
                error={errors.content?.message}
                disabled={isSubmitting}
                isAuthenticated={false} // TODO: Connect to auth system
              />
            )}

            {/* Preview Only Mode */}
            {viewMode === 'preview' && (
              <div className="relative rounded-md border overflow-hidden min-h-[400px]">
                <LivePreview
                  code={content}
                  language={language}
                  showLineNumbers={true}
                />
              </div>
            )}

            {/* Split View Mode */}
            {viewMode === 'split' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Editor</Label>
                  <Textarea
                    value={content}
                    onChange={(e) => setValue('content', e.target.value)}
                    placeholder="Paste your code here..."
                    disabled={isSubmitting}
                    className={`font-mono min-h-[400px] ${errors.content ? 'border-destructive' : ''}`}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Preview</Label>
                  <div className="relative rounded-md border overflow-hidden min-h-[400px]">
                    <LivePreview
                      code={content}
                      language={language}
                      showLineNumbers={true}
                    />
                  </div>
                </div>
              </div>
            )}

            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          {/* Language Select */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                value={language}
                onValueChange={(value) => setValue('language', value as any)}
              >
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.language && (
                <p className="text-sm text-destructive">{errors.language.message}</p>
              )}
            </div>

            {/* Expiration Select */}
            <div className="space-y-2">
              <Label htmlFor="expiresIn">Expiration</Label>
              <Select
                defaultValue="7d"
                onValueChange={(value) => setValue('expiresIn', value as any)}
              >
                <SelectTrigger id="expiresIn">
                  <SelectValue placeholder="Select expiration" />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === '1h' && '1 Hour'}
                      {option === '1d' && '1 Day'}
                      {option === '7d' && '7 Days'}
                      {option === 'never' && 'Never (Auth Required)'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.expiresIn && (
                <p className="text-sm text-destructive">{errors.expiresIn.message}</p>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Paste'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
