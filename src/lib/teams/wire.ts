/* Wire-id registry for the binary link codec: stable numeric ids for the
 * string-keyed modes and maps, so links carry small integers instead of text.
 *
 * An id is stable while its mode or map exists; reassigning one that live
 * data still carries would silently re-route those links. Retirement therefore
 * goes through a conversion window: a temporary migration converts the retired
 * mode id for as long as it lives, and the id returns to the pool when that
 * migration is deleted, exactly as seasonal preset maps rotate with the season
 * and hand their freed ids back. A mode is a board count (variants live in the
 * boards' map ids), so the mode table grows only for a new board count.
 * The codec imports this file, so it stays free of dataLoader and Vue: map ids
 * come from maps.ts, which loads only the arena JSON, and board counts are
 * duplicated from TEAM_MODES rather than imported, with the registry contract
 * tests checking them against the real TEAM_MODES data.
 */

import { MAPS } from '../maps'
import type { TeamModeKey } from './modes'

export interface WireMode {
  wireId: number
  key: TeamModeKey | 'arena'
  boardCount: number
}

// The Arena page's single board is wire mode 0, a first-class mode on the
// wire rather than a special case.
export const WIRE_MODES: readonly WireMode[] = [
  { wireId: 0, key: 'arena', boardCount: 1 },
  { wireId: 1, key: '1v1', boardCount: 1 },
  { wireId: 2, key: '3v3', boardCount: 3 },
  { wireId: 3, key: '5v5', boardCount: 5 },
  // TEMPORARY (delete with upgradeMigration.ts): id 4 is the retired 5v5sl
  // mode's id, which the shim converts on links; the id is free once the shim
  // is gone.
]

const MODE_BY_ID = new Map(WIRE_MODES.map((mode) => [mode.wireId, mode]))
const MODE_BY_KEY = new Map<string, WireMode>(WIRE_MODES.map((mode) => [mode.key, mode]))

// Map ids are each arena file's `id` (maps.ts keeps them unique). 0 is
// reserved for "no map": arena boards carry none in links, since their
// serialized tiles are authoritative.
const MAP_KEY_BY_ID = new Map(Object.entries(MAPS).map(([key, map]) => [map.id, key]))

export const wireModeById = (wireId: number): WireMode | undefined => MODE_BY_ID.get(wireId)

export const wireModeByKey = (key: string): WireMode | undefined => MODE_BY_KEY.get(key)

export const mapKeyByWireId = (wireId: number): string | undefined => MAP_KEY_BY_ID.get(wireId)

export const mapWireIdByKey = (key: string): number | undefined => MAPS[key]?.id
