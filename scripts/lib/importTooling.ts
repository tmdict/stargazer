// Reference loading for the offline reader check: match the app's image formats,
// EXIF orientation and size limits, using the published assets or a local copy.

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import sharp from 'sharp'
import { createServer } from 'vite'

import { PHANTIMAL_ID_OFFSET } from '../../src/lib/characters/phantimal.ts'
import { FRAME_NAMES } from '../../src/lib/import/frames.ts'
import type { PortraitRef, RgbaImage } from '../../src/lib/import/types.ts'
import {
  importReferenceUrl,
  importSkinsManifestUrl,
  phantimalImageUrl,
  seasonArtifactImageUrl,
} from '../../src/utils/artifactImage.ts'
import { arg } from './shared.ts'

export const ROOT = resolve(import.meta.dirname, '../..')

export interface ReferenceSource {
  label: string
  frame(name: string): Promise<Buffer>
  skinsManifest(): Promise<Record<string, string[]> | null>
  skin(file: string): Promise<Buffer | null>
  seasonalArtifact(name: string): Promise<Buffer | null>
  phantimal(name: string): Promise<Buffer | null>
}

// A directory laid out like the published `img/` tree (`import/`, `seasonal/`).
export function directorySource(img: string): ReferenceSource {
  const read = async (rel: string): Promise<Buffer | null> =>
    existsSync(join(img, rel)) ? readFile(join(img, rel)) : null
  return {
    label: img,
    frame: async (name) => {
      const bytes = await read(`import/frame-${name}.webp`)
      if (!bytes) throw new Error(`missing frame reference ${name} under ${img}`)
      return bytes
    },
    skinsManifest: async () => {
      const bytes = await read('import/skins.json')
      return bytes ? (JSON.parse(bytes.toString('utf8')) as Record<string, string[]>) : null
    },
    skin: (file) => read(`import/skin/${file}.webp`),
    seasonalArtifact: (name) => read(`seasonal/artifact/${name}.webp`),
    phantimal: (name) => read(`seasonal/phantimal/${name}.webp`),
  }
}

function remoteSource(): ReferenceSource {
  const fetchBytes = async (url: string): Promise<Buffer | null> => {
    const response = await fetch(url)
    return response.ok ? Buffer.from(await response.arrayBuffer()) : null
  }
  return {
    label: importReferenceUrl('*').replace('/*.webp', ''),
    frame: async (name) => {
      const bytes = await fetchBytes(importReferenceUrl(`frame-${name}`))
      if (!bytes)
        throw new Error(`missing frame reference ${name} at ${importReferenceUrl(`frame-${name}`)}`)
      return bytes
    },
    skinsManifest: async () => {
      const bytes = await fetchBytes(importSkinsManifestUrl())
      return bytes ? (JSON.parse(bytes.toString('utf8')) as Record<string, string[]>) : null
    },
    skin: (file) => fetchBytes(importReferenceUrl(`skin/${file}`)),
    seasonalArtifact: (name) => fetchBytes(seasonArtifactImageUrl(name)),
    phantimal: (name) => fetchBytes(phantimalImageUrl(name)),
  }
}

// `--references <dir>` reads a local copy of the published images; otherwise the deployed ones.
export const referenceSource = (): ReferenceSource => {
  const dir = arg('references')
  return dir ? directorySource(resolve(dir)) : remoteSource()
}

// `width` scales the image to that width, up or down, like the app's canvas
// draw; `maxWidth` only shrinks, like its reference icons.
export async function toImage(
  input: Buffer | string,
  size: { width?: number; maxWidth?: number } = {},
): Promise<RgbaImage> {
  let p = sharp(input).autoOrient()
  if (size.width) p = p.resize({ width: size.width })
  else if (size.maxWidth) p = p.resize({ width: size.maxWidth, withoutEnlargement: true })
  const { data, info } = await p.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  }
}

export const loadFrames = (source: ReferenceSource): Promise<RgbaImage[]> =>
  Promise.all(FRAME_NAMES.map(async (name) => toImage(await source.frame(name))))

