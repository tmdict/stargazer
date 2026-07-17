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
        expect(op3).not.toHaveBeenCalled()
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
    })

    describe('edge cases', () => {
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
    })
  })
})
