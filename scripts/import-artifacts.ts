// Artifact effect-text importer.
//
// Split of ownership: structural records (src/data/artifact/,
// src/data/seasonal/artifact/) and the display-name locale files (curated
// short names; the feed's en names carry a "Spell" suffix) are hand-written.
// This script owns only the per-level effect text, which is feed-verbatim and
// balance-patchable:
//   src/locales/artifact/effects/<slug>.json            pre-season set
//   src/locales/seasonal/artifact/effects/<slug>.json   seasonal set
//
// Everything hand-written is linted against the feed instead of generated:
// existence both ways, dir placement matching the feed's set, stat values
// matching statBonuses, and a name locale file per artifact. A balance patch
// fails the import loudly instead of drifting silently.
//
// Usage:
//   npm run import:artifacts                          # reads DEFAULT_SRC_DIR/<feed>/artifacts.json
//   npm run import:artifacts -- --src-dir <PATH> | --url-base <URL>
//   npm run import:artifacts -- --retire              # delete the seasonal effect files only
//
// Rotation and --retire touch the seasonal subset only; the pre-season six are
// permanent. An absent or unreadable feed is a hard error, never a silent wipe.

import { existsSync } from 'node:fs'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isAppLocale, SKILL_LOCALES, type AppLocale } from '../src/lib/types/i18n.ts'
import {
  arg,
  cleanDescription,
  DEFAULT_SRC_DIR,
  hasFlag,
  writeTextIfChanged,
} from './lib/shared.ts'

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')

// Everything under a seasonal/ dir is wholesale-replaceable at rollover; the
// pre-season trees are permanent.
const TREES = {
  'pre-season': {
    data: join(PROJECT_ROOT, 'src', 'data', 'artifact'),
    names: join(PROJECT_ROOT, 'src', 'locales', 'artifact'),
    effects: join(PROJECT_ROOT, 'src', 'locales', 'artifact', 'effects'),
  },
  season: {
    data: join(PROJECT_ROOT, 'src', 'data', 'seasonal', 'artifact'),
    names: join(PROJECT_ROOT, 'src', 'locales', 'seasonal', 'artifact'),
    effects: join(PROJECT_ROOT, 'src', 'locales', 'seasonal', 'artifact', 'effects'),
  },
} as const

type ArtifactSet = keyof typeof TREES

// Feed stat codes → the structural files' stats keys.
const STAT_KEY: Record<string, string> = {
  HP: 'hp',
  ATK: 'atk',
  DEF: 'def',
  ARM: 'phys-def',
  MR: 'magic-def',
  HAST: 'haste',
  ATKHAST: 'atk-spd',
  PT: 'def-penetration',
  HEAL: 'vitality',
  BLOCK: 'ranged-def',
  LFS: 'life-drain',
}

// ---------- feed shape (single-locale per file) ----------

interface ArtifactEntry {
  slug: string
  set: ArtifactSet
  name: string | null
  statBonuses: { stat: string; value: number }[]
  levels: { level: number; description: string | null }[]
}

interface ArtifactsBulk {
  artifacts: Record<string, ArtifactEntry>
}

const URL_BASE_FLAG = arg('url-base')
const SRC_DIR_FLAG = arg('src-dir')

async function loadArtifactsBulk(feed: string): Promise<ArtifactsBulk> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${feed}/artifacts.json`
    console.log(`import-artifacts: fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as ArtifactsBulk
  }
  const base = SRC_DIR_FLAG ? resolve(SRC_DIR_FLAG) : join(PROJECT_ROOT, DEFAULT_SRC_DIR)
  const path = join(base, feed, 'artifacts.json')
  if (!existsSync(path)) {
    throw new Error(
      `artifact data feed not found at ${path}\n` +
        `  Run the producer's build (npm run build:data in afkj-data-viewer),\n` +
        `  or pass --src-dir <PATH> / --url-base <URL>.`,
    )
  }
  console.log(`import-artifacts: reading ${path}`)
  return JSON.parse(await readFile(path, 'utf8')) as ArtifactsBulk
}

async function jsonSlugs(dir: string): Promise<Set<string>> {
  if (!existsSync(dir)) return new Set()
  return new Set(
    (await readdir(dir, { withFileTypes: true }))
      .filter((e) => e.isFile() && e.name.endsWith('.json'))
      .map((e) => e.name.slice(0, -5)),
  )
}

// ---------- retire ----------

async function retire(): Promise<void> {
  const dir = TREES.season.effects
  let removed = 0
  for (const slug of await jsonSlugs(dir)) {
    await unlink(join(dir, `${slug}.json`))
    console.log(`  removed ${join(dir, `${slug}.json`)}`)
    removed++
  }
  console.log(`import-artifacts: retired seasonal effects (${removed} file(s) removed)`)
}

// ---------- main ----------

