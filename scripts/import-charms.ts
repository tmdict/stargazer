// Seasonal charm importer.
//
// Charm text is charm-keyed, not hero-keyed: one charm (a skill family shared
// by several heroes) is stored once per locale, and heroes reference it
// through the structural charm -> heroes map. This script owns both outputs:
//   src/data/seasonal/charm/charms.json        charm slug -> sharing heroes
//   src/locales/skill/<code>/_charms.json      localized tier labels + text
//
// The underscore file rides each language's existing skill-locale chunk, so
// charm text is warm exactly when the surrounding skill text is. Charms are
// seasonal: this script also owns retirement, because nothing else ever
// deletes locale files and a stale _charms.json would keep shipping invisibly
// inside every chunk.
//
// Usage:
//   npm run import:charms                          # reads DEFAULT_SRC_DIR/<feed>/charms.json
//   npm run import:charms -- --src-dir <PATH>      # local: <PATH>/<feed>/charms.json
//   npm run import:charms -- --url-base <URL>      # remote: <URL>/<feed>/charms.json
//   npm run import:charms -- --retire              # delete every output (season retired)
//
// An absent or unreadable feed is a hard error, never a silent wipe; outputs
// are only removed by an explicit --retire run or a feed with zero charms.

import { existsSync } from 'node:fs'
import { readdir, readFile, rmdir, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { SKILL_LOCALES, type SkillLocale } from '../src/lib/types/i18n.ts'
import type { CharmData, SkillCharms, SkillKeywords } from '../src/lib/types/skill.ts'
import { HIGHLIGHT_RE, splitHighlightToken } from '../src/utils/textHighlight.ts'
import {
  arg,
  cleanDescription,
  DEFAULT_SRC_DIR,
  hasFlag,
  writeJsonIfChanged,
  writeTextIfChanged,
} from './lib/shared.ts'

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const CHARACTER_DIR = join(PROJECT_ROOT, 'src', 'data', 'character')
const CHARM_DATA_DIR = join(PROJECT_ROOT, 'src', 'data', 'seasonal', 'charm')
const CHARM_DATA_FILE = join(CHARM_DATA_DIR, 'charms.json')
const LOCALES_DIR = join(PROJECT_ROOT, 'src', 'locales', 'skill')

const TIER_COUNT = 4

// ---------- feed shape (single-locale per file) ----------

interface CharmEntry {
  slug: string
  heroes: string[]
  tiers: string[]
}

interface CharmsBulk {
  tierNames: string[]
  charms: CharmEntry[]
}

const URL_BASE_FLAG = arg('url-base')
const SRC_DIR_FLAG = arg('src-dir')

async function loadCharmsBulk(feed: string): Promise<CharmsBulk> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${feed}/charms.json`
    console.log(`import-charms: fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as CharmsBulk
  }
  const base = SRC_DIR_FLAG ? resolve(SRC_DIR_FLAG) : join(PROJECT_ROOT, DEFAULT_SRC_DIR)
  const path = join(base, feed, 'charms.json')
  if (!existsSync(path)) {
    throw new Error(
      `charm data feed not found at ${path}\n` +
        `  Run the producer's build (npm run build:data in afkj-data-viewer),\n` +
        `  or pass --src-dir <PATH> / --url-base <URL>.\n` +
        `  To remove charm data on purpose, run with --retire.`,
    )
  }
  console.log(`import-charms: reading ${path}`)
  return JSON.parse(await readFile(path, 'utf8')) as CharmsBulk
}

// ---------- retire ----------

async function retire(): Promise<void> {
  let removed = 0
  const targets = [
    CHARM_DATA_FILE,
    ...SKILL_LOCALES.map(({ code }) => join(LOCALES_DIR, code, '_charms.json')),
  ]
  for (const path of targets) {
    if (!existsSync(path)) continue
    await unlink(path)
    console.log(`  removed ${path}`)
    removed++
  }
  await rmdir(CHARM_DATA_DIR).catch(() => {})
  console.log(`import-charms: retired (${removed} file(s) removed)`)
}

// ---------- validation ----------

function assertBulkShape(code: SkillLocale, bulk: CharmsBulk): void {
  if (!Array.isArray(bulk.tierNames) || bulk.tierNames.length !== TIER_COUNT) {
    throw new Error(`[${code}] feed tierNames must have exactly ${TIER_COUNT} entries`)
  }
  if (bulk.tierNames.some((t) => !t?.trim())) {
    throw new Error(`[${code}] feed has an empty tier name`)
  }
  const seen = new Set<string>()
  for (const charm of bulk.charms) {
    if (seen.has(charm.slug)) throw new Error(`[${code}] duplicate charm slug "${charm.slug}"`)
    seen.add(charm.slug)
    if (!Array.isArray(charm.tiers) || charm.tiers.length !== TIER_COUNT) {
      throw new Error(`[${code}] charm "${charm.slug}" must have exactly ${TIER_COUNT} tiers`)
    }
    if (charm.tiers.some((t) => !t?.trim())) {
      throw new Error(`[${code}] charm "${charm.slug}" has an empty tier description`)
    }
  }
}

