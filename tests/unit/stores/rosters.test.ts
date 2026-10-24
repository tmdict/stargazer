// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON } from '@/lib/characters/attributes'
import { useRosters } from '@/stores/rosters'
import { stubLocalStorage } from '../fixtures/storage'

let storage: ReturnType<typeof stubLocalStorage>['storage']

beforeEach(() => {
  storage = stubLocalStorage().storage
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rosters store', () => {
  it("stores an import's roster with its name and heroes, and makes it active", () => {
    const rosters = useRosters()
    rosters.create()
    const heroes = { 1: { [ATTR_PARAGON]: 4 }, 2: {} }
    const created = rosters.create({ name: 'Main account', heroes })

    const stored = JSON.parse(storage.get('stargazer.rosters')!) as { id: string }[]
    expect(stored.find((r) => r.id === created!.id)).toMatchObject({ name: 'Main account', heroes })
    expect(rosters.active?.id).toBe(created!.id)
    // A blank name takes the next free automatic one.
    expect(rosters.create({ name: ' ' })?.name).toBe('Roster 3')
  })

  it('makes the first roster a file adds the active one, and leaves it alone when it adds none', () => {
    const rosters = useRosters()
    const own = rosters.create({ name: 'Main account' })!
    const file = (names: string[]) =>
      JSON.stringify({
        app: 'stargazer',
        kind: 'rosters',
        exportedAt: '2026-10-24T00:00:00.000Z',
        rosters: names.map((name, i) => ({ id: `r${i}-${name}`, name, heroes: { [i + 1]: {} } })),
      })

    expect(rosters.importRosters(file(['Alt', 'Friend'])).imported).toBe(2)
    expect(rosters.active?.name).toBe('Alt')

    rosters.setActive(own.id)
    expect(rosters.importRosters(file(['Alt', 'Friend'])).imported).toBe(0)
    expect(rosters.active?.id).toBe(own.id)
  })
})
