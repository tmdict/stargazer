# Targeting Skills

## Overview

Automatically select and track targets with colored arrows or tile highlights that update when characters move. The targeting system provides a unified, composable API split across three focused modules for distance-based, ring expansion, and symmetry-based targeting patterns.

## Architecture

The targeting system uses a functional composition approach with shared foundations and specialized modules:

```
┌───────────────────────┐
│  Skill Files          │
│  /skills/characters/  │
│                       │
│ silvina.ts            │
│ cassadee.ts           │───┐
│ reinier.ts            │   │
│ ...                   │   │
└───────────────────────┘   │
         ┌──────────────────┘
         ▼
┌──────────────-───┐  ┌──────────────┐  ┌─────────────────┐
│ utils/distance.ts│  │ utils/ring.ts│  │utils/symmetry.ts│
│                  │  │              │  │                 │
│ - findTarget()   │  │ - rowScan()  │  │ Pre-computed    │
│ - findRearmost   │  │ - searchBy   │  │ hex symmetry    │
│   Target()       │  │   Row()      │  │ map             │
│ - findFrontmost  │  │ - spiralSear │  │                 │
│   Target()       │  │   chFromTile │  │                 │
└────────┬─────────┘  └──────┬───────┘  └─────────────────┘
         │                   │
         ▼                   ▼
      ┌──────────────────────────┐
      │ utils/targeting.ts       │
      │                          │
      │ - getTeamTargetCandidates│
      │ - getCandidates()        │
      │ - calculateDistances()   │
      └──────────────────────────┘
```

## Implementation

### Shared Foundations (`utils/targeting.ts`)

Provides the base types and utilities used by both distance and ring modules:

- **TargetCandidate**: Core type with `hexId`, `characterId`, and distance map
- **getTeamTargetCandidates()**: Retrieves all characters on a given team
- **getCandidates()**: Gets candidates with optional self-exclusion
- **calculateDistances()**: Calculates distances from reference points

### Distance-Based Targeting (`utils/distance.ts`)

Selects targets by comparing distances from a reference point:

- **CLOSEST**: Find nearest target (used by Nara/Silvina from symmetrical point)
- **FURTHEST**: Find furthest target (used by Dunlingr/Vala)
- **REARMOST**: Find rearmost target by hex ID position (used by Bonnie)
- **FRONTMOST**: Find frontmost target by hex ID position

### Ring Expansion Targeting (`utils/ring.ts`)

Expands outward ring by ring from a center hex, checking tiles in order:

- **spiralSearchFromTile()**: Spiral walk with team-specific direction (clockwise for ally, counter-clockwise for enemy)
- **searchByRow()**: Finds closest target in the same diagonal row
- **rowScan()**: Ring expansion with hex ID ordering controlled by `RowScanDirection`

### Row Scan Direction (`RowScanDirection`)

Controls the hex ID sort order within each ring during `rowScan`:

- **FRONTMOST**: Ally scans highest→lowest hex ID, Enemy scans lowest→highest (used by Aliceth)
- **REARMOST**: Ally scans lowest→highest hex ID, Enemy scans highest→lowest (used by Cassadee)

### Tie-Breaking Strategy

When multiple candidates are at the same distance, the system applies team-aware hex ID tie-breaking:

- Ally team prefers lower hex IDs
- Enemy team prefers higher hex IDs (180° rotation symmetry)

## Lifecycle Management

All targeting skills follow the same lifecycle pattern:

```typescript
onActivate: calculateTarget() → setSkillTarget()
onUpdate: recalculate when grid changes → setSkillTarget()
onDeactivate: clearSkillTarget()
```

Visual feedback options:

- **Arrow color**: Via `targetingColorModifier` (e.g., Dunlingr, Aliceth)
- **Tile border color**: Via `tileColorModifier` and `setTileColorModifier()` (e.g., Reinier, Cassadee)

## Adding New Targeting Skills

1. **Determine targeting pattern**:
   - Distance-based? Use `findTarget()` from `distance.ts`
   - Ring expansion? Use `rowScan()` or `spiralSearchFromTile()` from `ring.ts`
   - Same diagonal row? Use `searchByRow()` from `ring.ts`
   - Symmetrical tile? Use `getSymmetricalHexId()` from `symmetry.ts`

2. **Use existing utilities**:

   ```typescript
   function calculateTarget(context: SkillContext): SkillTargetInfo | null {
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
