// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { useRosters } from '@/stores/rosters'
import { stubLocalStorage } from '../fixtures/storage'

let setItem: ReturnType<typeof stubLocalStorage>['setItemSpy']

beforeEach(() => {
  setItem = stubLocalStorage().setItemSpy
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('rosters store', () => {
  it("creates an import's roster with its name and heroes in one write, and makes it active", () => {
    const rosters = useRosters()
    rosters.create()
    setItem.mockClear()

    const created = rosters.create({
      name: '  Main account  ',
      heroes: { 1: { [ATTR_PARAGON]: 4, [ATTR_REFINEMENT]: 0 }, 2: {} },
    })

    expect(created).toMatchObject({
      name: 'Main account',
      heroes: { 1: { [ATTR_PARAGON]: 4 }, 2: {} },
    })
    expect(rosters.active?.id).toBe(created!.id)
    expect(setItem.mock.calls.filter(([key]) => key === 'stargazer.rosters')).toHaveLength(1)
    // A blank name takes the next free automatic one.
    expect(rosters.create({ name: ' ' })?.name).toBe('Roster 3')
  })
})
