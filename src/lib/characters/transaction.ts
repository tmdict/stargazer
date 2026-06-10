/**
 * Transaction utilities for atomic operations with rollback support
 */

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
  // Execute operations sequentially, stopping on first failure (returned false OR thrown).
  let failedAtIndex = -1
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
}
