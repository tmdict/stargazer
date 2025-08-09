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

## Example

**Silvina** (ID: 39) - First Strike:
- Green arrows (`#73be25`)
- Targets enemy on symmetrical hex position
- Falls back to closest enemy when symmetrical hex is empty
- Uses pre-computed map for O(1) symmetry lookups

## Utilities

- `symmetry.ts`: Pre-computed hex symmetry map
- `targeting.ts`: Enemy enumeration and distance sorting