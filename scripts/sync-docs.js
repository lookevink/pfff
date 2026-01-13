#!/usr/bin/env node

/**
 * Documentation Sync Script
 *
 * Updates the .claude/context.md file with the current timestamp.
 * In the future, this can be expanded to auto-generate from docs/ directory.
 */

const fs = require('fs')
const path = require('path')

const CONTEXT_FILE = path.join(__dirname, '..', '.claude', 'context.md')

// Get current date in YYYY-MM-DD format
const today = new Date().toISOString().split('T')[0]

try {
  // Read the context file
  let content = fs.readFileSync(CONTEXT_FILE, 'utf-8')

  // Update the timestamp line
  content = content.replace(
    /\*\*Auto-generated context for LLM agents\. Last updated: \d{4}-\d{2}-\d{2}\*\*/,
    `**Auto-generated context for LLM agents. Last updated: ${today}**`
  )

  // Write back
  fs.writeFileSync(CONTEXT_FILE, content, 'utf-8')

  console.log('✅ Documentation synced successfully!')
  console.log(`   Updated: .claude/context.md (${today})`)
  console.log('\n💡 Future enhancement: Auto-generate from docs/ directory')
} catch (error) {
  console.error('❌ Failed to sync documentation:', error.message)
  process.exit(1)
}
