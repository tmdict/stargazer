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
