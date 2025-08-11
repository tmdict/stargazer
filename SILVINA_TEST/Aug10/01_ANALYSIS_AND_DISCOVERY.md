# Silvina Targeting Analysis - Aug10 Investigation

## Problem Statement

Silvina's "First Strike" skill targets the enemy on the symmetrical tile. When that tile is empty, it should target the closest enemy to that tile. However, when multiple enemies are equidistant (tied), the tie-breaking behavior wasn't matching expected results consistently.

**Initial Status**: ~77% test cases passing with simple "prefer highest ID" rule

## Investigation Process

### Phase 1: Initial Problem Discovery
- Silvina's skill wasn't correctly targeting when multiple enemies were equidistant
- Simple tie-breaking rules (prefer highest/lowest ID) achieved only ~77% accuracy
- Distance calculations verified to be mathematically correct: `(|q1-q2| + |r1-r2| + |s1-s2|) / 2`

### Phase 2: Cross-Arena Testing
Established that the pattern is consistent across different arena configurations:
- **Arena I**: Base tests showing position-dependent behavior
- **Arena III**: Mostly successful with one failure (Silvina 1)
- **Arena IV**: Two failures (Silvina 3 and 8), confirming pattern isn't arena-specific

### Phase 3: Pattern Discovery Through Systematic Testing

#### Key Test: Controlled Tie (Enemies at 37 & 42)
Revealed position-dependent behavior with 92% success rate:

| Silvina | Sym | Expected | Pattern |
|---------|-----|----------|---------|
| 1 | 44 | 42 | Higher zone |
| 3 | 41 | 37 | Lower zone |
| 5 | 43 | 42 | Higher zone |
| 6 | 39 | 37 | Lower zone |
| 7 | 40 | 42 | Higher zone |
| 8 | 36 | 37 | Lower zone |
| 13 | 34 | 37 | Special case |

#### Additional Test Configurations
- **Three-way ties**: Complex behavior with 3 equidistant enemies
- **Reverse positions**: Pattern changes with different enemy placements
- **Adjacent enemies**: Mostly consistent behavior preferring lower ID
- **Symmetrical placement**: Edge cases revealing zone boundaries

## The Diagonal Discovery

### The Diagonal Line
A diagonal line through tiles **4, 9, 16, 23, 30, 37, 42** divides the grid into zones that determine tie-breaking behavior.

### Zone Classifications (Initial Theory)
- **LEFT Zone**: Tiles 30, 33, 36, 39, 41 → Prefer LOWER hex ID
- **RIGHT Zone**: Tiles 34, 38, 40, 43, 44, 45 → Prefer HIGHER hex ID  
- **ON Diagonal**: Tiles 37, 42 → Prefer LOWER hex ID

### Key Insights
1. **Position-Dependent**: Tie-breaking depends on the symmetrical tile's position relative to the diagonal
2. **Rotational Symmetry**: Uses 180° rotational symmetry, not mirror symmetry
3. **Neither Simple Rule Works**: 
   - Original (prefer highest): ~77% success
   - Reversed (prefer lowest): ~77% success
   - Position-based zones: ~95% success

## Test Data Summary

### Configuration Performance
- **Test C (37 & 42)**: 12/13 passing (92%)
- **Test M (36 & 43)**: 13/13 passing (100%) - Clean zone separation
- **Test D (37, 40, 42)**: Three-way ties showing complex patterns
- **Test E (38, 44)**: Reverse positions confirming zones
- **Test F (37, 38)**: Adjacent enemies mostly prefer lower

### Consistent Patterns Found
- **Always expect lower**: Silvina at tiles 3, 6, 8
- **Variable behavior**: Silvina at tiles 2, 4, 5, 7, 10
- **Special cases**: Tile 34 inconsistent, Tile 10 anomalous

## Evolution to DIAGONAL_ROWS Pattern

While the diagonal zone theory achieved ~95% accuracy, further investigation in Aug11 revealed that the actual pattern follows the **DIAGONAL_ROWS structure** based on position within each diagonal row:
- First position in row → Prefer LOWER
- Last position in row → Prefer HIGHER
- Middle positions → Context-dependent

This discovery led to the final implementation achieving 89.5% accuracy with cleaner, more maintainable code.