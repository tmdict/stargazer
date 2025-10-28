import { beforeEach, describe, expect, it } from 'vitest'

import { type GridTile } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { generateGridCacheKey, generatePathCacheKey, MemoCache } from '@/lib/memoization'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Helper to create mock tiles
function createMockTile(hexId: number, characterId?: number, team?: Team): GridTile {
  return {
    hex: { getId: () => hexId } as Hex,
    state: State.DEFAULT,
    characterId,
    team,
  }
}

describe('MemoCache', () => {
  let cache: MemoCache<string, number>

  beforeEach(() => {
    cache = new MemoCache<string, number>()
  })

  describe('basic operations', () => {
    it('stores and retrieves values', () => {
      cache.set('key1', 42)
      expect(cache.get('key1')).toBe(42)
    })

    it('returns undefined for missing keys', () => {
      expect(cache.get('missing')).toBeUndefined()
    })

    it('checks if key exists', () => {
      cache.set('key1', 42)
      expect(cache.has('key1')).toBe(true)
      expect(cache.has('missing')).toBe(false)
    })

    it('deletes keys', () => {
      cache.set('key1', 42)
      expect(cache.delete('key1')).toBe(true)
      expect(cache.has('key1')).toBe(false)
      expect(cache.delete('missing')).toBe(false)
    })

    it('clears all entries', () => {
      cache.set('key1', 1)
      cache.set('key2', 2)
      cache.set('key3', 3)

      expect(cache.size).toBe(3)

      cache.clear()

      expect(cache.size).toBe(0)
      expect(cache.has('key1')).toBe(false)
      expect(cache.has('key2')).toBe(false)
      expect(cache.has('key3')).toBe(false)
    })
  })

  describe('LRU eviction', () => {
    it('evicts least recently used item when capacity reached', () => {
      const smallCache = new MemoCache<string, number>(3)

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3)

      // Cache is now full
      expect(smallCache.size).toBe(3)

      // Adding new item should evict 'a' (least recently used)
      smallCache.set('d', 4)

      expect(smallCache.size).toBe(3)
      expect(smallCache.has('a')).toBe(false)
      expect(smallCache.has('b')).toBe(true)
      expect(smallCache.has('c')).toBe(true)
      expect(smallCache.has('d')).toBe(true)
    })

    it('updates access order on get', () => {
      const smallCache = new MemoCache<string, number>(3)

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3)

      // Access 'a' to make it recently used
      smallCache.get('a')

      // Now 'b' is least recently used
      smallCache.set('d', 4)

      expect(smallCache.has('a')).toBe(true) // Still there
      expect(smallCache.has('b')).toBe(false) // Evicted
      expect(smallCache.has('c')).toBe(true)
      expect(smallCache.has('d')).toBe(true)
    })

    it('handles re-setting existing keys', () => {
      const smallCache = new MemoCache<string, number>(3)

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3)

      // Re-set 'a' with new value
      smallCache.set('a', 10)

      expect(smallCache.size).toBe(3)
      expect(smallCache.get('a')).toBe(10)

      // 'b' should be LRU now
      smallCache.set('d', 4)

      expect(smallCache.has('a')).toBe(true)
      expect(smallCache.has('b')).toBe(false) // Evicted
    })
  })

  describe('TTL (Time To Live)', () => {
    it('expires entries after TTL', async () => {
      const ttlCache = new MemoCache<string, number>(100, 100) // 100ms TTL

      ttlCache.set('key1', 42)
      expect(ttlCache.get('key1')).toBe(42)

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150))

      expect(ttlCache.get('key1')).toBeUndefined()
      expect(ttlCache.has('key1')).toBe(false)
    })

    it('does not expire entries before TTL', async () => {
      const ttlCache = new MemoCache<string, number>(100, 200) // 200ms TTL

      ttlCache.set('key1', 42)

      // Wait less than TTL
      await new Promise((resolve) => setTimeout(resolve, 50))

      expect(ttlCache.get('key1')).toBe(42)
      expect(ttlCache.has('key1')).toBe(true)
    })

    it('handles Infinity TTL (no expiration)', () => {
      const cache = new MemoCache<string, number>(100, Infinity)

      cache.set('key1', 42)

      // Even after delay, should still be there
      setTimeout(() => {
        expect(cache.get('key1')).toBe(42)
      }, 100)
    })
  })

  describe('edge cases', () => {
    it('handles cache size of 1', () => {
      const tinyCache = new MemoCache<string, number>(1)

      tinyCache.set('a', 1)
      expect(tinyCache.get('a')).toBe(1)

      tinyCache.set('b', 2)
      expect(tinyCache.get('a')).toBeUndefined()
      expect(tinyCache.get('b')).toBe(2)
    })

    it('handles many items with eviction', () => {
      const smallCache = new MemoCache<string, number>(10)

      // Add 20 items
      for (let i = 0; i < 20; i++) {
        smallCache.set(`key${i}`, i)
      }

      // Only last 10 should remain
      expect(smallCache.size).toBe(10)

      // First 10 should be evicted
      for (let i = 0; i < 10; i++) {
        expect(smallCache.has(`key${i}`)).toBe(false)
      }

      // Last 10 should be present
      for (let i = 10; i < 20; i++) {
        expect(smallCache.has(`key${i}`)).toBe(true)
      }
    })
  })
})

