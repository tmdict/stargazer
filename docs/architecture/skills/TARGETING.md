# Targeting Skills

Targeting helpers pick the unit a skill's arrow or highlight points at. They run again on every grid change, so each one must give exactly one answer for a formation. The helpers live in `src/lib/skills/utils/`: distances and formation ends in `distance.ts`, row and ring scans in `ring.ts`, the board mirror in `symmetry.ts`, and the candidate list and adjacent-tile picks in `targeting.ts`. Each reads a `SkillContext` and returns a target or `null`, and the builder decides what to draw.

## One board orientation

The engine never rotates the board ([Grid & Characters](../GRID.md#invert)). Ally hex ids rise toward the enemy side and enemy ids fall toward the ally side, and the enemy half is a 180° turn of the ally half. Every helper is therefore written once for the ally team and flips its scan direction for the enemy team.

Formation ends belong to the team being searched. The frontmost unit of an ally team is its highest id and of an enemy team its lowest, whoever is asking. That is why artifact targeting, which has no caster, can call the same code (`rearmostUnit`) and get the same answer a hero would.

Every sort key runs down to hex id, so a tie always has a written rule. The furthest-unit pick breaks equal distances by the caster's team: an ally caster prefers the lower id, an enemy caster the higher. Formation ends cannot tie, because ids are unique.

## Candidates

A team's candidates are every occupied tile of that team, companions, phantimals and placeholders included. A helper that targets the caster's own team drops the caster by id.

Two adjacent-tile picks look easy to merge but differ on purpose. `findAdjacentPriorityTarget` (Daimon, phantimal Spirit Marks) tries up to three neighbours toward the team's back or front: straight behind or ahead, then the side neighbour in the caster's row, then the other diagonal. Neighbours off the board drop out of the chain. `findUnitBehind` (Gunnar, Hugin, Thador) checks only the tile straight behind and ignores the diagonals even when they exist.

## Row scans

The only row that matters on this board is the diagonal row, `q - r` (`Hex.getDiagonal`). Hex ids increase along a row from a team's back to its front. `ScanDirection` names one end of the scanned team's axis (`FRONTMOST` or `REARMOST`), and each helper resolves it per team.

`rowScan` sorts candidates by distance from the caster, then by diagonal row in `rowDirection`, then by hex id in `withinRowDirection`. The within-row direction defaults to the row direction. When the two agree, the order inside each distance ring is a plain id sort, because ids follow the rows. Only a mixed pair needs the explicit row tier. `maxDistance: 1` limits the scan to the six neighbours, and `filter` keeps candidates whose id passes a predicate.

|                   | within: `REARMOST` (lower id) | within: `FRONTMOST` (higher id) |
| ----------------- | ----------------------------- | ------------------------------- |
| rows: `REARMOST`  | Faramor, Cassadee, Galahad    | Himmel, Niru                    |
| rows: `FRONTMOST` | (valid, unused)               | Aliceth fallback, Hepler        |

`searchByRow` (Aliceth, Alna) looks only at the caster's own diagonal row, closest first, with ties going to the searched team's frontmost unit. Aliceth falls back to `rowScan` with `FRONTMOST` rows. Her own row is always empty when the fallback runs, so the fallback needs no exclusion.

## Mirror and spiral

`getSymmetricalHexId` swaps q and r, which reflects a hex across the board's middle diagonal and keeps `q + r + s = 0`. It returns `undefined` when the mirror falls off the grid, and a hex on the middle diagonal mirrors to itself.

`spiralSearchFromTile` (Silvina, Nara) walks rings outward from a centre hex. Within a ring an ally caster walks clockwise from just past top-right, and an enemy caster counter-clockwise from just past bottom-left. It never examines the centre tile, so callers test the mirror tile first and reach the spiral only when it holds no enemy.

## When not to extend a helper

The shared helpers cover orderings that run one way along a team's axis. Keep a rule in its character file when it alternates direction, depends on another tile, or chains stages. Reinier accepts an adjacent ally only when that ally's mirror holds an enemy. Aliceth combines a same-row search with a furthest-enemy pick. Each would add an option to `rowScan` that only one caller uses.

## Drawing the result

`createTargetingSkill` runs the pick on activate and on every update, stores a hit with `setSkillTarget`, and clears a miss. With `arrowType` set, the factory draws one arrow from caster to target, and a hit needs a concrete `targetHexId`. With it omitted, the skill fills `metadata.arrows` itself (Ravion's two rearmost allies, Aliceth's ally and enemy). `createTileHighlightSkill` paints the target tile instead and unpaints the previous target before repainting. The `is*Target` flags and `examinedTiles` in the metadata serve only the debug panel.

## Related documentation

- [Skills](../SKILLS.md): builders, the skill registry and artifact targeting
- [Pathfinding](../PATHFINDING.md): the closest-enemy search behind attack arrows
- [Grid & Characters](../GRID.md): hex coordinates and unit ids
