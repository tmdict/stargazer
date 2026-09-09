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

export function decodeMultiGridStateFromUrl(encoded: string): MultiGridState | null {
  try {
    const bytes = urlSafeToBytes(encoded)
    if (!bytes || bytes.length === 0) return null
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as MultiGridState
    if (!Array.isArray(parsed.boards)) return null
    // Every board must be a plain object: consumers (canonicalization,
    // validation, restore) read board keys directly past this boundary, so a
    // null/array entry in a crafted payload would throw deep inside them.
    const plainObjects = parsed.boards.every(
      (board) => typeof board === 'object' && board !== null && !Array.isArray(board),
    )
    if (!plainObjects) return null
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
