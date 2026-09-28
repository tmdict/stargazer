/* The saved-teams library: named canonical snapshots of N-grid teams, persisted
 * under one localStorage blob.
 *
 * Layering: this store returns typed results and never surfaces user feedback;
 * toasts belong to the calling components/composables (stores must not call
 * composables). Mutations re-read the stored blob first (read-modify-write) so
 * two same-origin tabs clobber each other per-mutation rather than resurrecting
 * whole stale arrays; full cross-tab sync is deliberately out of scope. Once a
 * write fails the in-memory list is the only copy, so mutations build on it
 * until a write lands again, and `persisted` lets callers report the loss.
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

// The stored value is a plain array of records (docs/architecture/TEAMS.md).
const readLibrary = (): SavedTeam[] => {
  const raw = readStorage(LIBRARY_KEY)
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  // TEMPORARY: delete with upgradeMigration.ts (its runbook names this line).
  // A library its v pass has not rewritten yet still loads, and the next write
  // stores it as the plain array, so a failed rewrite can't lose a team.
  const records = Array.isArray(parsed) ? parsed : (parsed as { teams?: unknown } | null)?.teams
  if (!Array.isArray(records)) return []
  const teams: SavedTeam[] = []
  for (const record of records) {
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

const writeLibrary = (teams: SavedTeam[]): boolean =>
  writeStorage(LIBRARY_KEY, JSON.stringify(teams))

export const useTeamLibrary = defineStore('teamLibrary', () => {
  const teams = ref<SavedTeam[]>(readLibrary())
  // Whether the last mutation reached storage.
  const persisted = ref(true)

  const count = computed(() => teams.value.length)
  const atCap = computed(() => teams.value.length >= MAX_SAVED_TEAMS)

  const get = (id: string | null): SavedTeam | undefined =>
    id === null ? undefined : teams.value.find((team) => team.id === id)

  // Mutations re-read the stored blob first so a second tab's writes survive
  // (clobber window narrows to one mutation).
  const mutate = <T>(action: (fresh: SavedTeam[]) => T): T => {
    const fresh = persisted.value ? readLibrary() : [...teams.value]
    const result = action(fresh)
    persisted.value = writeLibrary(fresh)
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

  /* The last-modified sort and the card's "updated" label both read `updatedAt`,
   * so a relabel deliberately leaves it alone. */
  const rename = (id: string, name: string): boolean =>
    mutate((fresh) => {
      const team = fresh.find((t) => t.id === id)
      const clean = sanitizeTeamName(name)
      if (!team || !clean) return false
      team.name = clean
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

  const exportTeams = (selection: readonly SavedTeam[] = teams.value): TeamsExportFile =>
    buildExport(selection, new Date().toISOString())

  /* Merge-only: `invalid` means the envelope itself was rejected (library
   * untouched); records past the cap count as skipped. */
  const importTeams = (
    raw: string,
  ): { imported: number; skipped: number; conflicts: number; invalid: boolean } =>
    mutate((fresh) => {
      const parsed = parseImport(raw, fresh)
      if (!parsed.ok) return { imported: 0, skipped: 0, conflicts: 0, invalid: true }
      let imported = 0
      let skipped = parsed.skipped
      for (const team of parsed.teams) {
        if (fresh.length >= MAX_SAVED_TEAMS) skipped++
        else {
          fresh.push(team)
          imported++
        }
      }
      return { imported, skipped, conflicts: parsed.conflicts, invalid: false }
    })

  return {
    teams,
    persisted,
    count,
    atCap,
    get,
    saveAsNew,
    update,
    rename,
    remove,
    removeAll,
    duplicate,
    exportTeams,
    importTeams,
  }
})
