import { nextTick, ref } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadTeamsDisplayPrefs,
  saveTeamsDisplayPrefs,
  teamsSlotKey,
  useTeamsPersistence,
  type ActiveSlot,
} from '@/composables/useGridPersistence'
import type { TeamModeKey } from '@/lib/teams/modes'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from '@/stores/character'
import { useGrids } from '@/stores/grids'

/* Per-mode ActiveSlot persistence: slot routing, envelope round-trips, pause
 * semantics, and legacy-key cleanup. Runs headless: node env + in-memory
 * localStorage stub, SSR flag off so the storage branches execute. */

const storage = new Map<string, string>()
const setItemSpy = vi.fn((key: string, value: string) => {
  storage.set(key, value)
})

function stubStorage() {
  storage.clear()
  setItemSpy.mockClear()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: setItemSpy,
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  })
}

const FLAGS = () => ({ showGridInfo: true, showArrows: false })

const readEnvelope = (mode: TeamModeKey): ActiveSlot =>
  JSON.parse(storage.get(teamsSlotKey(mode))!) as ActiveSlot

describe('useTeamsPersistence', () => {
  beforeEach(() => {
    vi.stubEnv('SSR', false)
    stubStorage()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('deletes the legacy single-slot key unread on creation', () => {
    storage.set('stargazer.teams', 'legacy-payload')
    useTeamsPersistence(ref<TeamModeKey>('5v5sl'), ref(null), FLAGS)
    expect(storage.has('stargazer.teams')).toBe(false)
  })

  it('flush is inert before startAutosave (degraded page must not overwrite slots)', () => {
    storage.set(teamsSlotKey('3v3'), 'existing-slot')
    const persistence = useTeamsPersistence(ref<TeamModeKey>('3v3'), ref(null), FLAGS)
    persistence.flush()
    expect(storage.get(teamsSlotKey('3v3'))).toBe('existing-slot')
  })

  it('routes flush writes to the live mode slot with a versioned envelope', () => {
    const mode = ref<TeamModeKey>('3v3')
    const sourceId = ref<string | null>('team-42')
    const persistence = useTeamsPersistence(mode, sourceId, FLAGS)
    persistence.startAutosave()

    persistence.flush()
    const slot = readEnvelope('3v3')
    expect(slot.v).toBe(1)
    expect(slot.sourceId).toBe('team-42')
    expect(typeof slot.data).toBe('string')
    expect(storage.has(teamsSlotKey('5v5sl'))).toBe(false)

    mode.value = '5v5sl'
    sourceId.value = null
    persistence.flush()
    expect(readEnvelope('5v5sl').sourceId).toBeNull()
  })

  it('load round-trips the envelope and rejects corrupt or wrong-version slots', () => {
    const mode = ref<TeamModeKey>('1v1')
    const persistence = useTeamsPersistence(mode, ref('abc'), FLAGS)
    persistence.startAutosave()

    const loaded = persistence.load('1v1')
    expect(loaded).not.toBeNull()
    expect(loaded!.sourceId).toBe('abc')
    expect(loaded!.data).toBe(readEnvelope('1v1').data)

    expect(persistence.load('3v3')).toBeNull()
    storage.set(teamsSlotKey('3v3'), 'not json')
    expect(persistence.load('3v3')).toBeNull()
    storage.set(teamsSlotKey('3v3'), JSON.stringify({ v: 2, data: 'x', sourceId: null }))
    expect(persistence.load('3v3')).toBeNull()
    storage.set(teamsSlotKey('3v3'), JSON.stringify({ v: 1, data: 42, sourceId: null }))
    expect(persistence.load('3v3')).toBeNull()
  })

  it('persists and validates the last-used mode', () => {
    const persistence = useTeamsPersistence(ref<TeamModeKey>('5v5'), ref(null), FLAGS)
    expect(persistence.loadMode()).toBeNull()
    persistence.persistMode('3v3')
    expect(persistence.loadMode()).toBe('3v3')
    storage.set('stargazer.teams.mode', 'garbage')
    expect(persistence.loadMode()).toBeNull()
  })

  it('autosaves board changes to the live slot and pause gates the watcher', async () => {
    const grids = useGrids()
    const character = useCharacterStore()
    grids.setGridCount(1, ['arena1'])

    const mode = ref<TeamModeKey>('1v1')
    const persistence = useTeamsPersistence(mode, ref(null), FLAGS)
    persistence.startAutosave()
    const baseline = readEnvelope('1v1').data

    character.placeCharacterOnHex(1, 11, Team.ALLY)
    await nextTick()
    const withUnit = readEnvelope('1v1').data
    expect(withUnit).not.toBe(baseline)

    persistence.setPaused(true)
    character.placeCharacterOnHex(2, 12, Team.ALLY)
    await nextTick()
    expect(readEnvelope('1v1').data).toBe(withUnit)

    persistence.setPaused(false)
    character.placeCharacterOnHex(3, 13, Team.ALLY)
    await nextTick()
    expect(readEnvelope('1v1').data).not.toBe(withUnit)
  })

  it('startAutosave guards against double registration', async () => {
    const grids = useGrids()
    const character = useCharacterStore()
    grids.setGridCount(1, ['arena1'])

    const persistence = useTeamsPersistence(ref<TeamModeKey>('1v1'), ref(null), FLAGS)
    persistence.startAutosave()
    persistence.startAutosave()
    setItemSpy.mockClear()

    character.placeCharacterOnHex(1, 11, Team.ALLY)
    await nextTick()
    const slotWrites = setItemSpy.mock.calls.filter(([key]) => key === teamsSlotKey('1v1'))
    expect(slotWrites).toHaveLength(1)
  })
})

describe('teams display prefs', () => {
  beforeEach(() => {
    vi.stubEnv('SSR', false)
    stubStorage()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('round-trips the view toggles with inverted masked out both ways', () => {
    saveTeamsDisplayPrefs({
      showGridInfo: false,
      showArrows: true,
      teamView: true,
      wrap: true,
      inverted: true,
    })
    const loaded = loadTeamsDisplayPrefs()
    expect(loaded).not.toBeNull()
    expect(loaded!.showGridInfo).toBe(false)
    expect(loaded!.showArrows).toBe(true)
    expect(loaded!.teamView).toBe(true)
    expect(loaded!.wrap).toBe(true)
    expect(loaded!.inverted).toBe(false)
  })

  it('returns null when absent or corrupt', () => {
    expect(loadTeamsDisplayPrefs()).toBeNull()
    storage.set('stargazer.teams.display', 'garbage')
    expect(loadTeamsDisplayPrefs()).toBeNull()
  })
})
