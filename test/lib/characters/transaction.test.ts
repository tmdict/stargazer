import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  executeTransaction,
  handleCacheInvalidation,
} from '../../../src/lib/characters/transaction'
import { Grid } from '../../../src/lib/grid'
import * as pathfinding from '../../../src/lib/pathfinding'
import type { SkillManager } from '../../../src/lib/skills/skill'

// Mock the pathfinding module
vi.mock('../../../src/lib/pathfinding', () => ({
  clearPathfindingCache: vi.fn(),
}))

describe('transaction.ts', () => {
  let grid: Grid
  let mockSkillManager: SkillManager

  beforeEach(() => {
    grid = new Grid()

    // Reset mock
    vi.clearAllMocks()

    // Create mock skill manager
    mockSkillManager = {
      updateActiveSkills: vi.fn(),
    } as unknown as SkillManager
  })

  describe('executeTransaction', () => {
    describe('successful transactions', () => {
      it('should execute all operations when all succeed', () => {
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => true)
        const op3 = vi.fn(() => true)

        const result = executeTransaction([op1, op2, op3])

        expect(result).toBe(true)
        expect(op1).toHaveBeenCalledTimes(1)
        expect(op2).toHaveBeenCalledTimes(1)
        expect(op3).toHaveBeenCalledTimes(1)
      })

      it('should clear cache once after successful transaction', () => {
        const operations = [
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return true
          },
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return true
          },
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return true
          },
        ]

        executeTransaction(operations)

        // Cache should be cleared exactly once after all operations
        expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
      })

      it('should handle empty operations array', () => {
        const result = executeTransaction([])
        expect(result).toBe(true)
        expect(pathfinding.clearPathfindingCache).not.toHaveBeenCalled()
      })

      it('should skip undefined operations', () => {
        const op1 = vi.fn(() => true)
        const op2 = undefined as any
        const op3 = vi.fn(() => true)

        const result = executeTransaction([op1, op2, op3])

        expect(result).toBe(true)
        expect(op1).toHaveBeenCalledTimes(1)
        expect(op3).toHaveBeenCalledTimes(1)
      })
    })

    describe('failed transactions', () => {
      it('should stop on first failure', () => {
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => false)
        const op3 = vi.fn(() => true)

        const result = executeTransaction([op1, op2, op3])

        expect(result).toBe(false)
        expect(op1).toHaveBeenCalledTimes(1)
        expect(op2).toHaveBeenCalledTimes(1)
        expect(op3).not.toHaveBeenCalled() // Should not execute after failure
      })

      it('should execute all rollback operations on failure', () => {
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => false)

        const rollback1 = vi.fn()
        const rollback2 = vi.fn()
        const rollback3 = vi.fn()

        const result = executeTransaction([op1, op2], [rollback1, rollback2, rollback3])

        expect(result).toBe(false)
        expect(rollback1).toHaveBeenCalledTimes(1)
        expect(rollback2).toHaveBeenCalledTimes(1)
        expect(rollback3).toHaveBeenCalledTimes(1)
      })

      it('should clear cache once after rollback', () => {
        const operations = [
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return true
          },
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return false
          }, // Fails
        ]

        const rollbacks = [
          () => {
            handleCacheInvalidation(false, undefined, grid)
          },
        ]

        executeTransaction(operations, rollbacks)

        // Cache should be cleared once after rollback
        expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
      })

      it('should handle failure on first operation', () => {
        const op1 = vi.fn(() => false)
        const op2 = vi.fn(() => true)
        const rollback = vi.fn()

        const result = executeTransaction([op1, op2], [rollback])

        expect(result).toBe(false)
        expect(op1).toHaveBeenCalledTimes(1)
        expect(op2).not.toHaveBeenCalled()
        expect(rollback).toHaveBeenCalledTimes(1)
      })

      it('should handle empty rollback array', () => {
        const op = vi.fn(() => false)

        const result = executeTransaction([op])

        expect(result).toBe(false)
        // Should not throw even without rollback operations
      })

      it('should not clear cache if no operations attempted', () => {
        const operations = [
          () => false, // Fails immediately
        ]

        executeTransaction(operations)

        // No cache invalidation was triggered, so no clear
        expect(pathfinding.clearPathfindingCache).not.toHaveBeenCalled()
      })
    })

    describe('complex transaction scenarios', () => {
      it('should handle mixed success and failure correctly', () => {
        let counter = 0

        const increment = () => {
          counter++
          return true
        }
        const decrement = () => {
          counter--
          return true
        }
        const fail = () => false

        const operations = [increment, increment, fail, increment]
        const rollbacks = [decrement, decrement]

        const result = executeTransaction(operations, rollbacks)

        expect(result).toBe(false)
        expect(counter).toBe(0) // 2 increments, then 2 decrements
      })

      it('should maintain transaction atomicity', () => {
        const state = { value: 0 }

        const operations = [
          () => {
            state.value = 10
            return true
          },
          () => {
            state.value = 20
            return true
          },
          () => {
            state.value = 30
            return false
          }, // Fail here
        ]

        const rollbacks = [
          () => {
            state.value = 0
          }, // Reset state
        ]

        executeTransaction(operations, rollbacks)

        expect(state.value).toBe(0) // State should be rolled back
      })

      it('should handle nested cache invalidations correctly', () => {
        let innerCalled = false

        const operations = [
          () => {
            handleCacheInvalidation(false, undefined, grid)
            return true
          },
          () => {
            // Nested transaction simulation
            const innerResult = executeTransaction([
              () => {
                innerCalled = true
                handleCacheInvalidation(false, undefined, grid)
                return true
              },
            ])
            return innerResult
          },
        ]

        executeTransaction(operations)

        expect(innerCalled).toBe(true)
        // Cache should still only be cleared twice total (once for inner, once for outer)
        expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('handleCacheInvalidation', () => {
    it('should skip cache invalidation when skipCache is true', () => {
      handleCacheInvalidation(true, mockSkillManager, grid)

      expect(pathfinding.clearPathfindingCache).not.toHaveBeenCalled()
      expect(mockSkillManager.updateActiveSkills).not.toHaveBeenCalled()
    })

    it('should clear cache and update skills immediately when not batching', () => {
      handleCacheInvalidation(false, mockSkillManager, grid)

      expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledTimes(1)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should not update skills when skillManager is undefined', () => {
      handleCacheInvalidation(false, undefined, grid)

      expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
      // No skill manager, so no update
    })

    it('should batch cache clears during transaction', () => {
      // Start a transaction
      const operations = [
        () => {
          handleCacheInvalidation(false, mockSkillManager, grid)
          return true
        },
        () => {
          handleCacheInvalidation(false, mockSkillManager, grid)
          return true
        },
        () => {
          handleCacheInvalidation(false, mockSkillManager, grid)
          return true
        },
      ]

      executeTransaction(operations)

      // Cache should only be cleared once after all operations
      expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)

      // Skill updates should not happen during batching
      expect(mockSkillManager.updateActiveSkills).not.toHaveBeenCalled()
    })

    it('should handle mixed skipCache values during transaction', () => {
      const operations = [
        () => {
          handleCacheInvalidation(true, mockSkillManager, grid) // Skipped
          return true
        },
        () => {
          handleCacheInvalidation(false, mockSkillManager, grid) // Should mark pending
          return true
        },
        () => {
          handleCacheInvalidation(true, mockSkillManager, grid) // Skipped
          return true
        },
      ]

      executeTransaction(operations)

      // Cache should still be cleared once because one operation needed it
      expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
    })

    it('should handle cache invalidation after transaction completes', () => {
      // Execute a transaction that invalidates cache
      executeTransaction([
        () => {
          handleCacheInvalidation(false, mockSkillManager, grid)
          return true
        },
      ])

      // Clear mocks
      vi.clearAllMocks()

      // Now call handleCacheInvalidation outside of transaction
      handleCacheInvalidation(false, mockSkillManager, grid)

      // Should work normally (immediate clear and skill update)
      expect(pathfinding.clearPathfindingCache).toHaveBeenCalledTimes(1)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle throwing operations gracefully', () => {
      const op1 = vi.fn(() => true)
      const op2 = vi.fn(() => {
        throw new Error('Operation error')
      })
      const rollback = vi.fn()

      // executeTransaction doesn't catch errors, it will throw
      expect(() => executeTransaction([op1, op2], [rollback])).toThrow('Operation error')

      // Since the error is not caught, rollback won't be called
      expect(rollback).toHaveBeenCalledTimes(0)
    })

    it('should handle throwing rollback operations', () => {
      const op = vi.fn(() => false)
      const rollback1 = vi.fn()
      const rollback2 = vi.fn(() => {
        throw new Error('Rollback error')
      })
      const rollback3 = vi.fn()

      expect(() => executeTransaction([op], [rollback1, rollback2, rollback3])).toThrow()

      // First rollback should have been called
      expect(rollback1).toHaveBeenCalledTimes(1)
      // Third might not be called due to error in second
    })

    it('should handle very large transaction sets', () => {
      const operations = Array.from(
        { length: 1000 },
        (_, i) => vi.fn(() => i !== 500), // Fail at operation 500
      )

      const rollbacks = Array.from({ length: 100 }, () => vi.fn())

      const result = executeTransaction(operations, rollbacks)

      expect(result).toBe(false)
      // Should have executed up to and including operation 500
      expect(operations[499]).toHaveBeenCalled()
      expect(operations[500]).toHaveBeenCalled()
      expect(operations[501]).not.toHaveBeenCalled()

      // All rollbacks should have been called
      rollbacks.forEach((rb) => expect(rb).toHaveBeenCalled())
    })

    it('should handle all operations returning false', () => {
      const operations = [vi.fn(() => false), vi.fn(() => false), vi.fn(() => false)]

      const result = executeTransaction(operations)

      expect(result).toBe(false)
      expect(operations[0]).toHaveBeenCalledTimes(1)
      expect(operations[1]).not.toHaveBeenCalled()
      expect(operations[2]).not.toHaveBeenCalled()
    })

    it('should handle all operations returning true', () => {
      const operations = Array.from({ length: 10 }, () => vi.fn(() => true))

      const result = executeTransaction(operations)

      expect(result).toBe(true)
      operations.forEach((op) => expect(op).toHaveBeenCalledTimes(1))
    })
  })
})
