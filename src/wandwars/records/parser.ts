import type { MatchNote, MatchResult } from '../types'

// Sweep wins (>> / <<) weight 2.0: a sweep guarantees every surviving unit
// contributed to the win, making it stronger evidence than a regular win (1.0).
const RESULT_SYMBOLS: Record<string, { result: 'left' | 'right' | 'draw'; weight: number }> = {
  '>>': { result: 'left', weight: 2.0 },
  '>': { result: 'left', weight: 1.0 },
  '<<': { result: 'right', weight: 2.0 },
  '<': { result: 'right', weight: 1.0 },
  '=': { result: 'draw', weight: 1.0 },
}

function parseNotes(raw: string): MatchNote[] {
  const text = raw.trim()
  if (!text) return []

  const heroes: string[] = []
  const heroPattern = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = heroPattern.exec(text)) !== null) {
    if (match[1]) heroes.push(match[1])
  }

  return [{ text, heroes }]
}

function parseHeroes(raw: string): [string, string, string] | null {
  const heroes = raw.split(',').map((h) => h.trim())
  if (heroes.length !== 3 || heroes.some((h) => !h)) return null
  return heroes as [string, string, string]
}

// Captures the value following `@patch ` on a directive line (whitespace-delimited).
// Lines look like: `// @patch 202604_1.6.3 @data <filename>`
const PATCH_DIRECTIVE_RE = /@patch\s+(\S+)/

/**
 * Parse encoded WandWars match data into structured `MatchResult` records.
 *
 * `rawText` is expected to begin with one or more `// @patch <id>` directive
 * lines (emitted by `encode.ts`). The parser tracks the most-recent directive
 * while walking lines so every match inherits the patch it was recorded under.
 * Match lines encountered before any directive are skipped with a warning.
 */
export function parseMatchData(rawText: string): MatchResult[] {
  const allLines = rawText.split('\n')
  const results: MatchResult[] = []
  const warnings: string[] = []
  let currentPatch: string | undefined

  for (let i = 0; i < allLines.length; i++) {
    const raw = allLines[i]!
    const trimmed = raw.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('//')) {
      const m = PATCH_DIRECTIVE_RE.exec(trimmed)
      if (m) currentPatch = m[1]
      continue
    }

    const line = trimmed

    // Split notes from match data
    const semicolonIdx = line.indexOf(';')
    const matchPart = semicolonIdx >= 0 ? line.slice(0, semicolonIdx) : line
    const notesPart = semicolonIdx >= 0 ? line.slice(semicolonIdx + 1) : ''

    // Find the result symbol (try longer symbols first)
    let resultSymbol: string | null = null
    let leftPart = ''
    let rightPart = ''

    for (const symbol of ['>>', '<<', '>', '<', '=']) {
      // Match symbol surrounded by spaces to avoid matching within hero names
      const idx = matchPart.indexOf(` ${symbol} `)
      if (idx >= 0) {
        resultSymbol = symbol
        leftPart = matchPart.slice(0, idx).trim()
        rightPart = matchPart.slice(idx + symbol.length + 2).trim()
        break
      }
    }

    if (!resultSymbol) {
      warnings.push(`Line ${i + 1}: Could not find result symbol`)
      continue
    }

    const left = parseHeroes(leftPart)
    const right = parseHeroes(rightPart)

    if (!left) {
      warnings.push(`Line ${i + 1}: Invalid left team "${leftPart}"`)
      continue
    }
    if (!right) {
      warnings.push(`Line ${i + 1}: Invalid right team "${rightPart}"`)
      continue
    }

    if (!currentPatch) {
      warnings.push(`Line ${i + 1}: No @patch directive seen before this match (skipped)`)
      continue
    }

    const { result, weight } = RESULT_SYMBOLS[resultSymbol]!
    const notes = parseNotes(notesPart)

    results.push({ left, right, result, weight, notes, patch: currentPatch })
  }

  if (warnings.length > 0) {
    console.warn('[WandWars Parser]', warnings.join('\n'))
  }

  return results
}

export function getUniqueHeroes(matches: MatchResult[]): string[] {
  const heroes = new Set<string>()
  for (const match of matches) {
    for (const hero of [...match.left, ...match.right]) {
      heroes.add(hero)
    }
  }
  return [...heroes].sort()
}
