import hljs from 'highlight.js/lib/core'
import { SUPPORTED_LANGUAGES } from '@/lib/schemas/paste.schema'

// Import language definitions (reuse from detection)
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
 * Syntax highlighter using Highlight.js
 *
 * Benefits:
 * - Reuses detection library (no extra bundle)
 * - Server-side safe (can run during SSR)
 * - Returns HTML string with class names
 * - Works with any Highlight.js CSS theme
 */

let initialized = false

function ensureInitialized() {
  if (initialized) return

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

  initialized = true
}

export interface HighlightResult {
  html: string
  language: string
  relevance: number
}

/**
 * Highlight code with specified language
 *
 * @param code - Source code to highlight
 * @param language - Language identifier (must be in SUPPORTED_LANGUAGES)
 * @returns HTML string with syntax highlighting class names
 */
export function highlightCode(code: string, language: string): HighlightResult {
  ensureInitialized()

  // Validate language
  if (!SUPPORTED_LANGUAGES.includes(language as any)) {
    console.warn(`Unsupported language: ${language}, falling back to plaintext`)
    return {
      html: escapeHtml(code),
      language: 'text',
      relevance: 0,
    }
  }

  // Don't highlight plaintext
  if (language === 'text') {
    return {
      html: escapeHtml(code),
      language: 'text',
      relevance: 0,
    }
  }

  try {
    const result = hljs.highlight(code, { language })
    return {
      html: result.value,
      language: result.language || language,
      relevance: result.relevance,
    }
  } catch (error) {
    console.error(`Highlighting failed for ${language}:`, error)
    return {
      html: escapeHtml(code),
      language: 'text',
      relevance: 0,
    }
  }
}

/**
 * Auto-detect language and highlight
 *
 * @param code - Source code to highlight
 * @returns HTML string with syntax highlighting class names
 */
export function highlightAuto(code: string): HighlightResult {
  ensureInitialized()

  try {
    const result = hljs.highlightAuto(code, SUPPORTED_LANGUAGES.filter(lang => lang !== 'text'))
    return {
      html: result.value,
      language: result.language || 'text',
      relevance: result.relevance,
    }
  } catch (error) {
    console.error('Auto-highlighting failed:', error)
    return {
      html: escapeHtml(code),
      language: 'text',
      relevance: 0,
    }
  }
}

/**
 * Escape HTML entities for safe display
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char])
}
