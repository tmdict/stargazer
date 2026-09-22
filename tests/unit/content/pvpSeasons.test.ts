import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

import { PVP_SEASONS } from '@/content/pvp/seasons'
import { loadCharacters } from '@/utils/dataLoader'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const roster = new Set(loadCharacters().map((character) => character.name))

// A summary is transcribed by hand from a finished season's report, so every
// reference it makes is checked against the roster and the report it cites.
it.each(PVP_SEASONS.map((summary) => [summary.season, summary] as const))(
  'season %i summary is consistent with the roster and its report',
  (season, summary) => {
    const template = readFileSync(
      join(root, `src/content/pvp/s${season}/index.template.html`),
      'utf8',
    )
    const ids = new Set(summary.teams.map((team) => team.id))

    expect(ids.size).toBe(summary.teams.length)
    expect(
      summary.teams.flatMap((team) => team.heroes.filter((slug) => !roster.has(slug))),
    ).toEqual([])
    expect(summary.counters.length).toBeGreaterThan(0)
    expect(
      summary.counters.filter(
        (counter) =>
          !ids.has(counter.winner) || !ids.has(counter.loser) || counter.winner === counter.loser,
      ),
    ).toEqual([])
    expect(
      summary.counters
        .map((counter) => counter.anchor)
        .filter((anchor) => !template.includes(`id="${anchor}"`)),
    ).toEqual([])
  },
)

it('lists seasons newest first', () => {
  const seasons = PVP_SEASONS.map((summary) => summary.season)
  expect(seasons).toEqual([...seasons].sort((a, b) => b - a))
})
