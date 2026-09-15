/* The app's two serialization boundaries, one function each way per format:
 *
 * - BINARY (binaryEncoder) is the link format — every `?g=` payload — plus
 *   the arena autosave, the one binary value at rest (a device-local snapshot
 *   that is never exported or shared). `decodeLinkFromUrl` is the universal
 *   link decoder: the only function any page or storage pass calls for a
 *   `?g=` payload, and the shim's single call site in live code.
 * - JSON (encode/decodeMultiGridState) is the interchange format — the
 *   saved-team library, mode slots, and export files — the data that
 *   canonicalization and the byte-equality compares operate on. Links never
 *   use it.
 */

import {
  bytesToUrlSafe,
  decodeLink,
  encodeLink,
  urlSafeToBytes,
  type BinaryLinkState,
} from './binaryEncoder'
import type { GridState, MultiGridState } from './gridStateSerializer'
import { convertLegacyBoard, decodeLegacyLink, stampLegacySeason } from './upgradeMigration'

/* Decode any `?g=` link payload. Strict v2 first; a failure falls through to
 * the shim's frozen legacy reader (old binary arena links and the stored
 * arena autosave, plus pre-binary JSON Teams links). Pages route on the
 * result's mode — 'arena' or a team mode key. */
export function decodeLinkFromUrl(encoded: string): BinaryLinkState | null {
  const bytes = urlSafeToBytes(encoded)
  if (!bytes || bytes.length === 0) return null
  const link = decodeLink(bytes)
  if (link) return link
  // TEMPORARY: delete with upgradeMigration.ts.
  return decodeLegacyLink(encoded, bytes)
}

export function encodeGridStateToUrl(gridState: GridState): string {
  try {
    const { d, ...board } = gridState
    return bytesToUrlSafe(encodeLink({ mode: 'arena', active: 0, d, boards: [board] }))
  } catch (error) {
    console.error('Failed to encode grid state:', error)
    throw new Error('Failed to encode grid state for sharing')
  }
}

/* The arena adapter over the universal decoder: a payload naming any other
 * mode rejects, so a teams link pasted on the Arena page (or crafted into the
 * arena autosave) fails clean instead of half-rendering one board. */
export function decodeGridStateFromUrl(encodedState: string): GridState | null {
  const link = decodeLinkFromUrl(encodedState)
  if (!link || link.mode !== 'arena') return null
  const board = link.boards[0] ?? {}
  return { ...board, d: link.d }
}

export function encodeMultiGridStateToLinkUrl(state: MultiGridState): string {
  try {
    return bytesToUrlSafe(
      encodeLink({
        mode: state.mode ?? '',
        active: state.active,
        d: state.d,
        boards: state.boards,
      }),
    )
  } catch (error) {
    console.error('Failed to encode multi-grid state:', error)
    throw new Error('Failed to encode grid state for sharing')
  }
}

// JSON, interchange only (library, slots, export files) — never a link.
export function encodeMultiGridStateToUrl(state: MultiGridState): string {
  return bytesToUrlSafe(new TextEncoder().encode(JSON.stringify(state)))
}

// Consumers past the decode boundary (canonicalization, validation, restore,
// preview) read board keys and destructure section rows directly, so a crafted
// payload is rejected unless every board is a plain object whose sections have
// the serializer's shapes. Keys outside the contract are left to
// canonicalization, which drops them.
const ROW_SECTIONS = ['t', 'c', 's', 'y', 'u'] as const
const isNumber = (value: unknown): boolean => typeof value === 'number'
const isRowSection = (value: unknown): boolean =>
  Array.isArray(value) && value.every((row) => Array.isArray(row) && row.every(isNumber))
const isIdSection = (value: unknown): boolean =>
  Array.isArray(value) && value.every((id) => id === null || isNumber(id))
const isWellFormedBoard = (board: unknown): boolean => {
  if (typeof board !== 'object' || board === null || Array.isArray(board)) return false
  const sections = board as Record<string, unknown>
  if (sections.m !== undefined && typeof sections.m !== 'string') return false
  if (sections.a !== undefined && !isIdSection(sections.a)) return false
  return ROW_SECTIONS.every((key) => sections[key] === undefined || isRowSection(sections[key]))
}

export function decodeMultiGridStateFromUrl(encoded: string): MultiGridState | null {
  try {
    const bytes = urlSafeToBytes(encoded)
    if (!bytes || bytes.length === 0) return null
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as MultiGridState
    if (!Array.isArray(parsed.boards) || !parsed.boards.every(isWellFormedBoard)) return null
    // Crafted junk carries no provenance; consumers treat an absent season as
    // current-pool content. The upper bound blocks absurd-but-integer values
    // (1e300 passes Number.isInteger) from persisting into records and labels.
    if (
      parsed.season !== undefined &&
      (!Number.isInteger(parsed.season) || parsed.season < 0 || parsed.season > 9999)
    ) {
      delete parsed.season
    }
    // TEMPORARY: delete with upgradeMigration.ts.
    stampLegacySeason(parsed)
    for (const board of parsed.boards) convertLegacyBoard(board as Record<string, unknown>)
    return parsed
  } catch {
    return null
  }
}

/* Get encoded state from current URL
 * Direct URL parsing - used when Vue Router isn't available (e.g., initial page load in HomeView)
 * Uses URLSearchParams to read directly from window.location.search */
export function getEncodedStateFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('g')
}

/* Get encoded state from Vue Router query object
 * Vue Router query parsing - used when working with route.query object (e.g., ShareView)
 * Handles Vue Router's query format which can be string, string[], or null */
export function getEncodedStateFromRoute(query: { g?: string | string[] | null }): string | null {
  return typeof query.g === 'string' ? query.g : null
}
