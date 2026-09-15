# Targeting Skills

## Overview

Targeting helpers pick the unit a skill's arrow or highlight points at and are re-run on every grid change through the builder lifecycle. Three modules cover the three selection shapes: distance and formation ends (`distance.ts`), ring and diagonal-row scans (`ring.ts`), and the board mirror (`symmetry.ts`), all over the candidate list from `targeting.ts`.

## Design Principles

1. **One board orientation**: Ally ids rise toward the enemy side and enemy ids fall toward the ally side, so every helper flips its scan for the enemy team
2. **Formation ends belong to the target team**: Frontmost and rearmost are read off the searched team, so an artifact with no caster gets the same answer as a hero
3. **Explicit total orders**: Every sort key runs down to hex id, so a formation always yields one pick and the tie rule is visible in the helper
4. **Pure over the grid**: A helper reads `SkillContext` and returns `SkillTargetInfo | null`; the builder decides what to draw or clear
5. **Monotone rules only**: A pick that alternates direction or is gated on another tile stays in its character file instead of growing a helper's option set

## Candidates (`/src/lib/skills/utils/targeting.ts`)

- **Candidate list**: `getTeamTargetCandidates` returns every occupied tile of a team (companions, phantimals, and placeholders included); `getCandidates` drops one id for self-exclusion; `calculateDistances` fills each candidate's `distances` map per reference hex
- **Adjacent priority chain**: `findAdjacentPriorityTarget` (Daimon, phantimal Spirit Marks) checks up to three neighbours toward the team's back or front: straight behind or ahead, then the caster-row side neighbour, then the remaining diagonal (direction indices 3, 4, 2 toward high r; 0, 1, 5 toward low r); off-board neighbours drop out of the chain
- **Straight behind only**: `findUnitBehind` (Gunnar, Hugin, Thador) targets the tile directly behind the caster and nothing else, even when a back-row diagonal exists

## Distance and Formation Ends (`/src/lib/skills/utils/distance.ts`)

`findTarget(ctx, { targetTeam, targetingMethod, excludeSelf?, referenceHexId? })` dispatches on `TargetingMethod`:

| Method      | Pick                                                      | Caster excluded              | Users                                          |
| ----------- | --------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| `FURTHEST`  | Greatest distance from `referenceHexId` (default: caster) | Only with `excludeSelf`      | Dunlingr, Vala, Aliceth (enemy arrow)          |
| `REARMOST`  | Lowest id on an ally team, highest on an enemy team       | `excludeSelf`, own team only | Evie, Pandora; Bonnie via `findRearmostTarget` |
| `FRONTMOST` | Highest id on an ally team, lowest on an enemy team       | Always, own team only        | Talene, Frieren, Isabella                      |

- **FURTHEST tie-break**: Equal distances resolve by the caster's team: an ally caster prefers the lower hex id, an enemy caster the higher (the 180° rotation). The end picks cannot tie because ids are unique
- **Whole-team picks**: `frontmostUnit(grid, team)` / `rearmostUnit(grid, team)` need no caster; artifact targeting uses them so companions and phantimals count exactly as in hero skills
- **Metadata**: the `is*Target` flags and `examinedTiles` serve `DebugPanel` only; nothing in the render path reads them

## Ring and Row Scans (`/src/lib/skills/utils/ring.ts`)

The arena's only meaningful row is the diagonal row, `Hex.getDiagonal() = q - r`. Hex ids increase along a row from a team's back to its front, and the enemy team is a 180° flip of both axes, so `ScanDirection` (`FRONTMOST` / `REARMOST`) names an end of the scanned team's axis and each helper resolves it per team.

### `rowScan(ctx, { team, rowDirection, withinRowDirection?, maxDistance?, filter? })`

Expands distance rings from the caster and orders each ring by diagonal row, then hex id within a row. Scan key: `(distance asc, diagonal by rowDirection, hex id by withinRowDirection)`, a total order with no separate tie-break.

- **Two independent knobs**: `rowDirection` picks which rows come first; `withinRowDirection` picks which unit of a shared row and defaults to `rowDirection`. Because ids run in diagonal-row order, an aligned pair reduces to a plain id sort within each ring; only a mixed pair needs the explicit diagonal tier
- **`maxDistance: 1`** confines the scan to the six neighbours; **`filter`** keeps candidates whose id passes a predicate (class for Himmel, companion exclusion for Galahad)

|                       | within: `REARMOST` (lower id) | within: `FRONTMOST` (higher id) |
| --------------------- | ----------------------------- | ------------------------------- |
| **rows: `REARMOST`**  | Faramor, Cassadee, Galahad    | Himmel, Niru                    |
| **rows: `FRONTMOST`** | (valid, unused)               | Aliceth fallback, Hepler        |

**Not a `rowScan`**: a pick that alternates within-row direction, is gated on another tile (Reinier's mirror-holds-enemy check), or composes stages (Aliceth's same-row-first plus a furthest enemy) stays in the character file rather than being forced into options.

### `searchByRow(ctx, targetTeam)` (Aliceth, Alna)

Only the caster's own diagonal row; closest first, ties to the searched team's frontmost unit (higher id on an ally team, lower on enemy). Aliceth falls back to `rowScan` with `FRONTMOST` rows; her own row is empty whenever the fallback runs, so it needs no exclusion.

### `spiralSearchFromTile(grid, centerHexId, targetTeam, casterTeam)` (Silvina, Nara)

Rings of distance 1 outward from a centre hex, tiles within a ring ordered by angle: an ally caster walks clockwise from just past top-right, an enemy caster counter-clockwise from just past bottom-left. The centre tile itself is not examined; callers test it first and reach the spiral only when it holds no enemy. `metadata.isSymmetricalTarget` is `false` on a spiral hit and `true` on a direct mirror hit, which the debug panel labels.

## Symmetry (`/src/lib/skills/utils/symmetry.ts`)

- **`getSymmetricalHexId(grid, hexId)`** swaps q and r, a reflection across the board's middle diagonal (the q = r line), valid on any grid because `q + r + s` stays 0; returns `undefined` when the mirror is off-grid, and a middle-diagonal hex mirrors to itself
- **Users**: Silvina and Nara (mirror first, then spiral), Evie (paints the mirror and its six neighbours that lie in the enemy zone), Reinier (an adjacent ally qualifies only when its mirror holds an enemy)

## Lifecycle

`createTargetingSkill` runs `calculateTarget` on activate and on every update, stores a hit with `setSkillTarget` and clears a miss; deactivate clears. Arrow color is the config `color` (`targetingColorModifier`).

- **`arrowType` set**: the factory adds one caster-to-target arrow, and a hit requires a concrete `targetHexId`
- **`arrowType` omitted**: `calculateTarget` fills `metadata.arrows` itself and leaves `targetHexId` null (Ravion's two rearmost allies, Aliceth's ally plus enemy)
- **Tile instead of arrow**: `createTileHighlightSkill` paints the target's border (or fill) and unpaints the previous target before repainting; a hand-written lifecycle (Reinier) calls `setSkillTarget` and `paintTiles` itself

See [Adding a Skill](../SKILLS.md#adding-a-skill) for the factory and file conventions.

## Related Documentation

- [`/docs/architecture/SKILLS.md`](../SKILLS.md) - Builders, SkillManager, and artifact targeting
- [`/docs/architecture/GRID.md`](../GRID.md) - Hex coordinates, the fixed engine orientation, and unit id bands
