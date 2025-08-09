import type { GridTile } from './grid'

/**
 * LRU (Least Recently Used) cache implementation for memoization.
 * Automatically evicts least recently used items when capacity is reached.
 * Used to cache expensive pathfinding and closest target calculations.
 */
export class MemoCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private accessOrder: K[] = []

  constructor(
    private maxSize: number = 100,
    private ttl: number = Infinity, // Time to live in milliseconds
  ) {}

  /**
   * Get value from cache, updating access order
   * Returns undefined if not found or expired
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (this.ttl !== Infinity && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return undefined
    }

    // Update access order
    this.updateAccessOrder(key)
    return entry.value
  }

  /**
   * Set value in cache, evicting LRU item if needed
   */
  set(key: K, value: V): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key)
    }

    // Evict LRU item if at capacity
    if (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lru = this.accessOrder[0]
      this.delete(lru)
    }

    // Add new entry
    this.cache.set(key, { value, timestamp: Date.now() })
    this.accessOrder.push(key)
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    if (this.ttl !== Infinity && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Remove entry from cache
   */
  delete(key: K): boolean {
    const deleted = this.cache.delete(key)
    if (deleted) {
      const index = this.accessOrder.indexOf(key)
      if (index !== -1) {
        this.accessOrder.splice(index, 1)
      }
    }
    return deleted
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder.length = 0
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  private updateAccessOrder(key: K): void {
    const index = this.accessOrder.indexOf(key)
    if (index !== -1) {
      this.accessOrder.splice(index, 1)
    }
    this.accessOrder.push(key)
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
