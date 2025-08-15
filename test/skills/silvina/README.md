# Silvina Test Suite

This directory contains the test suite for Silvina's "First Strike" targeting algorithm.

## Files

- **silvina.test.ts** - Test file that includes:
  - Test parser for markdown test files
  - Test runner with detailed reporting
  - Tests the actual implementation from silvina.ts
  - Current status: 100% accuracy (145/145 tests passing)

## Test Data Format

Test cases are written in markdown files with the following structure:

```markdown
# Arena [number] Test [name]

## Test Setup

arena: [arena_name]
notes: [optional description]

## Enemy Team Positions

- Character 1: Tile [number]
- Character 2: Tile [number]
  ...

## Test Cases

silvina tile: [number]
symmetrical tile: [number]
expected target: [number]
```

The parser extracts:

- Enemy positions from the "Enemy Team Positions" section
- Test cases with silvina tile, symmetrical tile, and expected target
- Arena and notes metadata

## Test Structure

```
silvina/
├── README.md           # This file
├── silvina.test.ts     # Main test file
├── control/           # Control test cases
├── arena1/            # Arena 1 test cases
├── arena3/            # Arena 3 test cases
└── arena4/            # Arena 4 test cases
```

## Running Tests

```bash
npm test          # Run all Silvina tests
npm run test:silvina  # Same as above
```

## Test Coverage

- **4 different arenas** tested
- **Various enemy configurations**: 2-enemy, 3-enemy, 5-enemy, adjacent, symmetrical
- **Edge cases**: Multiple enemies at same distance, ring walking order
- **Team perspectives**: Both ally team (clockwise) and enemy team (counter-clockwise) tested

## Algorithm

Silvina's targeting now uses a **clockwise spiral search** algorithm:

- **Priority 1**: Enemy on the symmetrical tile (immediate target)
- **Priority 2**: Nearest enemy via spiral search
  - Ally team: Walks clockwise starting just after top-right (q+N, r-N)
  - Enemy team: Walks counter-clockwise starting just after bottom-left (q-N, r+N)
  - Searches expanding rings (distance 1, 2, 3...) until an enemy is found
  - Within each ring, tiles are checked in the appropriate walk order

This approach ensures consistent, predictable targeting behavior with 100% test accuracy.
