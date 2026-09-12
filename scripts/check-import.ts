// Match-import reader check: runs lib/import over a folder of result screenshots
// and prints what it read, optionally scored against a truth file. The only way
// to see the readers work outside the app (tests are pure logic by design), and
// the regression check when the game changes its result screen.
//
// Usage:
//   npm run check:import -- --samples <dir> --frames <dir> [--artifacts <dir>] [--maps 5] [--truth <json>]
//
//   --samples    folder of PNG/JPEG screenshots (hand-cropped result screens)
//   --frames     folder holding frame-p0.webp … frame-p4-crown.webp (chaldea's img/import);
//                its skins.json and skin/ folder, when present, add the costume references
//   --artifacts  folder of seasonal artifact icons (chaldea's img/seasonal/artifact); the
//                bundled permanent six are always included
//   --maps       circles on the strip for every file in the folder (default 5); a truth
//                file overrides it per file
//   --truth      { "<file>": { "maps": 3, "cells": { "a1": { "hero": "gunnar", "p": 4, "r": 4 }, … } } }
//
// Decoding goes through sharp, which vite-imagetools already pulls in; portraits
// are re-encoded as WebP q85 first, the way the app ships them.

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import sharp from 'sharp'

import { buildArtifactTable } from '../src/lib/import/artifacts.ts'
import { FRAME_NAMES, prepareFrameRefs } from '../src/lib/import/frames.ts'
import { buildHeroTable } from '../src/lib/import/heroes.ts'
import { CANONICAL_WIDTH } from '../src/lib/import/layout.ts'
import { readScreenshot } from '../src/lib/import/pipeline.ts'
import type { PortraitRef, RgbaImage, ScreenshotReading } from '../src/lib/import/types.ts'
import { Team } from '../src/lib/types/team.ts'
import { arg } from './lib/shared.ts'

const ROOT = resolve(import.meta.dirname, '..')

interface TruthCell {
  hero: string
  p: number
  r: number
}
type Truth = Record<string, { maps?: number; cells: Record<string, TruthCell> }>

const toImage = async (input: Buffer | string, width?: number): Promise<RgbaImage> => {
  let p = sharp(input)
  if (width) p = p.resize({ width })
  const { data, info } = await p.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length),
  }
}

async function loadHeroes(
  referenceDir: string,
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
  const manifest = join(referenceDir, 'skins.json')
  if (existsSync(manifest)) {
    const skins = JSON.parse(await readFile(manifest, 'utf8')) as Record<string, string[]>
    for (const [slug, files] of Object.entries(skins)) {
      const characterId = ids.get(slug)
      if (characterId === undefined) continue
      for (const file of files) {
        const path = join(referenceDir, 'skin', `${file}.webp`)
        if (!existsSync(path)) continue
        portraits.push({ characterId, image: await toImage(path), costume: true })
      }
    }
  }
  return { names, portraits }
}

async function loadArtifacts(
  seasonalDir: string | undefined,
): Promise<{ names: Map<number, string>; icons: { artifactId: number; image: RgbaImage }[] }> {
  const names = new Map<number, string>()
  const icons: { artifactId: number; image: RgbaImage }[] = []
  const dirs = [
    {
      data: join(ROOT, 'src/data/artifact'),
      art: join(ROOT, 'src/assets/images/artifact'),
      ext: 'png',
    },
    { data: join(ROOT, 'src/data/seasonal/artifact'), art: seasonalDir, ext: 'webp' },
  ]
  for (const { data, art, ext } of dirs) {
    if (!art || !existsSync(art)) continue
    for (const file of await readdir(data)) {
      if (!file.endsWith('.json')) continue
      const artifact = JSON.parse(await readFile(join(data, file), 'utf8')) as {
        id: number
        name: string
      }
      names.set(artifact.id, artifact.name)
      const icon = join(art, `${artifact.name}.${ext}`)
      if (existsSync(icon)) icons.push({ artifactId: artifact.id, image: await toImage(icon) })
    }
  }
  return { names, icons }
}