export async function loadHeroes(
  source: ReferenceSource,
): Promise<{ names: Map<number, string>; portraits: PortraitRef[] }> {
  const dataDir = join(ROOT, 'src/data/character')
  const artDir = join(ROOT, 'src/assets/images/character')
  const names = new Map<number, string>()
  const ids = new Map<string, number>()
  const portraits: PortraitRef[] = []
  for (const file of await readdir(dataDir)) {
    if (!file.endsWith('.json')) continue
    const hero = JSON.parse(await readFile(join(dataDir, file), 'utf8')) as {
      id: number
      name: string
    }
    names.set(hero.id, hero.name)
    ids.set(hero.name, hero.id)
    const art = join(artDir, `${hero.name}.png`)
    if (!existsSync(art)) continue
    const webp = await sharp(art).webp({ quality: 85 }).toBuffer()
    portraits.push({ characterId: hero.id, image: await toImage(webp) })
  }
  const skins = await source.skinsManifest()
  for (const [slug, files] of Object.entries(skins ?? {})) {
    const characterId = ids.get(slug)
    if (characterId === undefined) continue
    for (const file of files) {
      const bytes = await source.skin(file)
      if (bytes) portraits.push({ characterId, image: await toImage(bytes), costume: true })
    }
  }
  return { names, portraits }
}

export async function loadArtifacts(
  source: ReferenceSource,
): Promise<{ names: Map<number, string>; icons: { artifactId: number; image: RgbaImage }[] }> {
  const names = new Map<number, string>()
  const icons: { artifactId: number; image: RgbaImage }[] = []
  const read = async (data: string, bytesOf: (name: string) => Promise<Buffer | null>) => {
    for (const file of await readdir(join(ROOT, data))) {
      if (!file.endsWith('.json')) continue
      const artifact = JSON.parse(await readFile(join(ROOT, data, file), 'utf8')) as {
        id: number
        name: string
      }
      names.set(artifact.id, artifact.name)
      const bytes = await bytesOf(artifact.name)
      if (bytes)
        icons.push({ artifactId: artifact.id, image: await toImage(bytes, { maxWidth: 128 }) })
    }
  }
  await read('src/data/artifact', async (name) => {
    const png = join(ROOT, 'src/assets/images/artifact', `${name}.png`)
    return existsSync(png) ? readFile(png) : null
  })
  await read('src/data/seasonal/artifact', (name) => source.seasonalArtifact(name))
  return { names, icons }
}

/* The art of units that are not heroes, by unit id, as the app gathers it for
 * formation shots: every phantimal of the season, and the companions drawn
 * with an image of their own (`companions`, from the skills), a phantimal's
 * from the published phantimal images and a hero's from the bundled art. */
export async function loadUnits(
  source: ReferenceSource,
  companions: readonly { unitId: number; image: string; phantimal: boolean }[],
): Promise<{ names: Map<number, string>; portraits: PortraitRef[] }> {
  const names = new Map<number, string>()
  const portraits: PortraitRef[] = []
  const dataDir = join(ROOT, 'src/data/seasonal/phantimal')
  for (const file of await readdir(dataDir)) {
    if (!file.endsWith('.json')) continue
    const phantimal = JSON.parse(await readFile(join(dataDir, file), 'utf8')) as {
      id: number
      name: string
    }
    const unitId = PHANTIMAL_ID_OFFSET + phantimal.id
    names.set(unitId, phantimal.name)
    const bytes = await source.phantimal(phantimal.name)
    if (bytes) portraits.push({ characterId: unitId, image: await toImage(bytes) })
  }
  for (const { unitId, image, phantimal } of companions) {
    names.set(unitId, image)
    const art = join(ROOT, 'src/assets/images/character', `${image}.png`)
    const bytes = phantimal
      ? await source.phantimal(image)
      : existsSync(art)
        ? await readFile(art)
        : null
    if (bytes) portraits.push({ characterId: unitId, image: await toImage(bytes) })
  }
  return { names, portraits }
}

/* App modules that read Vite's import.meta.glob (the map registry, the skills
 * and whatever reads them) cannot load under tsx alone, so they load through
 * Vite's server-side loader; close it when done. */
export async function appModuleLoader(): Promise<{
  load: <T>(path: string) => Promise<T>
  close: () => Promise<void>
}> {
  const vite = await createServer({
    root: ROOT,
    configFile: join(ROOT, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    logLevel: 'error',
  })
  return {
    load: <T>(path: string) => vite.ssrLoadModule(path) as Promise<T>,
    close: () => vite.close(),
  }
}
