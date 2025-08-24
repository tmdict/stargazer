import type { GridTile } from './grid'
import { Hex } from './hex'
import { generateGridCacheKey, generatePathCacheKey, MemoCache } from './memoization'
import { PriorityQueue } from './priorityQueue'
import { areHexesInSameDiagonalRow } from './types/grid'
import { State } from './types/state'
import { Team } from './types/team'

// A* Algorithm Types
interface AStarNode {
  hex: Hex
  gCost: number // Actual cost from start to this node
  hCost: number // Heuristic cost estimate to goal
  fCost: number // Total cost (gCost + hCost)
  parent: AStarNode | null
}

interface DistanceResult {
  movementDistance: number
  canReach: boolean
  directDistance: number
}

interface RangedDistanceResult {
  movementDistance: number
  canReach: boolean
  reachableTargets: Hex[]
}

interface TargetResult {
  hexId: number
  distance: number
}

interface TargetInfo {
  enemyHexId?: number
  allyHexId?: number
  distance: number
}

/*
 * Caching System
 */

/*
 * Cache management for pathfinding operations.
 */
export class PathfindingCache {
  private pathCache = new MemoCache<string, Hex[] | null>(500)
  private effectiveDistanceCache = new MemoCache<string, DistanceResult>(500)
  private closestEnemyCache = new MemoCache<string, Map<number, TargetInfo>>(100)
  private closestAllyCache = new MemoCache<string, Map<number, TargetInfo>>(100)

  // Path cache operations
  getPath(key: string): Hex[] | null | undefined {
    return this.pathCache.get(key)
  }

  setPath(key: string, value: Hex[] | null): void {
    this.pathCache.set(key, value)
  }

  // Effective distance cache operations
  getEffectiveDistance(key: string): DistanceResult | undefined {
    return this.effectiveDistanceCache.get(key)
  }

  setEffectiveDistance(key: string, value: DistanceResult): void {
    this.effectiveDistanceCache.set(key, value)
  }

  // Closest enemy cache operations
  getClosestEnemyMap(key: string): Map<number, TargetInfo> | undefined {
    return this.closestEnemyCache.get(key)
  }

  setClosestEnemyMap(key: string, value: Map<number, TargetInfo>): void {
    this.closestEnemyCache.set(key, value)
  }

  // Closest ally cache operations
  getClosestAllyMap(key: string): Map<number, TargetInfo> | undefined {
    return this.closestAllyCache.get(key)
  }

  setClosestAllyMap(key: string, value: Map<number, TargetInfo>): void {
    this.closestAllyCache.set(key, value)
  }

  // Cache management operations
  clear(): void {
    this.pathCache.clear()
    this.effectiveDistanceCache.clear()
    this.closestEnemyCache.clear()
    this.closestAllyCache.clear()
  }

  clearSpecific(cacheType: 'path' | 'effectiveDistance' | 'closestEnemy' | 'closestAlly'): void {
    switch (cacheType) {
      case 'path':
        this.pathCache.clear()
        break
      case 'effectiveDistance':
        this.effectiveDistanceCache.clear()
        break
      case 'closestEnemy':
        this.closestEnemyCache.clear()
        break
      case 'closestAlly':
        this.closestAllyCache.clear()
        break
    }
  }

  // Cache statistics for debugging
  getStats() {
    return {
      pathCacheSize: this.pathCache.size,
      effectiveDistanceCacheSize: this.effectiveDistanceCache.size,
      closestEnemyCacheSize: this.closestEnemyCache.size,
      closestAllyCacheSize: this.closestAllyCache.size,
    }
  }
}

// Default cache instance for module-level operations
const defaultCache = new PathfindingCache()

/*
 * Core Pathfinding Algorithms
 */

