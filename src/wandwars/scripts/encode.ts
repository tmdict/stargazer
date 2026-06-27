/**
 * Combine every *.data file under `src/wandwars/data/raw/<patch>/` into one
 * base64-encoded blob at `src/wandwars/data/data`. Patch folders are named by
 * the patch identifier (e.g. `202604_1.6.3`: date YYYYMM, underscore,
 * game version). Within a patch, file names are arbitrary so contributors can
 * name uploads after themselves; the encoded output is agnostic of origin.
 *
 * Each file section is preceded by a directive line:
 *   // @patch <id> @data <filename>
 *
 * `parser.ts` reads the `@patch` directive and attaches it to each subsequent
 * `MatchResult`. `@data` is informational (preserved so contributor origin is
 * visible when the blob is decoded for debugging).
 *
 * Layout of the encoded blob: files within a patch are joined tight (no blank
 * lines between sections); a single blank line separates one patch from the
 * next, for human readability when the blob is decoded.
 *
 * Usage: npx tsx src/wandwars/scripts/encode.ts
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const RAW_DIR = join(import.meta.dirname!, '../data/raw')
const OUT_FILE = join(import.meta.dirname!, '../data/data')

// Patch folders look like `202604_1.6.3`: YYYYMM date, underscore, semver-ish.
const PATCH_DIR_RE = /^\d{6}_\d+(?:\.\d+)*$/

const patchDirs = readdirSync(RAW_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && PATCH_DIR_RE.test(d.name))
  .map((d) => d.name)
  .sort() // chronological by construction (date prefix)

if (patchDirs.length === 0) {
  console.error(`No patch folders found in ${RAW_DIR} (expected names like 202604_1.6.3)`)
  process.exit(1)
}

const patchBlocks: string[] = []
const summary: { patch: string; files: string[]; records: number }[] = []

for (const patch of patchDirs) {
  const patchPath = join(RAW_DIR, patch)
  const files = readdirSync(patchPath)
    .filter((name) => name.toLowerCase().endsWith('.data'))
    .sort()

  const fileChunks: string[] = []
  const includedFiles: string[] = []
  let recordCount = 0

  for (const name of files) {
    const content = readFileSync(join(patchPath, name), 'utf-8').replace(/\s+$/, '')
    if (!content) continue
    fileChunks.push(`// @patch ${patch} @data ${name}\n${content}\n`)
    includedFiles.push(name)
    recordCount += content.split('\n').filter((l) => l.trim()).length
  }

  if (fileChunks.length === 0) continue

  patchBlocks.push(fileChunks.join(''))
  summary.push({ patch, files: includedFiles, records: recordCount })
}

// Single blank line between patches; tight within a patch.
const combined = patchBlocks.join('\n')
writeFileSync(OUT_FILE, Buffer.from(combined, 'utf-8').toString('base64'))

const totalRecords = summary.reduce((n, p) => n + p.records, 0)
const totalFiles = summary.reduce((n, p) => n + p.files.length, 0)
console.log(
  `Encoded ${summary.length} patch(es), ${totalFiles} file(s), ${totalRecords} record(s) → ${OUT_FILE}`,
)
for (const { patch, files } of summary) {
  console.log(`  ${patch}`)
  for (const name of files) console.log(`    ${name}`)
}
