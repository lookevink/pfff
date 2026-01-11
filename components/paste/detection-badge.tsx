import { Badge } from '@/components/ui/badge'
import type { DetectionResult } from '@/lib/detection/types'

interface DetectionBadgeProps {
  result: DetectionResult | null
  isDetecting?: boolean
}

export function DetectionBadge({ result, isDetecting = false }: DetectionBadgeProps) {
  if (isDetecting) {
    return (
      <Badge variant="outline" className="text-xs">
        Detecting...
      </Badge>
    )
  }

  if (!result) {
    return null
  }

  const confidencePercent = Math.round(result.confidence * 100)
  const confidenceColor = getConfidenceColor(result.confidence)

  return (
    <Badge variant="outline" className="text-xs gap-1.5">
      <span>Detected: {formatLanguage(result.language)}</span>
      <span className={confidenceColor}>({confidencePercent}%)</span>
      <span className="text-muted-foreground">via {result.detector}</span>
    </Badge>
  )
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400'
  if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

function formatLanguage(language: string): string {
  const displayNames: Record<string, string> = {
    javascript: 'JavaScript',
    typescript: 'TypeScript',
    python: 'Python',
    java: 'Java',
    go: 'Go',
    rust: 'Rust',
    cpp: 'C++',
    c: 'C',
    csharp: 'C#',
    php: 'PHP',
    ruby: 'Ruby',
    swift: 'Swift',
    kotlin: 'Kotlin',
    sql: 'SQL',
    html: 'HTML',
    css: 'CSS',
    json: 'JSON',
    yaml: 'YAML',
    markdown: 'Markdown',
    bash: 'Bash',
    shell: 'Shell',
    text: 'Plain Text',
  }

  return displayNames[language] || language.charAt(0).toUpperCase() + language.slice(1)
}