/*
 * A* pathfinding algorithm for hex grids.
 *
 * A* uses f(n) = g(n) + h(n) where:
 * - g(n) = actual cost from start to node n
 * - h(n) = heuristic estimate from node n to goal
 * - f(n) = estimated total cost of path through node n
 *
 * Returns array of hexes representing the optimal path, or null if no path exists.
 */
export function findPathAStar(
  start: Hex,
  goal: Hex,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): Hex[] | null {
  // A* data structures
  const openSet = new PriorityQueue<AStarNode>() // Nodes to be evaluated
  const closedSet = new Set<string>() // Nodes already evaluated
  const nodeMap = new Map<string, AStarNode>() // Quick node lookup
  const MAX_NODES_EXPLORED = 1000 // Limit to prevent excessive memory usage

  // Initialize start node with A* costs
  const startNode: AStarNode = {
    hex: start,
    gCost: 0,
    hCost: start.distance(goal), // Heuristic: direct distance to goal
    fCost: start.distance(goal), // f = g + h
    parent: null,
  }

  openSet.enqueue(startNode, startNode.fCost)
  nodeMap.set(start.toString(), startNode)

  // A* main loop
  while (!openSet.isEmpty()) {
    // Get node with lowest f-cost
    const currentNode = openSet.dequeue()
    if (!currentNode) break

    // Prevent excessive memory usage on large grids
    if (nodeMap.size > MAX_NODES_EXPLORED) {
      console.warn(`A* search limit reached (${MAX_NODES_EXPLORED} nodes), aborting`)
      return null
    }

    // Goal reached - reconstruct path
    if (currentNode.hex.equals(goal)) {
      const path: Hex[] = []
      let node: AStarNode | null = currentNode
      while (node) {
        path.unshift(node.hex)
        node = node.parent
      }
      return path
    }

    // Move current node from open to closed set
    closedSet.add(currentNode.hex.toString())

    // Evaluate all 6 hex neighbors
    for (let direction = 0; direction < 6; direction++) {
      const neighborHex = currentNode.hex.neighbor(direction)
      const neighborKey = neighborHex.toString()

      // Skip if already fully evaluated
      if (closedSet.has(neighborKey)) {
        continue
      }

      // Skip if not traversable
      const tile = getTile(neighborHex)
      if (!tile || !canTraverse(tile)) {
        continue
      }

      // Calculate A* costs for this neighbor
      const tentativeGCost = currentNode.gCost + 1 // Movement cost is always 1
      const hCost = neighborHex.distance(goal) // Heuristic: direct distance
      const tentativeFCost = tentativeGCost + hCost

      // Check if neighbor is already in open set
      let neighborNode = nodeMap.get(neighborKey)

      if (!neighborNode) {
        // New node - add to open set
        neighborNode = {
          hex: neighborHex,
          gCost: tentativeGCost,
          hCost: hCost,
          fCost: tentativeFCost,
          parent: currentNode,
        }
        nodeMap.set(neighborKey, neighborNode)
        openSet.enqueue(neighborNode, neighborNode.fCost)
      } else if (tentativeGCost < neighborNode.gCost) {
        // Better path to existing node - update it
        neighborNode.gCost = tentativeGCost
        neighborNode.fCost = tentativeFCost
        neighborNode.parent = currentNode
        // Update priority in queue
        openSet.updatePriority(neighborNode, neighborNode.fCost, (a, b) => a.hex.equals(b.hex))
      }
    }
  }

  // No path found
  return null
}

/*
 * Find shortest path distance using A* algorithm.
 * Returns number of steps needed, or null if no path exists.
 */
export function findPathDistance(
  start: Hex,
  goal: Hex,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): number | null {
  const path = findPathAStar(start, goal, getTile, canTraverse)
  return path ? path.length - 1 : null // Subtract 1 to get number of steps
}

/*
 * Calculate effective movement distance considering character range.
 * Returns movement tiles needed (0 if already in range).
 */
