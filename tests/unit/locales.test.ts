import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Guards the homegrown i18n's two blind spots:
 *  1. a typo'd literal `t('cat.key')` only fails at runtime (renders the key)
 *  2. locale files could drift from the `{ en, zh }` shape unnoticed
 *
 * Key resolution mirrors dataLoader: app/character/artifact/game keys are flat
 * filenames (subfolders are organizational); wandwars prefixes subfolder files
 * with the folder name (`messages/...`, `insights/...`).
 *
 * Dynamically-built keys (`app.${tag}`, `wandwars.messages/confidence-…`) are
 * out of scope here — only literal call sites are checked.
 */

const LOCALES_DIR = 'src/locales'
const T_CATEGORIES = ['app', 'character', 'artifact', 'game', 'wandwars'] as const

function walkJsonFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkJsonFiles(full))
    else if (entry.endsWith('.json')) out.push(full)
  }
  return out
}

function walkSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'locales' || entry === 'assets' || entry === 'data') continue
      out.push(...walkSourceFiles(full))
    } else if (entry.endsWith('.ts') || entry.endsWith('.vue')) {
      out.push(full)
    }
  }
  return out
}

function loadCategoryKeys(category: string): Map<string, Record<string, unknown>> {
  const dir = join(LOCALES_DIR, category)
  // Mirror the loaders' glob depth: app and wandwars use `**` (recursive);
  // character/artifact/game use `*` (their subfolders — e.g. artifact/effects —
  // belong to other loaders with different shapes)
  const recursive = category === 'app' || category === 'wandwars'
  const prefixSubfolders = category === 'wandwars'
  const files = recursive
    ? walkJsonFiles(dir)
    : readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => join(dir, f))
  const keys = new Map<string, Record<string, unknown>>()
  for (const file of files) {
    const parts = file.split('/')
    const folder = parts[parts.length - 2]!
    const name = parts[parts.length - 1]!.replace(/\.json$/, '')
    const key = prefixSubfolders && folder !== category ? `${folder}/${name}` : name
    keys.set(key, JSON.parse(readFileSync(file, 'utf-8')))
  }
  return keys
}

describe('locale files', () => {
  const dicts = new Map(T_CATEGORIES.map((c) => [c as string, loadCategoryKeys(c)]))

  it('every entry has exactly { en, zh } string values', () => {
    for (const [category, entries] of dicts) {
      for (const [key, value] of entries) {
        expect(Object.keys(value).sort(), `${category}.${key}`).toEqual(['en', 'zh'])
        expect(typeof value.en, `${category}.${key}.en`).toBe('string')
        expect(typeof value.zh, `${category}.${key}.zh`).toBe('string')
      }
    }
  })

  it('every literal t() key in src resolves to an existing entry', () => {
    const used = new Set<string>()
    for (const file of walkSourceFiles('src')) {
      const content = readFileSync(file, 'utf-8')
      // t('cat.name') / i18n.t('cat.name') — the leading non-letter excludes
      // identifiers that merely end in t (formatPercent, parseFloat, .at)
      for (const m of content.matchAll(/[^a-zA-Z]t\(\s*'([a-z][a-z0-9-]*\.[A-Za-z0-9/_-]+)'/g)) {
        used.add(m[1]!)
      }
      // ti('name') in the insights builders resolves to wandwars.insights/<name>
      if (file.includes('wandwars/insights')) {
        for (const m of content.matchAll(/\bti\(\s*'([a-z0-9-]+)'/g)) {
          used.add(`wandwars.insights/${m[1]!}`)
        }
      }
    }

    expect(used.size).toBeGreaterThan(50) // sanity: the scan actually found keys

    const missing: string[] = []
    for (const key of used) {
      const [category, ...rest] = key.split('.')
      const dict = dicts.get(category!)
      if (!dict) continue // not an i18n category (e.g. unrelated dotted string)
      if (!dict.has(rest.join('.'))) missing.push(key)
    }

    expect(missing).toEqual([])
  })
})
