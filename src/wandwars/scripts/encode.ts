/**
 * Combine every *.data file under `src/wandwars/data/raw/` into one
 * base64-encoded blob at `src/wandwars/data/data`. File names are arbitrary
 * (e.g. `milan.data`, `unii.data`) so contributors can name their uploads
 * after themselves; the final encoded output is agnostic of origin.
 *
 * Usage: npx tsx src/wandwars/scripts/encode.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RAW_DIR = join(import.meta.dirname!, '../data/raw')
const OUT_FILE = join(import.meta.dirname!, '../data/data')

const files = readdirSync(RAW_DIR)
  .filter((name) => name.toLowerCase().endsWith('.data'))
  .sort()

if (files.length === 0) {
  console.error(`No .data files found in ${RAW_DIR}`)
  process.exit(1)
}

const chunks: string[] = []
const includedFiles: string[] = []
for (const name of files) {
  const content = readFileSync(join(RAW_DIR, name), 'utf-8').replace(/\s+$/, '')
  if (!content) continue // skip files with no records (empty marker is noise)
  // Prepend a `// <filename>` marker so origin is visible when the blob is
  // decoded for debugging. `parser.ts` skips any line starting with `//`.
  chunks.push(`// ${name}\n${content}\n`)
  includedFiles.push(name)
}

// Join with a blank line between sections for readability on decode.
const combined = chunks.join('\n')
writeFileSync(OUT_FILE, Buffer.from(combined, 'utf-8').toString('base64'))

const lines = combined.split('\n').filter((l) => l.trim() && !l.startsWith('//')).length
console.log(`Encoded ${includedFiles.length} file(s), ${lines} record(s) → ${OUT_FILE}`)
for (const name of includedFiles) console.log(`  ${name}`)
const skipped = files.filter((f) => !includedFiles.includes(f))
if (skipped.length > 0) console.log(`Skipped (empty): ${skipped.join(', ')}`)
