/**
 * Language detection types and interfaces
 *
 * Abstraction layer that allows swapping between different detection engines
 * (Highlight.js, Magika, etc.) without changing consuming code
 */

export interface DetectionResult {
  language: string
  confidence: number  // 0-1 scale (0 = no confidence, 1 = 100% confident)
  detector: 'highlight.js' | 'magika'
  raw?: unknown  // Original result from detector (for debugging)
}

export interface LanguageDetector {
  name: 'highlight.js' | 'magika'

  /**
   * Detect language from code snippet
   */
  detect(code: string): Promise<DetectionResult>

  /**
   * Check if detector is initialized and ready to use
   */
  isReady(): boolean

  /**
   * Initialize detector (async for WASM-based detectors)
   */
  initialize?(): Promise<void>

  /**
   * Cleanup resources (for WASM memory management)
   */
  dispose?(): Promise<void>
}

export interface DetectorConfig {
  preferredDetector?: 'highlight.js' | 'magika'
  fallbackToHighlightJs?: boolean  // If preferred detector fails
  cacheMagika?: boolean             // Store WASM in IndexedDB
  minContentLength?: number         // Minimum code length to detect (default: 50)
}