async function main() {
  if (hasFlag('retire')) {
    await retire()
    return
  }

  const appLocales = SKILL_LOCALES.filter(
    (l): l is (typeof SKILL_LOCALES)[number] & { code: AppLocale } => isAppLocale(l.code),
  )
  const bulks = {} as Record<AppLocale, ArtifactsBulk>
  for (const { feed, code } of appLocales) bulks[code] = await loadArtifactsBulk(feed)

  const en = bulks.en.artifacts
  const zh = bulks.zh.artifacts
  const feedSlugs = Object.keys(en).sort()
  const problems: string[] = []

  if (Object.keys(zh).sort().join(',') !== feedSlugs.join(',')) {
    throw new Error('artifact feed slug sets differ between en and zh')
  }

  // Structural lint: hand-written files must mirror the feed exactly.
  const structuralBySet = {} as Record<ArtifactSet, Set<string>>
  for (const set of ['pre-season', 'season'] as const) {
    structuralBySet[set] = await jsonSlugs(TREES[set].data)
  }
  const idOwner = new Map<number, string>()
  for (const slug of feedSlugs) {
    const entry = en[slug]!
    const tree = TREES[entry.set]
    if (!tree) {
      problems.push(`${slug}: unknown feed set "${entry.set}"`)
      continue
    }
    if (!structuralBySet[entry.set].has(slug)) {
      problems.push(`${slug}: no structural file in ${tree.data} (feed set: ${entry.set})`)
      continue
    }
    if (!existsSync(join(tree.names, `${slug}.json`))) {
      problems.push(`${slug}: no display-name locale file in ${tree.names}`)
    }
    const structural = JSON.parse(await readFile(join(tree.data, `${slug}.json`), 'utf8')) as {
      id?: number
      name?: string
      stats?: Record<string, number>
    }
    // Effect/name locale dicts and image lookups key on `name` matching the
    // filename; ids key URL serialization, so both must be unique/consistent.
    if (structural.name !== slug) {
      problems.push(`${slug}: structural name "${structural.name}" does not match the filename`)
    }
    if (structural.id != null) {
      const owner = idOwner.get(structural.id)
      if (owner) problems.push(`${slug}: id ${structural.id} already used by "${owner}"`)
      else idOwner.set(structural.id, slug)
    }
    const expected: Record<string, number> = {}
    for (const { stat, value } of entry.statBonuses) {
      const key = STAT_KEY[stat]
      if (!key) {
        problems.push(`${slug}: unmapped feed stat code "${stat}"`)
        continue
      }
      expected[key] = value
    }
    const actual = structural.stats ?? {}
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    for (const key of keys) {
      if (expected[key] !== actual[key]) {
        problems.push(
          `${slug}: stats.${key} is ${actual[key] ?? 'absent'}, feed says ${expected[key] ?? 'absent'}`,
        )
      }
    }
  }
  for (const set of ['pre-season', 'season'] as const) {
    for (const slug of structuralBySet[set]) {
      if (!(slug in en))
        problems.push(`${slug}: structural file in ${TREES[set].data} has no feed entry`)
      else if (en[slug]!.set !== set) {
        problems.push(`${slug}: lives in the ${set} tree but the feed says ${en[slug]!.set}`)
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`artifact structural data disagrees with the feed:\n  ${problems.join('\n  ')}`)
  }

  // Effect text: the one output this script owns. Every payload is built and
  // validated before the first write, so an invalid feed never leaves a
  // partially updated tree.
  const payloads: { path: string; text: string }[] = []
  for (const slug of feedSlugs) {
    const enLevels = en[slug]!.levels
    const zhLevels = zh[slug]!.levels
    if (enLevels.length !== zhLevels.length) {
      throw new Error(`${slug}: en has ${enLevels.length} levels, zh has ${zhLevels.length}`)
    }
    const effects = enLevels.map((l, i) => {
      const zhDesc = zhLevels[i]!.description
      if (l.description == null || zhDesc == null) {
        throw new Error(`${slug}: level ${l.level} has a null description`)
      }
      return { en: cleanDescription(l.description), zh: cleanDescription(zhDesc) }
    })
    payloads.push({
      path: join(TREES[en[slug]!.set].effects, `${slug}.json`),
      text: JSON.stringify(effects, null, 2) + '\n',
    })
  }
  let written = 0
  let unchanged = 0
  for (const { path, text } of payloads) {
    if (await writeTextIfChanged(path, text)) written++
    else unchanged++
  }

  // Prune effect files this script owns whose artifact left the feed, or
  // that sit in the wrong tree after a set change (the loaders merge both
  // trees by basename, so a stale wrong-tree file would shadow fresh text).
  let pruned = 0
  for (const set of ['pre-season', 'season'] as const) {
    for (const slug of await jsonSlugs(TREES[set].effects)) {
      if (slug in en && en[slug]!.set === set) continue
      await unlink(join(TREES[set].effects, `${slug}.json`))
      console.log(`  pruned ${join(TREES[set].effects, `${slug}.json`)}`)
      pruned++
    }
  }

  console.log('')
  console.log(`import-artifacts: ${feedSlugs.length} artifacts (structural lint clean)`)
  console.log(
    `  effect files: ${written} written, ${unchanged} unchanged${pruned ? `, ${pruned} pruned` : ''}`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
