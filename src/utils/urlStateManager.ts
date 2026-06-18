import type { GridTile } from '@/lib/grid'
import { bytesToUrlSafe, decodeFromBinary, encodeToBinary, urlSafeToBytes } from './binaryEncoder'
import {
  serializeGridState,
  type DisplayFlags,
  type GridState,
  type MultiGridState,
} from './gridStateSerializer'

export function encodeGridStateToUrl(gridState: GridState): string {
  try {
    const binaryData = encodeToBinary(gridState)
    return bytesToUrlSafe(binaryData)
  } catch (error) {
    console.error('Failed to encode grid state:', error)
    throw new Error('Failed to encode grid state for sharing')
  }
}

export function decodeGridStateFromUrl(encodedState: string): GridState | null {
  try {
    const bytes = urlSafeToBytes(encodedState)
    // A valid encoding always carries at least one header byte; zero decoded
    // bytes means the input is not shared state (e.g. a truncated link)
    if (!bytes || bytes.length === 0) {
      console.warn('Failed to decode binary data from URL')
      return null
    }
    return decodeFromBinary(bytes)
  } catch (error) {
    console.warn('Failed to decode grid state from URL:', error)
    return null
  }
}

/* Generate shareable URL with compressed grid state */
export function generateShareableUrl(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: DisplayFlags,
  baseTileState?: (hexId: number, state: number) => number,
): string {
  const gridState = serializeGridState(
    allTiles,
    allyArtifact,
    enemyArtifact,
    displayFlags,
    baseTileState,
  )

  const encodedState = encodeGridStateToUrl(gridState)

  // Generate full URL with query parameter format
  const baseUrl = `${window.location.origin}${window.location.pathname}`
  return `${baseUrl}?g=${encodedState}`
}

/* Multi-board (5 v 5) state is encoded as url-safe base64 of JSON: five boards
 * plus active id and global flags are too varied for the single-board binary
 * packing, and there is no back-compat constraint to keep it binary. */
export function encodeMultiGridStateToUrl(state: MultiGridState): string {
  return bytesToUrlSafe(new TextEncoder().encode(JSON.stringify(state)))
}

export function decodeMultiGridStateFromUrl(encoded: string): MultiGridState | null {
  try {
    const bytes = urlSafeToBytes(encoded)
    if (!bytes || bytes.length === 0) return null
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as MultiGridState
    return Array.isArray(parsed.boards) ? parsed : null
  } catch (error) {
    console.warn('Failed to decode multi-grid state from URL:', error)
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
