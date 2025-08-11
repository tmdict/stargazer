# Aug11 - The DIAGONAL_ROWS Discovery Journey

## Context
Building on Aug10's diagonal zone theory (95% accuracy with hardcoded tile lists), we sought a more elegant, maintainable solution based on understanding the underlying pattern.

## The Investigation Path

### Phase 1: Revisiting with Visual Understanding
After user provided `grid_tile_test.png` showing the actual hexagonal grid layout, we realized our mental model was incorrect. The grid is organized in diagonal rows, not the traditional row/column structure we assumed.

### Phase 2: Zone Theory Refinement and Failure
**Initial Theory**: Tiles are in LEFT or RIGHT zones relative to the diagonal line (4, 9, 16, 23, 30, 37, 42).

**Zone Classifications Attempted**:
- LEFT Zone: 30, 33, 36, 39, 41 → Prefer LOWER
- RIGHT Zone: 34, 38, 40, 43, 44, 45 → Prefer HIGHER
- ON Diagonal: 37, 42 → Prefer LOWER

**Result**: Only 54% accuracy when tested systematically. The geometric zones didn't explain the pattern.

**Key Learning**: User corrected our zone classifications - tiles 39 and 44 were on opposite sides from what we thought. This revealed our visual model was wrong.

### Phase 3: Distance Patterns and Silvina Proximity
**Hypothesis**: When Silvina is close (distance ≤ 2) to tied enemies, proximity might override zone rules.

**Findings**:
- Most tiles pick the closer enemy when Silvina is nearby
- Exception: Tile 10 consistently picks the farther enemy
- Pattern exists but doesn't fully explain behavior

### Phase 4: The DIAGONAL_ROWS Breakthrough
**Critical Discovery**: The grid structure in `src/lib/types/grid.ts` uses DIAGONAL_ROWS:
```typescript
DIAGONAL_ROWS = [
  [1, 2],           // Row 0
  [3, 4, 5],        // Row 1
  ...
  [22, 23, 24],     // Row 7 - MIDDLE
  ...
  [44, 45],         // Row 14
]
```

**The Pattern**: Tie-breaking preference depends on **position within each diagonal row**:
- **First position** in row → Prefer LOWER hex ID
- **Last position** in row → Prefer HIGHER hex ID
- **Middle positions** → Context-dependent (diagonal tiles prefer LOWER)
- **Row 14 exception** → Both positions prefer HIGHER

### Phase 5: Special Cases Investigation

#### Tile 34 - The Anomaly
- Position: Row 10, position 2 (middle of 4)
- Expected: Should prefer LOWER (middle position)
- Actual: Inconsistent behavior across tests
- Resolution: Default to LOWER, accept occasional failures

#### Middle Diagonal Hypothesis
User suggested using the middle diagonal (row 7) as reference:
- Tiles below middle → one preference
- Tiles above middle → opposite preference
- Result: Didn't improve accuracy, DIAGONAL_ROWS pattern was superior

## Key Insights

### 1. Visual Model Correction
The hexagonal grid isn't organized in traditional rows/columns but in diagonal lines. This fundamentally changed our understanding of the pattern.

### 2. Position Matters More Than Geometry
The pattern isn't about geometric zones or distances, but about the tile's **position within its diagonal row**. This elegant rule explains most behavior.

### 3. Rotational Symmetry
Enemy targeting uses 180° rotational symmetry:
```typescript
if (team === Team.ENEMY) {
  return basePreference === 'lower' ? 'higher' : 'lower'
}
```
This creates tactical asymmetry between ally and enemy sides.

### 4. Edge Cases Are Acceptable
Not every tile follows the pattern perfectly (especially tile 34). Accepting 89.5% accuracy for cleaner, maintainable code is a good trade-off.

## Evolution from Aug10

| Aspect | Aug10 Approach | Aug11 Approach |
|--------|----------------|----------------|
| Method | Hardcoded tile lists | Position-based pattern |
| Accuracy | 95% | 89.5% |
| Maintainability | Low (arbitrary lists) | High (clear rules) |
| Elegance | Brute force | Pattern-based |
| Code Lines | ~20 lines of lists | ~10 lines of logic |

## Testing Validation

The pattern was validated against:
- 143 test cases across 4 different arenas
- Various enemy configurations (2-enemy, 3-enemy, adjacent, symmetrical)
- Both ally and enemy team perspectives
- Edge cases and special positions

Final test results: **128/143 passing (89.5% accuracy)**

## Lessons Learned

1. **Challenge assumptions**: Our initial mental model of the grid was wrong
2. **User feedback is crucial**: Corrections about zone classifications led to breakthrough
3. **Patterns over hardcoding**: Even with slightly lower accuracy, pattern-based solutions are more maintainable
4. **Test comprehensively**: 143 test cases revealed edge cases we wouldn't have found otherwise
5. **Document the journey**: Understanding why we made certain decisions is as important as the final solution