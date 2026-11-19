import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useArenaBoards } from '@/composables/useArenaBoards'
import { getTilesWithCharacters } from '@/lib/characters/character'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { DUEL_HEROES } from '../fixtures/characters'
import { stubLocalStorage } from '../fixtures/storage'

// Both boards take the Honor Duel shop's heroes.
const [ALLY_A, ALLY_B, , ENEMY_A] = DUEL_HEROES

/* The Arena page's two boards share one screen and keep a stored value each.
 * Runs headless: node env + in-memory localStorage stub, SSR flag off so the
 * storage branches execute. */

const ARENA_KEY = 'stargazer.arena'
const DUEL_KEY = 'stargazer.hd.board'
const FLAGS = () => ({ showPerspective: false, showSkills: false })

let storage: Map<string, string>

const heroesOnScreen = (): number[] =>
  getTilesWithCharacters(useGrids().active!.grid)
    .map((tile) => tile.characterId!)
    .sort((a, b) => a - b)

// The page as it opens on the Arena board, autosave running.
const openPage = () => {
  const boards = useArenaBoards(FLAGS)
  boards.openArena()
  boards.startAutosave()
  return boards
}

describe('useArenaBoards', () => {
  beforeEach(() => {
    vi.stubEnv('SSR', false)
    ;({ storage } = stubLocalStorage())
    setActivePinia(createPinia())
    useGameDataStore().initializeContentData()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('writes each board to its own stored value and never to the other', async () => {
    const grids = useGrids()
    const boards = openPage()
    grids.placePick(grids.active!, ALLY_A, Team.ALLY, 1)
    await nextTick()
    const arena = storage.get(ARENA_KEY)!

    boards.show('honorDuel')
    await nextTick()
    const emptyDuel = storage.get(DUEL_KEY)!
    grids.placePick(grids.active!, ALLY_B, Team.ALLY, 2)
    grids.placePick(grids.active!, ENEMY_A, Team.ENEMY, 40)
    await nextTick()
    const duel = storage.get(DUEL_KEY)!
    expect(duel).not.toBe(emptyDuel)
    expect(storage.get(ARENA_KEY)).toBe(arena)

    boards.show('arena')
    await nextTick()
    grids.placePick(grids.active!, ALLY_B, Team.ALLY, 3)
    await nextTick()
    expect(storage.get(ARENA_KEY)).not.toBe(arena)
    expect(storage.get(DUEL_KEY)).toBe(duel)
  })

  it('brings each board back as it was left', async () => {
    const grids = useGrids()
    const boards = openPage()
    grids.placePick(grids.active!, ALLY_A, Team.ALLY, 1)

    boards.show('honorDuel')
    expect(grids.active!.kind).toBe('honorDuel')
    expect(heroesOnScreen()).toEqual([])
    grids.placePick(grids.active!, ALLY_B, Team.ALLY, 2)

    boards.show('arena')
    expect(grids.active!.kind).toBe('arena')
    expect(heroesOnScreen()).toEqual([ALLY_A])

    boards.show('honorDuel')
    expect(heroesOnScreen()).toEqual([ALLY_B])
  })

  it('writes nothing before the page has read its stored boards', () => {
    storage.set(ARENA_KEY, 'stored-arena')
    storage.set(DUEL_KEY, 'stored-duel')
    const boards = useArenaBoards(FLAGS)

    boards.show('honorDuel')
    boards.show('arena')

    expect(storage.get(ARENA_KEY)).toBe('stored-arena')
    expect(storage.get(DUEL_KEY)).toBe('stored-duel')
  })

  it('keeps the Arena choices no stored value holds across a visit to the Honor Duel board', () => {
    const grids = useGrids()
    const boards = openPage()
    grids.synergy = true
    grids.nonSeasonal = true

    boards.show('honorDuel')
    expect(grids.synergy).toBe(false)
    boards.show('arena')

    expect(grids.synergy).toBe(true)
    expect(grids.nonSeasonal).toBe(true)
  })
})
