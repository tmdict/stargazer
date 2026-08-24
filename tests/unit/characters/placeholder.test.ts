import { computed } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { canPlaceCharacterOnTeam, getAvailableTeamSize } from '@/lib/characters/character'
import { performPlace } from '@/lib/characters/place'
import { isPlaceholderId, PLACEHOLDER_ID_OFFSET, PLACEHOLDERS } from '@/lib/characters/placeholder'
import { performRemove } from '@/lib/characters/remove'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { FACTION_ORDER } from '@/lib/filterOrder'
import { COMPANION_ID_OFFSET, Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { loadCharacters } from '@/utils/dataLoader'
import { serializeGridState } from '@/utils/gridStateSerializer'
import { decodeGridStateFromUrl, encodeGridStateToUrl } from '@/utils/urlStateManager'

// Default map (arena1) ally tiles, used for real placement-path tests.
const ALLY_TILES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

const PLACEHOLDER = PLACEHOLDERS[0]!

describe('placeholder definitions', () => {
  it('covers every faction exactly once', () => {
    expect(new Set(PLACEHOLDERS.map((p) => p.faction))).toEqual(new Set(FACTION_ORDER))
    expect(new Set(PLACEHOLDERS.map((p) => p.id)).size).toBe(PLACEHOLDERS.length)
    for (const p of PLACEHOLDERS) {
      expect(p.class).toBe('none')
      expect(p.damage).toBe('none')
    }
  })

  it('pins each faction to its published id (baked into links and saved teams)', () => {
    const byFaction = Object.fromEntries(PLACEHOLDERS.map((p) => [p.faction, p.id]))
    expect(byFaction).toEqual({
      lightbearer: 9001,
      wilder: 9002,
      mauler: 9003,
      graveborn: 9004,
      celestial: 9005,
      hypogean: 9006,
      dimensional: 9007,
    })
  })

  it('keeps ids inside the reserved band below the companion namespace', () => {
    for (const p of PLACEHOLDERS) {
      expect(isPlaceholderId(p.id)).toBe(true)
      expect(p.id).toBeLessThan(COMPANION_ID_OFFSET)
    }
    expect(isPlaceholderId(PLACEHOLDER_ID_OFFSET - 1)).toBe(false)
    expect(isPlaceholderId(COMPANION_ID_OFFSET)).toBe(false)
  })

  it('joins the roster without colliding with real hero ids', () => {
    const characters = loadCharacters()
    const real = characters.filter((c) => !c.placeholder)
    for (const p of PLACEHOLDERS) {
      expect(characters).toContain(p)
      expect(real.some((c) => c.id === p.id)).toBe(false)
    }
    // Real ids stay far below the band, so the reservation holds long-term.
    expect(Math.max(...real.map((c) => c.id))).toBeLessThan(PLACEHOLDER_ID_OFFSET)
  })
})

describe('placeholder roster order', () => {
  it('trails the roster as one block in faction filter icon order', () => {
    const { filteredCharacters } = useCharacterFilters(computed(() => loadCharacters()))
    const tail = filteredCharacters.value.slice(-PLACEHOLDERS.length)
    expect(tail.map((c) => c.faction)).toEqual([...FACTION_ORDER])
    expect(tail.every((c) => c.placeholder)).toBe(true)
  })
})

describe('placeholder placement rules', () => {
  it('allows repeated copies of the same placeholder on one team', () => {
    const grid = new Grid()
    expect(performPlace(grid, ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    expect(canPlaceCharacterOnTeam(grid, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    expect(performPlace(grid, ALLY_TILES[1]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    expect(grid.getTileById(ALLY_TILES[0]!).characterId).toBe(PLACEHOLDER.id)
    expect(grid.getTileById(ALLY_TILES[1]!).characterId).toBe(PLACEHOLDER.id)
  })

  it('still rejects duplicate real heroes', () => {
    const grid = new Grid()
    const hero = loadCharacters().find((c) => !c.placeholder)!
    expect(performPlace(grid, ALLY_TILES[0]!, hero.id, Team.ALLY)).toBe(true)
    expect(performPlace(grid, ALLY_TILES[1]!, hero.id, Team.ALLY)).toBe(false)
  })

  it('counts placeholders toward team capacity', () => {
    const grid = new Grid()
    for (let i = 0; i < 5; i++) {
      expect(performPlace(grid, ALLY_TILES[i]!, PLACEHOLDERS[i]!.id, Team.ALLY)).toBe(true)
    }
    expect(canPlaceCharacterOnTeam(grid, PLACEHOLDERS[5]!.id, Team.ALLY)).toBe(false)
    expect(performPlace(grid, ALLY_TILES[5]!, PLACEHOLDERS[5]!.id, Team.ALLY)).toBe(false)
  })

  it('counts every copy of one placeholder toward capacity', () => {
    const grid = new Grid()
    for (let i = 0; i < 5; i++) {
      expect(performPlace(grid, ALLY_TILES[i]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    }
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(0)
    expect(canPlaceCharacterOnTeam(grid, PLACEHOLDER.id, Team.ALLY)).toBe(false)
    expect(performPlace(grid, ALLY_TILES[5]!, PLACEHOLDER.id, Team.ALLY)).toBe(false)
    const hero = loadCharacters().find((c) => !c.placeholder)!
    expect(performPlace(grid, ALLY_TILES[6]!, hero.id, Team.ALLY)).toBe(false)
  })

  it('keeps capacity accurate after removing one of several copies', () => {
    const grid = new Grid()
    performPlace(grid, ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)
    performPlace(grid, ALLY_TILES[1]!, PLACEHOLDER.id, Team.ALLY)
    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(3)

    expect(performRemove(grid, ALLY_TILES[0]!)).toBe(true)

    expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(4)
    expect(grid.getTileById(ALLY_TILES[1]!).characterId).toBe(PLACEHOLDER.id)
  })

  it('swaps a placeholder cross-team even when the destination team holds a copy', () => {
    const grid = new Grid()
    const hero = loadCharacters().find((c) => !c.placeholder)!
    performPlace(grid, ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)
    performPlace(grid, 40, hero.id, Team.ENEMY)
    performPlace(grid, 42, PLACEHOLDER.id, Team.ENEMY)

    expect(executeSwapCharacters(grid, new SkillManager(), ALLY_TILES[0]!, 40)).toBe(true)

    expect(grid.getTileById(40).characterId).toBe(PLACEHOLDER.id)
    expect(grid.getTileById(ALLY_TILES[0]!).characterId).toBe(hero.id)
  })

  it('serializes placeholder copies like ordinary characters', () => {
    const grid = new Grid()
    performPlace(grid, ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)
    performPlace(grid, ALLY_TILES[1]!, PLACEHOLDER.id, Team.ALLY)
    const state = serializeGridState(grid.getAllTiles(), null, null)
    const entries = (state.c ?? []).filter(([, id]) => id === PLACEHOLDER.id)
    expect(entries).toHaveLength(2)
    expect(entries.map(([hexId]) => hexId).sort((a, b) => a! - b!)).toEqual([
      ALLY_TILES[0],
      ALLY_TILES[1],
    ])
  })

  it('round-trips placeholder copies through the arena binary codec', () => {
    const grid = new Grid()
    performPlace(grid, ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)
    performPlace(grid, ALLY_TILES[1]!, PLACEHOLDER.id, Team.ALLY)
    const state = serializeGridState(grid.getAllTiles(), null, null)

    const decoded = decodeGridStateFromUrl(encodeGridStateToUrl(state))

    expect(decoded).not.toBeNull()
    const entries = (decoded!.c ?? []).filter(([, id]) => id === PLACEHOLDER.id)
    expect(entries.map(([hexId]) => hexId).sort((a, b) => a! - b!)).toEqual([
      ALLY_TILES[0],
      ALLY_TILES[1],
    ])
  })
})

describe('placeholder store exemptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('never reports placeholders as used and dedupe keeps their copies', () => {
    const grids = useGrids()
    grids.setGridCount(2)
    const [a, b] = grids.contexts
    expect(a!.place(ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    expect(a!.place(ALLY_TILES[1]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)
    expect(b!.place(ALLY_TILES[0]!, PLACEHOLDER.id, Team.ALLY)).toBe(true)

    expect(grids.isUsed(PLACEHOLDER.id, Team.ALLY)).toBe(false)

    grids.dedupeCharacters()
    expect(a!.grid.getTileById(ALLY_TILES[0]!).characterId).toBe(PLACEHOLDER.id)
    expect(a!.grid.getTileById(ALLY_TILES[1]!).characterId).toBe(PLACEHOLDER.id)
    expect(b!.grid.getTileById(ALLY_TILES[0]!).characterId).toBe(PLACEHOLDER.id)
  })
})
