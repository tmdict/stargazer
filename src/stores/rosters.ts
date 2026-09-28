/* The roster library and the active roster: the picker's source of heroes and
 * the levels they start with (lib/rosters). No active roster means All heroes.
 *
 * Like the saved-team library, this store returns typed results and leaves
 * user feedback to components, re-reads storage before every change, and keeps
 * working in memory when a write fails (`persisted` reports it). */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { AttrRecord } from '@/lib/characters/attributes'
import { importInto, type ImportOutcome } from '@/lib/exportFile'
import { nextAutoName, sanitizeName } from '@/lib/names'
import {
  buildRostersExport,
  canonicalLevels,
  MAX_ROSTERS,
  parseRostersImport,
  validateRoster,
  type Roster,
  type RostersExportFile,
} from '@/lib/rosters'
import type { CharacterType } from '@/lib/types/character'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

const ROSTERS_KEY = 'stargazer.rosters'
const ACTIVE_KEY = 'stargazer.rosters.active'

const readRosters = (): Roster[] => {
  const raw = readStorage(ROSTERS_KEY)
  if (!raw) return []
  let records: unknown
  try {
    records = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(records)) return []
  const rosters: Roster[] = []
  for (const record of records) {
    const valid = validateRoster(record)
    if (valid) rosters.push(valid)
    else console.warn('Dropping invalid roster record:', record)
  }
  return rosters
}

const writeRosters = (rosters: Roster[]): boolean =>
  writeStorage(ROSTERS_KEY, JSON.stringify(rosters))

export const useRosters = defineStore('rosters', () => {
  const rosters = ref<Roster[]>(readRosters())
  // Whether the last change reached storage.
  const persisted = ref(true)
  const activeId = ref<string | null>(readStorage(ACTIVE_KEY))

  const active = computed(() => rosters.value.find((r) => r.id === activeId.value) ?? null)
  const count = computed(() => rosters.value.length)

  const mutate = <T>(action: (fresh: Roster[]) => T): T => {
    const fresh = persisted.value ? readRosters() : [...rosters.value]
    const result = action(fresh)
    persisted.value = writeRosters(fresh)
    rosters.value = fresh
    return result
  }

  const setActive = (id: string | null): void => {
    activeId.value = id
    if (id === null) removeStorage(ACTIVE_KEY)
    else writeStorage(ACTIVE_KEY, id)
  }

  // A new roster becomes the active one, since the Rosters tab edits the
  // active roster.
  const create = (): Roster | null => {
    const created = mutate((fresh) => {
      if (fresh.length >= MAX_ROSTERS) return null
      const now = Date.now()
      const roster: Roster = {
        id: crypto.randomUUID(),
        name: nextAutoName(
          fresh.map((r) => r.name),
          'Roster',
        ),
        heroes: {},
        createdAt: now,
        updatedAt: now,
      }
      fresh.push(roster)
      return roster
    })
    if (created) setActive(created.id)
    return created
  }

  // A rename leaves `updatedAt` alone: it tracks content edits only.
  const rename = (id: string, name: string): boolean =>
    mutate((fresh) => {
      const roster = fresh.find((r) => r.id === id)
      const clean = sanitizeName(name)
      if (!roster || !clean) return false
      roster.name = clean
      return true
    })

  const remove = (id: string): void => {
    mutate((fresh) => {
      const index = fresh.findIndex((r) => r.id === id)
      if (index !== -1) fresh.splice(index, 1)
    })
    if (activeId.value === id) setActive(null)
  }

  // Keyed by hero id: levels add or update the hero, null removes it.
  const setHeroes = (id: string, changes: Record<string, AttrRecord | null>): void =>
    mutate((fresh) => {
      const roster = fresh.find((r) => r.id === id)
      if (!roster) return
      const heroes = { ...roster.heroes }
      for (const [heroId, levels] of Object.entries(changes)) {
        if (levels === null) delete heroes[heroId]
        else heroes[heroId] = canonicalLevels(levels)
      }
      roster.heroes = heroes
      roster.updatedAt = Date.now()
    })

  const levelsFor = (heroId: number): AttrRecord | undefined => active.value?.heroes[heroId]

  // Placeholders stand in for any hero, so every source offers them.
  const isPickable = (character: CharacterType): boolean =>
    !active.value ||
    !!character.placeholder ||
    Object.hasOwn(active.value.heroes, String(character.id))

  const exportRosters = (): RostersExportFile =>
    buildRostersExport(rosters.value, new Date().toISOString())

  // Merge-only (lib/exportFile).
  const importRosters = (raw: string): ImportOutcome =>
    mutate((fresh) => importInto(fresh, parseRostersImport(raw, fresh), MAX_ROSTERS))

  return {
    rosters,
    persisted,
    activeId,
    active,
    count,
    setActive,
    create,
    rename,
    remove,
    setHeroes,
    levelsFor,
    isPickable,
    exportRosters,
    importRosters,
  }
})
