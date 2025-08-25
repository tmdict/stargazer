# Targeting Skills

## Overview

Automatically select and track enemy targets with colored arrows that update when characters move. The targeting system provides a unified, composable API for various targeting patterns while eliminating code duplication.

## Architecture

The targeting system uses a functional composition approach with reusable utilities:

```
┌─────────────────┐
│  Skill Files    │
│                 │
│ silvina.ts      │
│ vala.ts         │──────┐
│ reinier.ts      │      │
│ ...             │      │
└─────────────────┘      │
                         ▼
              ┌─────────────────────────┐
              │ utils/targeting.ts      │
              │                         │
              │ - findTarget()          │
              │ - spiralSearchFromTile()│
              │ - getTeamCharacters()   │
              │ - calculateDistances()  │
              └─────────────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ utils/symmetry.ts│
              │                  │
              │ Pre-computed hex │
              │ symmetry map     │
              └──────────────────┘
```

## Implementation

### Targeting Methods (`TargetingMethod`)

- **CLOSEST**: Find nearest target (used by Nara/Silvina from symmetrical point)
- **FURTHEST**: Find furthest target (used by Dunlingr/Vala)
- **REARMOST**: Find rearmost target based on hex ID scanning (used by Bonnie)

### Tie-Breaking Strategy

When multiple candidates are at the same distance, the system automatically applies team-aware hex ID tie-breaking:

- Ally team prefers lower hex IDs
- Enemy team prefers higher hex IDs (180° rotation symmetry)

### Main Targeting Function

```typescript
export function findTarget(context: SkillContext, options: TargetingOptions): SkillTargetInfo | null
```

Handles common targeting patterns:

- Team selection (same team or opposing)
- Self-exclusion for same-team targeting
- Distance-based selection (closest/furthest)
- Automatic team-aware hex ID tie-breaking

### Spiral Search Function

```typescript
export function spiralSearchFromTile(
  grid: Grid,
  centerHexId: number,
  targetTeam: Team,
  casterTeam: Team,
): SkillTargetInfo | null
```

Specialized function for spiral search pattern:

- Expands ring by ring from center point
- Team-specific walk direction for consistent behavior
- Returns first target found in spiral order

## Lifecycle Management

All targeting skills follow the same lifecycle pattern:

```typescript
onActivate: calculateTarget() → setSkillTarget()
onUpdate: recalculate when grid changes → setSkillTarget()
onDeactivate: clearSkillTarget()
```

Key features:

- Visual feedback via `targetingColorModifier` (arrow color)
- Dynamic updates through `onUpdate` lifecycle
- No border changes - uses arrows only
- Metadata for visual hints (e.g., `isSymmetricalTarget`, `examinedTiles`)

## Adding New Targeting Skills

To add a new targeting skill:

1. **Determine targeting pattern**:

   - Same team or opposing team?
   - Closest or furthest?
   - Special requirements (symmetrical, adjacent, etc.)?

2. **Use existing utilities when possible**:

   ```typescript
   function calculateTarget(context: SkillContext): SkillTargetInfo | null {
     // For standard patterns, use findTarget()
     return findTarget(context, {
       targetTeam: getOpposingTeam(context.team),
       targetingMethod: TargetingMethod.CLOSEST,
     })
   }
   ```

3. **Implement custom logic only if needed**:
   - Complex multi-step targeting (like Reinier)
   - Non-standard tie-breaking rules
   - Special validation requirements
