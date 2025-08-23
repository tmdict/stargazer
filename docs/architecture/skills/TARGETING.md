# Targeting Skills

## Overview

Automatically select and track enemy targets with colored arrows that update when characters move.

## Implementation

Uses three lifecycle methods to manage targeting:

```typescript
onActivate: calculateTarget() → setSkillTarget()
onUpdate: recalculate when grid changes
onDeactivate: clearSkillTarget()
```

Key features:

- Visual feedback via `targetingColorModifier` (arrow color)
- Dynamic updates through `onUpdate` lifecycle
- No border changes - uses arrows only
- Metadata for visual hints (e.g., `isSymmetricalTarget`)

## Utilities

- `symmetry.ts`: Pre-computed hex symmetry map for O(1) lookups
- `targeting.ts`: Generic targeting utilities for simple skills
  - `getOpposingCharacters()`: Get all characters from the opposing team
  - `calculateDistances()`: Calculate distances from reference points
  - `sortByDistancePriorities()`: Sort candidates by distance with simple hex ID tie-breaking
  - `findBestTarget()`: Generic targeting function for skills without special logic
- Note: Complex skills like Silvina implement their own specialized targeting algorithms
