// Match-import reference images for chaldea. Every PNG under <chaldea>/img/import
// is the source of truth: the paragon frames and star rows at the top level, the
// costume captures under skin/ (named <hero slug>-<anything>.png). This writes the
// WebP the app fetches beside each PNG and regenerates skins.json from the skin
// folder, so adding a costume is: drop the PNG, run this, commit chaldea.
//
// Usage:
//   npm run import:refs -- --chaldea <path to the chaldea checkout>

import { existsSync } from 'node:fs'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'

const ROOT = resolve(import.meta.dirname, '..')

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

const kb = async (path: string): Promise<string> =>
  `${((await stat(path)).size / 1024).toFixed(0)} KB`

// Exact alpha at source resolution: the readers correlate against these pixels.
async function toWebp(png: string): Promise<void> {
  const out = png.replace(/\.png$/, '.webp')
  await sharp(png).webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(out)
  const m = await sharp(out).metadata()
  console.log(
    `${basename(out).padEnd(28)} ${m.width}x${m.height}  ${await kb(out)}  (from ${await kb(png)} png)`,
  )
}

async function heroSlugs(): Promise<string[]> {
  const dir = join(ROOT, 'src/data/character')
  const slugs: string[] = []
  for (const file of await readdir(dir)) {
    if (!file.endsWith('.json')) continue
    slugs.push((JSON.parse(await readFile(join(dir, file), 'utf8')) as { name: string }).name)
  }
  // Longest first, so lily-may-alt resolves to lily-may before any shorter slug.
  return slugs.sort((a, b) => b.length - a.length)
}

async function main(): Promise<void> {
  const chaldea = arg('chaldea')
  if (!chaldea) {
    console.error('usage: import-refs --chaldea <path>')
    process.exit(2)
  }
  const importDir = join(chaldea, 'img/import')
  const skinDir = join(importDir, 'skin')
  const pngs = (dir: string) => readdir(dir).then((f) => f.filter((n) => n.endsWith('.png')).sort())

  for (const file of await pngs(importDir)) await toWebp(join(importDir, file))

  const manifest: Record<string, string[]> = {}
  if (existsSync(skinDir)) {
    const slugs = await heroSlugs()
    for (const file of await pngs(skinDir)) {
      const name = file.replace(/\.png$/, '')
      const slug = slugs.find((s) => name.startsWith(`${s}-`))
      if (!slug) {
        console.warn(`skin/${file}: no hero slug prefix, skipped`)
        continue
      }
      await toWebp(join(skinDir, file))
      ;(manifest[slug] ??= []).push(name)
    }
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)))
  await writeFile(join(importDir, 'skins.json'), `${JSON.stringify(sorted, null, 2)}\n`)
  console.log(`skins.json: ${Object.values(sorted).flat().length} costume references`)
}

await main()
