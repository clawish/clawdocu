#!/usr/bin/env node

/**
 * Migration script: Convert separate comment files to single comments.json
 * 
 * Usage: node scripts/migrate-comments.mjs
 * 
 * This script:
 * 1. Reads all JSON files from .clawdocu-comments/
 * 2. Converts them to the new format
 * 3. Creates .clawdocu/comments.json
 */

import fs from 'fs'
import path from 'path'

const OLD_DIR = '.clawdocu-comments'
const NEW_DIR = '.clawdocu'
const NEW_FILE = 'comments.json'

console.log('🔄 ClawDocu Comment Migration Script')
console.log('=====================================\n')

// Check if old directory exists
if (!fs.existsSync(OLD_DIR)) {
  console.log('✅ No .clawdocu-comments/ directory found.')
  console.log('   Your comments are already in the new format or you have no comments yet.')
  process.exit(0)
}

// Read all JSON files from old directory
const files = []
const oldFiles = fs.readdirSync(OLD_DIR, { recursive: true, withFileTypes: false })

for (const file of oldFiles) {
  if (!file.endsWith('.json')) continue
  
  const filePath = file.toString()
  const fullPath = path.join(OLD_DIR, filePath)
  
  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    const data = JSON.parse(content)
    
    // Remove .json extension to get the original file path
    const originalPath = filePath.replace(/\.json$/, '')
    
    files.push({
      path: originalPath,
      comments: data.comments || []
    })
    
    console.log(`✓ Migrated: ${originalPath} (${data.comments?.length || 0} comments)`)
  } catch (e) {
    console.error(`✗ Failed to read ${filePath}:`, e.message)
  }
}

// Create new structure
const newStructure = { files }

// Create new directory if it doesn't exist
if (!fs.existsSync(NEW_DIR)) {
  fs.mkdirSync(NEW_DIR, { recursive: true })
}

// Write new file
const newFilePath = path.join(NEW_DIR, NEW_FILE)
fs.writeFileSync(newFilePath, JSON.stringify(newStructure, null, 2))

console.log(`\n✅ Migration complete!`)
console.log(`   Created: ${newFilePath}`)
console.log(`   Total files: ${files.length}`)
console.log(`   Total comments: ${files.reduce((sum, f) => sum + f.comments.length, 0)}`)
console.log(`\n⚠️  Next steps:`)
console.log(`   1. Verify the new file: cat ${newFilePath}`)
console.log(`   2. Test in ClawDocu UI`)
console.log(`   3. Delete old directory: rm -rf ${OLD_DIR}`)
console.log(`   4. Commit: git add ${NEW_DIR} && git rm -r ${OLD_DIR}`)
