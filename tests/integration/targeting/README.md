# Targeting System Test Suite

This directory contains comprehensive tests for the skill targeting system utilities.

## Structure

```
targeting/
├── README.md             # This file
├── *.test.ts    # Main test runner for tests
└── symmetricalSpiral/    # Test data for symmetrical targeting
    ├── control/          # Control test cases
    ├── arena1/           # Arena 1 test cases
    ├── arena3/           # Arena 3 test cases
    └── arena4/           # Arena 4 test cases
```

## Test Coverage

The tests simulate various complex targeting test scenarios, such as the symmetrical targeting flow.

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
