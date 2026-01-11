'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createPasteSchema, SUPPORTED_LANGUAGES, EXPIRATION_OPTIONS } from '@/lib/schemas/paste.schema'
import type { CreatePasteInput } from '@/lib/schemas/paste.schema'
import { Textarea } from '@/components/ui/textarea'
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

export function PasteForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CreatePasteInput>({
    resolver: zodResolver(createPasteSchema),
    defaultValues: {
      content: '',
      language: 'text',
      expiresIn: '7d',
    },
  })

  const content = watch('content')
  const contentSize = new TextEncoder().encode(content).length
  const maxSize = 100 * 1024 // 100KB

  const onSubmit = async (data: CreatePasteInput) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/pastes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          metadata: {
            clientVersion: '1.0.0',
            languageDetector: 'manual',
          },
        }),
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
          {/* Content Textarea */}
          <div className="space-y-2">
            <Label htmlFor="content">
              Content
              <span className="ml-2 text-xs text-muted-foreground">
                ({(contentSize / 1024).toFixed(1)}KB / {maxSize / 1024}KB)
              </span>
            </Label>
            <Textarea
              id="content"
              placeholder="Paste your code here..."
              className="min-h-[400px] font-mono text-sm resize-y"
              {...register('content')}
            />
            {errors.content && (
              <p className="text-sm text-destructive">{errors.content.message}</p>
            )}
          </div>

          {/* Language Select */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select
                defaultValue="text"
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
