# Silvina Test Suite

This directory contains the test suite for Silvina's "First Strike" targeting algorithm.

## Files

- **silvina.test.ts** - Self-contained test file that includes:
  - Test parser for markdown test files
  - Test runner with detailed reporting
  - Actual implementation testing (not mocks)
  - Current status: 89.5% accuracy (128/143 tests passing)

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
├── arena1/            # Arena 1 test cases
│   ├── control1.md    # Control tests with 2 enemies
│   ├── control2.md    # Control tests with 3 enemies
│   ├── test1.md       # Additional scenarios
│   └── test2.md       # Edge cases
├── arena3/            # Arena 3 test cases
│   ├── test1.md
│   ├── test2.md
│   └── test3.md
└── arena4/            # Arena 4 test cases
    └── test1.md
```

## Running Tests

```bash
npm test          # Run all Silvina tests
npm run test:silvina  # Same as above
```

## Test Coverage

- **4 different arenas** tested
- **Various enemy configurations**: 2-enemy, 3-enemy, adjacent, symmetrical
- **Edge cases**: Tile 34 inconsistencies, three-way ties
- **Team perspectives**: Primarily ally team (enemy team uses rotational symmetry)

## Known Failures

Consistent failures occur with:

- **Tile 13 (sym 34)**: Middle position with inconsistent behavior
- **Tile 1 (sym 44)**: Occasional Arena 3 failures
- **Tile 9 (sym 37)**: Diagonal tile edge cases

These failures are acceptable given the trade-off between code maintainability and 100% accuracy.
