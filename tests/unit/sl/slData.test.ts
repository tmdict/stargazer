import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { chooseSlSet } from '@/lib/pvp/sl/chooser'
import { loadSlData } from '@/lib/pvp/sl/codec'
import type { SlPick, SlUnit } from '@/lib/pvp/sl/types'
import { CURRENT_SEASON } from '@/lib/seasonal'
import { loadArtifacts, loadCharacters, loadPhantimals } from '@/utils/dataLoader'

// The file a deploy ships, as copied in from the external report generator,
// which runs its own chooser beside this one on every selection it audits.
// The page fetches the file the build emits, so the test serves it the same bytes.
vi.stubGlobal(
  'fetch',
  async () =>
    new Response(readFileSync(new URL('../../../src/content/pvp/sl/sl.bin', import.meta.url))),
)
const data = await loadSlData()
vi.unstubAllGlobals()
const seasons = [data, ...(data.before ? [data.before] : [])]
const heroes = new Map(
  loadCharacters()
    .filter((c) => !c.placeholder)
    .map((c) => [c.id, c]),
)
const pick = (id: number, paragon = 4, refinement = 4): SlPick => ({
  id,
  faction: heroes.get(id)!.faction,
  paragon,
  refinement,
})
const named = [...new Set(seasons.flatMap((s) => s.teams.flatMap((t) => t.heroes)))]

describe('the shipped Supreme League data', () => {
  // A rotation must not hold up a deploy, so the maps are the file's own.
  it('names only heroes Stargazer knows, and companions their heroes spawn', () => {
    expect(data.order.filter((id) => !heroes.has(id))).toEqual([])
    const strays: SlUnit[] = []
    for (const s of seasons) {
      for (const t of s.teams) {
        expect(t.heroes.every((id) => heroes.has(id))).toBe(true)
        for (const p of t.placements) {
          const units = p.c.map(([, id]) => id)
          const spawned = new Set(units.flatMap((id) => companionIdsOf(id)))
          strays.push(...p.c.filter(([, id]) => !t.heroes.includes(id) && !spawned.has(id)))
          const [phantimal, ...companions] = p.s
          const own = new Set(phantimal ? companionIdsOf(toPhantimalId(phantimal[1])) : [])
          strays.push(...companions.filter(([, id]) => !own.has(toPhantimalId(id))))
        }
      }
    }
    expect(strays).toEqual([])
  })

  // After a cutover the ids name the new season's content, so they are only
  // checked while the file's season is Stargazer's.
  it.runIf(data.season === CURRENT_SEASON)('uses the season’s own artifacts and phantimals', () => {
    const artifacts = new Set(loadArtifacts().map((a) => a.id))
    const phantimals = new Set(loadPhantimals().map((p) => p.id))
    for (const s of seasons) {
      for (const t of s.teams) {
        const ids = 'artifacts' in t ? t.artifacts.map(([id]) => id) : t.like
        expect(ids.filter((id) => !artifacts.has(id))).toEqual([])
        const used = t.placements.flatMap((p) => (p.s[0] ? [p.s[0][1]] : []))
        expect(used.filter((id) => !phantimals.has(id))).toEqual([])
      }
    }
  })
})

describe('chooseSlSet on the shipped data', () => {
  const holds = (picks: SlPick[]) => {
    const set = chooseSlSet(data, picks)!
    expect(set.teams).toHaveLength(data.maps.length)
    const used = set.teams.flatMap((t) => t.heroes)
    expect(new Set(used).size).toBe(used.length)
    const selected = new Set(picks.map((p) => p.id))
    expect(used.every((id) => selected.has(id))).toBe(true)
    for (const t of set.teams) {
      expect(t.chance).toBeGreaterThan(0)
      expect(t.chance).toBeLessThan(1)
      expect(t.flex.flatMap((f) => f.options).every((id) => selected.has(id))).toBe(true)
      // A two-hero swap takes heroes the set leaves free, for two of the team's
      // that are neither core nor out in a one-hero swap, in the rows left.
      const free = new Set([...selected].filter((id) => !used.includes(id)))
      const fixed = new Set([...t.core, ...t.flex.map((f) => f.out)])
      expect(t.flex.length + t.pairs.length).toBeLessThanOrEqual(data.flex.heroes)
      for (const pair of t.pairs) {
        expect(pair.out.every((id) => t.heroes.includes(id) && !fixed.has(id))).toBe(true)
        expect(pair.options.flat().every((id) => free.has(id))).toBe(true)
      }
    }
    const artifacts = set.teams.flatMap((t) => (t.artifact === null ? [] : [t.artifact]))
    expect(new Set(artifacts).size).toBe(artifacts.length)
    expect(set.chance).toBeGreaterThan(0)
    expect(set.chance).toBeLessThan(1)
    return set
  }

  it('makes a set of every recorded hero at the top levels, from this season alone', () => {
    const set = holds(named.map((id) => pick(id)))
    expect(set.teams.every((t) => t.source === 0)).toBe(true)
  })

  it('counts upgrades against a team', () => {
    const full = holds(named.map((id) => pick(id)))
    const low = holds(named.map((id) => pick(id, 0, 0)))
    expect(low.chance).toBeLessThanOrEqual(full.chance)
  })

  it.runIf(!!data.before)(
    'gives a team of the season before an artifact it can take, for a selection with few Celestial and Hypogean heroes',
    () => {
      const rare = (id: number) => ['celestial', 'hypogean'].includes(heroes.get(id)!.faction)
      const set = holds(named.filter((id) => !rare(id)).map((id) => pick(id)))
      for (const t of set.teams.filter((t) => t.source === 1)) {
        const like = data.before!.teams[t.team]!.like
        expect(t.artifact === null || like.includes(t.artifact)).toBe(true)
      }
    },
  )

  it('makes no set from no heroes', () => {
    expect(chooseSlSet(data, [])).toBeNull()
  })
})