// Coverage must be uniform across locales, same contract as the skill import:
// the app assumes any charm present in en renders in every language.
function assertUniformCoverage(bulks: Record<SkillLocale, CharmsBulk>): void {
  const enBySlug = new Map(bulks.en.charms.map((c) => [c.slug, c]))
  const problems: string[] = []
  for (const { code } of SKILL_LOCALES) {
    const slugs = new Set(bulks[code].charms.map((c) => c.slug))
    const missing = [...enBySlug.keys()].filter((s) => !slugs.has(s))
    const extra = [...slugs].filter((s) => !enBySlug.has(s))
    if (missing.length > 0) problems.push(`  [${code}] missing: ${missing.join(', ')}`)
    if (extra.length > 0) problems.push(`  [${code}] extra: ${extra.join(', ')}`)
    // Hero lists are structural, not localized: any divergence means the
    // producer's feeds are out of sync with each other.
    for (const charm of bulks[code].charms) {
      const en = enBySlug.get(charm.slug)
      if (en && en.heroes.join(',') !== charm.heroes.join(',')) {
        problems.push(`  [${code}] ${charm.slug}: hero list differs from en`)
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(`charm feed is not uniform across locales:\n${problems.join('\n')}`)
  }
}

// ---------- main ----------

async function main() {
  if (hasFlag('retire')) {
    await retire()
    return
  }

  const bulks = {} as Record<SkillLocale, CharmsBulk>
  for (const { feed, code } of SKILL_LOCALES) {
    bulks[code] = await loadCharmsBulk(feed)
    assertBulkShape(code, bulks[code])
  }
  assertUniformCoverage(bulks)

  if (bulks.en.charms.length === 0) {
    console.log('import-charms: feed contains zero charms; removing outputs')
    await retire()
    return
  }

  // One charm per hero: the derived hero → charm inverse (getCharmForHero)
  // would otherwise silently resolve to the last charm written.
  const heroOwner = new Map<string, string>()
  for (const charm of bulks.en.charms) {
    for (const hero of charm.heroes) {
      const owner = heroOwner.get(hero)
      if (owner) {
        throw new Error(`hero "${hero}" appears on charms "${owner}" and "${charm.slug}"`)
      }
      heroOwner.set(hero, charm.slug)
    }
  }

  // Roster intersection: the structural map only lists heroes this app knows.
  const rosterSlugs = new Set(
    (await readdir(CHARACTER_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)),
  )
  const unknownHeroes = new Set<string>()

  const structural: CharmData = {}
  for (const charm of [...bulks.en.charms].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const heroes = charm.heroes.filter((h) => {
      if (rosterSlugs.has(h)) return true
      unknownHeroes.add(h)
      return false
    })
    if (heroes.length === 0) {
      console.warn(`  skipping charm "${charm.slug}": no sharing hero is in the roster`)
      continue
    }
    structural[charm.slug] = { heroes: [...heroes].sort() }
  }

  // Keyword tokens in charm text resolve against the glossaries the skill
  // import already wrote; a key missing there would ship a dead tooltip span.
  const missingKeywords: string[] = []
  const localeFiles = {} as Record<SkillLocale, SkillCharms>
  for (const { code } of SKILL_LOCALES) {
    const keywordsPath = join(LOCALES_DIR, code, '_keywords.json')
    if (!existsSync(keywordsPath)) {
      throw new Error(`[${code}] ${keywordsPath} not found; run import:skills first`)
    }
    const keywords = JSON.parse(await readFile(keywordsPath, 'utf8')) as SkillKeywords
    const charms: Record<string, string[]> = {}
    for (const charm of [...bulks[code].charms].sort((a, b) => a.slug.localeCompare(b.slug))) {
      if (!(charm.slug in structural)) continue
      // Validation runs on the cleaned strings, which are exactly what gets
      // written (a tier that is only a sprite tag must fail, not ship empty).
      const tiers = charm.tiers.map(cleanDescription)
      tiers.forEach((t, i) => {
        if (!t.trim()) {
          throw new Error(`[${code}] charm "${charm.slug}" tier ${i + 1} is empty after cleaning`)
        }
      })
      for (const text of tiers) {
        for (const m of text.matchAll(HIGHLIGHT_RE)) {
          const { key } = splitHighlightToken(m[1]!)
          if (key && !(key in keywords)) missingKeywords.push(`[${code}] ${charm.slug}: ${key}`)
        }
      }
      charms[charm.slug] = tiers
    }
    localeFiles[code] = { tiers: bulks[code].tierNames, charms }
  }

  if (missingKeywords.length > 0) {
    throw new Error(
      `keyword token(s) missing from glossaries:\n  ${missingKeywords.join('\n  ')}\n` +
        `  Run import:skills to refresh the glossaries, then re-run.`,
    )
  }

  // The structural map is pretty-printed to match the hand-curated src/data/
  // style; its dir is prettier-ignored so this formatting is authoritative
  // (prettier would collapse the hero arrays). The locale files are compact
  // like the rest of skill/.
  const structuralChanged = await writeTextIfChanged(
    CHARM_DATA_FILE,
    JSON.stringify(structural, null, 2) + '\n',
  )
  let localesWritten = 0
  for (const { code } of SKILL_LOCALES) {
    if (await writeJsonIfChanged(join(LOCALES_DIR, code, '_charms.json'), localeFiles[code])) {
      localesWritten++
    }
  }

  const charmCount = Object.keys(structural).length
  const heroCount = new Set(Object.values(structural).flatMap((c) => c.heroes)).size
  console.log('')
  console.log(`import-charms: ${charmCount} charms covering ${heroCount} heroes`)
  console.log(`  structural map: ${structuralChanged ? 'written' : 'unchanged'}`)
  console.log(
    `  locale files: ${localesWritten} written, ${SKILL_LOCALES.length - localesWritten} unchanged`,
  )
  if (unknownHeroes.size > 0) {
    console.warn(`  ${unknownHeroes.size} feed hero(es) not in character/ (skipped):`)
    for (const h of [...unknownHeroes].sort()) console.warn(`    - ${h}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
