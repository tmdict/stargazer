/* Pure mappings from a saved team's encoded data to display inputs: thumbnail
 * boards (one entry per board with its map key, occupied hexes, and artifact
 * ids) and record-level queries like teamHasSynergy. Image resolution stays in
 * the component layer (it needs the game-data store); this split keeps the
 * mapping unit-testable headless. */

import { COMPANION_ID_OFFSET } from '@/lib/grid'
import { resolveBoardMap } from '@/lib/maps'
import { isPermanentArtifactId, isRetiredSeason } from '@/lib/seasonal'
import type { Team } from '@/lib/types/team'
import { decodeMultiGridStateFromUrl } from '@/utils/urlStateManager'
import {
  DEFAULT_VARIANT,
  matchVariant,
  resolveTeamMode,
  TEAM_VARIANTS,
  type VariantMatch,
} from './modes'

export interface PreviewUnit {
  hexId: number
  team: Team
  // Exactly one of the three is set (characters and phantimals resolve their
  // portraits through different dictionaries). A retired seasonal unit carries
  // only its season: the raw id is withheld so nothing can resolve it to the
  // current season's content that reuses it.
  characterId?: number
  phantimalLocal?: number // band-local: N * 10000 + L, N > 0 for a phantimal's companion
  retiredSeason?: number
}

// An artifact slot: a resolvable id, a retired seasonal placeholder, or empty.
export type PreviewArtifact = number | { retiredSeason: number } | null

/* A main-roster hero: not a phantimal, not a companion summon. */
export function isStandardHero(unit: PreviewUnit): unit is PreviewUnit & { characterId: number } {
  return unit.characterId !== undefined && unit.characterId < COMPANION_ID_OFFSET
}

/* Names a hero within one lineup for search highlighting: the saved-team
 * search builds these keys and TeamPreview tests its units against them.
 * `board` is the index into teamPreviewBoards. */
export function lineupHeroKey(board: number, team: Team, slug: string): string {
  return `${board}:${team}:${slug}`
}

export interface PreviewBoard {
  mapKey: string
  // The board's serialized tile states, authoritative for rendering (an empty
  // array means an all-default board; undefined means no t section was present).
  tiles?: number[][]
  units: PreviewUnit[]
  artifacts: { ally: PreviewArtifact; enemy: PreviewArtifact }
}

/* Null = undecodable record (the card renders its fallback tile). */
export function teamPreviewBoards(data: string): PreviewBoard[] | null {
  const decoded = decodeMultiGridStateFromUrl(data)
  if (!decoded || decoded.boards.length === 0) return null

  // Seasonal refs in a payload from another season's pool are retired: masked
  // here (season instead of id) so no display surface can resolve the reused
  // id to the current season's content.
  const retiredSeason =
    decoded.season !== undefined && isRetiredSeason(decoded.season) ? decoded.season : undefined
  const artifactSlot = (id: number | null | undefined): PreviewArtifact => {
    if (id === null || id === undefined) return null
    if (retiredSeason !== undefined && !isPermanentArtifactId(id)) return { retiredSeason }
    return id
  }

  return decoded.boards.map((board) => {
    const units: PreviewUnit[] = []
    for (const entry of board.c ?? []) {
      const [hexId, characterId, team] = entry
      if (hexId === undefined || characterId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, characterId })
    }
    for (const entry of board.s ?? []) {
      const [hexId, phantimalLocal, team] = entry
      if (hexId === undefined || phantimalLocal === undefined || team === undefined) continue
      if (retiredSeason !== undefined) units.push({ hexId, team: team as Team, retiredSeason })
      else units.push({ hexId, team: team as Team, phantimalLocal })
    }
    // Synergy-band locals reuse c's id space, so portraits, companion art, and
    // the search index handle them with the same logic as c entries.
    for (const entry of board.y ?? []) {
      const [hexId, localId, team] = entry
      if (hexId === undefined || localId === undefined || team === undefined) continue
      units.push({ hexId, team: team as Team, characterId: localId })
    }
    return {
      mapKey: resolveBoardMap(board),
      tiles: board.t,
      units,
      artifacts: { ally: artifactSlot(board.a?.[0]), enemy: artifactSlot(board.a?.[1]) },
    }
  })
}

// Memoized on the immutable data string (records mutate by replacement).
const variantCache = new Map<string, VariantMatch>()

/* The record's type (matchVariant): derived from its boards' maps against the
 * current registry and never stored, so a rotation that edits a registry row
 * changes the answer for every record at once. */
export function teamVariant(data: string): VariantMatch {
  const cached = variantCache.get(data)
  if (cached !== undefined) return cached
  const decoded = decodeMultiGridStateFromUrl(data)
  const result = decoded
    ? matchVariant(resolveTeamMode(decoded), decoded.boards.map(resolveBoardMap))
    : null
  variantCache.set(data, result)
  return result
}

/* The label key of the record's named type, for the card chips; null for
 * default or custom maps, which get no chip. */
export function teamTypeLabelKey(data: string): string | null {
  const variant = teamVariant(data)
  return variant === null || variant === DEFAULT_VARIANT ? null : TEAM_VARIANTS[variant].labelKey
}

const synergyCache = new Map<string, boolean>()

/* Whether the record fields a friend-assist unit. The Syn toggle itself is
 * never serialized: the placed assist hero is the state, so a y-section hero
 * entry (local id below the companion band) is the source of truth. */
export function teamHasSynergy(data: string): boolean {
  const cached = synergyCache.get(data)
  if (cached !== undefined) return cached
  const decoded = decodeMultiGridStateFromUrl(data)
  const result = !!decoded?.boards.some((board) =>
    (board.y ?? []).some((entry) => {
      const localId = entry[1]
      return localId !== undefined && localId < COMPANION_ID_OFFSET
    }),
  )
  synergyCache.set(data, result)
  return result
}
