import { describe, expect, it, vi } from 'vitest'

import { executeTransaction } from '@/lib/characters/transaction'

describe('transaction.ts', () => {
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

      it('should handle empty operations array', () => {
        const result = executeTransaction([])
        expect(result).toBe(true)
      })

      it('should skip undefined operations', () => {
        const op1 = vi.fn(() => true)
        const op2 = undefined as unknown as () => boolean
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

      it('should support nested transactions', () => {
        let innerCalled = false

        const operations = [
          () => true,
          () => {
            // Nested transaction
            const innerResult = executeTransaction([
              () => {
                innerCalled = true
                return true
              },
            ])
            return innerResult
          },
        ]

        const result = executeTransaction(operations)

        expect(result).toBe(true)
        expect(innerCalled).toBe(true)
      })
    })

    describe('Edge cases', () => {
      it('should treat a throwing operation as a failure and roll back', () => {
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => {
          throw new Error('Operation error')
        })
        const rollback = vi.fn()
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const result = executeTransaction([op1, op2], [rollback])

        // The throw is caught and treated as a failure (not propagated).
        expect(result).toBe(false)
        // Rollbacks must run when an operation fails — including via throw.
        expect(rollback).toHaveBeenCalledTimes(1)
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should continue rolling back even if a rollback throws', () => {
        const op = vi.fn(() => false)
        const rollback1 = vi.fn()
        const rollback2 = vi.fn(() => {
          throw new Error('Rollback error')
        })
        const rollback3 = vi.fn()
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        // Does not throw, returns false.
        expect(executeTransaction([op], [rollback1, rollback2, rollback3])).toBe(false)

        // All three must be invoked despite rollback2 throwing.
        expect(rollback1).toHaveBeenCalledTimes(1)
        expect(rollback2).toHaveBeenCalledTimes(1)
        expect(rollback3).toHaveBeenCalledTimes(1)
        expect(consoleSpy).toHaveBeenCalled()

        consoleSpy.mockRestore()
      })

      it('should run rollbacks in LIFO order', () => {
        // Standard transaction semantics: undo the most recent operation first
        // so its dependencies (earlier operations) are still in the applied state.
        const calls: number[] = []
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => false) // Fails, triggering rollback.
        const rollback1 = vi.fn(() => calls.push(1))
        const rollback2 = vi.fn(() => calls.push(2))
        const rollback3 = vi.fn(() => calls.push(3))

        executeTransaction([op1, op2], [rollback1, rollback2, rollback3])

        expect(calls).toEqual([3, 2, 1])
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
})
