// Skill data importer.
//
// Character files are the source of truth for which heroes exist. This script
// reads one per-locale skill-data feed for every language in SKILL_LOCALES and
// writes per-language locale files at `src/locales/skill/<code>/<slug>.json`,
// plus (for non-en/zh locales) a per-dir `index.ts` chunk module that the app
// dynamically imports as one lazy chunk per language.
//
// Read-only against character files. The only write target is the locale dir.
//
// Usage:
//   npm run import:skills                          # reads from DEFAULT_SOURCE/<feed>/skills.json
//   npm run import:skills -- --src-dir <PATH>      # local: <PATH>/<feed>/skills.json
//   npm run import:skills -- --url-base <URL>      # remote: <URL>/<feed>/skills.json

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

import { isAppLocale, SKILL_LOCALES, type SkillLocale } from '../src/lib/types/i18n.ts'
import {
  SLOT_ORDER,
  type SlotKey,
  type CharacterTags,
  type SkillKeywords,
  type SkillLocaleFile,
  type SkillRefineEntry,
} from '../src/lib/types/skill.ts'
import { STAT_TAG_RE } from '../src/utils/textHighlight.ts'

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const CHARACTER_DIR = join(PROJECT_ROOT, 'src', 'data', 'character')
const LOCALES_DIR = join(PROJECT_ROOT, 'src', 'locales', 'skill')

// Default local source: the sibling afkj-data-viewer checkout, which emits
// `static/api/<feed>/skills.json`. Resolved against this repo root so it
// holds regardless of CWD as long as the two repos are siblings. Override at
// runtime with `--src-dir <PATH>` (local) or `--url-base <URL>` (remote).
const DEFAULT_SRC_DIR = '../afkj-data-viewer/static/api'

// ---------- feed shape (single-locale per file) ----------

interface ExportLevel {
  level: number
  description: string | null
}

interface ExportRefinement {
  tier: number
  description: string | null
}

interface ExportSlot {
  name: string | null
  skillTypeCodes?: string[]
  levels: ExportLevel[]
  refinements?: ExportRefinement[]
}

interface HeroEntry {
  slug: string
  codename: string
  name: string | null
  title: string | null
  skills: Partial<Record<SlotKey, ExportSlot>>
}

interface SkillsBulk {
  _meta: {
    generatedAt: string
    locale: string
    heroCount: number
    terms?: { ultimate: string; exclusiveEquipment: string }
    keywords?: Record<string, string>
  }
  heroes: Record<string, HeroEntry>
}

type SlotTerms = NonNullable<SkillLocaleFile['_terms']>

type LocaleFile = SkillLocaleFile

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  return argv[i + 1]
}

const URL_BASE_FLAG = arg('url-base')
const SRC_DIR_FLAG = arg('src-dir')

// ---------- io helpers ----------

async function loadSkillsBulk(feed: string): Promise<SkillsBulk> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${feed}/skills.json`
    console.log(`import-skills: fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as SkillsBulk
  }
  const base = SRC_DIR_FLAG ? resolve(SRC_DIR_FLAG) : join(PROJECT_ROOT, DEFAULT_SRC_DIR)
  const path = join(base, feed, 'skills.json')
  if (!existsSync(path)) {
    throw new Error(
      `skill data feed not found at ${path}\n` +
        `  Place the per-locale skill JSON under <src-dir>/<feed>/skills.json,\n` +
        `  or pass --src-dir <PATH> / --url-base <URL>.`,
    )
  }
  console.log(`import-skills: reading ${path}`)
  return JSON.parse(await readFile(path, 'utf8')) as SkillsBulk
}

interface CharacterFile {
  name: string
  tags?: CharacterTags
  [k: string]: unknown
}

interface CharacterListing {
  slug: string
  file: CharacterFile
}

async function loadCharacters(): Promise<CharacterListing[]> {
  const files = (await readdir(CHARACTER_DIR)).filter((f) => f.endsWith('.json'))
  const out: CharacterListing[] = []
  for (const f of files) {
    const file = JSON.parse(await readFile(join(CHARACTER_DIR, f), 'utf8')) as CharacterFile
    out.push({ slug: basename(f, '.json'), file })
  }
  return out
}

// Write only when content differs so re-runs produce no git diff. Compact,
// auto-managed output; the dir is prettier-ignored so this stays stable.
async function writeTextIfChanged(path: string, next: string): Promise<boolean> {
  if (existsSync(path)) {
    const prev = await readFile(path, 'utf8')
    if (prev === next) return false
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, next)
  return true
}