function printReading(
  file: string,
  reading: ScreenshotReading,
  heroNames: Map<number, string>,
  artifactNames: Map<number, string>,
  truth: Truth[string] | undefined,
  tally: { hero: number[]; sure: number[]; p: number[]; r: number[] },
): void {
  const side = (team: Team): string => (team === Team.ALLY ? 'a' : 'e')
  const result = (t: Team | null): string => (t === Team.ALLY ? 'W' : t === Team.ENEMY ? 'L' : '?')
  console.log(
    `\n== ${file}: map ${reading.mapIndex === null ? '?' : reading.mapIndex + 1}, this map ${result(reading.winner)}, strip ${reading.mapResults.map(result).join('')}` +
      (reading.warnings.length
        ? `  warnings: ${reading.warnings.map((w) => w.kind).join(', ')}`
        : ''),
  )
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const artifact = reading.artifacts[team]
    if (artifact && artifact.candidates.length) {
      const top = artifact.candidates[0]!
      console.log(
        `  ${side(team)} artifact: ${artifactNames.get(top.artifactId) ?? top.artifactId} ${top.score.toFixed(2)} lead ${artifact.margin.toFixed(2)}`,
      )
    }
    reading.sides[team].forEach((cell, row) => {
      const key = `${side(team)}${row + 1}`
      const top = cell.candidates[0]
      const name = top ? (heroNames.get(top.characterId) ?? String(top.characterId)) : '-'
      const t = truth?.cells[key]
      let verdict = ''
      if (t) {
        const heroOk = name === t.hero
        const pOk = cell.paragon.level === t.p
        const rOk = cell.refinement.level === t.r
        tally.hero.push(heroOk ? 1 : 0)
        if (cell.sure) tally.sure.push(heroOk ? 1 : 0)
        tally.p.push(pOk ? 1 : 0)
        tally.r.push(rOk ? 1 : 0)
        verdict = `  | truth ${t.hero} P${t.p} R${t.r} ${heroOk ? '' : 'HERO✗'}${pOk ? '' : 'P✗'}${rOk ? '' : 'R✗'}`
      }
      console.log(
        `  ${key} ${name.padEnd(14)} ${top ? top.score.toFixed(2) : ' -  '} lead ${cell.margin.toFixed(2)}${top?.learned ? ' learned' : ''}${top?.costume ? ' costume' : ''}${cell.sure ? '' : ' review'}` +
          `  P${cell.paragon.level} (${cell.paragon.score.toFixed(2)}${cell.paragon.sure ? '' : ' check'})  R${cell.refinement.level} ${cell.refinement.family} ${cell.refinement.stars}★${verdict}`,
      )
    })
  }
}

async function main(): Promise<void> {
  const samples = arg('samples')
  const framesDir = arg('frames')
  if (!samples || !framesDir) {
    console.error(
      'usage: check-import --samples <dir> --frames <dir> [--artifacts <dir>] [--maps 5] [--truth <json>]',
    )
    process.exit(2)
  }
  const truthFile = arg('truth')
  const truth: Truth = truthFile ? (JSON.parse(await readFile(truthFile, 'utf8')) as Truth) : {}
  const defaultMaps = Number(arg('maps') ?? 5)

  const frames = await Promise.all(
    FRAME_NAMES.map((n) => toImage(join(framesDir, `frame-${n}.webp`))),
  )
  const refs = prepareFrameRefs(frames)
  const { names: heroNames, portraits } = await loadHeroes(framesDir)
  const heroTable = buildHeroTable(portraits)
  const { names: artifactNames, icons } = await loadArtifacts(arg('artifacts'))
  const artifactTable = buildArtifactTable(icons)
  const costumes = portraits.filter((p) => p.costume).length
  console.log(
    `references: ${portraits.length - costumes} portraits, ${costumes} costume references, ${heroTable.ids.length} descriptors, ${icons.length} artifact icons`,
  )

  const files = (await readdir(samples)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()
  const tally = { hero: [] as number[], sure: [] as number[], p: [] as number[], r: [] as number[] }
  for (const file of files) {
    const shot = await toImage(join(samples, file), CANONICAL_WIDTH)
    const t = truth[basename(file)]
    const started = performance.now()
    const reading = readScreenshot(
      shot,
      { frames: refs, heroes: heroTable, artifacts: artifactTable },
      t?.maps ?? defaultMaps,
    )
    const ms = Math.round(performance.now() - started)
    printReading(file, reading, heroNames, artifactNames, t, tally)
    console.log(`  (${ms} ms)`)
  }
  const sum = (a: number[]): string => `${a.reduce((x, y) => x + y, 0)}/${a.length}`
  if (tally.hero.length) {
    console.log(
      `\nheroes ${sum(tally.hero)} (high confidence ${sum(tally.sure)}), paragon ${sum(tally.p)}, refinement ${sum(tally.r)}`,
    )
  }
}

await main()