describe('Cache key generation', () => {
  describe('generateGridCacheKey', () => {
    it('generates consistent keys for same grid state', () => {
      const tiles = [createMockTile(1, 100, Team.ALLY), createMockTile(2, 200, Team.ENEMY)]
      const ranges = new Map([
        [100, 1],
        [200, 2],
      ])

      const key1 = generateGridCacheKey(tiles, ranges)
      const key2 = generateGridCacheKey(tiles, ranges)

      expect(key1).toBe(key2)
    })

    it('generates different keys for different states', () => {
      const tiles1 = [createMockTile(1, 100, Team.ALLY)]
      const tiles2 = [createMockTile(1, 100, Team.ENEMY)]
      const ranges = new Map([[100, 1]])

      const key1 = generateGridCacheKey(tiles1, ranges)
      const key2 = generateGridCacheKey(tiles2, ranges)

      expect(key1).not.toBe(key2)
    })

    it('handles tiles without characters', () => {
      const tiles = [createMockTile(1), createMockTile(2, 100, Team.ALLY), createMockTile(3)]
      const ranges = new Map([[100, 1]])

      const key = generateGridCacheKey(tiles, ranges)

      // Should only include tile with character
      expect(key).toContain('2:100:')
      // Key should include the character ID
      expect(key).toContain('100')
    })

    it('sorts tiles by hex ID for consistency', () => {
      const tiles1 = [
        createMockTile(3, 300, Team.ALLY),
        createMockTile(1, 100, Team.ALLY),
        createMockTile(2, 200, Team.ALLY),
      ]

      const tiles2 = [
        createMockTile(1, 100, Team.ALLY),
        createMockTile(2, 200, Team.ALLY),
        createMockTile(3, 300, Team.ALLY),
      ]

      const ranges = new Map()

      const key1 = generateGridCacheKey(tiles1, ranges)
      const key2 = generateGridCacheKey(tiles2, ranges)

      expect(key1).toBe(key2)
    })

    it('includes character ranges in key', () => {
      const tiles = [createMockTile(1, 100, Team.ALLY)]

      const ranges1 = new Map([[100, 1]])
      const ranges2 = new Map([[100, 3]])

      const key1 = generateGridCacheKey(tiles, ranges1)
      const key2 = generateGridCacheKey(tiles, ranges2)

      expect(key1).not.toBe(key2)
      expect(key1).toContain(':1')
      expect(key2).toContain(':3')
    })
  })

  describe('generatePathCacheKey', () => {
    it('generates key from hex IDs and range', () => {
      const key = generatePathCacheKey(1, 2, 3)
      expect(key).toBe('1-2-3')
    })

    it('generates key without range', () => {
      const key = generatePathCacheKey(5, 10)
      expect(key).toBe('5-10-0')
    })

    it('generates different keys for different inputs', () => {
      const key1 = generatePathCacheKey(1, 2, 3)
      const key2 = generatePathCacheKey(2, 1, 3)
      const key3 = generatePathCacheKey(1, 2, 4)

      expect(key1).not.toBe(key2)
      expect(key1).not.toBe(key3)
      expect(key2).not.toBe(key3)
    })
  })
})
