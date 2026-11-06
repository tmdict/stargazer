// @vitest-environment jsdom
import { computed, effectScope, nextTick, ref, type EffectScope } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it } from 'vitest'

import { useSlRoster } from '@/components/guide/sl/useSlRoster'
import { ATTR_PARAGON, TOP_LEVELS } from '@/lib/characters/attributes'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

/* Which roster an edit on the generator lands in: a selected roster takes it at
 * once, while under All heroes it stays in a draft until Save or Export, both
 * without the locked heroes. */

let scope: EffectScope | undefined

afterEach(() => {
  scope?.stop()
  scope = undefined
  localStorage.clear()
})

const setup = () => {
  setActivePinia(createPinia())
  useI18nStore().initialize()
  const gameData = useGameDataStore()
  gameData.initializeContentData()
  const rosters = useRosters()
  const heroes = computed(() => gameData.characters.filter((c) => !c.placeholder))
  const [first, second, third] = heroes.value.map((c) => String(c.id))
  const locked = ref({ ids: new Set([Number(third)]), note: '' })
  scope = effectScope()
  const roster = scope.run(() => useSlRoster(heroes, locked))!
  return { rosters, roster, heroes, first: first!, second: second!, third: third! }
}

describe('useSlRoster', () => {
  it('keeps edits under All heroes in a draft, never in storage', () => {
    const { rosters, roster, first } = setup()
    roster.edit({ [first]: null })
    expect(roster.levels.value[first]).toBeUndefined()
    expect(roster.dirty.value).toBe(true)
    expect(rosters.count).toBe(0)
    roster.edit({ [first]: {} })
    expect(roster.levels.value[first]).toEqual(TOP_LEVELS)
    expect(roster.dirty.value).toBe(false)
  })

  it('writes edits straight into a selected roster', () => {
    const { rosters, roster, first, second } = setup()
    rosters.create({ name: 'Mine', heroes: { [first]: {} } })
    roster.edit({ [second]: { [ATTR_PARAGON]: 2 }, [first]: null })
    expect(rosters.active!.heroes).toEqual({ [second]: { [ATTR_PARAGON]: 2 } })
    expect(roster.levels.value).toEqual(rosters.active!.heroes)
    expect(roster.dirty.value).toBe(false)
  })

  it('saves the draft without locked heroes as the selected roster', async () => {
    const { rosters, roster, heroes, first, third } = setup()
    roster.edit({ [first]: null })
    roster.saveRoster('Kept')
    await nextTick()
    expect(rosters.active!.name).toBe('Kept')
    expect(Object.keys(rosters.active!.heroes)).toHaveLength(heroes.value.length - 2)
    expect(rosters.active!.heroes[first]).toBeUndefined()
    expect(rosters.active!.heroes[third]).toBeUndefined()
    expect(roster.dirty.value).toBe(false)
  })

  it('exports the draft as one roster without locked heroes', () => {
    const { rosters, roster, first, third } = setup()
    roster.edit({ [first]: null })
    const file = roster.exportShown()
    expect(file.kind).toBe('rosters')
    expect(file.rosters).toHaveLength(1)
    expect(file.rosters[0]!.name).toBe(rosters.nextName)
    expect(file.rosters[0]!.heroes[first]).toBeUndefined()
    expect(file.rosters[0]!.heroes[third]).toBeUndefined()
    expect(rosters.count).toBe(0)
  })

  it('drops the draft when a roster is picked', async () => {
    const { rosters, roster, first } = setup()
    const mine = rosters.create({ name: 'Mine' })!
    rosters.setActive(null)
    await nextTick()
    roster.edit({ [first]: null })
    rosters.setActive(mine.id)
    await nextTick()
    rosters.setActive(null)
    await nextTick()
    expect(roster.levels.value[first]).toEqual(TOP_LEVELS)
    expect(roster.dirty.value).toBe(false)
  })
})