async function writeJsonIfChanged(path: string, value: unknown): Promise<boolean> {
  return writeTextIfChanged(path, JSON.stringify(value) + '\n')
}

// ---------- projection ----------

// Reorder adjacent <STAT>[[value]] pairs to [[value]]<STAT>, which reads more
// naturally in both EN and ZH ("40% of ATK" rather than "ATK 40%"). Standalone
// stat tags like "based on <ATK>" are left untouched. The tag grammar comes
// from the canonical STAT_TAG_RE so renderer and importer can't diverge.
const STAT_VALUE_SWAP = new RegExp(`${STAT_TAG_RE.source}\\s*(\\[\\[[^\\]]+\\]\\])`, 'g')

function reorderStatValuePairs(text: string): string {
  return text.replace(STAT_VALUE_SWAP, '$2<$1>')
}

// Strip Unity TextMeshPro <sprite name="..."> markers. The mode label that
// follows the sprite carries the meaning; we don't ship the icon assets.
const SPRITE_TAG = /<sprite\s+name="[^"]*">/g

function stripSpriteTags(text: string): string {
  return text.replace(SPRITE_TAG, '')
}

function cleanDescription(text: string): string {
  return reorderStatValuePairs(stripSpriteTags(text))
}

function projectLocale(hero: HeroEntry, terms: SlotTerms): LocaleFile {
  const out: LocaleFile = {}
  // Trimmed: the feed carries stray whitespace on some names.
  const heroName = hero.name?.trim()
  if (heroName) out._hero = { name: heroName }
  out._terms = terms
  for (const slotKey of SLOT_ORDER) {
    const slot = hero.skills[slotKey]
    if (!slot) continue
    const descriptions = slot.levels
      .map((l) => l.description)
      .filter((d): d is string => d != null)
      .map(cleanDescription)
    const refinements: SkillRefineEntry[] = (slot.refinements ?? [])
      .filter((r): r is { tier: number; description: string } => r.description != null)
      .map((r) => ({ t: r.tier, d: cleanDescription(r.description) }))
    if (descriptions.length === 0 && refinements.length === 0) continue
    const entry: NonNullable<LocaleFile[typeof slotKey]> = { n: slot.name, d: descriptions }
    if (refinements.length > 0) entry.r = refinements
    out[slotKey] = entry
  }
  return out
}

// One lazy chunk per non-app locale: the eager same-dir glob inlines every
// JSON in the dir into the module's chunk, so `import('…/<lang>/index.ts')`
// fetches the whole language at once (shared by skill pages and search).
const CHUNK_MODULE_SOURCE = `// Auto-generated by scripts/import-skills.ts; do not edit.
// Importing this module loads every skill locale file in this directory as
// one chunk; see loadSkillLocale() in src/utils/dataLoader.ts.
import type { SkillLocaleFile } from '../../../lib/types/skill'

const modules = import.meta.glob<SkillLocaleFile>('./*.json', {
  eager: true,
  import: 'default',
})

const dict: Record<string, SkillLocaleFile> = {}
for (const [path, file] of Object.entries(modules)) {
  dict[path.slice(2, -'.json'.length)] = file
}

export default dict
`

// ---------- validation ----------

// Every locale must cover exactly the en hero set: the app treats coverage as
// uniform (hasSkillLocale answers from en presence; hreflang emits all
// languages per hero), so drift here must stop the import, not degrade
// silently at runtime.
function assertUniformCoverage(bulks: Record<SkillLocale, SkillsBulk>): void {
  const enSlugs = new Set(Object.keys(bulks.en.heroes))
  const problems: string[] = []
  for (const { code } of SKILL_LOCALES) {
    const slugs = Object.keys(bulks[code].heroes)
    const missing = [...enSlugs].filter((s) => !(s in bulks[code].heroes))
    const extra = slugs.filter((s) => !enSlugs.has(s))
    if (missing.length > 0) problems.push(`  [${code}] missing: ${missing.join(', ')}`)
    if (extra.length > 0) problems.push(`  [${code}] extra: ${extra.join(', ')}`)
  }
  if (problems.length > 0) {
    throw new Error(`feed coverage is not uniform across locales:\n${problems.join('\n')}`)
  }
}

interface OrphanTag {
  slug: string
  tag: string
  attachment: string // e.g. "ultimate:5"
  reason: string
}

// Keyword tokens `[[label|key]]` in projected slot text; every key must
// resolve in the locale's glossary or the rendered span would be a dead
// tooltip affordance.
const KEYWORD_TOKEN_RE = /\[\[[^\]]*?\|([A-Za-z][A-Za-z0-9_]*)\]\]/g

