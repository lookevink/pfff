import { Magika } from 'magika'
import type { LanguageDetector, DetectionResult } from './types'

/**
 * Magika-based language detector
 *
 * Pros:
 * - Very accurate (Google-trained ML model)
 * - Detects 100+ file types
 * - Good confidence scores
 *
 * Cons:
 * - Heavy (5MB WASM download)
 * - Async initialization
 * - Designed for files, not code snippets
 *
 * Usage: Only for authenticated users as a premium feature
 */
export class MagikaDetector implements LanguageDetector {
  name = 'magika' as const
  private magika: Magika | null = null
  private initPromise: Promise<void> | null = null

  isReady(): boolean {
    return this.magika !== null
  }

  async initialize(): Promise<void> {
    // Prevent multiple initializations
    if (this.initPromise) return this.initPromise
    if (this.magika) return

    this.initPromise = (async () => {
      try {
        console.log('Initializing Magika...')

        // Magika v1.0.0 uses static create() method
        // Browser caching is handled automatically by the library
        this.magika = await Magika.create()

        console.log('Magika initialized successfully')
      } catch (error) {
        console.error('Failed to initialize Magika:', error)
        this.magika = null
        this.initPromise = null
        throw error
      }
    })()

    return this.initPromise
  }

  async detect(code: string): Promise<DetectionResult> {
    if (!this.isReady()) {
      await this.initialize()
    }

    if (!this.magika) {
      throw new Error('Magika not initialized')
    }

    // Encode text to bytes
    const encoder = new TextEncoder()
    const bytes = encoder.encode(code)

    // Detect language
    const result = await this.magika.identifyBytes(bytes)

    return {
      language: this.mapMagikaLabel(result.prediction.output.label),
      confidence: result.prediction.score,
      detector: 'magika',
      raw: result,
    }
  }

  /**
   * Map Magika labels to our standard language names
   *
   * Magika uses different labels than our SUPPORTED_LANGUAGES
   */
  private mapMagikaLabel(label: string): string {
    const mapping: Record<string, string> = {
      'javascript': 'javascript',
      'js': 'javascript',
      'typescript': 'typescript',
      'ts': 'typescript',
      'python': 'python',
      'py': 'python',
      'java': 'java',
      'golang': 'go',
      'go': 'go',
      'rust': 'rust',
      'rs': 'rust',
      'c++': 'cpp',
      'cpp': 'cpp',
      'c': 'c',
      'csharp': 'csharp',
      'cs': 'csharp',
      'php': 'php',
      'ruby': 'ruby',
      'rb': 'ruby',
      'swift': 'swift',
      'kotlin': 'kotlin',
      'kt': 'kotlin',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'markdown': 'markdown',
      'md': 'markdown',
      'bash': 'bash',
      'sh': 'bash',
      'shell': 'shell',
      'plaintext': 'text',
      'txt': 'text',
    }

    return mapping[label.toLowerCase()] || 'text'
  }

  async dispose(): Promise<void> {
    this.magika = null
    this.initPromise = null
  }
}
