# Silvina Targeting Algorithm Investigation

## Overview

This directory documents a comprehensive two-day investigation into Silvina's "First Strike" targeting algorithm in the Stargazer game. The work progressed from identifying a tie-breaking bug to discovering an elegant pattern-based solution.

## The Problem

Silvina's "First Strike" skill targets the enemy on the symmetrical tile (mirrored across the board's middle diagonal). When that tile is empty, it targets the closest enemy to that tile. The challenge: when multiple enemies are equidistant, the tie-breaking behavior didn't match expectations.

## Investigation Timeline

### Aug10 - Initial Discovery
**Goal**: Fix inconsistent tie-breaking behavior  
**Method**: Empirical testing with various enemy configurations  
**Discovery**: Tie-breaking follows a diagonal zone pattern  
**Solution**: Hardcoded tile lists based on observed behavior  
**Result**: 95% accuracy but not maintainable  

Key findings:
- Simple "prefer highest/lowest ID" rules only achieved 77% accuracy
- Discovered diagonal line through tiles 4, 9, 16, 23, 30, 37, 42
- Identified tile-specific preferences (LEFT zone → LOWER, RIGHT zone → HIGHER)

### Aug11 - Pattern Breakthrough  
**Goal**: Find the underlying pattern instead of hardcoding  
**Method**: Analysis using DIAGONAL_ROWS grid structure  
**Discovery**: Preferences based on position within diagonal rows  
**Solution**: Elegant position-based algorithm  
**Result**: 89.5% accuracy with clean, maintainable code  

Key breakthroughs:
- Corrected mental model of hexagonal grid structure
- Discovered position-in-row determines preference
- Implemented rotational symmetry for enemy perspective

## Final Solution

```typescript
// Tie-breaking based on position in DIAGONAL_ROWS
function getTieBreakingPreference(symmetricalHexId: number, team: Team): 'lower' | 'higher' {
  const rowIndex = DIAGONAL_ROWS.findIndex(row => row.includes(symmetricalHexId))
  const row = DIAGONAL_ROWS[rowIndex]
  const position = row.indexOf(symmetricalHexId)
  
  // Determine base preference
  let basePreference: 'lower' | 'higher'
  if (rowIndex === 14) basePreference = 'higher'  // Top row exception
  else if (position === 0) basePreference = 'lower'  // First in row
  else if (position === row.length - 1) basePreference = 'higher'  // Last in row
  else basePreference = 'lower'  // Middle positions
  
  // Invert for enemy team (180° rotation)
  if (team === Team.ENEMY) {
    return basePreference === 'lower' ? 'higher' : 'lower'
  }
  return basePreference
}
```

## Directory Structure

```
SILVINA_TEST/
├── README.md                 # This file
├── Aug10/                    # Initial investigation
│   ├── 01_ANALYSIS_AND_DISCOVERY.md  # Investigation narrative
│   ├── 02_TEST_DATA.md              # Complete test results
│   └── README.md                     # Aug10 summary
└── Aug11/                    # Pattern discovery
    ├── 01_DISCOVERY_JOURNEY.md      # How we found the pattern
    ├── 02_IMPLEMENTATION_DETAILS.md # Technical documentation
    ├── 03_TEST_RESULTS.md            # Test performance analysis
    └── README.md                     # Aug11 summary
```

## Test Implementation

Tests are located in `/test/skills/silvina/` in the main repository:
- **silvina.test.ts** - Consolidated test file with parser and runner
- **Test data** - Markdown files with test cases in subdirectories
- **README.md** - Test format documentation

The test file now includes the parser logic, making it self-contained. See `Aug11/03_TEST_RESULTS.md` for comprehensive test performance analysis.

## Key Learnings

### Technical Discoveries
1. **Grid Structure**: Hexagonal grid uses DIAGONAL_ROWS, not traditional rows/columns
2. **Pattern Rule**: Position in diagonal row determines tie-breaking preference
3. **Symmetry**: 180° rotational symmetry between ally/enemy perspectives
4. **Edge Cases**: Some tiles (like 34) have inconsistent behavior

### Process Insights
1. **Empirical Testing**: 143 test cases across 4 arenas revealed the pattern
2. **Visual Understanding**: Correcting mental models was crucial for breakthrough
3. **Trade-offs**: 89.5% accuracy with clean code vs 95% with hardcoding
4. **Documentation**: Recording the journey helps future understanding

## Performance Summary

| Approach | Accuracy | Maintainability | Code Complexity |
|----------|----------|-----------------|-----------------|
| Simple rule (prefer highest) | 77% | High | Very Low |
| Hardcoded lists (Aug10) | 95% | Low | Medium |
| DIAGONAL_ROWS pattern (Aug11) | 89.5% | High | Low |

## Test Results

- **Total Test Cases**: 143
- **Passing Tests**: 128  
- **Failing Tests**: 15
- **Overall Accuracy**: 89.5%

Common failures occur with:
- Tile 13 (symmetrical 34) - inconsistent middle position behavior
- Some Arena 3 edge cases
- Three-way tie scenarios

## Running the Tests

```bash
npm test                    # Run Silvina tests
npm run test:silvina       # Same as above (alias)
```

## Implementation Files

The actual implementation is in the main Stargazer codebase:
- `/src/lib/skills/silvina.ts` - Main targeting logic
- `/src/lib/skills/utils/symmetry.ts` - Symmetrical tile calculation
- `/src/lib/types/grid.ts` - DIAGONAL_ROWS structure
- `/test/skills/silvina/silvina.test.ts` - Self-contained test file

## For Future LLMs

If you're reading this to understand the Silvina targeting algorithm:

1. **Start with Aug11/01_DISCOVERY_JOURNEY.md** to understand the investigation process
2. **Read Aug11/02_IMPLEMENTATION_DETAILS.md** for technical implementation
3. **Review silvina.test.ts** for validation approach and test data parsing
4. **Key insight**: It's not about geometric zones but position within DIAGONAL_ROWS

The pattern is elegant once understood: first position prefers lower ID, last position prefers higher ID, with special handling for Row 14 and rotational symmetry for enemy team.

## Acknowledgments

This investigation was a collaborative effort involving:
- Empirical testing and pattern recognition
- User feedback correcting misconceptions
- Iterative refinement of hypotheses
- Comprehensive documentation of findings

The final solution balances accuracy, maintainability, and elegance - a testament to the value of understanding underlying patterns rather than just fixing symptoms.