/* Wire-id registry for the binary link codec: stable numeric ids for the
 * string-keyed modes and maps, so links carry small integers instead of text.
 *
 * APPEND-ONLY: ids are never reused or renumbered; retiring a mode or map
 * leaves its id reserved (a retired entry stays here, tagged in a comment).
 * Deliberately a pure leaf: the codec imports this file, so it must stay free
 * of data loading (maps.ts eagerly loads every arena JSON) and Vue. Board
 * counts are duplicated from TEAM_MODES for the same reason — completeness
 * and equality against the real TEAM_MODES / MAPS data are enforced by the
 * registry contract tests, not by importing the data here.
 */

import type { TeamModeKey } from './modes'

export interface WireMode {
  wireId: number
  key: TeamModeKey | 'arena'
  boardCount: number
}

// The Arena page's single board is wire mode 0 — a first-class mode on the
// wire, not a special case.
export const WIRE_MODES: readonly WireMode[] = [
  { wireId: 0, key: 'arena', boardCount: 1 },
  { wireId: 1, key: '1v1', boardCount: 1 },
  { wireId: 2, key: '3v3', boardCount: 3 },
  { wireId: 3, key: '5v5', boardCount: 5 },
  { wireId: 4, key: '5v5sl', boardCount: 5 },
]

/* Map keys (arena JSON filenames) → wire ids. 0 is reserved for "no map":
 * arena boards carry none in links — their serialized tiles are authoritative.
 * Seasonal preset ids follow the owner's rotation policy: a season's maps
 * replace the last season's, and freed ids return to this pool. */
export const MAP_WIRE_IDS: Readonly<Record<string, number>> = {
  arena1: 1,
  arena2: 2,
  arena3: 3,
  arena4: 4,
  arena5: 5,
  arena5sp: 6,
  'preset-as1': 7,
  'preset-as2': 8,
  'preset-as3': 9,
  'preset-as4': 10,
  'preset-sr1': 11,
  'preset-sr2': 12,
  'preset-sr3': 13,
  'preset-sr4': 14,
  'preset-sr5': 15,
  'preset-sr6': 16,
  'preset-sr7': 17,
  'preset-sr8': 18,
  'preset-sr9': 19,
  'preset-sr10': 20,
  'preset-sr11': 21,
}

const MODE_BY_ID = new Map(WIRE_MODES.map((mode) => [mode.wireId, mode]))
const MODE_BY_KEY = new Map<string, WireMode>(WIRE_MODES.map((mode) => [mode.key, mode]))
const MAP_KEY_BY_ID = new Map(Object.entries(MAP_WIRE_IDS).map(([key, id]) => [id, key]))

export const wireModeById = (wireId: number): WireMode | undefined => MODE_BY_ID.get(wireId)

export const wireModeByKey = (key: string): WireMode | undefined => MODE_BY_KEY.get(key)

export const mapKeyByWireId = (wireId: number): string | undefined => MAP_KEY_BY_ID.get(wireId)

export const mapWireIdByKey = (key: string): number | undefined => MAP_WIRE_IDS[key]
