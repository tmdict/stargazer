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

    const oldPriority = this.heap[index].priority
    this.heap[index].priority = newPriority

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

      if (this.heap[index].priority >= this.heap[parentIndex].priority) {
        break
      }

      // Swap with parent
      ;[this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]]
      index = parentIndex
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2
      let smallest = index

      if (
        leftChild < this.heap.length &&
        this.heap[leftChild].priority < this.heap[smallest].priority
      ) {
        smallest = leftChild
      }

      if (
        rightChild < this.heap.length &&
        this.heap[rightChild].priority < this.heap[smallest].priority
      ) {
        smallest = rightChild
      }

      if (smallest === index)
        break

        // Swap with smallest child
      ;[this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]]
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
