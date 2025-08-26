import type { GridTile } from '../lib/grid'
import { bytesToUrlSafe, decodeFromBinary, encodeToBinary, urlSafeToBytes } from './binaryEncoder'
import { serializeGridState, type GridState } from './gridStateSerializer'

/* Encode grid state to compressed URL-safe string using binary encoding */
export function encodeGridStateToUrl(gridState: GridState): string {
  try {
    const binaryData = encodeToBinary(gridState)
    return bytesToUrlSafe(binaryData)
  } catch (error) {
    console.error('Failed to encode grid state:', error)
    throw new Error('Failed to encode grid state for sharing')
  }
}

/* Decode compressed URL string back to grid state using binary decoding */
export function decodeGridStateFromUrl(encodedState: string): GridState | null {
  try {
    const bytes = urlSafeToBytes(encodedState)
    if (!bytes) {
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
  displayFlags?: {
    showHexIds?: boolean
    showArrows?: boolean
    showPerspective?: boolean
    showSkills?: boolean
  },
): string {
  // Serialize to compact format
  const gridState = serializeGridState(allTiles, allyArtifact, enemyArtifact, displayFlags)

  // Encode using binary compression
  const encodedState = encodeGridStateToUrl(gridState)

  // Generate full URL with query parameter format
  const baseUrl = `${window.location.origin}${window.location.pathname}`
  return `${baseUrl}?g=${encodedState}`
}

/* Get encoded state from current URL */
export function getEncodedStateFromUrl(): string | null {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('g')
}

/* Get encoded state from Vue Router query object */
export function getEncodedStateFromRoute(query: { g?: string | string[] | null }): string | null {
  return typeof query.g === 'string' ? query.g : null
}

/* Update URL with current grid state (uses replaceState to avoid new history entries) */
export function updateUrlWithGridState(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: {
    showHexIds?: boolean
    showArrows?: boolean
    showPerspective?: boolean
    showSkills?: boolean
  },
): void {
  try {
    const shareableUrl = generateShareableUrl(allTiles, allyArtifact, enemyArtifact, displayFlags)

    // Update URL without triggering navigation
    window.history.replaceState({}, '', shareableUrl)
  } catch (error) {
    console.warn('Failed to update URL with grid state:', error)
  }
}
