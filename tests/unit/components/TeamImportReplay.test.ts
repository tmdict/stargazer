// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamImportReplay from '@/components/teams/TeamImportReplay.vue'
import { disposeTeamImport, useTeamImport } from '@/composables/useTeamImport'
import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import type { ReplayReading } from '@/lib/import/types'
import { DEFAULT_MAP_KEY, MAPS } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({
    getCharacterNameById: () => undefined,
    getCharacterImageNameById: () => undefined,
    getCharacterImage: () => '',
    getPhantimalUnitSlug: () => undefined,
  }),
}))

const deploymentTiles = (type: State): number[] =>
  MAPS[DEFAULT_MAP_KEY]!.grid.filter((entry) => entry.type === type).flatMap((entry) => entry.hex)
const deploymentTile = (type: State): number => deploymentTiles(type)[0]!

const clickTile = async (hexId: number): Promise<void> => {
  document
    .querySelector(`polygon[aria-label="Tile ${hexId}"]`)!
    .dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await nextTick()
}

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  disposeTeamImport()
})

type Sides = Record<Team, { heroes: number[]; options: number[] }>

const mountReplay = async (
  sides: Sides = {
    [Team.ALLY]: { heroes: [5, 6], options: [5, 6] },
    [Team.ENEMY]: { heroes: [7], options: [7] },
  },
) => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const reading: ReplayReading = {
    mapIndex: 0,
    mapCount: 5,
    winner: null,
    mapResults: [],
    sides: { 1: [], 2: [] },
    artifacts: { 1: null, 2: null },
    warnings: [],
    size: { width: 1400, height: 1940 },
    placement: { scale: 1, x: 0, y: 0, score: 1 },
  }
  const api = useTeamImport(
    () => '5v5',
    () => true,
  )
  api.shots.value = [
    {
      id: 'frame',
      kind: 'replay',
      name: 'frame.png',
      size: 1,
      thumb: 'blob:frame',
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
      h(TeamImportReplay, {
        shot: api.shots.value[0]!,
        mapKey: DEFAULT_MAP_KEY,
        sides,
        placed: null,
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
  return { picks: () => api.shots.value[0]!.tilePicks, setPick: api.setTilePick }
}

const type = async (box: HTMLInputElement, text: string, event: Event): Promise<void> => {
  box.focus()
  box.value = text
  box.dispatchEvent(event)
  await nextTick()
}

describe('typing a replay tile', () => {
  it("places a unit only on its own team's deployment tiles", async () => {
    const { picks } = await mountReplay()
    const ally = deploymentTile(State.AVAILABLE_ALLY)
    const enemy = deploymentTile(State.AVAILABLE_ENEMY)
    const boxes = () => [...document.querySelectorAll<HTMLInputElement>('.tile-box')]

    await type(boxes()[0]!, String(ally), new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(picks()[1]).toEqual({ [ally]: 5 })
    expect(document.activeElement).toBe(boxes()[1])

    await type(boxes()[1]!, String(enemy), new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(picks()[1]).toEqual({ [ally]: 5 })
    expect(boxes()[1]!.value).toBe('')
    expect(document.activeElement).toBe(boxes()[1])
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(String(enemy))

    await type(boxes()[2]!, String(enemy), new Event('change'))
    expect(picks()[2]).toEqual({ [enemy]: 7 })
    expect(document.querySelector('[role="alert"]')).toBeNull()

    await type(boxes()[0]!, '', new Event('change'))
    expect(picks()[1]).toEqual({})
  })
})

describe('a tile click', () => {
  it("places each side's next hero, a chosen one first, and opens the picker with none left", async () => {
    const { picks } = await mountReplay()
    const [a0, a1, a2, a3] = deploymentTiles(State.AVAILABLE_ALLY)
    const enemy = deploymentTile(State.AVAILABLE_ENEMY)
    const allyRows = () => [...document.querySelectorAll<HTMLElement>('.lineup.ally .lineup-pick')]

    await clickTile(a0!)
    await clickTile(enemy)
    expect(picks()).toEqual({ 1: { [a0!]: 5 }, 2: { [enemy]: 7 } })

    // A hero chosen in the list goes next, even one already placed.
    allyRows()[0]!.click()
    await nextTick()
    await clickTile(a1!)
    expect(picks()[1]).toEqual({ [a1!]: 5 })

    await clickTile(a2!)
    expect(picks()[1]).toEqual({ [a1!]: 5, [a2!]: 6 })
    await clickTile(a3!)
    expect(picks()[1]).toEqual({ [a1!]: 5, [a2!]: 6 })
    expect(document.querySelector('.picker')).not.toBeNull()
  })

  it('uses up a chosen hero placed by typing its tile', async () => {
    const { picks } = await mountReplay()
    const [a0, a1] = deploymentTiles(State.AVAILABLE_ALLY)
    document.querySelectorAll<HTMLElement>('.lineup.ally .lineup-pick')[1]!.click()
    await nextTick()
    const box = document.querySelectorAll<HTMLInputElement>('.tile-box')[1]!
    await type(box, String(a0), new Event('change'))
    await clickTile(a1!)
    expect(picks()[1]).toEqual({ [a0!]: 6, [a1!]: 5 })
  })

  it("places a hero's companions after it, and a picked phantimal's after the heroes", async () => {
    const elijah = 68
    const [lailah] = companionIdsOf(elijah)
    const wedgeOfMatter = toPhantimalId(5)
    const [wedgeOfPower] = companionIdsOf(wedgeOfMatter)
    const wedges = [wedgeOfMatter, wedgeOfPower!]
    const { picks, setPick } = await mountReplay({
      [Team.ALLY]: { heroes: [elijah, 6], options: [elijah, lailah!, 6, ...wedges] },
      [Team.ENEMY]: { heroes: [7], options: [7, ...wedges] },
    })
    const [a0, a1, a2, a3, a4] = deploymentTiles(State.AVAILABLE_ALLY)
    const [e0, e1, e2] = deploymentTiles(State.AVAILABLE_ENEMY)

    for (const tile of [a0!, a1!, a2!]) await clickTile(tile)
    expect(picks()[1]).toEqual({ [a0!]: elijah, [a1!]: lailah, [a2!]: 6 })

    setPick('frame', Team.ALLY, a3!, wedgeOfMatter)
    await nextTick()
    await clickTile(a4!)
    expect(picks()[1]).toMatchObject({ [a3!]: wedgeOfMatter, [a4!]: wedgeOfPower })

    // A companion picked first fields its phantimal, which goes next.
    await clickTile(e0!)
    setPick('frame', Team.ENEMY, e1!, wedgeOfPower!)
    await nextTick()
    await clickTile(e2!)
    expect(picks()[2]).toEqual({ [e0!]: 7, [e1!]: wedgeOfPower, [e2!]: wedgeOfMatter })
  })
})

describe('the tile picker', () => {
  it('closes on Escape without the key reaching the modal, and on a click on the frame', async () => {
    await mountReplay()
    const modalHeard: string[] = []
    const modal = (event: KeyboardEvent) => modalHeard.push(event.key)
    document.addEventListener('keydown', modal)
    const ally = deploymentTile(State.AVAILABLE_ALLY)
    // Choosing the highlighted hero again stops placing, so a click opens the picker.
    document.querySelector<HTMLElement>('.lineup.ally li.next .lineup-pick')!.click()
    await nextTick()
    const open = async () => {
      await clickTile(ally)
      expect(document.querySelector('.picker')).not.toBeNull()
    }

    await open()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(document.querySelector('.picker')).toBeNull()
    expect(modalHeard).toEqual([])

    await open()
    document
      .querySelector('.frame-view image')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()
    expect(document.querySelector('.picker')).toBeNull()

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(modalHeard).toEqual(['Escape'])
    document.removeEventListener('keydown', modal)
  })
})
