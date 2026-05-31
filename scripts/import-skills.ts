// Skill data importer.
//
// Character files are the source of truth for which heroes exist. This script
// reads N per-locale skill-data feeds (one per language we render), and writes
// per-language locale files at `src/locales/skill/{en,zh}/<slug>.json`.
//
// Read-only against character files. The only write target is the locale dir.
//
// Usage:
//   npm run import:skills                          # reads from DEFAULT_SOURCE/<lang>/skills.json
//   npm run import:skills -- --src-dir <PATH>      # local: <PATH>/<lang>/skills.json
//   npm run import:skills -- --url-base <URL>      # remote: <URL>/<lang>/skills.json

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { argv } from 'node:process'

import {
  SLOT_ORDER,
  type SlotKey,
  type CharacterTags,
  type SkillLocaleFile,
  type SkillRefineEntry,
} from '../src/lib/types/skill.ts'

// ---------- locales we render ----------

// Languages Stargazer's UI ships. Add to extend — the per-locale feed
// schema is identical, no other importer changes needed.
const LOCALES = ['en', 'zh'] as const
type Locale = (typeof LOCALES)[number]

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const CHARACTER_DIR = join(PROJECT_ROOT, 'src', 'data', 'character')
const LOCALES_DIR = join(PROJECT_ROOT, 'src', 'locales', 'skill')

// Default local source. The producer (afkj-data-viewer) emits
// `static/api/<locale>/skills.json`; conventionally a sibling checkout of
// that repo gets symlinked / copied to `./api` here. Override at runtime
// with `--src-dir <PATH>` (local) or `--url-base <URL>` (remote).
const DEFAULT_SRC_DIR = 'api'

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
  _meta: { generatedAt: string; locale: string; heroCount: number }
  heroes: Record<string, HeroEntry>
}

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

async function loadSkillsBulk(lang: Locale): Promise<SkillsBulk> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${lang}/skills.json`
    console.log(`import-skills: fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as SkillsBulk
  }
  const base = SRC_DIR_FLAG ? resolve(SRC_DIR_FLAG) : join(PROJECT_ROOT, DEFAULT_SRC_DIR)
  const path = join(base, lang, 'skills.json')
  if (!existsSync(path)) {
    throw new Error(
      `skill data feed not found at ${path}\n` +
        `  Place the per-locale skill JSON under <src-dir>/<locale>/skills.json,\n` +
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

// Write only when content differs so re-runs produce no git diff.
// Compact (no indent) — these files are auto-managed, not hand-read.
async function writeJsonIfChanged(path: string, value: unknown): Promise<boolean> {
  const next = JSON.stringify(value) + '\n'
  if (existsSync(path)) {
    const prev = await readFile(path, 'utf8')
    if (prev === next) return false
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, next)
  return true
}

// ---------- projection ----------

// Slots whose name is invariant across all heroes — the renderer reads these
// from app locales (`hero-focus.json` / `enhance-force.json`) instead of
// repeating the same string in every per-hero locale file.
const NAME_INVARIANT_SLOTS = new Set<SlotKey>(['mastery', 'awakening'])

// Reorder adjacent <STAT>[[value]] pairs to [[value]]<STAT>, which reads more
// naturally in both EN and ZH ("40% of ATK" rather than "ATK 40%"). Standalone
// stat tags like "based on <ATK>" are left untouched.
const STAT_VALUE_SWAP = /<([A-Z][A-Za-z0-9_]*)>\s*(\[\[[^\]]+\]\])/g

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

function projectLocale(hero: HeroEntry): LocaleFile {
  const out: LocaleFile = {}
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
    const entry: NonNullable<LocaleFile[typeof slotKey]> = NAME_INVARIANT_SLOTS.has(slotKey)
      ? { d: descriptions }
      : { n: slot.name, d: descriptions }
    if (refinements.length > 0) entry.r = refinements
    out[slotKey] = entry
  }
  return out
}

// ---------- validation: orphan tag attachments ----------

interface OrphanTag {
  slug: string
  tag: string
  attachment: string // e.g. "ultimate:5"
  reason: string
}

function validateTagAttachments(slug: string, char: CharacterFile, hero: HeroEntry): OrphanTag[] {
  if (!char.tags) return []
  const orphans: OrphanTag[] = []
  for (const [tag, attachments] of Object.entries(char.tags)) {
    if (!Array.isArray(attachments)) continue
    for (const att of attachments) {
      const entries = Object.entries(att)
      if (entries.length === 0) continue // explicit character-level — always valid
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
}

async function main() {
  const t0 = Date.now()

  // Load one bulk per locale. Tag-attachment validation is locale-agnostic
  // (kits are language-independent), so we validate against the EN bulk and
  // assume slot shapes match across languages. The producer's per-hero slug
  // is EN-derived, so all per-locale bulks share the same slug set.
  const bulks: Record<Locale, SkillsBulk> = {} as Record<Locale, SkillsBulk>
  for (const lang of LOCALES) bulks[lang] = await loadSkillsBulk(lang)
  const heroCount = Object.keys(bulks[LOCALES[0]].heroes).length
  console.log(`import-skills: bulks have ${heroCount} heroes (per locale)`)

  const characters = await loadCharacters()
  console.log(`import-skills: ${characters.length} character files found`)

  const summary: RunSummary = {
    imported: [],
    missingFromFeed: [],
    availableNotAdded: [],
    orphans: [],
  }

  const knownSlugs = new Set(characters.map((c) => c.slug))

  for (const { slug, file } of characters) {
    const enHero = bulks.en.heroes[slug]
    if (!enHero) {
      summary.missingFromFeed.push(slug)
      continue
    }
    summary.orphans.push(...validateTagAttachments(slug, file, enHero))

    let written = 0
    let unchanged = 0
    for (const lang of LOCALES) {
      const hero = bulks[lang].heroes[slug]
      if (!hero) continue
      const data = projectLocale(hero)
      const path = join(LOCALES_DIR, lang, `${slug}.json`)
      const changed = await writeJsonIfChanged(path, data)
      if (changed) written++
      else unchanged++
    }
    summary.imported.push({ slug, written, unchanged })
  }

  // Discovery hint — heroes that the producer publishes but Stargazer hasn't
  // added a character/ entry for yet. Reported off the EN bulk; the slug set
  // is the same across locales.
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

  if (summary.missingFromFeed.length > 0) {
    console.warn(
      `\n  ${summary.missingFromFeed.length} character(s) have no entry in the skill data feed:`,
    )
    for (const s of summary.missingFromFeed) console.warn(`    - ${s}`)
  }

  if (summary.orphans.length > 0) {
    console.warn(`\n  ${summary.orphans.length} orphan tag attachment(s):`)
    for (const o of summary.orphans) {
      console.warn(`    - [${o.slug}] tag "${o.tag}" → ${o.attachment} — ${o.reason}`)
    }
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
