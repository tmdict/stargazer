// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import TeamPreview from '@/components/teams/TeamPreview.vue'
import { lineupHeroKey } from '@/lib/teams/preview'
import type { SavedTeam } from '@/lib/teams/savedTeam'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import { GUNNAR } from '../fixtures/characters'

/* Search marks on a three-board record: Rolan + Alsa on board 0's ally side
 * with a mirrored enemy Rolan, Gunnar alone on board 1, board 2 empty. */

const ROLAN = 121
const ALSA = 48

const TEAM: SavedTeam = {
  id: 'marks',
  name: 'Marks',
  mode: '3v3',
  data: encodeMultiGridStateToUrl({
    boards: [
      {
        m: 'arena1',
        c: [
          [1, ROLAN, Team.ALLY],
          [2, ALSA, Team.ALLY],
          [30, ROLAN, Team.ENEMY],
        ],
      },
      { m: 'arena1', c: [[1, GUNNAR, Team.ALLY]] },
      { m: 'arena1' },
    ],
    mode: '3v3',
  }),
  createdAt: 0,
  updatedAt: 0,
}

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

const mountPreview = async (highlightHeroes?: ReadonlySet<string>): Promise<SVGSVGElement[]> => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useGameDataStore().initializeContentData()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(TeamPreview, { team: TEAM, highlightHeroes }) })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return Array.from(host.querySelectorAll('svg'))
}

const dimmed = (boards: SVGSVGElement[]): boolean[] =>
  boards.map((board) => board.classList.contains('dimmed'))

describe('TeamPreview search marks', () => {
  it('rings only the keyed placements and fades the rest', async () => {
    const boards = await mountPreview(
      new Set([lineupHeroKey(0, Team.ALLY, 'rolan'), lineupHeroKey(0, Team.ALLY, 'alsa')]),
    )
    expect(dimmed(boards)).toEqual([false, true, true])
    const [matched, other] = boards
    expect(matched!.querySelectorAll('.ring')).toHaveLength(2)
    // The mirrored enemy Rolan is outside the keyed lineup.
    expect(matched!.querySelectorAll('.faded')).toHaveLength(1)
    // A board without a ring recedes whole rather than unit by unit.
    expect(other!.querySelectorAll('.ring, .faded')).toHaveLength(0)
  })

  it('leaves every board plain without a search', async () => {
    const boards = await mountPreview()
    expect(dimmed(boards)).toEqual([false, false, false])
    for (const board of boards) expect(board.querySelectorAll('.ring, .faded')).toHaveLength(0)
  })
})
