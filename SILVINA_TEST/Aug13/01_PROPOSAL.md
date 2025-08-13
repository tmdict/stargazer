# Silvina Targeting Analysis and Proposal

## 1. Summary of Findings

After a comprehensive review of the existing documentation, source code, and test results for Silvina's "First Strike" skill, I've identified two primary categories of failures that contribute to the current 89.5% accuracy rate. The existing implementation, which relies on a tie-breaking system based on a tile's position within `DIAGONAL_ROWS`, is a strong foundation but has clear areas for improvement.

The 15 failing tests can be classified into two groups:

- **Group A: Apparent Primary Targeting Failures (3 cases):** In these scenarios, the algorithm correctly identifies the enemy closest to the symmetrical tile, but the test expects a _different, more distant_ enemy. This suggests either the core premise of "closest to symmetrical tile" is incomplete or the test cases are flawed.
- **Group B: Tie-Breaker Logic Failures (12 cases):** In these scenarios, two enemies are equidistant from the symmetrical tile, and the `getTieBreakingPreference` function selects the wrong target. These failures are systematic and point to correctable flaws in the preference logic.

This proposal will focus on solving the **Tie-Breaker Logic Failures (Group B)**, as they represent the majority of the issues and have a clear, addressable pattern. Fixing these is projected to increase test accuracy from **89.5% to approximately 97.9%**.

## 2. Analysis of Tie-Breaker Failures

The core of the issue lies in the `getTieBreakingPreference` function in `src/lib/skills/silvina.ts`. The current logic is based on a tile's position within its diagonal row (first, last, or middle). While this works for many cases, it fails consistently for certain board configurations.

Initial visual grid representations suggested a static division between "home" and "enemy" territories. However, further investigation reveals that board layouts are dynamic - units can be placed anywhere, and the layout is not always symmetrical. This means the targeting rules must adapt to the actual game state rather than relying on fixed board regions.

### Key Observation: Proximity-Based Preference

My analysis of the failing test cases reveals a clear pattern: the preference for a 'higher' or 'lower' hex ID is not static but rather **inverts as the symmetrical tile gets closer to the enemy's backline**.

The current implementation has a hardcoded exception for `rowIndex === 14` (the last row), making it always prefer `'higher'`. The test failures show this is often incorrect. A more nuanced approach is needed.

**Example Failure (`arena1/control4.md`, Silvina at 2):**

1.  **Symmetrical Tile:** 45 (in the last diagonal row)
2.  **Tied Enemies:** 37 and 38 (equidistant)
3.  **Current Logic:** The rule for the last row is to prefer `'higher'`. The algorithm incorrectly chooses **38**.
4.  **Expected Target:** The test expects **37** (`'lower'`).

This pattern repeats across multiple failures. The simple "first in row = lower, last in row = higher" model breaks down for the top-most rows.

## 3. Proposed Solution: A Dynamic Territory-Based Tie-Breaking Algorithm

### Update: Dynamic Board Layouts

After further analysis, it's become clear that board layouts in the game are dynamic - enemy and ally placements can be anywhere on the board, and they're not always symmetrical. This invalidates my initial approach of using static board regions (like "top half" vs "bottom half") for tie-breaking logic.

### Revised Approach: Territory Detection Based on Unit Positions

I propose a more sophisticated approach that dynamically determines which "territory" a symmetrical tile belongs to based on the actual positions of units on the board. This will work for any board configuration, including asymmetrical layouts.

### Proposed Implementation

