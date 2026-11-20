import { createPinia, setActivePinia } from 'pinia'
import { afterEach, expect, it, vi } from 'vitest'

import {
  decodeDuelBoard,
  encodeDuelBoard,
  type DuelBoardState,
  type DuelUnitState,
} from '@/lib/hd/boardLink'
import { unpackDisplayFlags } from '@/lib/teams/gridStateSerializer'
import { Team } from '@/lib/types/team'
import { useDuelBoard } from '@/stores/duelBoard'
import { useGameDataStore } from '@/stores/gameData'
import { DUEL_HEROES, PHRAESTO } from '../fixtures/characters'

/* No unit of the mode summons a companion today. The Trial list is data, so
 * this file's list gains a card that brings a summoner, as a pack update
 * could. */
vi.mock('@/data/hd/trial.json', async (original) => {
  const list = (await original<{ default: { cards: object[] } }>()).default
  return {
    default: {
      cards: [...list.cards, { card: 'trial-card-45', tier: 'supreme', units: ['phraesto'] }],
    },
  }
})

const unit = (hexId: number, heroId: number, rest: Partial<DuelUnitState> = {}): DuelUnitState => ({
  hexId,
  team: Team.ALLY,
  heroId,
  trial: false,
  tier: 0,
  equipment: 0,
  ...rest,
})

afterEach(() => {
  vi.restoreAllMocks()
})

const summoner = (hexId: number): DuelUnitState => unit(hexId, PHRAESTO, { trial: true, tier: 3 })
const DRAWS = 10

/* The units a board of `units` holds once opened, for each of DRAWS boards:
 * a companion's tile is drawn at random, one board per tenth of the draw. */
function reopened(units: DuelUnitState[]): DuelUnitState[][] {
  const state: DuelBoardState = {
    d: 0,
    map: 'arena1',
    units,
    artifacts: { ally: null, enemy: null },
  }
  return Array.from({ length: DRAWS }, (_, pick) => {
    vi.spyOn(Math, 'random').mockReturnValue(pick / DRAWS)
    setActivePinia(createPinia())
    useGameDataStore().initializeContentData()
    const duel = useDuelBoard()
    duel.open(encodeDuelBoard(state))
    return decodeDuelBoard(duel.snapshot(unpackDisplayFlags(0)))!.units
  })
}

it('a summoner never costs another hero its tile, whichever tile its companion draws', () => {
  const units = [summoner(1), ...DUEL_HEROES.map((heroId, i) => unit(i + 2, heroId))]
  expect(reopened(units)).toEqual(Array(DRAWS).fill(units))
})

it("a summoner's companion never takes the tile of a summoner placed after it", () => {
  const units = [summoner(1), summoner(2), ...DUEL_HEROES.slice(1).map((id, i) => unit(i + 3, id))]
  expect(reopened(units)).toEqual(Array(DRAWS).fill(units))
})
