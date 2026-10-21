// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamImportReview from '@/components/teams/TeamImportReview.vue'
import { toPhantimalId } from '@/lib/characters/phantimal'
import type { FormationReading } from '@/lib/import/screens/formation/types'
import { DEFAULT_MAP_KEY, MAPS } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'
import { holdTeamImport, leaveTeamImport } from '../fixtures/teamImport'

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({
    characters: [],
    getCharacterNameById: (id: number) => `hero${id}`,
    getCharacterImageNameById: () => undefined,
    getCharacterImage: () => '',
    getPhantimalUnitSlug: () => 'wedge',
    getArtifactById: () => undefined,
  }),
}))

const ALLY_TILES = MAPS[DEFAULT_MAP_KEY]!.grid.filter(
  (entry) => entry.type === State.AVAILABLE_ALLY,
).flatMap((entry) => entry.hex)

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  leaveTeamImport()
})

// A formation shot of the ally side showing hero 5 on the first ally tile
// (or no portrait at all), whose lineup also fields hero 6.
const mountFormation = async (withPortrait = true) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const portraitTile = ALLY_TILES[0]!
  const reading: FormationReading = {
    mapIndex: 0,
    mapCount: 5,
    winner: null,
    mapResults: [],
    sides: { [Team.ALLY]: [], [Team.ENEMY]: [] },
    artifacts: { [Team.ALLY]: null, [Team.ENEMY]: null },
    warnings: [],
    size: { width: 640, height: 760 },
    board: { scale: 20, x: 300, y: 400, support: 0.7 },
    side: Team.ALLY,
    tiles: ALLY_TILES,
    unclear: [],
    units: (withPortrait ? [portraitTile] : []).map(() => ({
      hexId: portraitTile,
      ring: { x: 0, y: 0, radius: 8 },
      score: 1,
      candidates: [{ characterId: 5, score: 0.9, learned: false, costume: false }],
      card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
    })),
  }
  const api = holdTeamImport(
    () => '5v5',
    () => false,
  )
  api.shots.value = [
    {
      id: 'shot',
      kind: 'formation',
      name: 'shot.png',
      size: 1,
      thumb: 'blob:shot',
      status: 'ready',
      error: null,
      cards: {},
      artifactCards: {},
      unitOverrides: {},
      unitCards: [],
      tilePicks: {},
      overrides: {},
      artifactOverrides: {},
      resultOverrides: {},
      reading,
    },
  ]
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(TeamImportReview, {
        shot: api.shots.value[0]!,
        names: { prefix: '', left: '', right: '' },
        swapSides: false,
        sides: [],
        units: {
          assignments: withPortrait ? [{ unitId: 5, state: 'sure' }] : [],
          options: [5, 6, toPhantimalId(1)],
          placed: {
            mapKey: DEFAULT_MAP_KEY,
            team: Team.ALLY,
            side: {
              mains: [
                withPortrait ? { unitId: 5, hexId: portraitTile } : { unitId: 5 },
                { unitId: 6 },
              ],
              companions: [],
              phantimal: null,
              artifact: null,
            },
          },
        },
        onSetPick: api.setTilePick,
      }),
  })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return { portraitTile, picks: () => api.shots.value[0]!.tilePicks[Team.ALLY] }
}

const clickTile = async (hexId: number): Promise<void> => {
  document
    .querySelector(`polygon.pick-tile[aria-label="Tile ${hexId}"]`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

describe('the units a formation shot misses', () => {
  it('places the next one on a free tile, then offers the rest in the picker', async () => {
    const { portraitTile, picks } = await mountFormation()
    const [, free, other] = ALLY_TILES
    const pickable = [...document.querySelectorAll('polygon.pick-tile')].map((p) =>
      p.getAttribute('aria-label'),
    )
    expect(pickable).not.toContain(`Tile ${portraitTile}`)
    expect(document.querySelector('.cell.missing.next .cell-name')?.textContent).toContain('Hero6')

    await clickTile(free!)
    expect(picks()).toEqual({ [free!]: 6 })

    // Nothing left to place: the picker offers the missing hero and the
    // phantimals, never the hero the screenshot shows.
    await clickTile(other!)
    const offered = [...document.querySelectorAll('.picker .picker-item')].map((item) =>
      item.textContent?.trim(),
    )
    expect(offered).toContain(`Hero6${free}`)
    expect(offered.some((text) => text?.includes('Hero5'))).toBe(false)
    expect(document.querySelectorAll('.picker .picker-item.extra')).toHaveLength(1)

    const box = document.querySelector<HTMLInputElement>('.cell.missing .tile-box')!
    box.value = String(portraitTile)
    box.dispatchEvent(new Event('change'))
    await nextTick()
    expect(picks()).toEqual({ [free!]: 6 })
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(String(portraitTile))
  })

  it('offers every unit to place when the screenshot shows no portrait', async () => {
    const { picks } = await mountFormation(false)
    expect(document.querySelectorAll('.cell.missing')).toHaveLength(2)
    expect(document.querySelector('.cell.missing.next .cell-name')?.textContent).toContain('Hero5')

    await clickTile(ALLY_TILES[0]!)
    expect(picks()).toEqual({ [ALLY_TILES[0]!]: 5 })
    // With no portrait to measure, the mark takes the reader's own ring size.
    expect(Number(document.querySelector('.tile-mark circle')?.getAttribute('r'))).toBeGreaterThan(
      0,
    )
  })
})
