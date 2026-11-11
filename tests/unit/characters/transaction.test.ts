import { describe, expect, it, vi } from 'vitest'

import { executeTransaction } from '@/lib/characters/transaction'

describe('transaction.ts', () => {
  describe('executeTransaction', () => {
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
    })

    describe('edge cases', () => {
      it('should treat a throwing operation as a failure and roll back', () => {
        const op1 = vi.fn(() => true)
        const op2 = vi.fn(() => {
          throw new Error('Operation error')
        })
        const rollback = vi.fn()

        const result = executeTransaction([op1, op2], [rollback])

        expect(result).toBe(false)
        expect(rollback).toHaveBeenCalledTimes(1)
      })
    })
  })
})
