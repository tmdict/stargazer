// Formation-import check: reads a sample set's formation shots and its result
// shots, builds the import plan as the app does (the result shots name each
// board's lineup), and prints what every formation shot places, optionally
// scored against a truth file. The plan reads the map registry and the skills,
// which load through Vite's import.meta.glob, so the app modules run through
// Vite's server-side loader rather than tsx alone.
//
// Usage:
//   npm run check:formation -- --samples <dir> [--truth <json>] [--references <dir>] [--mode 5v5]
//                               [--swap-sides]
//
//   --samples    a set folder: formation shots under formations/, result shots of the
//                same match under results/ (optional; without them a board's lineup
//                comes from the formation's own card row)
//   --truth      per formation file: slots, slot (1-based), side (ally or enemy), map,
//                artifact and phantimal (slug, or null for none), cards (c1-c5 as the
//                match truth's cells, for a set without result shots) and units
//                ({ hex, and one of hero, phantimal, or companionOf with an owner
//                listed in the same array }); default formations/truth.json
//   --references read the frames, costume captures and seasonal icons from a local copy
//                of the published img/ tree instead of the deployed image host
//   --mode       the Teams mode whose map lists and board count apply (default 5v5)
//   --swap-sides the match's Swap sides, each result shot's Ally column on the enemy side,
//                for a match whose formation shots do not settle the sides

import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import type * as CompanionModule from '../src/lib/characters/companion.ts'
import type * as PhantimalModule from '../src/lib/characters/phantimal.ts'
import type * as PhantimalFactionModule from '../src/lib/characters/phantimalFaction.ts'
import type * as ArtifactsModule from '../src/lib/import/artifacts.ts'
import type * as FormationModule from '../src/lib/import/formation.ts'
import type * as FramesModule from '../src/lib/import/frames.ts'
import type * as HeroesModule from '../src/lib/import/heroes.ts'
import type * as LayoutModule from '../src/lib/import/layout.ts'
import type * as PipelineModule from '../src/lib/import/pipeline.ts'
import type * as ReferencesModule from '../src/lib/import/references.ts'
import type { FormationReading, ReferenceSet } from '../src/lib/import/types.ts'
import type { TeamModeKey } from '../src/lib/teams/modes.ts'
import type * as TeamImportModule from '../src/lib/teams/teamImport.ts'
import { Team } from '../src/lib/types/team.ts'
import type * as DataLoaderModule from '../src/utils/dataLoader.ts'
import {
  appModuleLoader,
  loadArtifacts,
  loadFrames,
  loadHeroes,
  loadUnits,
  referenceSource,
  toImage,
} from './lib/importTooling.ts'
import { arg, hasFlag } from './lib/shared.ts'

interface TruthUnit {
  hex: number
  hero?: string
  phantimal?: string
  companionOf?: string
  index?: number
}

type Truth = Record<
  string,
  {
    slots?: number
    slot?: number
    side?: 'ally' | 'enemy'
    map?: string
    artifact?: string | null
    phantimal?: string | null
    cards?: Record<string, { hero?: string; p?: number; r?: number }>
    units?: TruthUnit[]
  }
>

