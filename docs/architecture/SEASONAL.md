# Seasonal Content

Three mechanics rotate with the game's seasons: **phantimals** (grid units),
**seasonal artifacts** (the rotating subset of artifacts), and **charms**
(per-hero seasonal skill upgrades shown with skill text). They share one
lifecycle: data is replaced wholesale when a season flips (no version fields,
no archives; git history is the archive), and every feature is confined to
dedicated files plus a short seam list so retirement is deletion, not surgery.

Text for all three originates in the sibling `afkj-data-viewer` checkout,
which parses the raw game data and emits per-locale feeds under
`static/api/<locale>/`. The shared ownership rule: **scripts own everything
derivable from the feed, humans own only what requires judgment** (compact URL
ids, board-sim ranges, curated display names), and the importers lint the
hand-written parts against the feed instead of generating them.
`npm run import:seasonal` refreshes all three consumers in one run
(charms, artifact effects, phantimal text); the importers share helpers in
`scripts/lib/shared.ts`.

## Phantimals

Phantimals are a seasonal unit type that can be placed on the grid alongside
characters. They occupy cells, can be moved, and participate in targeting and
pathfinding exactly like characters, with three deliberate differences:

1. **They don't count toward team size.**
2. **At most one phantimal per team** may be on the field; placing a new one
   replaces the team's current phantimal.
3. **They can be swapped only within their own team**: `executeSwapCharacters`
   rejects any cross-team swap involving a phantimal.

### Approach: a namespaced unit

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

### The seams

| Concern                  | Where                                                                                                                             | What changes                                                                                                                                              |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team-size exemption      | `place.ts` (`performPlace`)                                                                                                       | Phantimals are not added to the `teamCharacters` capacity set.                                                                                            |
| Capacity/duplicate check | `character.ts` (`canPlaceCharacterOnTeam`)                                                                                        | Returns `true` for phantimal IDs.                                                                                                                         |
| One-per-team replace     | `stores/character.ts` wrappers delegating to `useGridContext.ts` (`placePhantimal` / `autoPlacePhantimal` / `clearTeamPhantimal`) | Clears the team's existing phantimal (`findTeamPhantimalHex`) before placing. Cross-team moves route through the same clear in `handleDrop`.              |
| Spirit Mark skill        | `lib/skills/seasonal/phantimal.ts`                                                                                                | Tile highlight registered under the namespaced ID; rides the generic skill lifecycle (see below).                                                         |
| Data lookup              | `stores/gameData.ts`                                                                                                              | `getPhantimalById`; `getCharacterRange`/`getCharacterNameById` short-circuit phantimal IDs.                                                               |
| On-grid rendering        | `components/grid/GridCharacters.vue`                                                                                              | An `isPhantimalId` branch swaps the image source (remote `phantimalImageSources`) and colour; all positioning, drag, lift and perspective code is reused. |
| Roster                   | `components/PhantimalSelection.vue`                                                                                               | Draggable + tap-to-place + placed state, mirroring the character roster; the info modal stays reachable via the pill.                                     |
| URL serialization        | see below                                                                                                                         | Dedicated `s` section.                                                                                                                                    |

Skills: each phantimal registers a **Spirit Mark tile highlight** under its
namespaced ID in `lib/skills/seasonal/phantimal.ts`, discovered by the
`./seasonal/*.ts` glob in `skill.ts`. The skill marks the unit on the
phantimal's priority-behind tile (Necrodrakon: priority-front) via
`findAdjacentPriorityTarget` (shared with Daimon), painting a yellow fill plus
border through the SkillManager's refcounted tile channels. Activation is gated
only by the registry (`hasSkill`), so the whole lifecycle (activate on place,
deactivate on remove, re-key on cross-team move, re-derive on every mutation)
rides the generic `execute*` ops; the skill system contains no phantimal-aware
code.

Targeting range: a phantimal's `range` (from its data file) is used when it acts
as a targeting _source_ for the on-grid arrows. `getCharacterRange` returns it,
and the pathfinding store adds on-grid phantimals to the per-unit range map it
passes to `getClosestTargetMap` (the static map is keyed by character id only).

### URL serialization

Phantimal IDs (100000+) don't fit the character section's 14-bit ID field, so they
get their own section rather than overloading `c`:

