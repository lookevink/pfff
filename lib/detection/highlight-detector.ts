import hljs from 'highlight.js/lib/core'
import type { LanguageDetector, DetectionResult } from './types'
import { SUPPORTED_LANGUAGES } from '@/lib/schemas/paste.schema'

// Import language definitions
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import cpp from 'highlight.js/lib/languages/cpp'
import c from 'highlight.js/lib/languages/c'
import csharp from 'highlight.js/lib/languages/csharp'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import sql from 'highlight.js/lib/languages/sql'
import xml from 'highlight.js/lib/languages/xml' // for HTML
import css from 'highlight.js/lib/languages/css'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import markdown from 'highlight.js/lib/languages/markdown'
import bash from 'highlight.js/lib/languages/bash'
import shell from 'highlight.js/lib/languages/shell'

/**
 * Highlight.js-based language detector
 *
 * Pros:
 * - Lightweight (~50KB per language, tree-shakeable)
 * - Synchronous (instant detection)
 * - Already needed for syntax highlighting
 * - Built specifically for code detection
 *
 * Cons:
 * - Less accurate than ML models (but good enough for code)
 * - Only detects programming languages
 */
export class HighlightJsDetector implements LanguageDetector {
  name = 'highlight.js' as const
  private initialized = false

  constructor() {
    // Initialize synchronously in constructor
    this.initialize()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    // Register all supported languages
    hljs.registerLanguage('javascript', javascript)
    hljs.registerLanguage('typescript', typescript)
    hljs.registerLanguage('python', python)
    hljs.registerLanguage('java', java)
    hljs.registerLanguage('go', go)
    hljs.registerLanguage('rust', rust)
    hljs.registerLanguage('cpp', cpp)
    hljs.registerLanguage('c', c)
    hljs.registerLanguage('csharp', csharp)
    hljs.registerLanguage('php', php)
    hljs.registerLanguage('ruby', ruby)
    hljs.registerLanguage('swift', swift)
    hljs.registerLanguage('kotlin', kotlin)
    hljs.registerLanguage('sql', sql)
    hljs.registerLanguage('html', xml)
    hljs.registerLanguage('css', css)
    hljs.registerLanguage('json', json)
    hljs.registerLanguage('yaml', yaml)
    hljs.registerLanguage('markdown', markdown)
    hljs.registerLanguage('bash', bash)
    hljs.registerLanguage('shell', shell)

    this.initialized = true
  }

  isReady(): boolean {
    return this.initialized
  }

  async detect(code: string): Promise<DetectionResult> {
    if (!this.isReady()) {
      await this.initialize()
    }

    // Use highlightAuto with our supported languages
    const result = hljs.highlightAuto(code, SUPPORTED_LANGUAGES.filter(lang => lang !== 'text'))

    return {
      language: result.language || 'text',
      confidence: this.normalizeRelevance(result.relevance),
      detector: 'highlight.js',
      raw: result,
    }
  }

  /**
   * Normalize Highlight.js relevance score to 0-1 range
   *
   * Highlight.js relevance is typically 0-20 for matches
   * We normalize this to a 0-1 confidence score
   */
  private normalizeRelevance(relevance: number): number {
    // Typical relevance ranges:
    // 0-5: Low confidence
    // 5-10: Medium confidence
    // 10-20: High confidence
    // 20+: Very high confidence (rare)

    return Math.min(relevance / 20, 1)
  }
}