export function calculateEffectiveDistance(
  start: Hex,
  goal: Hex,
  range: number,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
  cachingEnabled: boolean = false,
): DistanceResult {
  // Check cache first if caching is enabled
  if (cachingEnabled) {
    const cacheKey = generatePathCacheKey(start.getId(), goal.getId(), range)
    const cached = defaultCache.getEffectiveDistance(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Calculate direct hex distance (ignoring obstacles)
  const directDistance = start.distance(goal)

  // If target is within range, no movement needed
  if (directDistance <= range) {
    const result = { movementDistance: 0, canReach: true, directDistance }
    if (cachingEnabled) {
      const cacheKey = generatePathCacheKey(start.getId(), goal.getId(), range)
      defaultCache.setEffectiveDistance(cacheKey, result)
    }
    return result
  }

  // Need to move closer - use A* to find optimal path
  const path = findPathAStar(start, goal, getTile, canTraverse)

  if (!path) {
    // No path exists, cannot reach target
    const result = { movementDistance: Infinity, canReach: false, directDistance }
    if (cachingEnabled) {
      const cacheKey = generatePathCacheKey(start.getId(), goal.getId(), range)
      defaultCache.setEffectiveDistance(cacheKey, result)
    }
    return result
  }

  // Calculate how many tiles we need to move to get within range
  const pathLength = path.length - 1 // Subtract 1 because path includes start position
  const movementNeeded = Math.max(0, pathLength - range)

  const result = {
    movementDistance: movementNeeded,
    canReach: true,
    directDistance,
  }

  if (cachingEnabled) {
    const cacheKey = generatePathCacheKey(start.getId(), goal.getId(), range)
    defaultCache.setEffectiveDistance(cacheKey, result)
  }
  return result
}

/*
 * Calculate minimum movement distance to reach any target using BFS.
 * Returns the movement distance and all targets reachable at that distance.
 */
export function calculateRangedMovementDistance(
  start: Hex,
  targets: Hex[],
  range: number,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): RangedDistanceResult {
  if (targets.length === 0) {
    return { movementDistance: Infinity, canReach: false, reachableTargets: [] }
  }

  // First check if already within range of any target
  const immediateTargets: Hex[] = []
  for (const target of targets) {
    const directDistance = start.distance(target)
    if (directDistance <= range) {
      immediateTargets.push(target)
    }
  }

  if (immediateTargets.length > 0) {
    return { movementDistance: 0, canReach: true, reachableTargets: immediateTargets }
  }

  // BFS to find minimum moves to get within range of any target
  let currentMoves = 0
  let currentQueue: Hex[] = [start]
  let nextQueue: Hex[] = []
  const visited = new Set<string>()
  visited.add(start.toString())

  const MAX_MOVEMENT_DISTANCE = 20 // Limit to prevent excessive searches

  while (currentQueue.length > 0 && currentMoves < MAX_MOVEMENT_DISTANCE) {
    const reachableAtThisDistance: Hex[] = []

    // Process all positions at current movement distance
    for (const currentHex of currentQueue) {
      // Try all 6 directions from current position
      for (let direction = 0; direction < 6; direction++) {
        const neighbor = currentHex.neighbor(direction)
        const neighborKey = neighbor.toString()

        if (visited.has(neighborKey)) continue

        const tile = getTile(neighbor)
        if (!tile || !canTraverse(tile)) continue

        visited.add(neighborKey)
        nextQueue.push(neighbor)

        // Check if from this new position, we can reach any target
        for (const target of targets) {
          const distanceToTarget = neighbor.distance(target)
          if (distanceToTarget <= range) {
            reachableAtThisDistance.push(target)
          }
        }
      }
    }

    // If we found targets at this distance, return them all for tie-breaking
    if (reachableAtThisDistance.length > 0) {
      // Remove duplicates
      const uniqueTargets = Array.from(
        new Set(reachableAtThisDistance.map((h) => h.toString())),
      ).map((str) => reachableAtThisDistance.find((h) => h.toString() === str)!)

      return {
        movementDistance: currentMoves + 1,
        canReach: true,
        reachableTargets: uniqueTargets,
      }
    }

    // Move to next movement distance
    currentQueue = nextQueue
    nextQueue = []
    currentMoves++
  }

  return { movementDistance: Infinity, canReach: false, reachableTargets: [] }
}

/*
 * Utility Functions
 */

/*
 * Default traversal function - allows movement through all tiles except blocked ones.
 */
export function defaultCanTraverse(tile: GridTile): boolean {
  return tile.state !== State.BLOCKED && tile.state !== State.BLOCKED_BREAKABLE
}

// Internal helper for applying tie-breaking rules (see findClosestTarget for details)
function applyTieBreakingRules(
  candidates: GridTile[],
  sourceHex: Hex,
  sourceTeam?: Team,
  currentBest: GridTile | null = null,
): GridTile {
  if (candidates.length === 0) {
    throw new Error('applyTieBreakingRules: No candidates provided')
  }

  if (candidates.length === 1) {
    return candidates[0]
  }

  let bestTarget = currentBest || candidates[0]
  const startIndex = currentBest ? 0 : 1

  for (let i = startIndex; i < candidates.length; i++) {
    const candidate = candidates[i]
    const candidateIsVertical = isVerticallyAligned(sourceHex, candidate.hex)
    const bestIsVertical = isVerticallyAligned(sourceHex, bestTarget.hex)

    if (candidateIsVertical && !bestIsVertical) {
      // Rule 1: Prefer vertical alignment
      bestTarget = candidate
    } else if (!candidateIsVertical && bestIsVertical) {
      // Keep current best (already vertical)
      continue
    } else if (areHexesInSameDiagonalRow(candidate.hex.getId(), bestTarget.hex.getId())) {
      // Rule 2: Same diagonal row - team-based ID preference
      // ALLY to ENEMY: prefer larger ID, ENEMY to ALLY: prefer lower ID
      const preferLowerId = sourceTeam === Team.ENEMY
      const shouldUpdate = preferLowerId
        ? candidate.hex.getId() < bestTarget.hex.getId()
        : candidate.hex.getId() > bestTarget.hex.getId()
      if (shouldUpdate) {
        bestTarget = candidate
      }
    } else if (!candidateIsVertical && !bestIsVertical) {
      // Rule 3: Neither vertical - use absolute distance as fallback
      const candidateDirectDistance = sourceHex.distance(candidate.hex)
      const bestDirectDistance = sourceHex.distance(bestTarget.hex)
      if (candidateDirectDistance < bestDirectDistance) {
        bestTarget = candidate
      } else if (candidateDirectDistance === bestDirectDistance) {
        // Final fallback: team-based ID preference
        const preferLowerId = sourceTeam === Team.ENEMY
        const shouldUpdate = preferLowerId
          ? candidate.hex.getId() < bestTarget.hex.getId()
          : candidate.hex.getId() > bestTarget.hex.getId()
        if (shouldUpdate) {
          bestTarget = candidate
        }
      }
    }
  }

  return bestTarget
}

/*
 * Check if source and target hex are vertically aligned (same q coordinate).
 */
export function isVerticallyAligned(sourceHex: Hex, targetHex: Hex): boolean {
  return sourceHex.q === targetHex.q
}

/*
 * Target Selection and Tie-Breaking
 */

/*
 * Find the closest reachable target from a source tile.
 *
 * Uses BFS to find the minimum movement distance required to engage any target.
 * Works for both melee and ranged units based on their attack range.
 *
 * Tie-breaking Rules (when multiple targets have same movement distance):
 * 1. Vertical alignment (same q coordinate) - straight-line movement preference
 * 2. Same diagonal row position - team-based ID preference
 * 3. Minimum direct distance - spatial proximity
 */
export function findClosestTarget(
  sourceTile: GridTile,
  targetTiles: GridTile[],
  sourceRange: number,
  getTile: (hex: Hex) => GridTile | undefined,
  canTraverse: (tile: GridTile) => boolean,
): TargetResult | null {
  if (targetTiles.length === 0) {
    return null
  }

  // Use BFS to find minimum movement distance to any target
  const targetHexes = targetTiles.map((tile) => tile.hex)
  const bfsResult = calculateRangedMovementDistance(
    sourceTile.hex,
    targetHexes,
    sourceRange,
    getTile,
    canTraverse,
  )

  if (!bfsResult.canReach || bfsResult.reachableTargets.length === 0) {
    return null
  }

  // Convert reachable target hexes back to tiles for tie-breaking
  const candidateTargets = targetTiles.filter((tile) =>
    bfsResult.reachableTargets.some((reachableHex) => reachableHex.equals(tile.hex)),
  )

  if (candidateTargets.length === 0) {
    return null
  }

  // Apply tie-breaking rules to select the best target
  const bestTarget = applyTieBreakingRules(candidateTargets, sourceTile.hex, sourceTile.team, null)

  return {
    hexId: bestTarget.hex.getId(),
    distance: bfsResult.movementDistance,
  }
}

/*
 * High-Level Game APIs
 */

/*
 * Calculate closest targets for characters of a specific team.
 * Returns map: source hex ID -> {target hex ID, distance}
 */
export function getClosestTargetMap(
  tilesWithCharacters: GridTile[],
  sourceTeam: Team,
  targetTeam: Team,
  characterRanges: Map<number, number> = new Map(),
  cachingEnabled: boolean = true,
  getTile?: (hex: Hex) => GridTile | undefined,
): Map<number, TargetInfo> {
  // Check cache first if caching is enabled
  if (cachingEnabled) {
    const cacheKey = generateGridCacheKey(tilesWithCharacters, characterRanges)
    const cached =
      sourceTeam === Team.ALLY
        ? defaultCache.getClosestEnemyMap(cacheKey)
        : defaultCache.getClosestAllyMap(cacheKey)
    if (cached) {
      return cached
    }
  }

  const result = new Map<number, TargetInfo>()

  // Get tiles for source and target teams
  const sourceTiles = tilesWithCharacters.filter((tile) => tile.team === sourceTeam)
  const targetTiles = tilesWithCharacters.filter((tile) => tile.team === targetTeam)

  // getTile helper that handles out-of-bounds hexes
  const getTileHelper =
    getTile ||
    ((hex: Hex) => {
      const tile = tilesWithCharacters.find((t) => t.hex.equals(hex))
      return tile
    })

  // For each source character, find closest target using shared pathfinding logic
  for (const sourceTile of sourceTiles) {
    const range = sourceTile.characterId ? (characterRanges.get(sourceTile.characterId) ?? 1) : 1
    const closestTarget = findClosestTarget(
      sourceTile,
      targetTiles,
      range,
      getTileHelper,
      defaultCanTraverse,
    )

    if (closestTarget) {
      // Create result with appropriate field name based on target team
      const targetInfo: TargetInfo = {
        distance: closestTarget.distance,
      }

      if (targetTeam === Team.ENEMY) {
        targetInfo.enemyHexId = closestTarget.hexId
      } else {
        targetInfo.allyHexId = closestTarget.hexId
      }

      result.set(sourceTile.hex.getId(), targetInfo)
    }
  }

  // Cache the result if caching is enabled
  if (cachingEnabled) {
    const cacheKey = generateGridCacheKey(tilesWithCharacters, characterRanges)
    if (sourceTeam === Team.ALLY) {
      defaultCache.setClosestEnemyMap(cacheKey, result)
    } else {
      defaultCache.setClosestAllyMap(cacheKey, result)
    }
  }
  return result
}

/*
 * Cache Management
 */

/*
 * Clear all pathfinding caches.
 */
export function clearPathfindingCache(): void {
  defaultCache.clear()
}
