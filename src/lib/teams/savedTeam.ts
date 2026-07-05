/* Saved-team records: types, naming rules, canonical data, and per-record
 * validation shared by library hydration and file import.
 *
 * `data` is always CANONICAL: the encoded MultiGridState stripped of viewer
 * state (`active` board pointer and `d` display flags) and re-encoded through
 * this codebase's serializer. Team content only — so equal content is byte-equal,
 * which is what makes the unsaved-changes compare and import dedupe trustworthy.
 */

import {
  BOARD_CONTENT_KEYS,
  type BoardState,
  type MultiGridState,
} from '@/utils/gridStateSerializer'
import { decodeMultiGridStateFromUrl, encodeMultiGridStateToUrl } from '@/utils/urlStateManager'
import {
  isTeamModeKey,
  MAX_TEAM_NAME_LENGTH,
  resolveTeamMode,
  TEAM_MODES,
  type TeamModeKey,
} from './modes'

export interface SavedTeam {
  id: string
  name: string
  mode: TeamModeKey
  // Canonical encoded MultiGridState (share-link codec, viewer state stripped).
  data: string
  createdAt: number
  updatedAt: number
}

/* Strip viewer state and re-encode. Boards are rebuilt key-by-key from
 * BOARD_CONTENT_KEYS (the serializer's emission order) so a hand-ordered import
 * and a fresh serialize of the same content produce identical bytes, and any
 * unregistered key is dropped. The mode is re-resolved so a canonical string is
 * total and self-consistent even for hand-crafted input. Null = undecodable. */
export function canonicalTeamData(encoded: string): string | null {
  const decoded = decodeMultiGridStateFromUrl(encoded)
  if (!decoded || decoded.boards.length === 0) return null
  const canonical: MultiGridState = {
    boards: decoded.boards.map((board) => {
      const ordered: BoardState = {}
      for (const key of BOARD_CONTENT_KEYS) {
        if (board[key] !== undefined) (ordered as Record<string, unknown>)[key] = board[key]
      }
      return ordered
    }),
    mode: resolveTeamMode(decoded),
  }
  return encodeMultiGridStateToUrl(canonical)
}

export function sanitizeTeamName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim().slice(0, MAX_TEAM_NAME_LENGTH)
  return name.length > 0 ? name : null
}

export function nextAutoName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames)
  let n = existingNames.length + 1
  while (taken.has(`Team ${n}`)) n++
  return `Team ${n}`
}

export function duplicateName(name: string): string {
  // Truncate the base, not the suffix, so a max-length name still gets a
  // visibly distinct copy name.
  return `${name.slice(0, MAX_TEAM_NAME_LENGTH - 7)} (copy)`
}

/* Validate one record from untrusted storage (hydration) or an import file.
 * Returns a normalized record — name sanitized, data canonicalized — or null.
 * Rules: known mode; decodable data whose board count matches the mode. Map keys
 * are NOT checked against the map registry: the serialized `t` tile states are
 * authoritative (restore resets tiles and replays them), so a record referencing
 * a retired map still restores and previews correctly — only the Maps-tab
 * highlight has nothing to point at. */
export function validateSavedTeam(record: unknown): SavedTeam | null {
  if (typeof record !== 'object' || record === null) return null
  const { id, name, mode, data, createdAt, updatedAt } = record as Record<string, unknown>

  if (typeof id !== 'string' || id.length === 0) return null
  const cleanName = sanitizeTeamName(name)
  if (!cleanName) return null
  if (!isTeamModeKey(mode)) return null
  if (typeof data !== 'string') return null

  const decoded = decodeMultiGridStateFromUrl(data)
  if (!decoded) return null
  if (decoded.boards.length !== TEAM_MODES[mode].boardCount) return null

  const canonical = canonicalTeamData(data)
  if (!canonical) return null

  return {
    id,
    name: cleanName,
    mode,
    data: canonical,
    createdAt: typeof createdAt === 'number' ? createdAt : 0,
    updatedAt: typeof updatedAt === 'number' ? updatedAt : 0,
  }
}
