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

## Examples

**Silvina** (ID: 39) - First Strike:

- Green arrows
- Targets enemy on symmetrical hex position
- Falls back to closest enemy when symmetrical hex is empty
- Uses pre-computed map for O(1) symmetry lookups
- **Diagonal-aware tie-breaking**: When multiple enemies are equidistant from the symmetrical tile, uses zone-based logic determined by a diagonal line through tiles 4,9,16,23,30,37,42
  - LEFT zone (tiles 30,33,36,39,41): Prefers lower hex ID
  - RIGHT zone (tiles 34,38,40,43,44,45): Prefers higher hex ID
  - ON diagonal (tiles 37,42): Prefers lower hex ID

**Vala** (ID: 46) - Assassin:

- Purple arrows
- Targets the furthest opposing character from Vala's position
- **Simple tie-breaking**: When multiple enemies are equidistant at maximum range:
  - Ally team Vala: Prefers lower hex ID
  - Enemy team Vala: Prefers higher hex ID (180° rotation)
- Clean implementation without complex fallback logic

## Utilities

- `symmetry.ts`: Pre-computed hex symmetry map
- `targeting.ts`: Opposing character enumeration and distance sorting
  - `getOpposingCharacters()`: Get all characters from the opposing team
  - `calculateDistances()`: Calculate distances from reference points
  - `sortByDistancePriorities()`: Sort candidates by distance with tie-breaking
