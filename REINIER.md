## Reinier Skill

### Description

Reinier's skill is a target-based skill that adds visual indicators to the grid when Reinier is on the map.

When placed on the grid, Reinier targets an adjacent ally position with an enemy hero, if both the ally and enemy are placed on a symmetrical tile.

When Reinier is removed from the grid, deactivate his skill.

### Symmetrical Tile

An Ally and an Enemy are considered on a symmetrical, if the tile is on the opposite side of the grid across the diagonal, use DIAGONAL_ROWS from `src/lib/types/grid.ts` as reference.

The symmetrical calculation should re-use the same implementation in `src/lib/skills/symmetry.ts` (if needed, can update this file if needed to make it more general purpose, since other skills may need it as well)

### Tie Breaking

If multiple allies are neighbors, apply a tie-breaking logic. To understand this logic, we need to establish the geometric context:

We are working with hex tiles, each with 6 neighbors, so using tile 9 as an example, if tile 9 is in the center, and tile 7 is to its left, the going counter-clockwise starting from 7, the neighbor tile IDs will be 7, 4, 6, 12, 16, 13.

Now that the context is establish, the absolute priority when there are multiple allies in neighbor tiles, is as follows: 4 > 7 > 6 >12 > 13 > 16

The above priority is for Ally targeting enemy. If Reinier is on the enemy team, and targeting is from enemy to ally, the priority order should be reversed, or think of it as rotated by 180 degrees. So if enemy Reinier is standing on tile 37, and there are multiple neighbors, the absolute tie-breaking priority is: 42 > 39 > 40 > 34 > 33 > 30

The tile IDs above are purely for illustrations, but hte positional priority should apply regardless of the tile we're working with. Try to detect a pattern for this tie-breaking logic if possible, as I prefer not having to hardcode the logic.

### Visual Modifier

The visual modifier for Reinier's skill will be to change the border color of the ally and enemy tiles to the color defined in reinier.ts's `tileColorModifier`

The border style should be similar to existing tile borders, however the skill tile border color should override all other tile border colors when Reinier is on the field and the skill is active.

The tile border color should also be controlled by the Skills toggle button from GridControls.vue, so when Skills is unchecked, tile border will not be overriden.
