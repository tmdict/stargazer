# Companion Skills

A companion skill spawns extra units that live and die with the unit that summoned them: Phraesto's shadow, Lailah, Zanie's turrets, or a phantimal's partner. `createCompanionSkill` (`src/lib/skills/utils/builders.ts`) spawns and removes them, the `Grid` stores the links and the raised team size, and `src/lib/characters/` makes removing any member remove the whole unit.

A companion exists only through its owner's skill. `executePlaceCharacter` rejects companion ids, so nothing else can put one on a tile.

## Activation

1. Collect the free tiles of the team's own zone. Fewer than `count` throws before anything changes.
2. Raise the team's maximum size by `count`. If `setMaxTeamSize` refuses (a size above the tile count), the skill warns and spawns nothing, and the owner stays placed without companions.
3. Place each companion on a random free tile, link it to the owner, and apply its color and image modifiers.
4. Apply the owner's own color modifier.

If a companion fails to place, the skill removes the ones already placed, restores the team size and throws. `SkillManager` turns the throw into a failed activation, so the surrounding placement transaction rolls the owner back too. Deactivation removes each companion with its modifiers, clears the link set, and lowers the size by `count`, never below `BASE_TEAM_SIZE`.

## Capacity

A hero companion takes a team slot like any other unit. The size bump on activation is what keeps the owner's total cost at one slot.

Phantimals and everything in their id range hold no slot, so their companion skills pass `raisesCapacity: false`. Raising the size there would hand the team an extra hero slot. A phantimal's companion spawns even on a full team, because the capacity check skips its range.

## Ids and instance state

A companion's id is `N × 10000` plus the placed id of its owner (`ctx.characterId`), with N from 1. A synergy hero's companions therefore land in the synergy range and a phantimal's in the phantimal range, beside the base hero's and never colliding with them. `getMainCharacterId` subtracts the index instead of taking a modulo, so each companion resolves to its own owner. The id ranges are in [Grid & Characters](../GRID.md#unit-ids).

Links (`grid.companionLinks`, keyed `"${ownerId}-${team}"`) and color and image modifiers are keyed by the placed id and team, never the skill's config id. A synergy copy shares one skill object with its base hero, and config-keyed state would cross-wire the two. `tests/unit/skills/instanceIsolation.test.ts` checks this for every registered skill. The same hero on both teams keeps separate link sets.

## Removal

Removing a companion finds its owner on the same team and removes that instead. The owner's skill deactivates first, which removes the companions, and then the owner's tile is cleared. A companion whose owner is missing is cleared directly. Placing onto a companion's tile anchors the cleanup on the owner the same way, and `resolveReplacement` judges the drop as if the owner had already left.

Companions cannot move to the other team or swap across teams.

## Keeping positions

Reactivating a skill respawns companions on random tiles. Cross-team moves and swaps, and the placement rollback, therefore save companion tiles with `storeCompanionPositions` before deactivating and put them back with `restoreCompanions` afterwards, which also re-applies the modifiers. They restore only when `hasCompanionSkill` is true, and that is derived from the skill having a companion color or image modifier. A new companion skill must set at least one of the two, or rollbacks will leave its companions on random tiles.

Link restore and side-load call `repositionCompanions` for each owner right after placing it, so a random spawn never takes a tile a later unit needs. It lifts every companion off before placing any, so two companions can trade tiles, and it uses the raw place and remove primitives to avoid the removal cascade. It does not refresh skills, so callers refresh once at the end.

## Presentation

A companion's range is the skill's `companionRange`, falling back to its owner's range (`gameData.getCharacterRange`). Its portrait is the skill's `companionImageModifier`, falling back to the owner's portrait. A phantimal companion has no data file of its own, so both come from the owning phantimal's skill ([Seasonal Content](../SEASONAL.md)).

## Related documentation

- [Skills](../SKILLS.md): builders, the skill registry and `SkillManager`
- [Grid & Characters](../GRID.md): unit ids, placement rules and transactions
