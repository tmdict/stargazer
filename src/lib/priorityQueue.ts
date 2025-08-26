/**
 * Min-heap based priority queue for efficient pathfinding.
 * Provides O(log n) insertion and extraction vs O(n) linear search.
 * Critical optimization for A* pathfinding performance on large grids.
 */
export class PriorityQueue<T> {
  private heap: Array<{ item: T; priority: number }> = []

  get size(): number {
    return this.heap.length
  }

  isEmpty(): boolean {
    return this.heap.length === 0
  }

  /**
   * Add item with priority (lower priority = higher precedence)
   * Time complexity: O(log n)
   */
  enqueue(item: T, priority: number): void {
    this.heap.push({ item, priority })
    this.bubbleUp(this.heap.length - 1)
  }

  /**
   * Remove and return item with lowest priority
   * Time complexity: O(log n)
   */
  dequeue(): T | undefined {
    if (this.isEmpty()) return undefined

    const min = this.heap[0]
    const last = this.heap.pop()

    if (this.heap.length > 0 && last) {
      this.heap[0] = last
      this.bubbleDown(0)
    }

    if (!min) {
      console.error('priorityQueue: Attempting to dequeue from empty queue')
      throw new Error('Cannot dequeue from empty queue')
    }
    return min.item
  }

  /**
   * Update priority of existing item or add if not exists
   * Time complexity: O(n) for search + O(log n) for update
   */
  updatePriority(item: T, newPriority: number, equals: (a: T, b: T) => boolean): void {
    const index = this.heap.findIndex((node) => equals(node.item, item))

    if (index === -1) {
      // Item not found, add it
      this.enqueue(item, newPriority)
      return
    }

    const heapItem = this.heap[index]
    if (!heapItem) {
      console.warn('priorityQueue: Heap item at index is undefined in updatePriority', {
        index,
        heapLength: this.heap.length,
      })
      return
    }

    const oldPriority = heapItem.priority
    heapItem.priority = newPriority

    // Restore heap property
    if (newPriority < oldPriority) {
      this.bubbleUp(index)
    } else if (newPriority > oldPriority) {
      this.bubbleDown(index)
    }
  }

  /**
   * Check if item exists in queue
   * Time complexity: O(n)
   */
  contains(item: T, equals: (a: T, b: T) => boolean): boolean {
    return this.heap.some((node) => equals(node.item, item))
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)

      const current = this.heap[index]
      const parent = this.heap[parentIndex]
      if (!current || !parent) {
        console.warn('priorityQueue: Undefined heap elements in bubbleUp', {
          index,
          parentIndex,
          heapLength: this.heap.length,
        })
        break
      }

      if (current.priority >= parent.priority) {
        break
      }

      // Swap with parent
      const temp = this.heap[index]
      if (!temp) {
        console.warn('priorityQueue: Temp element undefined during swap in bubbleUp', {
          index,
          heapLength: this.heap.length,
        })
        break
      }
      this.heap[index] = parent
      this.heap[parentIndex] = temp
      index = parentIndex
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2
      let smallest = index

      const current = this.heap[index]
      const leftItem = this.heap[leftChild]
      const rightItem = this.heap[rightChild]
      const smallestItem = this.heap[smallest]

      if (!current || !smallestItem) {
        console.warn('priorityQueue: Undefined heap elements in bubbleDown', {
          index,
          smallest,
          heapLength: this.heap.length,
        })
        break
      }

      if (leftChild < this.heap.length && leftItem && leftItem.priority < smallestItem.priority) {
        smallest = leftChild
      }

      if (
        rightChild < this.heap.length &&
        rightItem &&
        rightItem.priority < this.heap[smallest]!.priority
      ) {
        smallest = rightChild
      }

      if (smallest === index) break

      // Swap with smallest child
      const temp = this.heap[index]
      const smallestChild = this.heap[smallest]
      if (!temp || !smallestChild) {
        console.warn('priorityQueue: Elements undefined during swap in bubbleDown', {
          index,
          smallest,
          heapLength: this.heap.length,
        })
        break
      }
      this.heap[index] = smallestChild
      this.heap[smallest] = temp
      index = smallest
    }
  }

  /**
   * Clear all items from the queue
   */
  clear(): void {
    this.heap.length = 0
  }
}
