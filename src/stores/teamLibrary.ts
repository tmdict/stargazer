/* The saved-teams library: named canonical snapshots of N-grid teams, persisted
 * under one versioned localStorage blob.
 *
 * Layering: this store returns typed results and never surfaces user feedback;
 * toasts belong to the calling components/composables (stores must not call
 * composables). Mutations re-read the stored blob first (read-modify-write) so
 * two same-origin tabs clobber each other per-mutation rather than resurrecting
 * whole stale arrays; full cross-tab sync is deliberately out of scope.
 */

import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { MAX_SAVED_TEAMS, type TeamModeKey } from '@/lib/teams/modes'
import {
  canonicalTeamData,
  duplicateName,
  nextAutoName,
  sanitizeTeamName,
  validateSavedTeam,
  type SavedTeam,
} from '@/lib/teams/savedTeam'
import { buildExport, parseImport, type TeamsExportFile } from '@/lib/teams/transfer'
import { readStorage, writeStorage } from '@/utils/storage'

const LIBRARY_KEY = 'stargazer.teams.saved'
const BACKUP_KEY = `${LIBRARY_KEY}.backup`
const LIBRARY_VERSION = 1

interface LibraryBlob {
  v: number
  teams: unknown[]
}

const readLibrary = (): SavedTeam[] => {
  const raw = readStorage(LIBRARY_KEY)
  if (!raw) return []
  let blob: LibraryBlob
  try {
    blob = JSON.parse(raw) as LibraryBlob
  } catch {
    return []
  }
  if (typeof blob !== 'object' || blob === null) return []
  if (blob.v !== LIBRARY_VERSION || !Array.isArray(blob.teams)) {
    // An unknown version is treated as empty, never shape-read, but it is
    // likely a NEWER app version's library, and this version's next mutation
    // will overwrite the live key, so preserve the blob under a backup key.
    if (readStorage(BACKUP_KEY) === null) writeStorage(BACKUP_KEY, raw)
    return []
  }
  const teams: SavedTeam[] = []
  for (const record of blob.teams) {
    // Per-record isolation: one malformed record must drop alone, never hide
    // (or, via the next write, wipe) the rest of the library.
    try {
      const valid = validateSavedTeam(record)
      if (valid) teams.push(valid)
      else console.warn('Dropping invalid saved team record:', record)
    } catch {
      console.warn('Dropping invalid saved team record:', record)
    }
  }
  return teams
}

const writeLibrary = (teams: SavedTeam[]): void => {
  if (!writeStorage(LIBRARY_KEY, JSON.stringify({ v: LIBRARY_VERSION, teams }))) {
    console.warn('Saved-teams library write failed; changes are in-memory only')
  }
}

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>(readLibrary())

  const count = computed(() => teams.value.length)
  const atCap = computed(() => teams.value.length >= MAX_SAVED_TEAMS)

  const get = (id: string | null): SavedTeam | undefined =>
    id === null ? undefined : teams.value.find((team) => team.id === id)

  // Mutations re-read the stored blob first so a second tab's writes survive
  // (clobber window narrows to one mutation).
  const mutate = <T>(action: (fresh: SavedTeam[]) => T): T => {
    const fresh = readLibrary()
    const result = action(fresh)
    writeLibrary(fresh)
    teams.value = fresh
    return result
  }

  /* An empty/absent name falls back to the next auto-name; null when at cap
   * or when the data doesn't canonicalize. Canonical `data` is this store's
   * invariant, so it is enforced here rather than trusted from callers
   * (idempotent for the already-canonical strings they normally pass). */
  const saveAsNew = (mode: TeamModeKey, data: string, name?: string): SavedTeam | null =>
    mutate((fresh) => {
      if (fresh.length >= MAX_SAVED_TEAMS) return null
      const canonical = canonicalTeamData(data)
      if (!canonical) return null
      const now = Date.now()
      const team: SavedTeam = {
        id: crypto.randomUUID(),
        name: sanitizeTeamName(name) ?? nextAutoName(fresh.map((t) => t.name)),
        mode,
        data: canonical,
        createdAt: now,
        updatedAt: now,
      }
      fresh.push(team)
      return team
    })

  /* Content-only update: name and createdAt keep. */
  const update = (id: string, data: string): boolean =>
    mutate((fresh) => {
      const team = fresh.find((t) => t.id === id)
      const canonical = canonicalTeamData(data)
      if (!team || !canonical) return false
      team.data = canonical
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

  const exportAll = (): TeamsExportFile => buildExport(teams.value, new Date().toISOString())

  /* Merge-only: `invalid` means the envelope itself was rejected (library
   * untouched); records past the cap count as skipped. */
  const importTeams = (raw: string): { imported: number; skipped: number; invalid: boolean } =>
    mutate((fresh) => {
      const parsed = parseImport(raw, fresh)
      if (!parsed.ok) return { imported: 0, skipped: 0, invalid: true }
      let imported = 0
      let skipped = parsed.skipped
      for (const team of parsed.teams) {
        if (fresh.length >= MAX_SAVED_TEAMS) skipped++
        else {
          fresh.push(team)
          imported++
        }
      }
      return { imported, skipped, invalid: false }
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
    exportAll,
    importTeams,
  }
})
