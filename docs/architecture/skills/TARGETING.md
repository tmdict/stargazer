# Targeting Skills

## Overview

Automatically select and track enemy targets with colored arrows that update when characters move. The targeting system provides a unified, composable API for various targeting patterns while eliminating code duplication.

## Architecture

The targeting system uses a functional composition approach with reusable utilities:

```
┌─────────────────┐
│  Skill Files    │
│                 │
│ dunlingr.ts     │
│ vala.ts         │──────┐
│ silvina.ts      │      │
│ nara.ts         │      │
└─────────────────┘      │
                         ▼
              ┌──────────────────┐
              │ utils/targeting.ts│
              │                  │
              │ - findTarget()   │
              │ - spiralSearchFromTile()
              │ - getTeamCharacters()
              │ - calculateDistances()
              └──────────────────┘
                         │
                         ▼
              ┌──────────────────┐
              │ utils/symmetry.ts│
              │                  │
              │ Pre-computed hex │
              │ symmetry map     │
              └──────────────────┘
```

## Core Components

### Targeting Methods (`TargetingMethod`)

- **CLOSEST**: Find nearest target (used by Nara/Silvina from symmetrical point)
- **FURTHEST**: Find furthest target (used by Dunlingr/Vala)

### Tie-Breaking Strategy

When multiple candidates are at the same distance, the system automatically applies team-aware hex ID tie-breaking:
- Ally team prefers lower hex IDs
- Enemy team prefers higher hex IDs (180° rotation symmetry)

### Main Targeting Function

```typescript
export function findTarget(
  context: SkillContext,
  options: TargetingOptions
): SkillTargetInfo | null
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
  casterTeam: Team
): SkillTargetInfo | null
```

Specialized function for Nara/Silvina's spiral search pattern:
- Expands ring by ring from center point
- Team-specific walk direction for consistent behavior
- Returns first target found in spiral order

## Implementation Patterns

### Simple Furthest Targeting (Vala)

```typescript
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: getOpposingTeam(context.team),
    targetingMethod: TargetingMethod.FURTHEST,
  })
}
```

### Same-Team Targeting (Dunlingr)

```typescript
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  return findTarget(context, {
    targetTeam: context.team,
    excludeSelf: true,
    targetingMethod: TargetingMethod.FURTHEST,
  })
}
```

### Symmetrical + Spiral Targeting (Silvina/Nara)

```typescript
function calculateTarget(context: SkillContext): SkillTargetInfo | null {
  const { grid, team, hexId } = context
  const opposingTeam = getOpposingTeam(team)
  const symmetricalHexId = getSymmetricalHexId(hexId)
  
  // Priority 1: Check for enemy on symmetrical tile
  const symmetricalTile = grid.getTileById(symmetricalHexId)
  if (symmetricalTile?.characterId && symmetricalTile.team === opposingTeam) {
    return { /* target on symmetrical tile */ }
  }
  
  // Priority 2: Spiral search from symmetrical position
  return spiralSearchFromTile(grid, symmetricalHexId, opposingTeam, team)
}
```

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

## Utilities

### Core Targeting (`utils/targeting.ts`)

The main targeting utilities module provides:

- **Team Selection**:
  - `getTeamCharacters()`: Get all characters from a specific team
  - `getOpposingTeam()`: Get the opposing team
  - `getCandidates()`: Get candidates with optional self-exclusion

- **Distance Calculation**:
  - `calculateDistances()`: Batch distance calculations from reference points

- **Target Selection**:
  - `findTarget()`: Main targeting function with options
  - `spiralSearchFromTile()`: Specialized spiral search from a specific tile for Nara/Silvina

- **Helpers**:
  - `sortByTargetingMethod()`: Sort candidates by distance preference
  - `applyHexIdTieBreaker()`: Apply team-aware hex ID tie-breaking

### Symmetry Utilities (`utils/symmetry.ts`)

Pre-computed hex symmetry map for O(1) lookups:
- `getSymmetricalHexId()`: Get symmetrical hex for any position
- Used by Silvina, Nara, and Reinier for symmetrical tile checks

## Performance Optimizations

- **Efficient Grid Queries**: Uses `getTilesWithCharacters()` to avoid iterating all tiles
- **Batch Distance Calculations**: Calculate all distances in single pass
- **Early Termination**: Spiral search stops as soon as target found
- **Pre-computed Lookups**: Symmetry map avoids runtime calculations

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

## Benefits of the Refactored System

- **DRY Principle**: ~300+ lines of duplicate code eliminated
- **Single Source of Truth**: All targeting logic centralized
- **Maintainability**: Bug fixes apply to all skills automatically
- **Extensibility**: New skills can easily reuse patterns
- **Consistency**: Team-aware behavior guaranteed across all skills
- **Documentation**: Self-documenting function signatures