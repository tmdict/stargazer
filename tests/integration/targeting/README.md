# Targeting System Test Suite

This directory contains comprehensive tests for the skill targeting system utilities.

## Structure

```
targeting/
├── README.md             # This file
├── targeting.test.ts     # Main test runner for all targeting tests
└── symmetricalSpiral/    # Test data for symmetrical targeting
    ├── control/          # Control test cases
    ├── arena1/           # Arena 1 test cases
    ├── arena3/           # Arena 3 test cases
    └── arena4/           # Arena 4 test cases
```

## Test Coverage

The tests simulate the complete symmetrical targeting flow used by characters like Silvina to find the nearest enemy from their symmetrical position:

1. Calculate the symmetrical tile from the caster's position
2. Check if an enemy is on the symmetrical tile (handled by character logic)
3. If not, perform spiral search from the symmetrical tile to find the nearest enemy

## Running Tests

```bash
# Run all targeting tests
npm run test:targeting

# Run full test suite
npm test
```

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

character tile: [number] # Caster's position (used to calculate symmetrical tile)
symmetrical tile: [number] # The center point for symmetrical targeting (if enemy not on this tile, spiral search is performed)
expected target: [number] # Expected target found by symmetrical targeting
```
