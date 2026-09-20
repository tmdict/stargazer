// Match-import reader check: runs lib/import over a folder of result screenshots
// and prints what it read, optionally scored against a truth file. The only way
// to see the readers work outside the app (tests are pure logic by design), and
// the regression check when the game changes its result screen.
//
// Usage:
//   npm run check:import -- --samples <dir> [--truth <json>] [--references <dir>] [--maps 5]
//
//   --samples    folder of PNG/JPEG screenshots (result screens, cropped or not)
//   --truth      per-file cells (a1–a5, e1–e5: optional hero slug, p, r), optional maps,
//                and artifacts ({ a: slug | null, e: slug | null })
//                (default: truth.json beside the samples, when present)
//   --references read the frames, costume captures and seasonal icons from a local copy
//                of the published img/ tree instead of the deployed image host
//   --maps       how many maps each match had (default 5; 1 means no strip), checked
//                against what the strip reads; a truth file overrides it per file

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

import { buildArtifactTable } from '../src/lib/import/artifacts.ts'
import { prepareFrameRefs } from '../src/lib/import/frames.ts'
import { CANONICAL_WIDTH } from '../src/lib/import/layout.ts'
import { readScreenshot } from '../src/lib/import/pipeline.ts'
import { buildImportHeroTable } from '../src/lib/import/references.ts'
import type { ScreenshotReading } from '../src/lib/import/types.ts'
import { Team } from '../src/lib/types/team.ts'
import {
  loadArtifacts,
  loadFrames,
  loadHeroes,
  referenceSource,
  toImage,
} from './lib/importTooling.ts'
import { arg } from './lib/shared.ts'

interface TruthCell {
  hero?: string
  p?: number
  r?: number
}
type Truth = Record<
  string,
  {
    maps?: number
    cells?: Record<string, TruthCell>
    artifacts?: Partial<Record<'a' | 'e', string | null>>
  }
>

function printReading(
  file: string,
  reading: ScreenshotReading,
  heroNames: Map<number, string>,
  artifactNames: Map<number, string>,
  truth: Truth[string] | undefined,
  expectedMaps: number,
  tally: { hero: number[]; sure: number[]; p: number[]; r: number[]; artifact: number[] },
): void {
  const side = (team: Team): 'a' | 'e' => (team === Team.ALLY ? 'a' : 'e')
  const result = (t: Team | null): string => (t === Team.ALLY ? 'W' : t === Team.ENEMY ? 'L' : '?')
  const mapsOff = expectedMaps === 1 ? reading.mapCount !== null : reading.mapCount !== expectedMaps
  console.log(
    `\n== ${file}: map ${reading.mapIndex === null ? '?' : reading.mapIndex + 1}, this map ${result(reading.winner)}, strip ${reading.mapResults.map(result).join('')}` +
      (mapsOff
        ? `  MAPS✗ read ${reading.mapCount ?? 'no strip'}, expected ${expectedMaps === 1 ? 'no strip' : expectedMaps}`
        : '') +
      (reading.warnings.length
        ? `  warnings: ${reading.warnings.map((w) => w.kind).join(', ')}`
        : ''),
  )
  for (const team of [Team.ALLY, Team.ENEMY]) {
    const artifact = reading.artifacts[team]
    const topArtifact = artifact?.candidates[0]
    const artifactName = topArtifact
      ? (artifactNames.get(topArtifact.artifactId) ?? String(topArtifact.artifactId))
      : null
    const expectedArtifact = truth?.artifacts?.[side(team)]
    let artifactVerdict = ''
    if (expectedArtifact !== undefined) {
      const correct = artifactName === expectedArtifact
      tally.artifact.push(correct ? 1 : 0)
      artifactVerdict = `  | truth ${expectedArtifact ?? 'none'} ${correct ? '' : 'ARTIFACT✗'}`
    }
    if (topArtifact || expectedArtifact !== undefined) {
      const scores =
        artifact && topArtifact
          ? ` ${topArtifact.score.toFixed(2)} lead ${artifact.margin.toFixed(2)}`
          : ''
      console.log(`  ${side(team)} artifact: ${artifactName ?? 'none'}${scores}${artifactVerdict}`)
    }
    reading.sides[team].forEach((cell, row) => {
      const key = `${side(team)}${row + 1}`
      const top = cell.candidates[0]
      const name = top ? (heroNames.get(top.characterId) ?? String(top.characterId)) : '-'
      const t = truth?.cells?.[key]
      let verdict = ''
      if (t) {
        const expected: string[] = []
        const errors: string[] = []
        if (t.hero !== undefined) {
          const correct = name === t.hero
          tally.hero.push(correct ? 1 : 0)
          if (cell.sure) tally.sure.push(correct ? 1 : 0)
          expected.push(t.hero)
          if (!correct) errors.push('HERO✗')
        }
        if (t.p !== undefined) {
          const correct = cell.paragon.level === t.p
          tally.p.push(correct ? 1 : 0)
          expected.push(`P${t.p}`)
          if (!correct) errors.push('P✗')
        }
        if (t.r !== undefined) {
          const correct = cell.refinement.level === t.r
          tally.r.push(correct ? 1 : 0)
          expected.push(`R${t.r}`)
          if (!correct) errors.push('R✗')
        }
        if (expected.length) verdict = `  | truth ${expected.join(' ')} ${errors.join('')}`
      }
      console.log(
        `  ${key} ${name.padEnd(14)} ${top ? top.score.toFixed(2) : ' -  '} lead ${cell.margin.toFixed(2)}${top?.learned ? ' learned' : ''}${top?.costume ? ' costume' : ''}${cell.sure ? '' : ' review'}` +
          `  P${cell.paragon.level} (${cell.paragon.score.toFixed(2)}${cell.paragon.sure ? '' : ' check'})  R${cell.refinement.level} ${cell.refinement.family} ${cell.refinement.stars}★${verdict}`,
      )
    })
  }
}

