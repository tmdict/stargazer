// Phantimal locale-text importer.
//
// Split of ownership: the structural files (src/data/seasonal/phantimal/
// <slug>.json: id, range, faction) are written by import:structure, which keeps
// their ids stable within a season because ids are baked into share links. This
// script owns only the localized content:
//   src/locales/seasonal/phantimal/<slug>.json   {name, skills[].levels[]} app-locale maps
//
// Hand-written structure is linted against the feed: the slug sets must match
// both ways and factions must agree, so a season rotation that forgets a
// structural file (or leaves a stale one) fails the import loudly.
//
// Usage:
//   npm run import:phantimals                          # reads DATA_FEED_DIR/<feed>/phantimals.json
//   npm run import:phantimals -- --src-dir <PATH> | --url-base <URL>
//   npm run import:phantimals -- --retire              # delete every generated locale file
//
// An absent or unreadable feed is a hard error, never a silent wipe.

import { existsSync } from 'node:fs'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { APP_LOCALES, type AppLocale } from '../src/lib/types/i18n.ts'
import {
  APP_LOCALE_FEEDS,
  arg,
  cleanDescription,
  feedSrcDir,
  hasFlag,
  perAppLocale,
  writeTextIfChanged,
} from './lib/shared.ts'

// ---------- paths ----------

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '..')
const DATA_DIR = join(PROJECT_ROOT, 'src', 'data', 'seasonal', 'phantimal')
const LOCALE_DIR = join(PROJECT_ROOT, 'src', 'locales', 'seasonal', 'phantimal')

// ---------- feed shape (single-locale per file) ----------

interface PhantimalEntry {
  slug: string
  name: string | null
  faction: string | null
  skills: { name: string | null; levels: { level: number; description: string | null }[] }[]
}

interface PhantimalsBulk {
  phantimals: Record<string, PhantimalEntry>
}

const URL_BASE_FLAG = arg('url-base')
const SRC_DIR_FLAG = arg('src-dir')

async function loadPhantimalsBulk(feed: string): Promise<PhantimalsBulk> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${feed}/phantimals.json`
    console.log(`import-phantimals: fetching ${url}`)
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as PhantimalsBulk
  }
  const base = feedSrcDir(PROJECT_ROOT, SRC_DIR_FLAG)
  const path = join(base, feed, 'phantimals.json')
  if (!existsSync(path)) {
    throw new Error(
      `phantimal data feed not found at ${path}\n` +
        `  Rebuild the upstream data feed,\n` +
        `  or pass --src-dir <PATH> / --url-base <URL>.\n` +
        `  To remove phantimal locale data on purpose, run with --retire.`,
    )
  }
  console.log(`import-phantimals: reading ${path}`)
  return JSON.parse(await readFile(path, 'utf8')) as PhantimalsBulk
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
  let removed = 0
  for (const slug of await jsonSlugs(LOCALE_DIR)) {
    await unlink(join(LOCALE_DIR, `${slug}.json`))
    console.log(`  removed ${join(LOCALE_DIR, `${slug}.json`)}`)
    removed++
  }
  console.log(`import-phantimals: retired (${removed} file(s) removed)`)
}

// ---------- main ----------

async function main() {
  if (hasFlag('retire')) {
    await retire()
    return
  }

  const bulks = {} as Record<AppLocale, PhantimalsBulk>
  for (const { feed, code } of APP_LOCALE_FEEDS) bulks[code] = await loadPhantimalsBulk(feed)

  const en = bulks.en.phantimals
  const feedSlugs = Object.keys(en).sort()
  for (const code of APP_LOCALES) {
    if (Object.keys(bulks[code].phantimals).sort().join(',') !== feedSlugs.join(',')) {
      throw new Error(`phantimal feed slug sets differ between en and ${code}`)
    }
  }

  // Structural lint: the hand-written files must mirror the feed.
  const problems: string[] = []
  const structuralSlugs = await jsonSlugs(DATA_DIR)
  for (const slug of feedSlugs) {
    if (!structuralSlugs.has(slug)) {
      problems.push(`${slug}: no structural file in ${DATA_DIR} (run import:structure)`)
      continue
    }
    const structural = JSON.parse(await readFile(join(DATA_DIR, `${slug}.json`), 'utf8')) as {
      name?: string
      faction?: string
    }
    // The locale dict and image lookups key on `name` matching the filename.
    if (structural.name !== slug) {
      problems.push(`${slug}: structural name "${structural.name}" does not match the filename`)
    }
    const feedFaction = en[slug]!.faction?.toLowerCase() ?? null
    if (feedFaction && structural.faction !== feedFaction) {
      problems.push(`${slug}: faction "${structural.faction}" but the feed says "${feedFaction}"`)
    }
  }
  for (const slug of structuralSlugs) {
    if (!(slug in en)) problems.push(`${slug}: structural file has no feed entry (stale season?)`)
  }
  if (problems.length > 0) {
    throw new Error(
      `phantimal structural data disagrees with the feed:\n  ${problems.join('\n  ')}`,
    )
  }

  // Locale content: the one output this script owns. Every payload is built
  // and validated before the first write, so an invalid feed never leaves a
  // partially updated tree.
  const payloads: { path: string; text: string }[] = []
  for (const slug of feedSlugs) {
    const enEntry = en[slug]!
    for (const code of APP_LOCALES) {
      const count = bulks[code].phantimals[slug]!.skills.length
      if (count !== enEntry.skills.length) {
        throw new Error(`${slug}: en has ${enEntry.skills.length} skills, ${code} has ${count}`)
      }
    }
    const skills = enEntry.skills.map((skill, si) => {
      for (const code of APP_LOCALES) {
        if (bulks[code].phantimals[slug]!.skills[si]!.levels.length !== skill.levels.length) {
          throw new Error(`${slug}: skill ${si + 1} level count differs between en and ${code}`)
        }
      }
      return {
        name: perAppLocale((code) => bulks[code].phantimals[slug]!.skills[si]!.name ?? ''),
        levels: skill.levels.map((l, li) =>
          perAppLocale((code) => {
            const description = bulks[code].phantimals[slug]!.skills[si]!.levels[li]!.description
            if (description == null) {
              throw new Error(
                `${slug}: skill ${si + 1} level ${l.level} has a null ${code} description`,
              )
            }
            return cleanDescription(description)
          }),
        ),
      }
    })
    const content = {
      name: perAppLocale((code) => bulks[code].phantimals[slug]!.name ?? slug),
      skills,
    }
    payloads.push({
      path: join(LOCALE_DIR, `${slug}.json`),
      text: JSON.stringify(content, null, 2) + '\n',
    })
  }
  let written = 0
  let unchanged = 0
  for (const { path, text } of payloads) {
    if (await writeTextIfChanged(path, text)) written++
    else unchanged++
  }

  // Prune locale files this script owns whose phantimal left the feed.
  let pruned = 0
  for (const slug of await jsonSlugs(LOCALE_DIR)) {
    if (slug in en) continue
    await unlink(join(LOCALE_DIR, `${slug}.json`))
    console.log(`  pruned ${join(LOCALE_DIR, `${slug}.json`)}`)
    pruned++
  }

  console.log('')
  console.log(`import-phantimals: ${feedSlugs.length} phantimals (structural lint clean)`)
  console.log(
    `  locale files: ${written} written, ${unchanged} unchanged${pruned ? `, ${pruned} pruned` : ''}`,
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
