// @vitest-environment jsdom
import { createApp, h, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamImportModal from '@/components/modals/TeamImportModal.vue'
import type { ImportShot } from '@/composables/useTeamImport'
import { DESCRIPTOR_LENGTH } from '@/lib/import/card/heroes'
import type { TeamImportPlan } from '@/lib/teams/teamImport'
import { useI18nStore } from '@/stores/i18n'
import { shownText } from '../fixtures/dom'
import { holdTeamImport, leaveTeamImport } from '../fixtures/teamImport'

vi.mock('@/stores/grids', () => ({
  useGrids: () => ({ boardsHaveContent: () => false }),
}))

vi.mock('@/stores/gameData', () => ({
  useGameDataStore: () => ({
    characters: [],
    artifacts: [],
    getCharacterNameById: () => undefined,
    getCharacterImage: () => '',
    getArtifactById: (id: number) =>
      id === 1 ? { id: 1, name: 'starshard', season: 0, stats: {} } : undefined,
    getArtifactImage: () => '',
  }),
}))

const sample = (): ImportShot => ({
  id: 'sample',
  kind: 'result',
  name: 'sample.png',
  size: 1,
  thumb: 'blob:sample',
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
  reading: {
    mapIndex: 0,
    mapCount: 3,
    winner: 1,
    mapResults: [1, 1, 2],
    warnings: [],
    artifacts: { 1: null, 2: null },
    sides: {
      1: [
        {
          box: { x: 0, y: 0, w: 1, h: 1 },
          card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
          descriptor: new Float32Array(1),
          candidates: [{ characterId: 5, score: 0.4, learned: false, costume: false }],
          recognised: true,
          sure: false,
          margin: 0.02,
          paragon: { level: 4, score: 0.4, runnerUp: 0.39, sure: false },
          refinement: { level: 0, family: 'white', stars: 6, sure: true },
        },
      ],
      2: [],
    },
  },
})

let teardown: (() => void) | undefined

afterEach(() => {
  teardown?.()
  teardown = undefined
  leaveTeamImport()
  localStorage.clear()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const mountImport = async () => {
  vi.stubGlobal(
    'URL',
    class extends URL {
      static revokeObjectURL = vi.fn()
    },
  )
  // The references never arrive: the review shows the shot's reading alone.
  vi.stubGlobal(
    'Worker',
    class {
      postMessage(): void {}
      terminate(): void {}
    },
  )
  vi.stubGlobal('fetch', () => new Promise(() => {}))
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const api = holdTeamImport(
    () => '3v3',
    () => false,
  )
  api.shots.value = [reactive(sample())]
  Object.assign(api.names, { prefix: '', left: '', right: '' })
  const saved = vi.fn<(plan: TeamImportPlan) => void>()
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp({
    render: () =>
      h(TeamImportModal, { show: true, activeMode: '3v3', variant: null, onImportMatch: saved }),
  })
  app.use(pinia)
  app.mount(host)
  teardown = () => {
    app.unmount()
    host.remove()
  }
  await nextTick()
  return { api, saved }
}

describe('match import review and save', () => {
  it('requires a second click to forget learned icons and expires an unconfirmed click', async () => {
    vi.useFakeTimers()
    const { api } = await mountImport()
    const cell = api.shots.value[0]!.reading!.sides[1][0]!
    cell.paragon.sure = true
    cell.descriptor = new Float32Array(DESCRIPTOR_LENGTH).fill(0.02)
    api.setHero('sample', 1, 0, 9)
    await nextTick()
    const forget = [...document.querySelectorAll<HTMLButtonElement>('.link-btn')].find((button) =>
      button.textContent?.includes('Reset heroes learned from your corrections'),
    )!
    const save = document.querySelector<HTMLButtonElement>('.footer-btn.danger')!

    forget.click()
    await nextTick()
    expect(api.learnedCount.value).toBe(1)
    expect(shownText(forget)).toBe('Confirm?')
    expect(shownText(save)).toContain('Save as New')

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(shownText(forget)).toBe('Reset heroes learned from your corrections')
    forget.click()
    expect(api.learnedCount.value).toBe(1)
    forget.click()
    await nextTick()
    expect(api.learnedCount.value).toBe(0)
    expect(forget.isConnected).toBe(false)
  })

  it.each(['confirm', 'correct'])(
    'keeps paragon confirmation separate when choosing to %s the hero',
    async (action) => {
      const { api } = await mountImport()
      expect(document.querySelector('.cell.review')).not.toBeNull()
      if (action === 'confirm') {
        document.querySelector<HTMLButtonElement>('.cell.review .confirm-choice')!.click()
      } else {
        api.setHero('sample', 1, 0, 9)
      }
      await nextTick()
      const characterId = action === 'confirm' ? 5 : 9
      expect(api.shots.value[0]!.overrides['1:0']).toEqual({ characterId })
      expect(document.querySelector('.cell.review .confirm-choice')).toBeNull()
      expect(document.querySelector('.selection-popup')).toBeNull()
      const confirm = document.querySelector<HTMLButtonElement>('.cell.paragon .confirm-choice')!
      expect(confirm.textContent).toContain('Confirm P4')
      expect(document.querySelector('.shot-status')?.textContent).toContain('1 to review')
      confirm.click()
      await nextTick()
      expect(api.shots.value[0]!.overrides['1:0']).toEqual({ characterId, paragon: 4 })
      expect(document.querySelector('.cell.paragon .confirm-choice')).toBeNull()
      expect(document.querySelector('.cell.sure .edited')).not.toBeNull()
      expect(document.querySelector('.shot-status')?.textContent).toContain('Ready')
    },
  )

  it('accepts an artifact guess without opening the picker or changing the guess', async () => {
    const { api } = await mountImport()
    api.shots.value[0]!.reading!.artifacts[1] = {
      card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
      candidates: [{ artifactId: 1, score: 0.5 }],
      margin: 0.02,
      sure: false,
    }
    await nextTick()
    document.querySelector<HTMLButtonElement>('.artifact .confirm-choice')!.click()
    await nextTick()
    expect(api.shots.value[0]!.artifactOverrides).toEqual({ 1: 1 })
    expect(document.querySelector('.artifact .confirm-choice')).toBeNull()
    expect(document.querySelector('.selection-popup')).toBeNull()
  })
})
