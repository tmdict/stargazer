// Season structural importer: writes the files a season cutover used to write
// by hand, from the feed.
//   src/data/seasonal/artifact/<slug>.json      {id, name, season, stats}
//   src/locales/seasonal/artifact/<slug>.json   {en, zh} display names
//   src/data/seasonal/phantimal/<slug>.json     {id, name, season, range, faction, …}
// The rules are in scripts/lib/structure.ts. Curated fields (a phantimal's
// `targeting`, an existing `qualifyingFactions`) are kept, an id never changes
// within a season, and files whose slug left the feed are removed. Text is the
// other importers' job (import:seasonal), which lint these files against the
// feed.
//
// Usage:
//   npm run import:structure                          # reads DATA_FEED_DIR/<feed>/…
//   npm run import:structure -- --src-dir <PATH> | --url-base <URL>

import { existsSync } from 'node:fs'
import { readdir, readFile, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'

import { arg, feedSrcDir, writeTextIfChanged } from './lib/shared.ts'
import {
  artifactStructure,
  phantimalStructure,
  type FeedArtifact,
  type FeedPhantimal,
  type Json,
} from './lib/structure.ts'

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIRS = {
  artifactData: join(PROJECT_ROOT, 'src', 'data', 'seasonal', 'artifact'),
  artifactNames: join(PROJECT_ROOT, 'src', 'locales', 'seasonal', 'artifact'),
  phantimalData: join(PROJECT_ROOT, 'src', 'data', 'seasonal', 'phantimal'),
}

const URL_BASE_FLAG = arg('url-base')
const SRC_DIR_FLAG = arg('src-dir')

async function loadFeed<T>(feed: string, file: string): Promise<T> {
  if (URL_BASE_FLAG) {
    const url = `${URL_BASE_FLAG.replace(/\/$/, '')}/${feed}/${file}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`fetch ${url} → HTTP ${res.status}`)
    return (await res.json()) as T
  }
  const path = join(feedSrcDir(PROJECT_ROOT, SRC_DIR_FLAG), feed, file)
  if (!existsSync(path)) throw new Error(`data feed not found at ${path}`)
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function readDir(dir: string): Promise<Record<string, Json>> {
  const out: Record<string, Json> = {}
  if (!existsSync(dir)) return out
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      out[entry.name.slice(0, -5)] = JSON.parse(await readFile(join(dir, entry.name), 'utf8'))
    }
  }
  return out
}

// The committed files are Prettier-formatted; the output must match them byte for
// byte. Prettier keeps an object expanded only when its input is, so it gets the
// indented form.
async function format(path: string, value: unknown): Promise<string> {
  const options = (await prettier.resolveConfig(path)) ?? {}
  return prettier.format(JSON.stringify(value, null, 2), {
    ...options,
    filepath: path,
    parser: 'json',
  })
}

async function main() {
  const artifacts = {
    en: (await loadFeed<{ artifacts: Record<string, FeedArtifact> }>('en', 'artifacts.json'))
      .artifacts,
    zh: (await loadFeed<{ artifacts: Record<string, FeedArtifact> }>('zh', 'artifacts.json'))
      .artifacts,
  }
  const phantimals = (
    await loadFeed<{ phantimals: Record<string, FeedPhantimal> }>('en', 'phantimals.json')
  ).phantimals

  const art = artifactStructure(artifacts.en, artifacts.zh, await readDir(DIRS.artifactData))
  const pet = phantimalStructure(phantimals, await readDir(DIRS.phantimalData))
  const problems = [...art.problems, ...pet.problems]
  if (problems.length > 0) {
    throw new Error(`import-structure: nothing written:\n  ${problems.join('\n  ')}`)
  }

  const outputs: [dir: string, files: Record<string, unknown>][] = [
    [DIRS.artifactData, art.data],
    [DIRS.artifactNames, art.names],
    [DIRS.phantimalData, pet.data],
  ]
  // Every file is formatted before the first write, so a failure leaves the tree as it was.
  const payloads: { path: string; text: string }[] = []
  for (const [dir, files] of outputs) {
    for (const [slug, value] of Object.entries(files)) {
      const path = join(dir, `${slug}.json`)
      payloads.push({ path, text: await format(path, value) })
    }
  }
  let written = 0
  for (const { path, text } of payloads) if (await writeTextIfChanged(path, text)) written++

  // The previous season's files, whose slugs the feed no longer lists.
  const keep = [art.data, art.names, pet.data]
  let removed = 0
  for (const [i, dir] of [DIRS.artifactData, DIRS.artifactNames, DIRS.phantimalData].entries()) {
    for (const slug of Object.keys(await readDir(dir))) {
      if (slug in keep[i]!) continue
      await unlink(join(dir, `${slug}.json`))
      console.log(`  removed ${join(dir, `${slug}.json`)}`)
      removed++
    }
  }

  console.log(
    `import-structure: ${Object.keys(art.data).length} seasonal artifacts, ` +
      `${Object.keys(pet.data).length} phantimals`,
  )
  console.log(
    `  files: ${written} written, ${payloads.length - written} unchanged` +
      (removed ? `, ${removed} removed` : ''),
  )
}

main().catch((err) => {
  console.error(err instanceof Error ? (err.stack ?? err.message) : err)
  process.exit(1)
})