const images = async (dir: string): Promise<string[]> =>
  existsSync(dir) ? (await readdir(dir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort() : []

async function main(): Promise<void> {
  const samplesArg = arg('samples')
  if (!samplesArg) {
    console.error(
      'usage: check-formation-import --samples <dir> [--truth <json>] [--references <dir>] [--mode 5v5] [--swap-sides]',
    )
    process.exit(2)
  }
  const samples = resolve(samplesArg)
  const truthFile = arg('truth') ?? join(samples, 'formations', 'truth.json')
  const truth: Truth = existsSync(truthFile)
    ? (JSON.parse(await readFile(truthFile, 'utf8')) as Truth)
    : {}
  const mode = (arg('mode') ?? '5v5') as TeamModeKey

  const { load, close } = await appModuleLoader()
  try {
    // Registers every skill, which the companion lookups read.
    await load('/src/lib/skills/skill.ts')
    const { companionIdsOf, companionImages } = await load<typeof CompanionModule>(
      '/src/lib/characters/companion.ts',
    )
    const { inPhantimalBand, isPhantimalId, toPhantimalId } = await load<typeof PhantimalModule>(
      '/src/lib/characters/phantimal.ts',
    )
    const { lineupQualifies } = await load<typeof PhantimalFactionModule>(
      '/src/lib/characters/phantimalFaction.ts',
    )
    const { loadCharacters, loadPhantimals } = await load<typeof DataLoaderModule>(
      '/src/utils/dataLoader.ts',
    )
    const { buildArtifactTable } = await load<typeof ArtifactsModule>(
      '/src/lib/import/artifacts.ts',
    )
    const { prepareFrameRefs } = await load<typeof FramesModule>('/src/lib/import/frames.ts')
    const { buildHeroTable } = await load<typeof HeroesModule>('/src/lib/import/heroes.ts')
    const { FORMATION_MAX_WIDTH, RESULT_MAX_WIDTH } = await load<typeof LayoutModule>(
      '/src/lib/import/layout.ts',
    )
    const { readScreenshot } = await load<typeof PipelineModule>('/src/lib/import/pipeline.ts')
    const { buildImportHeroTable } = await load<typeof ReferencesModule>(
      '/src/lib/import/references.ts',
    )
    const { readFormation } = await load<typeof FormationModule>('/src/lib/import/formation.ts')
    const { buildTeamImportPlan, formationsSwapped } = await load<typeof TeamImportModule>(
      '/src/lib/teams/teamImport.ts',
    )

    const source = referenceSource()
    const { names: heroNames, portraits } = await loadHeroes(source)
    const { names: artifactNames, icons } = await loadArtifacts(source)
    const { names: unitNames, portraits: units } = await loadUnits(
      source,
      companionImages().map((c) => ({ ...c, phantimal: inPhantimalBand(c.unitId) })),
    )
    const refs: ReferenceSet = {
      frames: prepareFrameRefs(await loadFrames(source)),
      heroes: buildImportHeroTable(portraits),
      artifacts: buildArtifactTable(icons),
      units: buildHeroTable(units),
    }
    // The board's faction rule, as the app hands it to the plan.
    const factions = new Map(loadCharacters().map((c) => [c.id, c.faction]))
    const phantimals = new Map(loadPhantimals().map((p) => [toPhantimalId(p.id), p]))
    const phantimalFits = (phantimalId: number, lineup: readonly number[]): boolean =>
      lineupQualifies(phantimals.get(phantimalId), lineup, (id) => factions.get(id))
    const heroIds = new Map([...heroNames].map(([id, slug]) => [slug, id]))
    const unitIds = new Map([...unitNames].map(([id, slug]) => [slug, id]))
    const ownerId = (slug: string): number | undefined => heroIds.get(slug) ?? unitIds.get(slug)
    const nameOf = (unitId: number | null): string => {
      if (unitId === null) return '-'
      const name = heroNames.get(unitId) ?? unitNames.get(unitId)
      if (name) return name
      const owner = unitId % 10000
      const ownerName = heroNames.get(owner) ?? unitNames.get(unitId - (unitId % 100000) + owner)
      return `${ownerName ?? owner}'s companion`
    }
    const unknown = Object.entries(truth).flatMap(([file, entry]) =>
      [
        ...(entry.units ?? []).flatMap((u) => [u.hero, u.phantimal, u.companionOf]),
        entry.phantimal,
        ...Object.values(entry.cards ?? {}).map((c) => c.hero),
      ]
        .filter((slug): slug is string => typeof slug === 'string' && ownerId(slug) === undefined)
        .map((slug) => `${file}: ${slug}`),
    )
    if (unknown.length) {
      console.error(`${truthFile} names what the current data lacks:\n  ${unknown.join('\n  ')}`)
      process.exit(1)
    }

    const resultFiles = await images(join(samples, 'results'))
    const formationFiles = await images(join(samples, 'formations'))
    const results = []
    for (const file of resultFiles) {
      const shot = await toImage(join(samples, 'results', file), { maxWidth: RESULT_MAX_WIDTH })
      const reading = readScreenshot(shot, refs)
      results.push({
        reading,
        mapIndex: reading.mapIndex,
        winner: reading.winner,
        overrides: {},
        artifactOverrides: {},
      })
    }
    const formations: { file: string; reading: FormationReading; ms: number }[] = []
    for (const file of formationFiles) {
      const shot = await toImage(join(samples, 'formations', file), {
        maxWidth: FORMATION_MAX_WIDTH,
      })
      const started = performance.now()
      const reading = readFormation(shot, refs)
      formations.push({ file, reading, ms: Math.round(performance.now() - started) })
    }
    const assignments = formations.map(({ reading }) => ({
      reading,
      mapIndex: reading.mapIndex,
      overrides: {},
      artifactOverrides: {},
      unitOverrides: {},
      picks: {},
    }))
    // Swap sides as the import sets it.
    const formationSwap = formationsSwapped(results, assignments)
    const swapSides = formationSwap ?? hasFlag('swap-sides')
    const plan = buildTeamImportPlan(
      results,
      mode,
      { prefix: '', left: '', right: '' },
      {
        swapSides,
        formations: assignments,
        replays: [],
        matchImport: results.length > 0,
        phantimalFits,
      },
    )
    console.log(
      `references from ${source.label}; ${resultFiles.length} result and ${formationFiles.length} formation shots`,
    )
    if (resultFiles.length > 0) {
      console.log(
        `sides ${swapSides ? 'swapped' : 'as the result tabs list them'}, ${formationSwap !== null ? 'from the formation shots' : 'as --swap-sides says'}`,
      )
    }
    for (const issue of plan.issues) console.log(`plan issue: ${JSON.stringify(issue)}`)

    const tally: Record<string, number[]> = {}
    let extra = 0
    const score = (field: string, correct: boolean): string => {
      ;(tally[field] ??= []).push(correct ? 1 : 0)
      return correct ? '' : ` ${field.toUpperCase()}✗`
    }
    formations.forEach(({ file, reading, ms }, i) => {
      const t = truth[file]
      const side = reading.side === null ? null : reading.side === Team.ALLY ? 'ally' : 'enemy'
      const board = reading.mapIndex === null ? null : plan.boards[reading.mapIndex]
      const map = board?.map ?? null
      const verdicts = [
        t?.side !== undefined ? score('side', side === t.side) : '',
        t?.slot !== undefined ? score('slot', reading.mapIndex === t.slot - 1) : '',
        t?.slots !== undefined ? score('slots', reading.mapCount === t.slots) : '',
        t?.map !== undefined ? score('map', map === t.map) : '',
      ].join('')
      console.log(
        `\n== ${file}: ${side ?? 'no board'}, slot ${reading.mapIndex === null ? '?' : reading.mapIndex + 1}/${reading.mapCount ?? '?'}, map ${map ?? '?'}` +
          (reading.board
            ? `, board ${reading.board.scale.toFixed(1)} px/hex, support ${reading.board.support.toFixed(2)}`
            : '') +
          (reading.warnings.length
            ? `, warnings: ${reading.warnings.map((w) => w.kind).join(', ')}`
            : '') +
          `  (${ms} ms)${verdicts}`,
      )
      const artifact = reading.side === null ? null : reading.artifacts[reading.side]
      const artifactName = artifact ? artifactNames.get(artifact.candidates[0]!.artifactId)! : null
      if (artifact || t?.artifact !== undefined) {
        const verdict =
          t?.artifact !== undefined ? score('artifact', artifactName === t.artifact) : ''
        console.log(
          `  artifact ${artifactName ?? 'none'}${artifact ? ` lead ${artifact.margin.toFixed(2)}${artifact.sure ? '' : ' review'}` : ''}${verdict}`,
        )
      }
      if (reading.side !== null) {
        reading.sides[reading.side].forEach((cell, row) => {
          const key = `c${row + 1}`
          const name = cell.recognised ? nameOf(cell.candidates[0]!.characterId) : '-'
          const c = t?.cards?.[key]
          const verdict = [
            c?.hero !== undefined ? score('card hero', name === c.hero) : '',
            c?.p !== undefined ? score('paragon', cell.paragon.level === c.p) : '',
            c?.r !== undefined ? score('refinement', cell.refinement.level === c.r) : '',
          ].join('')
          console.log(
            `  ${key} ${name.padEnd(14)} lead ${cell.margin.toFixed(2)}${cell.sure ? '' : ' review'}  P${cell.paragon.level}${cell.paragon.sure ? '' : ' check'}  R${cell.refinement.level}${cell.refinement.sure ? '' : ' check'}${verdict}`,
          )
        })
      }
      // Each labelled unit counts as placed when a portrait stands on its tile,
      // and its identity is scored there; a portrait on an unlabelled tile is extra.
      const assignments = plan.units[i] ?? []
      const labelOf = (u: TruthUnit): string =>
        u.hero ?? u.phantimal ?? `${u.companionOf}'s companion`
      const isRight = (u: TruthUnit, id: number | null): boolean => {
        if (u.hero) return id === heroIds.get(u.hero)
        if (u.phantimal) return id === unitIds.get(u.phantimal)
        const owner = ownerId(u.companionOf!)
        const ids = owner === undefined ? [] : companionIdsOf(owner)
        return u.index ? id === ids[u.index - 1] : id !== null && ids.includes(id)
      }
      reading.units.forEach((unit, k) => {
        const a = assignments[k]
        const expected = t?.units?.find((u) => u.hex === unit.hexId)
        let verdict = ''
        if (t?.units && !expected) {
          extra++
          verdict = ' EXTRA'
        } else if (expected) {
          verdict = score('unit identity', isRight(expected, a?.unitId ?? null))
          if (verdict) verdict += ` truth ${labelOf(expected)}`
        }
        console.log(
          `  hex ${String(unit.hexId).padStart(2)} ${nameOf(a?.unitId ?? null).padEnd(22)} ${a?.state ?? '-'}  ring ${unit.score.toFixed(2)}  top ${nameOf(unit.candidates[0]?.characterId ?? null)} ${unit.candidates[0]?.score.toFixed(2) ?? ''}${verdict}`,
        )
      })
      for (const u of t?.units ?? []) {
        const found = reading.units.some((unit) => unit.hexId === u.hex)
        score('units placed', found)
        if (!found) console.log(`  hex ${String(u.hex).padStart(2)} MISSED ${labelOf(u)}`)
      }
      if (t?.phantimal !== undefined) {
        const shown = assignments.find((a) => a.unitId !== null && isPhantimalId(a.unitId))?.unitId
        const verdict = score(
          'phantimal',
          (shown === undefined ? null : nameOf(shown)) === t.phantimal,
        )
        if (verdict)
          console.log(`  phantimal ${shown === undefined ? 'none' : nameOf(shown)}${verdict}`)
      }
    })

    const fields = Object.entries(tally)
    if (fields.length) {
      console.log(
        `\n${fields.map(([field, v]) => `${field} ${v.reduce((a, b) => a + b, 0)}/${v.length}`).join(', ')}, extra units ${extra}`,
      )
    }
  } finally {
    await close()
  }
}

await main()
