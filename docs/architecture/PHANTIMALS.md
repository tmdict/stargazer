# Phantimals

Phantimals are a seasonal unit type that can be placed on the grid alongside
characters. They occupy cells, can be swapped/moved, and participate in targeting
and pathfinding exactly like characters — with two deliberate differences:

1. **They don't count toward team size.**
2. **At most one phantimal per team** may be on the field; placing a new one
   replaces the team's current phantimal.

They are documented separately (and kept modular) because the season they belong
to may rotate out; see [Modularity & removability](#modularity--removability).

## Approach: a namespaced unit

The grid stores a single occupant per tile (`GridTile.characterId` / `team`).
Targeting (`lib/skills/utils/targeting.ts`), pathfinding (`lib/pathfinding.ts`),
swap/move and occupancy all read from that slot, **not** from the character
store. So a phantimal placed in the same slot is treated as "another unit on the
grid" for free.

Phantimals are distinguished by an **ID namespace**, the same technique already
used for companions (`companionIdOffset = 10000`):

- `lib/characters/phantimal.ts` owns `PHANTIMAL_ID_OFFSET = 20000` plus the pure
  helpers `isPhantimalId`, `toPhantimalId(localId)`, `toLocalPhantimalId(id)`.
- A tile whose `characterId >= PHANTIMAL_ID_OFFSET` holds phantimal
  `characterId - PHANTIMAL_ID_OFFSET` (local IDs come from
  `src/data/seasonal/phantimal/*.json`).
- `grid.ts` imports the constant as `Grid.phantimalIdOffset`. `isCompanionId` is
  bounded by it (`>= companionIdOffset && < phantimalIdOffset`) so phantimal IDs
  are never mistaken for companions.

Because the simulation is ID-agnostic, the only code that needs phantimal
awareness is the small set of seams below.

## The seams

| Concern                  | Where                                                                | What changes                                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team-size exemption      | `place.ts` (`performPlace`)                                          | Phantimals are not added to the `teamCharacters` capacity set.                                                                                            |
| Capacity/duplicate check | `character.ts` (`canPlaceCharacterOnTeam`)                           | Returns `true` for phantimal IDs.                                                                                                                         |
| One-per-team replace     | `stores/character.ts` (`placePhantimalOnHex` / `autoPlacePhantimal`) | Clears the team's existing phantimal (`findTeamPhantimalHex`) before placing. Cross-team moves route through the same clear in `handleCharacterDrop`.     |
| Data lookup              | `stores/gameData.ts`                                                 | `getPhantimalById`; `getCharacterRange`/`getCharacterNameById` short-circuit phantimal IDs.                                                               |
| On-grid rendering        | `components/grid/GridCharacters.vue`                                 | An `isPhantimalId` branch swaps the image source (remote `phantimalImageSources`) and colour; all positioning, drag, lift and perspective code is reused. |
| Roster                   | `components/PhantimalSelection.vue`                                  | Draggable + tap-to-place + placed state, mirroring the character roster; the info modal stays reachable via the pill.                                     |
| URL serialization        | see below                                                            | Dedicated `p` section.                                                                                                                                    |

Skills: phantimals participate **passively** — they occupy cells and are valid
targets, but have no engine-active abilities (`hasSkill` is false for them, so no
activation is attempted). Placing/removing one still re-runs targeting for other
units because it flows through the normal placement path.

Targeting range: a phantimal's `range` (from its data file) is used when it acts
as a targeting _source_ for the on-grid arrows. `getCharacterRange` returns it,
and the pathfinding store adds on-grid phantimals to the per-unit range map it
passes to `getClosestTargetMap` (the static map is keyed by character id only).

## URL serialization

Phantimal IDs (20000+) don't fit the character section's 14-bit ID field, so they
get their own section rather than overloading `c`:

- `GridState.p`: `[hexId, localPhantimalId, team][]` (`gridStateSerializer.ts`).
- `binaryEncoder.ts`: a phantimal section after artifacts — a 4-bit count then
  `hexId(6) + localId(4) + team(1)` per entry. Presence is flagged by **bit 6 of
  the extended-flags byte** (previously reserved), which forces extended mode.
- `urlState.ts` restores phantimals via `placePhantimalOnHex` after characters
  and artifacts.

**Backward compatible:** old URLs have the flag unset, so the decoder never reads
the section; a state with no phantimals encodes byte-for-byte as before.

## Modularity & removability

Everything phantimal-specific is reachable from a short list of seams, each keyed
on `isPhantimalId` or living in a dedicated file. To retire the feature:

1. Delete `lib/characters/phantimal.ts`, `PhantimalSelection.vue`,
   `modals/PhantimalModal.vue`, the phantimal data/locale files, and this doc.
2. Remove the phantimal section from `binaryEncoder.ts` / `gridStateSerializer.ts`
   / `urlState.ts` (the `p` field) and the `getPhantimalById` accessor.
3. Drop the `!isPhantimalId(...)` guards (they collapse to "always a character"),
   the `GridCharacters` render branch, and `Grid.phantimalIdOffset` (restoring
   `isCompanionId` to a single lower bound).

The `GridTile` model, targeting, pathfinding, swap/move, and the `c` URL section
were never modified for phantimals, so nothing there needs reverting.