- `GridState.s`: `[hexId, localPhantimalId, team][]` (`gridStateSerializer.ts`).
- `binaryEncoder.ts`: a phantimal section after artifacts, a 4-bit count then
  `hexId(6) + localId(4) + team(1)` per entry. Presence is flagged by **bit 6 of
  the extended-flags byte**, which forces extended mode.
- `urlState.ts` restores phantimals via `placePhantimalOnHex` after characters
  and artifacts.

States with no phantimals leave the flag unset, so the decoder never reads the
section and such states encode byte-for-byte as if the section didn't exist.

### Descriptions

Phantimal skill descriptions use the same `[[value]]` / `<STAT>` markup as
character skills, and `textHighlight` renders both. The locale files at
`src/locales/seasonal/phantimal/<slug>.json` ({name, skills[].levels[]} en/zh
maps) are generated by `npm run import:phantimals` from the viewer's en/zh
feeds, with the shared `cleanDescription` normalization (stat/value reorder,
sprite strip). The structural files stay hand-written: the compact local ids
are baked into URL serialization and `range` is board-sim semantics no feed
carries. The importer lints them against the feed instead (slug sets match
both ways, factions agree), prunes locale files whose phantimal left the feed,
and `--retire` deletes them all.

### Faction requirement

A phantimal may only be on a team that fields at least
`PHANTIMAL_FACTION_REQUIREMENT` (3) characters of its faction. The rule lives in
the pure, injectable `lib/characters/phantimalFaction.ts` (`requiredFactions`,
`countTeamFaction`): it takes a `factionOf(id)` resolver so it stays free of the
data store. **midnight-hunter** is special: its `requiredFactions` override counts
both `hypogean` and `celestial`. Only distinct main characters count; companions
and phantimals are excluded.

The character store wires `gameDataStore.getCharacterFaction` into the rule and
enforces it at five points:

- **Placement gate**: `placePhantimalOnHex` / `autoPlacePhantimal` return `false`
  if the team is short, so a click or drop simply does nothing.
- **Cross-team gate**: `GridContext.handleDrop` blocks moving a phantimal to an
  empty tile on the other team unless that team qualifies; the phantimal stays
  put. Dropping a phantimal on an occupied tile on the other team is a
  cross-team swap, which `executeSwapCharacters` rejects outright.
- **Auto-removal**: a `watch(placements)` runs `reconcilePhantimals`, removing
  any on-field phantimal whose team drops below the requirement (e.g. a faction
  character is removed or moved away).
