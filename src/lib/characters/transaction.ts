import type { Grid } from '../grid'
import { clearPathfindingCache } from '../pathfinding'
import type { SkillManager } from '../skills/skill'

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

  // Execute operations sequentially, stopping on first failure (returned false OR thrown).
  let failedAtIndex = -1
  try {
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i]
      if (!op) continue // Skip undefined operations
      try {
        if (!op()) {
          failedAtIndex = i
          break
        }
      } catch (error) {
        console.error(`Transaction operation ${i} threw:`, error)
        failedAtIndex = i
        break
      }
    }

    if (failedAtIndex >= 0) {
      // Rollback in LIFO order: undo the most recent operation first so its dependencies
      // (earlier operations) are still in their applied state when their rollback runs.
      // Each rollback is isolated so a thrower can't halt the chain.
      for (let i = rollbackOperations.length - 1; i >= 0; i--) {
        try {
          rollbackOperations[i]?.()
        } catch (error) {
          console.error(`Transaction rollback ${i} threw:`, error)
          // Continue with remaining rollbacks
        }
      }
      return false
    }

    return true
  } finally {
    // Always reset the batching flag, even if a rollback threw, so subsequent
    // transactions don't inherit a stuck batching state.
    batchingCacheClears = false

    // Clear cache once after all operations (success or rollback) complete.
    if (pendingCacheClears) {
      clearPathfindingCache()
    }
  }
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
