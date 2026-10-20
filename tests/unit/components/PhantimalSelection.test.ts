// @vitest-environment jsdom
import { createApp, h, nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import PhantimalSelection from '@/components/PhantimalSelection.vue'
import { isPhantimalId, toPhantimalId } from '@/lib/characters/phantimal'
import type { PhantimalType } from '@/lib/types/phantimal'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGameDataStore } from '@/stores/gameData'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'

const phantimal = (id: number, name: string): PhantimalType => ({
  id,
  name,
  season: 8,
  range: 1,
  damage: 'magic',
  faction: 'lightbearer',
})
const WEDGE = phantimal(1, 'wedge')
const OTHER = phantimal(2, 'other')

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
})

describe('a phantimal click', () => {
  it('fills a side with room before it removes, and replaces only when every side is taken', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useI18nStore().initialize()
    const gameData = useGameDataStore()
    vi.spyOn(gameData, 'getCharacterFaction').mockReturnValue('lightbearer')
    vi.spyOn(gameData, 'getPhantimalById').mockImplementation((id: number) =>
      id === toPhantimalId(WEDGE.id) ? WEDGE : OTHER,
    )
    const gridStore = useGridStore()
    const store = useCharacterStore()
    const tiles = (state: State) =>
      gridStore.hexes.filter((hex) => gridStore.getTile(hex.getId()).state === state)
    const allyTiles = tiles(State.AVAILABLE_ALLY)
    const enemyTiles = tiles(State.AVAILABLE_ENEMY)
    allyTiles.slice(0, 3).forEach((hex, i) => store.placeCharacterOnHex(hex.getId(), 1 + i))
    enemyTiles
      .slice(0, 3)
      .forEach((hex, i) => store.placeCharacterOnHex(hex.getId(), 11 + i, Team.ENEMY))
    await nextTick()
    // Both sides qualify; start from the wedge on the ally side alone.
    for (const tile of store.getTilesWithCharacters()) {
      if (isPhantimalId(tile.characterId!)) store.removeCharacterFromHex(tile.hex.getId())
    }
    store.placePhantimalOnHex(allyTiles[5]!.getId(), toPhantimalId(WEDGE.id), Team.ALLY)
    const phantimalOn = (team: Team): number | null =>
      store
        .getTilesWithCharacters()
        .find((tile) => tile.team === team && isPhantimalId(tile.characterId!))?.characterId ?? null

    const host = document.createElement('div')
    document.body.append(host)
    const app = createApp({
      render: () => h(PhantimalSelection, { phantimals: [WEDGE, OTHER] }),
    })
    app.use(pinia)
    app.mount(host)
    teardown = () => {
      app.unmount()
      host.remove()
    }
    await nextTick()
    const wedge = document.querySelectorAll('.phantimal')[0]!
    const other = document.querySelectorAll('.phantimal')[1]!
    const click = async (el: Element): Promise<void> => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }))
      await nextTick()
    }

    // The enemy side has room, so the wedge goes there too.
    expect(wedge.classList.contains('placed')).toBe(false)
    await click(wedge)
    expect(phantimalOn(Team.ENEMY)).toBe(toPhantimalId(WEDGE.id))
    // With no side open, the next click takes it off the side filled last.
    expect(wedge.classList.contains('placed')).toBe(true)
    await click(wedge)
    expect(phantimalOn(Team.ENEMY)).toBeNull()
    expect(phantimalOn(Team.ALLY)).toBe(toPhantimalId(WEDGE.id))

    await click(wedge)
    await click(other)
    expect(phantimalOn(Team.ALLY)).toBe(toPhantimalId(OTHER.id))
    expect(phantimalOn(Team.ENEMY)).toBe(toPhantimalId(WEDGE.id))
  })
})
