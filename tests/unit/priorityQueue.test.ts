import { beforeEach, describe, expect, it } from 'vitest'

import { PriorityQueue } from '@/lib/priorityQueue'

describe('PriorityQueue', () => {
  let queue: PriorityQueue<string | number>

  beforeEach(() => {
    queue = new PriorityQueue<string | number>()
  })

  it('maintains min-heap property with many items', () => {
    const items = [10, 5, 20, 1, 15, 30, 25, 8, 12, 3]
    items.forEach((item) => queue.enqueue(item, item))

    const sorted = []
    while (!queue.isEmpty()) {
      sorted.push(queue.dequeue())
    }

    expect(sorted).toEqual([1, 3, 5, 8, 10, 12, 15, 20, 25, 30])
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
  })
})
