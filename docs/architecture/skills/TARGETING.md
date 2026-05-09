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
- **Tile border color**: Via `setTileColorModifier()` on the SkillManager (e.g., Reinier, Cassadee)

## Adding New Targeting Skills

1. **Pick a builder** from `src/lib/skills/utils/builders.ts`:
   - `createTargetingSkill` — arrow-based skills (single or self-built multi-arrow)
   - `createTileHighlightSkill` — single-tile highlights with previous-target cleanup
   - Custom `registerSkill({...})` — only when neither lifecycle fits (e.g. multi-tile pairs like Reinier)

2. **Pick a calculation utility** for `calculateTarget`:
   - Distance-based? `findTarget()` from `distance.ts`
   - Ring expansion? `rowScan()` or `spiralSearchFromTile()` from `ring.ts`
   - Same diagonal row? `searchByRow()` from `ring.ts`
   - Symmetrical tile? `getSymmetricalHexId()` from `symmetry.ts`

3. **Wire it up**:

   ```typescript
   registerSkill(
     createTargetingSkill({
       id: 'my-skill',
       characterId: 123,
       name: 'Skill Name',
       description: '...',
       color: '#hexcolor',
       arrowType: 'enemy',
       calculateTarget: (ctx) =>
         findTarget(ctx, {
           targetTeam: getOpposingTeam(ctx.team),
           targetingMethod: TargetingMethod.CLOSEST,
         }),
     }),
   )
   ```

4. **Drop down to a custom lifecycle only when needed**:
   - Complex multi-step targeting (like Reinier — highlights ally + symmetrical enemy pair)
   - Multi-tile zones with state changes (like Kulu — paints a demolition zone)
   - Companion spawning (like Phraesto, Zanie)

   In those cases, declare a local `const TILE_COLOR = '#xxx'` for any tile color and pass the skill object directly to `registerSkill({...})`. See [SKILLS.md](../SKILLS.md#pattern-3-custom-lifecycle-companions-multi-tile-zones-etc) for a full example.
