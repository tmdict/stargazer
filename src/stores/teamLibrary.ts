/* The saved-teams library: named canonical snapshots of N-grid teams, persisted
 * under one versioned localStorage blob.
 *
 * Layering: this store returns typed results and never surfaces user feedback —
 * toasts belong to the calling components/composables (stores must not call
 * composables). Mutations re-read the stored blob first (read-modify-write) so
 * two same-origin tabs clobber each other per-mutation rather than resurrecting
 * whole stale arrays; full cross-tab sync is deliberately out of scope.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { MAX_SAVED_TEAMS, type TeamModeKey } from '@/lib/teams/modes'
import {
  duplicateName,
  nextAutoName,
  sanitizeTeamName,
  validateSavedTeam,
  type SavedTeam,
} from '@/lib/teams/savedTeam'
import { readStorage, writeStorage } from '@/utils/storage'

const LIBRARY_KEY = 'stargazer.teams.saved'
const LIBRARY_VERSION = 1

interface LibraryBlob {
  v: number
  teams: unknown[]
}

const readLibrary = (): SavedTeam[] => {
  const raw = readStorage(LIBRARY_KEY)
  if (!raw) return []
  try {
    const blob = JSON.parse(raw) as LibraryBlob
    // An unknown version is treated as empty, never shape-read.
    if (blob.v !== LIBRARY_VERSION || !Array.isArray(blob.teams)) return []
    const teams: SavedTeam[] = []
    for (const record of blob.teams) {
      const valid = validateSavedTeam(record)
      if (valid) teams.push(valid)
      else console.warn('Dropping invalid saved team record:', record)
    }
    return teams
  } catch {
    return []
  }
}

const writeLibrary = (teams: SavedTeam[]): void => {
  writeStorage(LIBRARY_KEY, JSON.stringify({ v: LIBRARY_VERSION, teams }))
}

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>(readLibrary())

  const count = computed(() => teams.value.length)
  const atCap = computed(() => teams.value.length >= MAX_SAVED_TEAMS)

  const get = (id: string | null): SavedTeam | undefined =>
    id === null ? undefined : teams.value.find((team) => team.id === id)

  // Every mutation goes through here: re-read the stored blob (narrowing the
  // multi-tab clobber window to a single mutation), apply, persist, publish.
  const mutate = <T>(action: (fresh: SavedTeam[]) => T): T => {
    const fresh = readLibrary()
    const result = action(fresh)
    writeLibrary(fresh)
    teams.value = fresh
    return result
  }

  /* Create a new record from canonical data. `name` is sanitized; empty/absent
   * falls back to the next auto-name. Null when the library is at cap. */
  const saveAsNew = (mode: TeamModeKey, data: string, name?: string): SavedTeam | null =>
    mutate((fresh) => {
      if (fresh.length >= MAX_SAVED_TEAMS) return null
      const now = Date.now()
      const team: SavedTeam = {
        id: crypto.randomUUID(),
        name: sanitizeTeamName(name) ?? nextAutoName(fresh.map((t) => t.name)),
        mode,
        data,
        createdAt: now,
        updatedAt: now,
      }
      fresh.push(team)
      return team
    })

  /* Update an existing record's content in place (name and createdAt keep). */
  const update = (id: string, data: string): boolean =>
    mutate((fresh) => {
      const team = fresh.find((t) => t.id === id)
      if (!team) return false
      team.data = data
      team.updatedAt = Date.now()
      return true
    })

  const rename = (id: string, name: string): boolean =>
    mutate((fresh) => {
      const team = fresh.find((t) => t.id === id)
      const clean = sanitizeTeamName(name)
      if (!team || !clean) return false
      team.name = clean
      team.updatedAt = Date.now()
      return true
    })

  const remove = (id: string): void =>
    mutate((fresh) => {
      const index = fresh.findIndex((t) => t.id === id)
      if (index !== -1) fresh.splice(index, 1)
    })

  const removeAll = (): void =>
    mutate((fresh) => {
      fresh.length = 0
    })

  const duplicate = (id: string): SavedTeam | null =>
    mutate((fresh) => {
      if (fresh.length >= MAX_SAVED_TEAMS) return null
      const source = fresh.find((t) => t.id === id)
      if (!source) return null
      const now = Date.now()
      const copy: SavedTeam = {
        ...source,
        id: crypto.randomUUID(),
        name: duplicateName(source.name),
        createdAt: now,
        updatedAt: now,
      }
      fresh.push(copy)
      return copy
    })

  return {
    teams,
    count,
    atCap,
    get,
    saveAsNew,
    update,
    rename,
    remove,
    removeAll,
    duplicate,
  }
})
