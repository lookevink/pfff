import type * as PrettierType from 'prettier'

/**
 * Prettier formatter with JIT plugin loading
 *
 * Strategy:
 * - Load core Prettier lazily
 * - Load language plugins on-demand (built-in plugins only)
 * - Cache loaded modules for subsequent uses
 *
 * Supported languages:
 * - JavaScript, TypeScript (via babel/typescript plugins)
 * - HTML, CSS (via html/postcss plugins)
 * - JSON (built-in parser)
 * - YAML, Markdown (via yaml/markdown plugins)
 */

type PrettierModule = typeof PrettierType

let prettierCore: PrettierModule | null = null
const pluginCache = new Map<string, unknown>()

/**
 * Language to Prettier plugin mapping
 * Only includes plugins that ship with Prettier
 */
const LANGUAGE_PLUGINS: Record<string, string[]> = {
  javascript: ['estree', 'babel'],
  typescript: ['estree', 'typescript'],
  html: ['html'],
  css: ['postcss'],
  json: [], // Built-in, no plugin needed
  yaml: ['yaml'],
  markdown: ['markdown'],
}

/**
 * Language to Prettier parser mapping
 */
const LANGUAGE_PARSERS: Record<string, string> = {
  javascript: 'babel',
  typescript: 'typescript',
  html: 'html',
  css: 'css',
  json: 'json',
  yaml: 'yaml',
  markdown: 'markdown',
}

export interface FormatResult {
  formatted: string
  changed: boolean
  error?: string
}

export async function formatCode(code: string, language: string): Promise<FormatResult> {
  try {
    // Check if language is supported
    const parser = LANGUAGE_PARSERS[language]
    if (!parser) {
      return {
        formatted: code,
        changed: false,
        error: `Formatting not supported for ${language}`,
      }
    }

    // Load Prettier core
    if (!prettierCore) {
      prettierCore = await import('prettier')
    }

    // Load required plugins
    const pluginNames = LANGUAGE_PLUGINS[language] || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugins: any[] = []

    for (const pluginName of pluginNames) {
      if (!pluginCache.has(pluginName)) {
        try {
          const plugin = await loadPlugin(pluginName)
          pluginCache.set(pluginName, plugin)
        } catch (error) {
          console.error(`Failed to load plugin ${pluginName}:`, error)
          return {
            formatted: code,
            changed: false,
            error: `Failed to load formatting plugin for ${language}`,
          }
        }
      }
      plugins.push(pluginCache.get(pluginName))
    }

    // Format code
    const formatted = await prettierCore.format(code, {
      parser,
      plugins,
      printWidth: 80,
      tabWidth: 2,
      useTabs: false,
      semi: true,
      singleQuote: true,
      trailingComma: 'es5',
      bracketSpacing: true,
      arrowParens: 'always',
    })

    return {
      formatted,
      changed: formatted !== code,
    }
  } catch (error) {
    console.error('Formatting error:', error)
    return {
      formatted: code,
      changed: false,
      error: error instanceof Error ? error.message : 'Unknown formatting error',
    }
  }
}

async function loadPlugin(pluginName: string): Promise<unknown> {
  switch (pluginName) {
    case 'estree':
      return await import('prettier/plugins/estree')
    case 'babel':
      return await import('prettier/plugins/babel')
    case 'typescript':
      return await import('prettier/plugins/typescript')
    case 'html':
      return await import('prettier/plugins/html')
    case 'postcss':
      return await import('prettier/plugins/postcss')
    case 'markdown':
      return await import('prettier/plugins/markdown')
    case 'yaml':
      return await import('prettier/plugins/yaml')
    default:
      throw new Error(`Unknown plugin: ${pluginName}`)
  }
}

export function isFormattingSupported(language: string): boolean {
  return language in LANGUAGE_PARSERS
}
