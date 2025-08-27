import type { Grid } from '../grid'
import { clearPathfindingCache } from '../pathfinding'
import type { SkillManager } from '../skill'

/**
 * Transaction utilities for atomic operations with rollback support
 */

// Cache invalidation batching support
let batchingCacheClears = false
let pendingCacheClears = false

/**
 * Execute a transaction with automatic rollback on failure.
 *
 * @param operations Array of operations that return boolean (true = success)
 * @param rollbackOperations Array of rollback operations to execute on failure
 * @returns true if all operations succeeded, false otherwise
 */
export function executeTransaction(
  operations: (() => boolean)[],
  rollbackOperations: (() => void)[] = [],
): boolean {
  // Start batching - no cache clears during transaction
  batchingCacheClears = true
  pendingCacheClears = false

  // Execute operations sequentially, stopping on first failure
  let failedAtIndex = -1
  for (let i = 0; i < operations.length; i++) {
    const op = operations[i]
    if (!op) continue // Skip undefined operations
    const result = op()
    if (!result) {
      failedAtIndex = i
      break
    }
  }

  // Check if any failed
  if (failedAtIndex >= 0) {
    // Rollback all operations
    rollbackOperations.forEach((rollback) => rollback())
    batchingCacheClears = false

    // Clear cache once after rollback (if any operations were attempted)
    if (pendingCacheClears) {
      clearPathfindingCache()
    }
    return false
  }

  // Success - stop batching
  batchingCacheClears = false

  // Clear cache ONCE after all operations complete successfully
  if (pendingCacheClears) {
    clearPathfindingCache()
  }

  return true
}

/**
 * Handle cache invalidation with batching support.
 * @param skipCache If true, skip cache invalidation entirely
 * @param skillManager Skill manager to trigger updates (only when not batching)
 * @param grid Grid instance for skill manager updates
 */
export function handleCacheInvalidation(
  skipCache: boolean,
  skillManager: SkillManager | undefined,
  grid: Grid,
): void {
  if (skipCache) return

  if (batchingCacheClears) {
    pendingCacheClears = true
  } else {
    clearPathfindingCache()
    // Trigger skill updates immediately when not batching
    if (skillManager) {
      skillManager.updateActiveSkills(grid)
    }
  }
}
