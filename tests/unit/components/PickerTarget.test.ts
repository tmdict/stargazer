// @vitest-environment jsdom
import { createApp, h, nextTick, type Component } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import CharacterSelection from '@/components/CharacterSelection.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { Team } from '@/lib/types/team'
import { useGameDataStore } from '@/stores/gameData'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

/* A tapped tile picks the side a tap fills, so the hero picker's grey follows
 * that side rather than the whole board. */

const DUNLINGR = 57

let teardown: (() => void) | undefined
let pinia: ReturnType<typeof createPinia>

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
  pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  useGameDataStore().initializeContentData()
  useGrids().setGridCount(1)
})

afterEach(() => {
  useSelectionState().clearTargets()
  teardown?.()
  teardown = undefined
  vi.unstubAllGlobals()
})

const mount = async (picker: Component, props: Record<string, unknown>): Promise<void> => {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({ render: () => h(picker, props) })
  app.use(pinia)
  app.directive('scroll-chain', {})
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
}

const board = () => {
  const grids = useGrids()
  return { grids, ctx: grids.contexts[0]! }
}

const targetEmptyTile = async (team: Team): Promise<void> => {
  const { ctx } = board()
  const tile = [...ctx.grid.keys()]
    .map((hex) => ctx.grid.getTile(hex))
    .find((t) => getTeamFromTileState(t.state) === team && t.characterId === undefined)!
  useSelectionState().setTargetHex(tile.hex.getId(), ctx.id)
  await nextTick()
}

const isGrey = (selector: string): boolean =>
  document.querySelector(selector)!.classList.contains('greyed-out')

describe('a picker with a tile or slot targeted', () => {
  it('greys a hero only for the side that cannot take it', async () => {
    const { grids, ctx } = board()
    grids.placePick(ctx, DUNLINGR, Team.ALLY)
    const dunlingr = useGameDataStore().getCharacterById(DUNLINGR)!
    await mount(CharacterSelection, { characters: [dunlingr] })
    expect(isGrey('.character-display')).toBe(true)

    await targetEmptyTile(Team.ENEMY)
    expect(isGrey('.character-display')).toBe(false)

    await targetEmptyTile(Team.ALLY)
    expect(isGrey('.character-display')).toBe(true)
  })

  it('greys every hero on a full side', async () => {
    const { grids, ctx } = board()
    const others = useGameDataStore().characters.filter((c) => !c.placeholder && c.id !== DUNLINGR)
    for (const { id } of others) grids.placePick(ctx, id, Team.ENEMY)
    const dunlingr = useGameDataStore().getCharacterById(DUNLINGR)!
    await mount(CharacterSelection, { characters: [dunlingr] })
    expect(isGrey('.character-display')).toBe(false)

    await targetEmptyTile(Team.ENEMY)
    expect(isGrey('.character-display')).toBe(true)
  })
})
