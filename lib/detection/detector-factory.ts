import { HighlightJsDetector } from './highlight-detector'
import { MagikaDetector } from './magika-detector'
import type { LanguageDetector, DetectorConfig } from './types'

/**
 * Factory for creating and managing language detectors
 *
 * Strategy:
 * - Anonymous users: Highlight.js (fast, lightweight)
 * - Authenticated users: Magika (accurate, cached)
 * - Always fallback to Highlight.js if Magika fails
 */
export class DetectorFactory {
  private static highlightDetector: HighlightJsDetector | null = null
  private static magikaDetector: MagikaDetector | null = null
  private static magikaInitializing: boolean = false

  /**
   * Get the appropriate detector based on config
   */
  static async getDetector(config: DetectorConfig = {}): Promise<LanguageDetector> {
    const {
      preferredDetector,
      fallbackToHighlightJs = true,
    } = config

    // If user prefers Magika (authenticated users)
    if (preferredDetector === 'magika') {
      try {
        // Create Magika instance if needed
        if (!this.magikaDetector) {
          this.magikaDetector = new MagikaDetector()
        }

        // If Magika is ready, use it
        if (this.magikaDetector.isReady()) {
          return this.magikaDetector
        }

        // If Magika is initializing, use Highlight.js temporarily
        if (this.magikaInitializing) {
          console.log('Magika initializing, using Highlight.js temporarily')
          return this.getHighlightDetector()
        }

        // Start initializing Magika
        if (fallbackToHighlightJs) {
          // Non-blocking: Initialize in background
          this.magikaInitializing = true
          this.magikaDetector
            .initialize()
            .then(() => {
              console.log('Magika ready for next detection')
              this.magikaInitializing = false
            })
            .catch((error) => {
              console.error('Magika initialization failed:', error)
              this.magikaDetector = null
              this.magikaInitializing = false
            })

          // Use Highlight.js immediately
          return this.getHighlightDetector()
        } else {
          // Blocking: Wait for Magika
          this.magikaInitializing = true
          await this.magikaDetector.initialize()
          this.magikaInitializing = false
          return this.magikaDetector
        }
      } catch (error) {
        console.error('Failed to load Magika:', error)

        if (fallbackToHighlightJs) {
          console.log('Falling back to Highlight.js')
          return this.getHighlightDetector()
        }
        throw error
      }
    }

    // Default: Use Highlight.js
    return this.getHighlightDetector()
  }

  /**
   * Get Highlight.js detector (singleton)
   */
  private static getHighlightDetector(): HighlightJsDetector {
    if (!this.highlightDetector) {
      this.highlightDetector = new HighlightJsDetector()
    }
    return this.highlightDetector
  }

  /**
   * Preload Magika for authenticated users
   * Call this when user logs in to start downloading WASM
   */
  static async preloadMagika(): Promise<void> {
    try {
      if (!this.magikaDetector) {
        this.magikaDetector = new MagikaDetector()
      }

      if (this.magikaDetector.isReady()) {
        return
      }

      console.log('Preloading Magika for authenticated user...')
      await this.magikaDetector.initialize()
      console.log('Magika preloaded successfully')
    } catch (error) {
      console.error('Failed to preload Magika:', error)
      this.magikaDetector = null
    }
  }

  /**
   * Check if Magika is ready
   */
  static isMagikaReady(): boolean {
    return this.magikaDetector?.isReady() ?? false
  }

  /**
   * Cleanup all detectors
   */
  static async dispose(): Promise<void> {
    if (this.magikaDetector) {
      await this.magikaDetector.dispose()
      this.magikaDetector = null
    }
    this.highlightDetector = null
    this.magikaInitializing = false
  }
}