- **Auto-placement**: the same `reconcilePhantimals` watcher places a faction's
  phantimal the moment a team crosses _into_ qualifying, unless it already has
  one. It is **edge-triggered**: `lastQualifyingPhantimal` records the phantimal
  each team last qualified for, so placement fires once on the transition and a
  manually removed phantimal stays gone while the faction count holds.
  `findQualifyingPhantimalId` resolves which phantimal applies (at most one, since
  a 5-unit roster can't reach 3 of two factions). Bulk URL restores apply many
  characters at once, which would otherwise read as a fresh transition;
  `seedPhantimalBaseline` re-aligns the baseline after restore so a saved state
  that omits its phantimal loads without one.
- **Roster tooltip**: `PhantimalSelection` shows `app.phantimalDeployable` /
  `app.phantimalLocked` with the live `count/required` on hover.

When phantimal data isn't loaded (e.g. unit tests) the rule can't be evaluated and
placement is allowed, so the gate is inert rather than blocking.

### Modularity & removability

Everything phantimal-specific is reachable from a short list of seams, each keyed
on `isPhantimalId` or living in a dedicated file. To retire the feature:

1. Delete `lib/characters/phantimal.ts`, `lib/characters/phantimalFaction.ts`,
   `PhantimalSelection.vue`, `modals/PhantimalModal.vue`, the skill file
   `lib/skills/seasonal/phantimal.ts` with `tests/unit/skills/phantimal.test.ts`,
   the phantimal data/locale files (incl. `app/phantimalDeployable|Locked.json`),
   `scripts/import-phantimals.ts` with its npm scripts, and the Phantimals
   section of this doc. The skill file must go whenever the
   data/locale files do, including a data-only rotation: retired IDs restored
   from old URLs still place, and would otherwise keep activating the skill.
2. Remove the phantimal section from `binaryEncoder.ts` / `gridStateSerializer.ts`
   / `urlState.ts` (the `s` field) and the `getPhantimalById` /
   `getCharacterFaction` accessors. Optionally remove the `./seasonal/*.ts` glob
   line in `skill.ts`: an unmatched literal Vite glob compiles to an empty module
   map, so this is tidiness, not correctness. `findAdjacentPriorityTarget` stays
   (it is Daimon's targeting); its `'front'` direction becomes unused and may
   stay or be trimmed.
3. Drop the phantimal helpers from the character store (placement, the faction
   gate, and the `reconcilePhantimals` watcher), the `isPhantimalId(...)`
   guards including the cross-team swap rejection in `swap.ts` (they collapse to
   "always a character"), the `GridCharacters` render branch, and
   `Grid.phantimalIdOffset` (restoring `isCompanionId` to a single lower bound).

The `GridTile` model, pathfinding, move, and the `c` URL section were never
modified for phantimals, so nothing there needs reverting.

## Seasonal Artifacts

Artifacts are the one seasonal domain with a permanent core: the 6 pre-season
artifacts (`season: 0`) persist across rollovers, while the 12 seasonal ones
rotate. The directory tree encodes the split: the seasonal set lives under
`seasonal/` dirs in both trees, the pre-season set outside them, and the
loaders merge one glob per location.

- Structural records (hand-curated: compact URL ids, `season` grouping):
  `src/data/artifact/<slug>.json` for the pre-season set,
  `src/data/seasonal/artifact/<slug>.json` for the seasonal set
  ({id, name, season, stats}). The `season` field drives newest-first grouping
  in `ArtifactSelection.vue` and remote-vs-bundled imagery in
  `ArtifactImage.vue`.
- Display names (hand-curated: the en names are deliberately shortened, the
  feed's carry a "Spell" suffix): `src/locales/artifact/<slug>.json` and
  `src/locales/seasonal/artifact/<slug>.json` en/zh maps.
- Effect text (generated): `src/locales/artifact/effects/<slug>.json` and
  `src/locales/seasonal/artifact/effects/<slug>.json`, written by
  `npm run import:artifacts` from the viewer's en/zh `artifacts.json` feeds
  with the shared `cleanDescription` normalization.

The importer lints everything hand-written against the feed and hard-fails on
disagreement: every feed artifact has a structural file in the dir matching
its set (and vice versa), a display-name file exists per artifact, and
structural `stats` match the feed's `statBonuses` through the stat-code map,
so a balance patch fails the import loudly instead of drifting silently. It
prunes effect files whose artifact left the feed, and
`npm run import:artifacts -- --retire` clears the seasonal effect files.

Retiring a season's artifacts is deleting the seasonal data and name files
(the importer prunes its own effect files); the pre-season six are never
touched. Retired ids restored from old URLs occupy their slot as a
question-mark circle (see Retirement below).

## Charms

Charms are per-hero seasonal skill upgrades with four tiers (Elite, Epic,
Legendary, Mythic). One charm is a skill family **shared by 3-16 heroes**, so
the data model is charm-keyed, never hero-keyed: text is stored once per charm
and heroes reference it. Charms have no player-facing names; identity is the
raw codename slug (`SkillName` minus the `gemskill_` prefix, e.g.
`ep7mpregen`).

### Files

- `src/data/seasonal/charm/charms.json` (generated): charm slug → the roster
  heroes sharing it. The inverse hero → charm lookup is derived at load time.
- `src/locales/skill/<code>/_charms.json` (generated, one per language):
  `{ tiers: [4 localized tier labels], charms: { slug: [4 descriptions] } }`.

The underscore file piggybacks the reserved `_`-namespace of the skill locale
dirs (like `_keywords.json`): it rides the eager en/zh globs and each other
language's lazy chunk, so charm text is warm exactly when the surrounding
skill text is, and the SSG route walk and hero-slug walks already skip it.

### Pipeline

`afkj-data-viewer` derives charms from the raw `GemSuit` table (season
membership is self-updating; no season literal) and emits
`static/api/<locale>/charms.json` per feed locale. `npm run import:charms`
(`scripts/import-charms.ts`) then:

- asserts uniform charm coverage and identical hero lists across all 16 feeds;
- normalizes text with the shared `cleanDescription` (stat/value reorder,
  sprite-tag strip) and validates `[[label|key]]` tokens against each
  language's `_keywords.json` glossary;
- intersects feed heroes with the roster (`src/data/character/*.json`),
  warning on unknowns;
- writes both outputs diff-then-write.

An absent or unreadable feed is a hard error, never a silent wipe. Outputs are
deleted only by `npm run import:charms -- --retire` (or a feed that exists with
zero charms): nothing else ever deletes locale files, and a stale
`_charms.json` would otherwise keep shipping invisibly inside every chunk.

### Loading and UI

`splitSkillDict` (dataLoader) splits `_charms` out of each locale dict;
`getSkillCharms(lang)` reads it (en fallback at the call site), and
`loadCharms()` / `getCharmForHero(slug)` serve the structural map (after
removal the unmatched glob degrades to an empty map).

`SkillCharmSection.vue` is rendered by `SkillSections.vue` after the slot
sections and before the per-hero essay snippet, so it appears on every
`SkillSections` surface: the skill pages, the skills browser, and the roster
skill modal. `GuideCharacterPanel` and `PhantimalModal` compose `SkillSection`
directly and intentionally do not show charms. Details:

- Tier rows use a subgrid label column so all four descriptions start at the
  same x in every language; badges wear rarity hues (Elite purple, Epic
  orange, Legendary red, Mythic blue-silver).
- Text renders through `highlightSkillText`, and keyword tooltips work via the
  article-root delegation the block sits inside.
- An active tag-chip filter hides the block (charm rows carry no tags, the
  same rule as EX refinements).
- A muted "Same charm" footer lists the other heroes sharing the charm.
- The section id `#charm` anchors search deep links; heroes without a charm
  (and all heroes after retirement) render no block.

### Search

`useSkillSearch` indexes charm tier text per sharing hero (`loc: 'charm'`,
`tier` 1-4, deduped under one pseudo-slot so a hero surfaces once per charm).
The search overlay chips these hits with the charm label, type-lines them as
"Season Charm · <tier name>", and links them to `#charm`.

### Rotation

1. New season lands in the dump → in `afkj-data-viewer`, `npm run build:data`
   and commit. The charm step follows GemSuit automatically; new-season slugs
   appear, old ones vanish.
2. Here, `npm run import:charms` and commit: the structural map and all 16
   `_charms.json` are rewritten wholesale.

### Removal checklist

Charms are display-only content: no URL-serialization, grid, or store seams
exist, so removal is files, a few dataLoader accessors, and one template block.

1. `rm -r src/data/seasonal/charm/` (unmatched literal globs compile to empty
   module maps, so deletion is safe).
2. `rm src/locales/skill/*/_charms.json` (or run
   `npm run import:charms -- --retire`, which does both).
3. Delete `SkillCharmSection.vue`, the charm computed + insertion block in
   `SkillSections.vue`, and the charm branches in `useSkillSearch.ts` and
   `SkillSearchOverlay.vue`.
4. Revert the dataLoader accessors (`loadCharms`, `getCharmForHero`,
   `getSkillCharms`), the `_charms` branch in `splitSkillDict`, and the
   `SkillCharms` / `CharmData` types.
5. Delete `scripts/import-charms.ts` and the `import:charms` npm script
   (`scripts/lib/shared.ts` stays; the skill importer uses it).
6. Delete `src/locales/app/charm.json` and `src/locales/app/charm-shared.json`.
7. Delete the Charms section of this doc.

## Retirement

Deleting a season's phantimal data files (and artifact JSONs) is safe: the
binary format is positional, so encoded teams, links, and backups keep
decoding. Unknown ids render as question-mark placeholders on boards (with a
"no longer available" tooltip) and question-marked dots in thumbnails; retired
artifacts occupy their slot as a question-mark circle. All of them stay
removable/replaceable, and the ids survive load/save round-trips until edited
away. The `s` board section and its decode path are file format, not season
data: they stay even if phantimals are replaced by a new seasonal unit type.
Charms have no URL presence at all, so their retirement has no decode story.
