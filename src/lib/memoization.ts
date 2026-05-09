import type { GridTile } from './grid'

/**
 * LRU (Least Recently Used) cache for memoization.
 *
 * Relies on JS Map preserving insertion order: re-inserting a key on access
 * moves it to the end (most-recently-used), and the first key in iteration
 * order is always the LRU candidate for eviction. All ops are O(1).
 */
export class MemoCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()

  constructor(
    private maxSize: number = 100,
    private ttl: number = Infinity,
  ) {}

  private isExpired(timestamp: number): boolean {
    return this.ttl !== Infinity && Date.now() - timestamp > this.ttl
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (this.isExpired(entry.timestamp)) {
      this.cache.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.value
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      // Evict the oldest key (first in iteration order)
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    this.cache.set(key, { value, timestamp: Date.now() })
  }

  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (this.isExpired(entry.timestamp)) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  delete(key: K): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}

/**
 * Generate cache key for grid state based on character positions.
 * Used for caching closest enemy/ally calculations.
 * Key includes character ID, position, team, and range for accurate memoization.
 */
export function generateGridCacheKey(
  tiles: GridTile[],
  characterRanges: Map<number, number>,
): string {
  // Sort tiles by hex ID for consistent key generation
  const sortedTiles = [...tiles].sort((a, b) => a.hex.getId() - b.hex.getId())

  // Build key from character positions and ranges
  const parts: string[] = []
  for (const tile of sortedTiles) {
    if (tile.characterId && tile.team !== undefined) {
      const range = characterRanges.get(tile.characterId) ?? 1
      parts.push(`${tile.hex.getId()}:${tile.characterId}:${tile.team}:${range}`)
    }
  }

  return parts.join('|')
}

/**
 * Generate cache key for pathfinding results
 * Includes start, goal, and range for effective distance calculations
 */
export function generatePathCacheKey(
  startHexId: number,
  goalHexId: number,
  range: number = 0,
): string {
  return `${startHexId}-${goalHexId}-${range}`
}
