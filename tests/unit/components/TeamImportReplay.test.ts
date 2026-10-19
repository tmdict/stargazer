// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamImportReplay from '@/components/teams/TeamImportReplay.vue'
import { disposeTeamImport, useTeamImport } from '@/composables/useTeamImport'
import type { ReplayReading } from '@/lib/import/types'
import { DEFAULT_MAP_KEY, MAPS } from '@/lib/maps'
import { State } from '@/lib/types/state'
import { useI18nStore } from '@/stores/i18n'

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({
    getCharacterNameById: () => undefined,
    getCharacterImageNameById: () => undefined,
    getCharacterImage: () => '',
  }),
}))

const deploymentTile = (type: State): number =>
  MAPS[DEFAULT_MAP_KEY]!.grid.find((entry) => entry.type === type)!.hex[0]!

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  disposeTeamImport()
})

const mountReplay = async (placement: ReplayReading['placement'] = null) => {
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
    placement,
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
        columns: { 1: { heroes: [5, 6], options: [5, 6] }, 2: { heroes: [7], options: [7] } },
        swapSides: false,
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
  return { picks: () => api.shots.value[0]!.tilePicks }
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
    const boxes = () => [...document.querySelectorAll<HTMLInputElement>('.lineup-tile')]

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

describe('the tile picker', () => {
  it('closes on Escape without the key reaching the modal, and on a click on the frame', async () => {
    await mountReplay({ scale: 1, x: 0, y: 0, score: 1 })
    const modalHeard: string[] = []
    const modal = (event: KeyboardEvent) => modalHeard.push(event.key)
    document.addEventListener('keydown', modal)
    const ally = deploymentTile(State.AVAILABLE_ALLY)
    const open = async () => {
      document
        .querySelector(`polygon[aria-label="Tile ${ally}"]`)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await nextTick()
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
