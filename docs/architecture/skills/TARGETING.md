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

- **spiralSearchFromTile()**: Spiral walk by angle from a center tile, team-specific direction (clockwise for ally, counter-clockwise for enemy). Used by Silvina/Nara from a symmetrical tile.
- **searchByRow()**: The closest unit in the caster's _own_ diagonal row, tie-broken target-relative like `rowScan` (the searched team's frontmost unit wins: higher hex id for ally, lower for enemy). Used by Aliceth/Alna.
- **rowScan()**: The diagonal-row scan below. Used by Faramor, Cassadee, Galahad, Himmel, Hepler, and Aliceth's fallback.

### Diagonal-row scan (`rowScan`)

The arena's only meaningful "row" is the **diagonal row**: `Hex.getDiagonal() = q - r`. Hex ids increase along these rows from a team's back to its front, and the two teams face across the centre, so the enemy team is a 180° flip of both axes. `rowScan` expands distance rings from the caster and, within a ring, orders candidates by **diagonal row, then hex id within a row**. Two independent `ScanDirection` knobs choose which end of the _scanned team's_ front-to-back axis comes first:

- **rowDirection**: which diagonal rows first (`REARMOST` = the team's back rows).
- **withinRowDirection**: which unit of a shared row first (`REARMOST` = the lower hex id). Defaults to `rowDirection`; set it explicitly only for a mixed scan.

Scan key: `(distance asc, diagonal by rowDirection, hex id by withinRowDirection)`. Because ids run in diagonal-row order, when the two directions agree the ordering within each distance ring reduces to a plain hex-id sort (distance still ranks first); only the mixed pair needs the explicit diagonal tier.

|                     | within: REARMOST (lower id) | within: FRONTMOST (higher id) |
| ------------------- | --------------------------- | ----------------------------- |
| **rows: REARMOST**  | Faramor, Cassadee, Galahad  | Himmel                        |
| **rows: FRONTMOST** | (valid, currently unused)   | Aliceth fallback, Hepler      |

Options: `{ team, rowDirection, withinRowDirection?, maxDistance?, filter? }`. `maxDistance: 1` limits the scan to adjacent tiles; `filter` keeps only candidates whose id passes a predicate (class selection for Himmel, companion exclusion for Galahad).

**When NOT to use `rowScan`**: it expresses any monotone `(distance, diagonal row, hex id)` ordering. A pick that alternates within-row direction, is gated on another tile (Reinier's symmetrical-enemy check), or composes stages (Aliceth's same-row-first plus a furthest-enemy target) stays in the character file rather than being forced into options.

### Tie-Breaking Strategy (distance helpers)

`rowScan`'s diagonal-then-id key is already a total order, so it needs no tie-break. The distance helpers in `distance.ts` do: when candidates share a distance they break the tie by team-aware hex id, ally preferring lower ids and enemy higher (the 180° rotation).

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
   - Multi-tile cosmetic zones (like Kulu, which paints a demolition zone)
   - Companion spawning (like Phraesto, Zanie)

   In those cases, declare a local `const TILE_COLOR = '#xxx'` for any tile color and pass the skill object directly to `registerSkill({...})`. See [SKILLS.md](../SKILLS.md#pattern-3-custom-lifecycle-companions-multi-tile-zones-etc) for a full example.