function collectKeywordKeys(data: SkillLocaleFile): Set<string> {
  const keys = new Set<string>()
  for (const slotKey of SLOT_ORDER) {
    const slot = data[slotKey]
    if (!slot) continue
    for (const text of [...slot.d, ...(slot.r ?? []).map((r) => r.d)]) {
      for (const m of text.matchAll(KEYWORD_TOKEN_RE)) keys.add(m[1]!)
    }
  }
  return keys
}

function validateTagAttachments(slug: string, char: CharacterFile, hero: HeroEntry): OrphanTag[] {
  if (!char.tags) return []
  const orphans: OrphanTag[] = []
  for (const [tag, attachments] of Object.entries(char.tags)) {
    if (!Array.isArray(attachments)) continue
    for (const att of attachments) {
      const entries = Object.entries(att)
      if (entries.length === 0) continue // explicit character-level: always valid
      for (const [slotKey, level] of entries) {
        const slot = hero.skills[slotKey as SlotKey]
        if (!slot) {
          orphans.push({
            slug,
            tag,
            attachment: `${slotKey}:${level}`,
            reason: `slot "${slotKey}" not in hero's kit`,
          })
          continue
        }
        if (!slot.levels.some((l) => l.level === level)) {
          orphans.push({
            slug,
            tag,
            attachment: `${slotKey}:${level}`,
            reason: `level ${level} not in ${slotKey} (have: ${slot.levels.map((l) => l.level).join(', ')})`,
          })
        }
      }
    }
  }
  return orphans
}

// ---------- main ----------

interface ImportRecord {
  slug: string
  written: number
  unchanged: number
}

interface RunSummary {
  imported: ImportRecord[]
  missingFromFeed: string[] // character file present, no entry in the skill feed (any locale)
  availableNotAdded: string[] // feed entry present, no character file
  orphans: OrphanTag[]
  unknownDirs: string[] // locale dirs on disk that are not in SKILL_LOCALES
  missingKeywords: string[] // `[[label|key]]` keys with no glossary entry, e.g. "[de] peggy: weakest"
}

