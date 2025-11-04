# Integration Test Suite

This directory contains comprehensive integration tests for the skill targeting system utilities.

## Structure

```
integration/
├── README.md                  # This file
├── *.test.ts                  # Test runners
├── symmetricalSpiral/         # Test data for symmetrical targeting
│   ├── control/               # Control test cases
│   ├── arena1/                # Arena 1 test cases
│   ├── arena3/                # Arena 3 test cases
│   └── arena4/                # Arena 4 test cases
└── rowScan/                   # Test data for row scan targeting
```

## Test Coverage

The tests simulate various complex targeting test scenarios, such as the symmetrical targeting flow.

## Running Tests

```bash
# Run all integration tests
npm run test:it

# Run full test suite
npm test
```

## Test Data Format

Test cases are written in JSON files with the following structure:

### Symmetrical Spiral

```json
{
  "testName": "Arena 1 Test 1",
  "testSetup": {
    "arena": "I", // Arena name/number
    "team": "Enemy", // Target team
    "positions": [37, 42], // Enemy tile positions
    "notes": "optional description of test scenario"
  },
  "testCases": [
    {
      "characterTile": 1, // Character's position (used to calculate symmetrical tile)
      "symmetricalTile": 44, // The center point for symmetrical targeting
      "expectedTarget": 42 // Expected target found by spiral search
    }
    // ... more test cases
  ]
}
```

### Row Scan

```json
{
  "testName": "Arena 1 Test 1",
  "testSetup": {
    "arena": "I", // Arena name/number
    "team": "Ally", // Target team
    "positions": [8, 10], // Ally tile positions
    "notes": "optional description of test scenario"
  },
  "testCases": [
    {
      "characterTile": 1, // Character's position
      "expectedTarget": 42 // Expected target found by row scan
    }
    // ... more test cases
  ]
}
```
