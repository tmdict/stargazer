# Phantimals

Phantimals are a seasonal unit type that can be placed on the grid alongside
characters. They occupy cells, can be moved, and participate in targeting
and pathfinding exactly like characters — with three deliberate differences:

1. **They don't count toward team size.**
2. **At most one phantimal per team** may be on the field; placing a new one
   replaces the team's current phantimal.
3. **They can be swapped only within their own team** — `executeSwapCharacters`
   rejects any cross-team swap involving a phantimal.

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

- `lib/characters/phantimal.ts` owns `PHANTIMAL_ID_OFFSET = 100000` plus the pure
  helpers `isPhantimalId`, `toPhantimalId(localId)`, `toLocalPhantimalId(id)`.
- A tile whose `characterId >= PHANTIMAL_ID_OFFSET` holds phantimal
  `characterId - PHANTIMAL_ID_OFFSET` (local IDs come from
  `src/data/seasonal/phantimal/*.json`).
- `grid.ts` imports the constant as `Grid.phantimalIdOffset`. `isCompanionId` is
  bounded by it (`>= companionIdOffset && < phantimalIdOffset`) so phantimal IDs
  are never mistaken for companions. The offset sits well above the companion
  band (`N * companionIdOffset + characterId`, N ≥ 1) so a character with several
  companions (e.g. Zanie's two turrets at `10089`/`20089`) can't spill into the
  phantimal namespace.

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

Phantimal IDs (100000+) don't fit the character section's 14-bit ID field, so they
get their own section rather than overloading `c`:

- `GridState.p`: `[hexId, localPhantimalId, team][]` (`gridStateSerializer.ts`).
- `binaryEncoder.ts`: a phantimal section after artifacts — a 4-bit count then
  `hexId(6) + localId(4) + team(1)` per entry. Presence is flagged by **bit 6 of
  the extended-flags byte** (previously reserved), which forces extended mode.
- `urlState.ts` restores phantimals via `placePhantimalOnHex` after characters
  and artifacts.

**Backward compatible:** old URLs have the flag unset, so the decoder never reads
the section; a state with no phantimals encodes byte-for-byte as before.

## Descriptions

Phantimal skill descriptions use the same `[[value]]` / `<STAT>` markup as
character skills, and `textHighlight` renders both. The character importer
(`scripts/import-skills.ts`) reorders `<STAT>[[value]]` → `[[value]]<STAT>` (reads
naturally in EN and ZH) at import. Phantimals have no importer, so their locale
files are simply stored in that already-reordered form — a one-time normalization,
since the season's data is fixed.

## Faction requirement

A phantimal may only be on a team that fields at least
`PHANTIMAL_FACTION_REQUIREMENT` (3) characters of its faction. The rule lives in
the pure, injectable `lib/characters/phantimalFaction.ts` (`requiredFactions`,
`countTeamFaction`) — it takes a `factionOf(id)` resolver so it stays free of the
data store. **midnight-hunter** is special: its `requiredFactions` override counts
both `hypogean` and `celestial`. Only distinct main characters count — companions
and phantimals are excluded.

The character store wires `gameDataStore.getCharacterFaction` into the rule and
enforces it at five points:

- **Placement gate** — `placePhantimalOnHex` / `autoPlacePhantimal` return `false`
  if the team is short, so a click or drop simply does nothing.
- **Cross-team gate** — `GridContext.handleDrop` blocks moving a phantimal to an
  empty tile on the other team unless that team qualifies; the phantimal stays
  put. Dropping a phantimal on an occupied tile on the other team is a
  cross-team swap, which `executeSwapCharacters` rejects outright.
- **Auto-removal** — a `watch(placements)` runs `reconcilePhantimals`, removing
  any on-field phantimal whose team drops below the requirement (e.g. a faction
  character is removed or moved away).
- **Auto-placement** — the same `reconcilePhantimals` watcher places a faction's
  phantimal the moment a team crosses _into_ qualifying, unless it already has
  one. It is **edge-triggered**: `lastQualifyingPhantimal` records the phantimal
  each team last qualified for, so placement fires once on the transition and a
  manually removed phantimal stays gone while the faction count holds.
  `findQualifyingPhantimalId` resolves which phantimal applies (at most one, since
  a 5-unit roster can't reach 3 of two factions). Bulk URL restores apply many
  characters at once, which would otherwise read as a fresh transition;
  `seedPhantimalBaseline` re-aligns the baseline after restore so a saved state
  that omits its phantimal loads without one.
- **Roster tooltip** — `PhantimalSelection` shows `app.phantimalDeployable` /
  `app.phantimalLocked` with the live `count/required` on hover.

When phantimal data isn't loaded (e.g. unit tests) the rule can't be evaluated and
placement is allowed, so the gate is inert rather than blocking.

## Modularity & removability

Everything phantimal-specific is reachable from a short list of seams, each keyed
on `isPhantimalId` or living in a dedicated file. To retire the feature:

1. Delete `lib/characters/phantimal.ts`, `lib/characters/phantimalFaction.ts`,
   `PhantimalSelection.vue`, `modals/PhantimalModal.vue`, the phantimal
   data/locale files (incl. `app/phantimalDeployable|Locked.json`), and this doc.
2. Remove the phantimal section from `binaryEncoder.ts` / `gridStateSerializer.ts`
   / `urlState.ts` (the `p` field) and the `getPhantimalById` /
   `getCharacterFaction` accessors.
3. Drop the phantimal helpers from the character store (placement, the faction
   gate, and the `reconcilePhantimals` watcher), the `isPhantimalId(...)`
   guards including the cross-team swap rejection in `swap.ts` (they collapse to
   "always a character"), the `GridCharacters` render branch, and
   `Grid.phantimalIdOffset` (restoring `isCompanionId` to a single lower bound).

The `GridTile` model, targeting, pathfinding, move, and the `c` URL section
were never modified for phantimals, so nothing there needs reverting.

## Retirement

Deleting a season's phantimal data files (and artifact JSONs) is safe: the
binary format is positional, so encoded teams, links, and backups keep
decoding. Unknown ids render as question-mark placeholders on boards (with a
"no longer available" tooltip) and question-marked dots in thumbnails; retired
artifacts occupy their slot as a question-mark circle. All of them stay
removable/replaceable, and the ids survive load/save round-trips until edited
away. The `s` board section and its decode path are file format, not season
data: they stay even if phantimals are replaced by a new seasonal unit type.
