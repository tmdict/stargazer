import { beforeEach, describe, expect, it } from 'vitest'

import { PriorityQueue } from '@/lib/priorityQueue'

describe('PriorityQueue', () => {
  let queue: PriorityQueue<string | number>

  beforeEach(() => {
    queue = new PriorityQueue<string | number>()
  })

  describe('basic operations', () => {
    it('starts empty', () => {
      expect(queue.isEmpty()).toBe(true)
      expect(queue.size).toBe(0)
    })

    it('enqueues and dequeues single item', () => {
      queue.enqueue(42, 1)

      expect(queue.isEmpty()).toBe(false)
      expect(queue.size).toBe(1)

      const item = queue.dequeue()
      expect(item).toBe(42)
      expect(queue.isEmpty()).toBe(true)
    })

    it('handles items with same priority', () => {
      queue.enqueue('a', 1)
      queue.enqueue('b', 1)
      queue.enqueue('c', 1)

      const results = []
      results.push(queue.dequeue())
      results.push(queue.dequeue())
      results.push(queue.dequeue())

      // All should be dequeued (order among same priority not guaranteed)
      expect(results).toContain('a')
      expect(results).toContain('b')
      expect(results).toContain('c')
    })

    it('returns undefined when dequeuing empty queue', () => {
      expect(queue.dequeue()).toBeUndefined()
    })
  })

  describe('heap property maintenance', () => {
    it('maintains min-heap property with many items', () => {
      const items = [10, 5, 20, 1, 15, 30, 25, 8, 12, 3]
      items.forEach((item) => queue.enqueue(item, item))

      const sorted = []
      while (!queue.isEmpty()) {
        sorted.push(queue.dequeue())
      }

      expect(sorted).toEqual([1, 3, 5, 8, 10, 12, 15, 20, 25, 30])
    })

    it('handles negative priorities', () => {
      queue.enqueue('negative', -5)
      queue.enqueue('zero', 0)
      queue.enqueue('positive', 5)

      expect(queue.dequeue()).toBe('negative')
      expect(queue.dequeue()).toBe('zero')
      expect(queue.dequeue()).toBe('positive')
    })

    it('handles fractional priorities', () => {
      queue.enqueue('half', 0.5)
      queue.enqueue('one', 1)
      queue.enqueue('quarter', 0.25)

      expect(queue.dequeue()).toBe('quarter')
      expect(queue.dequeue()).toBe('half')
      expect(queue.dequeue()).toBe('one')
    })
  })

  describe('updatePriority', () => {
    it('updates existing item to lower priority', () => {
      queue.enqueue('a', 5)
      queue.enqueue('b', 3)
      queue.enqueue('c', 7)

      queue.updatePriority('c', 1, (a, b) => a === b)

      expect(queue.dequeue()).toBe('c')
      expect(queue.dequeue()).toBe('b')
      expect(queue.dequeue()).toBe('a')
    })

    it('updates existing item to higher priority', () => {
      queue.enqueue('a', 1)
      queue.enqueue('b', 3)
      queue.enqueue('c', 5)

      queue.updatePriority('a', 10, (a, b) => a === b)

      expect(queue.dequeue()).toBe('b')
      expect(queue.dequeue()).toBe('c')
      expect(queue.dequeue()).toBe('a')
    })

    it('adds item if not exists', () => {
      queue.enqueue('a', 5)

      queue.updatePriority('b', 3, (a, b) => a === b)

      expect(queue.size).toBe(2)
      expect(queue.dequeue()).toBe('b')
      expect(queue.dequeue()).toBe('a')
    })

    it('handles complex objects with custom equality', () => {
      interface Item {
        id: number
        value: string
      }

      const q = new PriorityQueue<Item>()
      const item1 = { id: 1, value: 'first' }
      const item2 = { id: 2, value: 'second' }

      q.enqueue(item1, 5)
      q.enqueue(item2, 3)

      // Update by ID
      q.updatePriority({ id: 2, value: 'updated' }, 1, (a, b) => a.id === b.id)

      const first = q.dequeue()
      expect(first?.id).toBe(2)
    })
  })

  describe('clear', () => {
    it('removes all items', () => {
      queue.enqueue(1, 1)
      queue.enqueue(2, 2)
      queue.enqueue(3, 3)

      expect(queue.size).toBe(3)

      queue.clear()

      expect(queue.size).toBe(0)
      expect(queue.isEmpty()).toBe(true)
      expect(queue.dequeue()).toBeUndefined()
    })
  })

  describe('stress', () => {
    it('dequeues a large randomized set in priority order', () => {
      // Item value === its priority, so heap order is directly observable
      const count = 1000
      for (let i = 0; i < count; i++) {
        const priority = Math.random() * 1000
        queue.enqueue(priority, priority)
      }

      expect(queue.size).toBe(count)

      let previous = -Infinity
      while (!queue.isEmpty()) {
        const item = queue.dequeue() as number
        expect(item).toBeGreaterThanOrEqual(previous)
        previous = item
      }
    })
  })
})
