# Companion Skills

## Overview

Companion skills spawn extra units (Phraesto's shadow, Lailah, Zanie's turrets) that share fate with the hero that summoned them. `createCompanionSkill` owns the spawn and teardown, the `Grid` stores the links and the raised capacity, and `lib/characters/` enforces the cascade so any member's removal takes the whole unit off the board.

## Design Principles

1. **Skill-owned units**: A companion exists only through `onActivate`; `executePlaceCharacter` rejects companion ids, so nothing else can put one on a tile
2. **Identity by id arithmetic**: `N * COMPANION_ID_OFFSET + mainId` encodes the main hero in the companion id, so no lookup table is needed to recover it
3. **Capacity stays balanced**: A companion occupies a normal slot; activation raises the team's max size by `count` and deactivation restores it, so the hero's own slot cost never changes
4. **One unit under removal**: Removing any member resolves to the main and deactivates its skill, which removes the rest
5. **Instance state keys by the placed id**: Links and modifiers key by `ctx.characterId` + team, never the config id, so a synergy copy and its base hero coexist without cross-wiring

## Factory (`/src/lib/skills/utils/builders.ts`)

`createCompanionSkill({ id, characterId, count?, colorModifier?, companionColorModifier?, companionImageModifier?, companionRange? })` returns the `Skill`; `count` defaults to 1 and the modifiers are copied onto the definition for the registry and the data store to read.

| Skill           | `characterId` | `count` | Companion presentation                              |
| --------------- | ------------- | ------- | --------------------------------------------------- |
| Phraesto        | 50            | 1       | crimson color, main hero white                      |
| Elijah & Lailah | 68            | 1       | rust color, range 1, plus line and paint decorators |
| Zanie           | 89            | 2       | `zanie-turret` image, range 3                       |

Activation, in order:

1. Collect free tiles in the team's own zone; fewer than `count` throws before anything changes
2. Raise the team's max size by `count` (`setMaxTeamSize` refuses a size above the tile count; the skill then warns and spawns nothing)
3. For each companion: `performPlace` on a random free tile, `addCompanionLink`, apply the companion color and image modifiers
4. Apply `colorModifier` to the main hero

A failed placement removes the companions already placed, restores the size, and throws, so the surrounding `executePlaceCharacter` transaction rolls the hero back as well. Deactivation removes each companion with its modifiers, clears the link set, and sets the size to `max(BASE_TEAM_SIZE, current - count)`.

## Ids and Links (`/src/lib/characters/companion.ts`)

- **Band**: `COMPANION_ID_OFFSET = 10000` (`grid.ts`), bounded above by `PHANTIMAL_ID_OFFSET = 100000`, so N runs 1 to 9; the synergy band repeats the layout at `SYNERGY_ID_OFFSET + N * 10000 + baseId` (see the namespace table in [GRID.md](../GRID.md))
- **Derived from the placed id**: the factory reads `ctx.characterId`, so a synergy hero's companions land in the synergy band beside the base hero's and the two never collide; `tests/unit/skills/instanceIsolation.test.ts` pins this for every registered skill
- **`isCompanionId`** classifies the `decomposeUnitId` local id; **`getMainCharacterId`** subtracts `floor(localId / 10000) * 10000` rather than taking a modulo, so a synergy companion resolves to the synergy main, never the base hero
- **`companionLinks`**: `Map<"${mainId}-${team}", Set<companionId>>` on the `Grid`; the same hero on both teams keeps independent sets
- **Save and restore**: `storeCompanionPositions` / `restoreCompanions` bracket the deactivate-reactivate cycle in `move.ts`, `swap.ts`, and the `place.ts` rollback, since reactivation respawns on random tiles; restore also re-applies the modifiers
- **`repositionCompanions`**: lifts every target off before placing any, so Zanie's two turrets can trade hexes, and uses the raw primitives to bypass the cascade. URL restore (`stores/urlState.ts`) and side-load (`stores/grids.ts`) call it per main right after that main is placed, so a random spawn never squats on a tile a later main needs

## Cascade and Capacity (`/src/lib/characters/remove.ts`, `place.ts`, `character.ts`)

- **Remove**: `executeRemoveCharacter` on a companion finds the main on the same team and recurses onto it; the main's removal deactivates the skill first, which removes the companions, then clears the main's tile. A companion whose main is missing is cleared directly
- **Replace**: placing onto a companion's tile anchors the cleanup on the main, so the whole unit leaves and `resolveReplacement` counts the anchor's slot as freed
- **Counting**: `getAvailableTeamSize` treats companions like any other occupant (only phantimals and the synergy hero are exempt); the activation bump is what keeps the hero's cost at one slot

## Presentation

- **`hasCompanionSkill`** (`registry.ts`) is derived from `companionColorModifier` or `companionImageModifier` on the definition; `place.ts`, `move.ts`, and `swap.ts` use it to decide whether a rollback has companions to restore
- **Range**: `gameData.getCharacterRange` returns the skill's `companionRange` for a companion id, else the main hero's range
- **Portrait**: `getCharacterImageNameById` uses `companionImageModifier` when set, else the main hero's name, matching what `GridCharacters` renders; the manager keys color and image modifiers by `characterId-team`, so the same companion id on both teams renders independently

## Related Documentation

- [`/docs/architecture/SKILLS.md`](../SKILLS.md) - Builders, SkillManager, and the activation contract
- [`/docs/architecture/GRID.md`](../GRID.md) - Unit id namespaces, transactions, and team capacity