```typescript
function getTieBreakingPreference(
  symmetricalHexId: number,
  team: Team,
  grid: Grid,
): 'lower' | 'higher' {
  const rowIndex = DIAGONAL_ROWS.findIndex((row) => row.includes(symmetricalHexId))
  if (rowIndex === -1) return 'higher' // Fallback

  const row = DIAGONAL_ROWS[rowIndex]
  const position = row.indexOf(symmetricalHexId)

  // Calculate average distance to all allied and enemy units
  const symmetricalHex = grid.getHexById(symmetricalHexId)
  let allyDistanceSum = 0
  let allyCount = 0
  let enemyDistanceSum = 0
  let enemyCount = 0

  const tiles = grid.getAllTiles()
  for (const tile of tiles) {
    if (tile.characterId) {
      const distance = symmetricalHex.distance(tile.hex)
      if (tile.team === team) {
        allyDistanceSum += distance
        allyCount++
      } else {
        enemyDistanceSum += distance
        enemyCount++
      }
    }
  }

  // Determine if we're in "enemy territory" (closer to enemies on average)
  const avgAllyDistance = allyCount > 0 ? allyDistanceSum / allyCount : Infinity
  const avgEnemyDistance = enemyCount > 0 ? enemyDistanceSum / enemyCount : Infinity
  const inEnemyTerritory = avgEnemyDistance < avgAllyDistance

  // Determine base preference (from ally perspective)
  let basePreference: 'lower' | 'higher'

  // Base rules, which are inverted when in enemy territory
  if (position === 0) {
    // First in row: normally 'lower', but 'higher' in enemy territory
    basePreference = inEnemyTerritory ? 'higher' : 'lower'
  } else if (position === row.length - 1) {
    // Last in row: normally 'higher', but 'lower' in enemy territory
    basePreference = inEnemyTerritory ? 'lower' : 'higher'
  } else {
    // Middle positions consistently prefer 'lower' across the entire board.
    // This appears to be a consistent rule regardless of territory.
    basePreference = 'lower'
  }

  // The existing rotational symmetry for the enemy team remains correct.
  if (team === Team.ENEMY) {
    return basePreference === 'lower' ? 'higher' : 'lower'
  }

  return basePreference
}
```

### Rationale for this Revised Approach:

- **Dynamic Adaptation:** Works with any board configuration, including non-standard and asymmetrical layouts.
- **Territory-Based Logic:** Captures the intuition that tie-breaking rules change based on which team's "territory" the symmetrical tile is in, but determines this dynamically rather than using hardcoded board regions.
- **Maintains Core Insights:** Still uses the position within `DIAGONAL_ROWS` as the primary factor, but adds dynamic territory detection instead of static row thresholds.
- **Fixes Test Failures:** This approach should still resolve the 12 tie-breaking failures while being more robust for future board configurations.

### Alternative Simpler Approach

If the dynamic territory calculation proves too complex or expensive, an alternative would be to examine the failing test cases more carefully to find a simpler pattern. The current implementation already achieves 89.5% accuracy, and it's possible that the remaining failures are edge cases that could be handled with minor tweaks rather than a complete overhaul.

## 4. Analysis of Primary Targeting Failures

The 3 failing tests in Group A remain a mystery. In these cases, the algorithm performs as designed ("target the closest enemy to the symmetrical tile"), but the expected results contradict this.

**Example Failure (`arena1/control3.md`, Silvina at 9):**

1.  **Symmetrical Tile:** 37
2.  **Enemies:** 38 and 44
3.  **Distances:** `distance(37, 38)` is 1. `distance(37, 44)` is 3.
4.  **Current Logic:** The algorithm correctly identifies tile **38** as the closest.
5.  **Expected Target:** The test expects tile **44**.

With the understanding that board layouts are dynamic, these test cases become even more puzzling. There are two possibilities:

1.  **The test data is incorrect.** This is plausible, as collecting perfect data for complex game mechanics can be difficult.
2.  **There is a more subtle game mechanic at play.** For example, there could be a "line-of-sight", "pathfinding cost", or other game-specific mechanic that is not captured by simple hex distance.

**Recommendation:**

Given the ambiguity, I recommend **not** attempting to fix these failures at this time. We should first implement the improved tie-breaking logic and get the test suite to ~98% accuracy. After that, the remaining 3 failures can be investigated separately, potentially with more targeted data collection to confirm or deny the existence of a more complex targeting rule.

## 5. Next Steps

1.  **Implement the proposed `getTieBreakingPreference` function** in `src/lib/skills/silvina.ts`. Note that this will require passing the `grid` parameter to the function, which means updating the call site in the `calculateTarget` function.
2.  **Run the tests again** to confirm that the 12 tie-breaking failures are resolved.
3.  **Evaluate performance impact** of the dynamic territory calculation. If it proves too expensive, consider the simpler alternative mentioned above.
4.  **Submit the changes for review.**

By following these steps, we can significantly improve the reliability of Silvina's targeting with a robust solution that works for any board configuration.