async function main(): Promise<void> {
  const samplesArg = arg('samples')
  if (!samplesArg) {
    console.error(
      'usage: check-import --samples <dir> [--truth <json>] [--references <dir>] [--maps 5]',
    )
    process.exit(2)
  }
  const samples = resolve(samplesArg)
  const truthFile = arg('truth') ?? join(samples, 'truth.json')
  const truth: Truth = existsSync(truthFile)
    ? (JSON.parse(await readFile(truthFile, 'utf8')) as Truth)
    : {}
  const defaultMaps = Number(arg('maps') ?? 5)

  const source = referenceSource()
  const refs = prepareFrameRefs(await loadFrames(source))
  const { names: heroNames, portraits } = await loadHeroes(source)
  const heroTable = buildImportHeroTable(portraits)
  const { names: artifactNames, icons } = await loadArtifacts(source)
  const artifactTable = buildArtifactTable(icons)
  const costumes = portraits.filter((p) => p.costume).length
  console.log(
    `references from ${source.label}: ${portraits.length - costumes} portraits, ${costumes} costume references, ${heroTable.ids.length} descriptors, ${icons.length} artifact icons`,
  )

  const files = (await readdir(samples)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort()
  const tally = {
    hero: [] as number[],
    sure: [] as number[],
    p: [] as number[],
    r: [] as number[],
    artifact: [] as number[],
  }
  for (const file of files) {
    const shot = await toImage(join(samples, file), { width: CANONICAL_WIDTH })
    const t = truth[basename(file)]
    const started = performance.now()
    const reading = readScreenshot(shot, {
      frames: refs,
      heroes: heroTable,
      artifacts: artifactTable,
    })
    const ms = Math.round(performance.now() - started)
    printReading(file, reading, heroNames, artifactNames, t, t?.maps ?? defaultMaps, tally)
    console.log(`  (${ms} ms)`)
  }
  const sum = (a: number[]): string => `${a.reduce((x, y) => x + y, 0)}/${a.length}`
  if (tally.hero.length || tally.p.length || tally.r.length || tally.artifact.length) {
    console.log(
      `\nheroes ${sum(tally.hero)} (high confidence ${sum(tally.sure)}), paragon ${sum(tally.p)}, refinement ${sum(tally.r)}, artifacts ${sum(tally.artifact)}`,
    )
  }
}

await main()
