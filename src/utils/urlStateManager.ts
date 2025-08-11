import type { GridTile } from '../lib/grid'
import { encodeToBinary, decodeFromBinary, bytesToUrlSafe, urlSafeToBytes } from './binaryEncoder'
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
  displayFlags?: { showHexIds?: boolean; showArrows?: boolean; showPerspective?: boolean },
): string {
  // Serialize to compact format
  const gridState = serializeGridState(allTiles, allyArtifact, enemyArtifact, displayFlags)

  // Encode using binary compression
  const encodedState = encodeGridStateToUrl(gridState)

  // Generate full URL with query parameter format
  const baseUrl = `${window.location.origin}${window.location.pathname}`
  return `${baseUrl}?g=${encodedState}`
}

/* Get grid state from current URL */
export function getGridStateFromCurrentUrl(): GridState | null {
  const urlParams = new URLSearchParams(window.location.search)
  const queryState = urlParams.get('g')

  if (!queryState) {
    return null
  }

  return decodeGridStateFromUrl(queryState)
}

/* Update URL with current grid state (uses replaceState to avoid new history entries) */
export function updateUrlWithGridState(
  allTiles: GridTile[],
  allyArtifact: number | null,
  enemyArtifact: number | null,
  displayFlags?: { showHexIds?: boolean; showArrows?: boolean; showPerspective?: boolean },
): void {
  try {
    const shareableUrl = generateShareableUrl(allTiles, allyArtifact, enemyArtifact, displayFlags)

    // Update URL without triggering navigation
    window.history.replaceState({}, '', shareableUrl)
  } catch (error) {
    console.warn('Failed to update URL with grid state:', error)
  }
}