async function main() {
  const t0 = Date.now()

  // Load one bulk per locale. Tag-attachment validation is locale-agnostic
  // (kits are language-independent), so we validate against the EN bulk. The
  // producer's per-hero slug is EN-derived; assertUniformCoverage guarantees
  // all per-locale bulks share the same slug set.
  const bulks = {} as Record<SkillLocale, SkillsBulk>
  for (const { feed, code } of SKILL_LOCALES) bulks[code] = await loadSkillsBulk(feed)
  assertUniformCoverage(bulks)

  // Official slot-type labels per locale, stamped into every written file so
  // skill headings render entirely from game data. Their absence means the
  // feed predates the producer's terms export.
  const termsByCode = {} as Record<SkillLocale, SlotTerms>
  for (const { code } of SKILL_LOCALES) {
    const terms = bulks[code]._meta.terms
    if (!terms?.ultimate || !terms?.exclusiveEquipment) {
      throw new Error(`[${code}] feed lacks _meta.terms; re-run the producer's build:data export`)
    }
    termsByCode[code] = { ultimate: terms.ultimate, ex: terms.exclusiveEquipment }
  }

  // Keyword glossaries per locale, resolving the `[[label|key]]` tokens the
  // producer embeds in slot text.
  const keywordsByCode = {} as Record<SkillLocale, SkillKeywords>
  for (const { code } of SKILL_LOCALES) {
    const keywords = bulks[code]._meta.keywords
    if (!keywords) {
      throw new Error(`[${code}] feed lacks _meta.keywords; re-run the producer's export:api`)
    }
    keywordsByCode[code] = Object.fromEntries(
      Object.entries(keywords).sort(([a], [b]) => a.localeCompare(b)),
    )
  }
  const heroCount = Object.keys(bulks.en.heroes).length
  console.log(`import-skills: bulks have ${heroCount} heroes (per locale)`)

  const characters = await loadCharacters()
  console.log(`import-skills: ${characters.length} character files found`)

  const summary: RunSummary = {
    imported: [],
    missingFromFeed: [],
    availableNotAdded: [],
    orphans: [],
    unknownDirs: [],
    missingKeywords: [],
  }

  const knownSlugs = new Set(characters.map((c) => c.slug))

  // Slot-level drift (a language's feed carrying no content for a slot en
  // has) would silently render pages missing a section; fail like the
  // hero-set assertion does.
  const slotMismatches: string[] = []

  for (const { slug, file } of characters) {
    const enHero = bulks.en.heroes[slug]
    if (!enHero) {
      summary.missingFromFeed.push(slug)
      continue
    }
    summary.orphans.push(...validateTagAttachments(slug, file, enHero))

    let written = 0
    let unchanged = 0
    let enSlots: string | null = null
    for (const { code } of SKILL_LOCALES) {
      const hero = bulks[code].heroes[slug]
      if (!hero) continue
      const data = projectLocale(hero, termsByCode[code])
      for (const key of collectKeywordKeys(data)) {
        if (!(key in keywordsByCode[code])) summary.missingKeywords.push(`[${code}] ${slug}: ${key}`)
      }
      const slots = SLOT_ORDER.filter((k) => k in data).join(',')
      if (code === 'en') enSlots = slots
      else if (slots !== enSlots) {
        slotMismatches.push(`[${slug}] ${code}: slots (${slots}) differ from en (${enSlots})`)
      }
      const path = join(LOCALES_DIR, code, `${slug}.json`)
      const changed = await writeJsonIfChanged(path, data)
      if (changed) written++
      else unchanged++
    }
    summary.imported.push({ slug, written, unchanged })
  }

  if (slotMismatches.length > 0) {
    throw new Error(`feed slot coverage is not uniform across locales:\n  ${slotMismatches.join('\n  ')}`)
  }

  // One keyword glossary per language, beside the hero files so the language
  // chunk (and the eager en/zh bundle) carries it automatically.
  let keywordsWritten = 0
  for (const { code } of SKILL_LOCALES) {
    if (await writeJsonIfChanged(join(LOCALES_DIR, code, '_keywords.json'), keywordsByCode[code])) {
      keywordsWritten++
    }
  }

  // Chunk modules for the non-app locales (en/zh are eagerly bundled; a chunk
  // there would ship the same JSON twice).
  let chunksWritten = 0
  for (const { code } of SKILL_LOCALES) {
    if (isAppLocale(code)) continue
    if (await writeTextIfChanged(join(LOCALES_DIR, code, 'index.ts'), CHUNK_MODULE_SOURCE)) {
      chunksWritten++
    }
  }

  // A dir not in the table is a removed (or misnamed) language: it would still
  // be globbed by the app, so flag it for deletion.
  const validDirs = new Set<string>(SKILL_LOCALES.map((l) => l.code))
  for (const entry of await readdir(LOCALES_DIR, { withFileTypes: true })) {
    if (entry.isDirectory() && !validDirs.has(entry.name)) summary.unknownDirs.push(entry.name)
  }

  // Discovery hint: heroes that the producer publishes but Stargazer hasn't
  // added a character/ entry for yet.
  for (const slug of Object.keys(bulks.en.heroes)) {
    if (!knownSlugs.has(slug)) summary.availableNotAdded.push(slug)
  }

  // ---------- summary ----------
  const ms = Date.now() - t0
  console.log('')
  console.log(`import-skills: ${summary.imported.length} characters processed in ${ms}ms`)
  const written = summary.imported.reduce((n, r) => n + r.written, 0)
  const unchanged = summary.imported.reduce((n, r) => n + r.unchanged, 0)
  console.log(`  locale files: ${written} written, ${unchanged} unchanged`)
  if (keywordsWritten > 0) console.log(`  keyword glossaries: ${keywordsWritten} written`)
  if (chunksWritten > 0) console.log(`  chunk modules: ${chunksWritten} written`)

  if (summary.missingKeywords.length > 0) {
    console.warn(`\n  ${summary.missingKeywords.length} keyword token(s) missing from glossaries:`)
    for (const k of summary.missingKeywords) console.warn(`    - ${k}`)
  }

  if (summary.missingFromFeed.length > 0) {
    console.warn(
      `\n  ${summary.missingFromFeed.length} character(s) have no entry in the skill data feed:`,
    )
    for (const s of summary.missingFromFeed) console.warn(`    - ${s}`)
  }

  if (summary.orphans.length > 0) {
    console.warn(`\n  ${summary.orphans.length} orphan tag attachment(s):`)
    for (const o of summary.orphans) {
      console.warn(`    - [${o.slug}] tag "${o.tag}" → ${o.attachment}: ${o.reason}`)
    }
  }

  if (summary.unknownDirs.length > 0) {
    console.warn(`\n  ${summary.unknownDirs.length} locale dir(s) not in SKILL_LOCALES (delete?):`)
    for (const d of summary.unknownDirs) console.warn(`    - ${d}`)
  }

  if (summary.availableNotAdded.length > 0) {
    console.log(
      `\n  ${summary.availableNotAdded.length} hero(es) available in the feed but not in character/ (discovery hint):`,
    )
    for (const s of summary.availableNotAdded) console.log(`    - ${s}`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
