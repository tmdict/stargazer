// @vitest-environment jsdom
import { createApp, h, nextTick, reactive } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import TeamImportModal from '@/components/modals/TeamImportModal.vue'
import { disposeTeamImport, useTeamImport, type ImportShot } from '@/composables/useTeamImport'
import { DESCRIPTOR_LENGTH } from '@/lib/import/heroes'
import type { TeamImportPlan } from '@/lib/teams/teamImport'
import { useI18nStore } from '@/stores/i18n'

vi.mock('@/stores/grids', () => ({
  useGrids: () => ({ rosterConflicts: () => [], rostersWouldReplace: () => false }),
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
  name: 'sample.png',
  size: 1,
  thumb: 'blob:sample',
  status: 'ready',
  error: null,
  cards: {},
  artifactCards: {},
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
          refinement: { level: 0, family: 'white', stars: 6 },
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
  disposeTeamImport()
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
  const pinia = createPinia()
  setActivePinia(pinia)
  useI18nStore().initialize()
  const api = useTeamImport(() => '3v3')
  api.referenceStatus.value = 'ready'
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
      button.textContent?.includes('Forget learned icons'),
    )!
    const save = document.querySelector<HTMLButtonElement>('.footer-btn.danger')!

    forget.click()
    await nextTick()
    expect(api.learnedCount.value).toBe(1)
    expect(forget.textContent?.trim()).toBe('Confirm?')
    expect(forget.classList.contains('armed')).toBe(true)
    expect(save.textContent).toContain('Save as New')
    expect(save.classList.contains('armed')).toBe(false)

    vi.advanceTimersByTime(3000)
    await nextTick()
    expect(forget.textContent).toContain('Forget learned icons (1)')
    expect(forget.classList.contains('armed')).toBe(false)
    forget.click()
    expect(api.learnedCount.value).toBe(1)
    forget.click()
    await nextTick()
    expect(api.learnedCount.value).toBe(0)
    expect(forget.isConnected).toBe(false)
  })

  it('saves without player names and leaves the generated record name blank', async () => {
    const { saved } = await mountImport()
    const save = document.querySelector<HTMLButtonElement>('.footer-btn.danger')!
    expect(document.querySelector('.record-name')!.textContent).toBe('')
    expect(save.disabled).toBe(false)
    save.click()
    expect(saved).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: '' }))
  })

  it.each(['confirm', 'correct'])(
    'keeps paragon confirmation separate when choosing to %s the hero',
    async (action) => {
      const { api } = await mountImport()
      expect(document.querySelector('.cell.review')).not.toBeNull()
      if (action === 'confirm') {
        document.querySelector<HTMLButtonElement>('.confirm-hero')!.click()
      } else {
        api.setHero('sample', 1, 0, 9)
      }
      await nextTick()
      const characterId = action === 'confirm' ? 5 : 9
      expect(api.shots.value[0]!.overrides['1:0']).toEqual({ characterId })
      expect(document.querySelector('.confirm-hero')).toBeNull()
      expect(document.querySelector('.selection-popup')).toBeNull()
      const confirm = document.querySelector<HTMLButtonElement>('.confirm-paragon')!
      expect(confirm.textContent).toContain('Confirm P4')
      expect(document.querySelector('.shot-status')?.textContent).toContain('1 to review')
      confirm.click()
      await nextTick()
      expect(api.shots.value[0]!.overrides['1:0']).toEqual({ characterId, paragon: 4 })
      expect(document.querySelector('.confirm-paragon')).toBeNull()
      expect(document.querySelector('.cell.sure .edited')).not.toBeNull()
      expect(document.querySelector('.shot-status')?.textContent).toContain('Ready')
    },
  )

  it('keeps the screenshot artifact close-up when the selection is removed', async () => {
    const { api } = await mountImport()
    const crop = 'data:image/png;base64,c2NyZWVuc2hvdA=='
    api.shots.value[0]!.artifactCards[1] = crop
    await nextTick()
    expect(document.querySelector('.artifact-card')?.getAttribute('src')).toBe(crop)
    expect(document.querySelectorAll('.artifact-card')).toHaveLength(1)
    api.setArtifact('sample', 1, null)
    await nextTick()
    expect(document.querySelector('.artifact-card')?.getAttribute('src')).toBe(crop)
    expect(document.querySelector('.artifact-icon.empty')).not.toBeNull()
  })

  it('accepts an artifact guess without opening the picker or changing the guess', async () => {
    const { api } = await mountImport()
    api.shots.value[0]!.reading!.artifacts[1] = {
      card: { width: 1, height: 1, data: new Uint8ClampedArray(4) },
      candidates: [{ artifactId: 1, score: 0.5 }],
      margin: 0.02,
    }
    await nextTick()
    const confirm = document.querySelector<HTMLButtonElement>('.confirm-artifact')!
    expect(confirm.textContent?.trim()).toBe('Confirm Starshard')
    confirm.click()
    await nextTick()
    expect(api.shots.value[0]!.artifactOverrides).toEqual({ 1: 1 })
    expect(document.querySelector('.artifact-name')?.textContent).toBe('Starshard')
    expect(document.querySelector('.confirm-artifact')).toBeNull()
    expect(document.querySelector('.artifact .edited')?.textContent).toBe('Edited')
    expect(document.querySelector('.selection-popup')).toBeNull()
  })
})
