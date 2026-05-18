// Skill data importer.
//
// Character files are the source of truth for which heroes exist. This script
// walks src/data/character/*.json, looks up each hero's slug in a skill-data
// JSON feed, and writes per-language locale files at
// src/locales/skill/{en,zh}/<slug>.json.
//
// Read-only against character files. The only write target is the locale dir.
//
// Usage:
//   npm run import:skills                 # reads from DEFAULT_SOURCE (below)
//   npm run import:skills -- --src <PATH> # override the local file path
//   npm run import:skills -- --url <URL>  # fetch the feed from a URL instead

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
} from '../src/lib/types/skill.ts'

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const CHARACTER_DIR = join(PROJECT_ROOT, 'src', 'data', 'character')
const LOCALES_DIR = join(PROJECT_ROOT, 'src', 'locales', 'skill')

// Default location of the skill-data feed (relative to project root). Override
// at runtime with `--src <PATH>` or `--url <URL>`; or change this constant if
// you keep the file elsewhere by convention.
const DEFAULT_SOURCE = 'skills.json'

const LOCALES = ['en', 'zh'] as const
type Locale = (typeof LOCALES)[number]

// ---------- feed shape (see contract docs) ----------

interface LocalizedPair {
  en: string | null
  zh: string | null
}

interface ExportLevel {
  level: number
  description: LocalizedPair
}

interface ExportSlot {
  name: LocalizedPair
  skillTypeCodes?: string[]
  levels: ExportLevel[]
}

interface HeroEntry {
  slug: string
  codename: string
  name: LocalizedPair
  title: LocalizedPair
  skills: Partial<Record<SlotKey, ExportSlot>>
}

interface SkillsBulk {
  _meta: { generatedAt: string; locales: string[]; heroCount: number }
  heroes: Record<string, HeroEntry>
}

type LocaleFile = SkillLocaleFile

// ---------- args ----------

function arg(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`)
  if (i === -1) return undefined
  return argv[i + 1]
}

const URL_FLAG = arg('url')
const SRC_FLAG = arg('src')

// ---------- io helpers ----------

async function loadSkillsBulk(): Promise<SkillsBulk> {
  if (URL_FLAG) {
    console.log(`import-skills: fetching ${URL_FLAG}`)
    const res = await fetch(URL_FLAG)
    if (!res.ok) throw new Error(`fetch ${URL_FLAG} → HTTP ${res.status}`)
    return (await res.json()) as SkillsBulk
  }
  const path = SRC_FLAG ? resolve(SRC_FLAG) : join(PROJECT_ROOT, DEFAULT_SOURCE)
  if (!existsSync(path)) {
    throw new Error(
      `skill data feed not found at ${path}\n` +
        `  Place the JSON at the path above, or pass --src <PATH> / --url <URL>.`,
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

function projectLocale(hero: HeroEntry, lang: Locale): LocaleFile {
  const out: LocaleFile = {}
  for (const slotKey of SLOT_ORDER) {
    const slot = hero.skills[slotKey]
    if (!slot) continue
    // Skip the slot if every level is null for this language.
    const descriptions = slot.levels
      .map((l) => l.description[lang])
      .filter((d): d is string => d != null)
      .map(reorderStatValuePairs)
    if (descriptions.length === 0) continue
    if (NAME_INVARIANT_SLOTS.has(slotKey)) {
      out[slotKey] = { d: descriptions }
    } else {
      out[slotKey] = { n: slot.name[lang], d: descriptions }
    }
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

interface RunSummary {
  imported: { slug: string; localesWritten: number; localesUnchanged: number }[]
  missingFromFeed: string[] // character file present, no entry in the skill feed
  availableNotAdded: string[] // feed entry present, no character file
  orphans: OrphanTag[]
}

async function main() {
  const t0 = Date.now()
  const bulk = await loadSkillsBulk()
  console.log(`import-skills: bulk has ${Object.keys(bulk.heroes).length} heroes`)

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
    const hero = bulk.heroes[slug]
    if (!hero) {
      summary.missingFromFeed.push(slug)
      continue
    }
    summary.orphans.push(...validateTagAttachments(slug, file, hero))
    let written = 0
    let unchanged = 0
    for (const lang of LOCALES) {
      const data = projectLocale(hero, lang)
      const path = join(LOCALES_DIR, lang, `${slug}.json`)
      const changed = await writeJsonIfChanged(path, data)
      if (changed) written++
      else unchanged++
    }
    summary.imported.push({ slug, localesWritten: written, localesUnchanged: unchanged })
  }

  for (const slug of Object.keys(bulk.heroes)) {
    if (!knownSlugs.has(slug)) summary.availableNotAdded.push(slug)
  }

  // ---------- summary ----------
  const ms = Date.now() - t0
  console.log('')
  console.log(`import-skills: ${summary.imported.length} characters processed in ${ms}ms`)
  const written = summary.imported.reduce((n, r) => n + r.localesWritten, 0)
  const unchanged = summary.imported.reduce((n, r) => n + r.localesUnchanged, 0)
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
