# Seasonal Content

## Overview

Three mechanics rotate with the game's seasons: phantimals (grid units), seasonal artifacts (the rotating subset of artifacts), and charms (per-hero seasonal skill upgrades shown with skill text). Text for all three originates in an upstream data feed outside this repo, whose per-locale files are consumed by importers that generate the derivable files and lint the hand-curated ones. Season provenance on stored payloads (`src/lib/seasonal.ts`) keeps reused seasonal ids from resolving to another season's content.

## Design Principles

1. **Wholesale replacement**: a cutover deletes a season's data files and the next season reuses the freed ids; no version fields or archives (git history is the archive).
2. **Scripts own the derivable, humans own judgment**: importers write everything the feed carries and lint the hand-written parts (compact ids, `season`, `range`, curated names) against it, failing loudly on drift.
3. **Namespaced units, not new models**: phantimals share the grid's single occupant slot through an id band, so occupancy, move, targeting and pathfinding need no phantimal-aware code.
4. **Deploy-derived season**: `CURRENT_SEASON` is the max `season` across loaded data files, so the boundary flips with the cutover deploy, never the calendar.
5. **Retirement is deletion**: each feature is confined to dedicated files plus a short seam list keyed on `isPhantimalId`, and stored payloads self-heal at read through provenance rather than per-season migrations.

## Importers (`scripts/import-*.ts`)

`npm run import:seasonal` runs `import:skills` first (fresh `_keywords.json` glossaries feed charm validation), then `import:charms`, `import:artifacts`, `import:phantimals`. `scripts/lib/shared.ts` holds `DEFAULT_SRC_DIR` (the feed's default local location, a sibling checkout), `cleanDescription` (stat/value reorder, sprite-tag strip) and the diff-then-write helpers.

| Importer            | Feed file                       | Writes                                                                                             | Lints (hard fail)                                                                                                                                          | `--retire`                    |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `import:phantimals` | `<locale>/phantimals.json`      | `src/locales/seasonal/phantimal/<slug>.json`: `{name, skills[].levels[]}` en/zh maps               | slug sets match both ways; structural `name` equals filename; factions agree                                                                               | deletes every locale file     |
| `import:artifacts`  | `<locale>/artifacts.json`       | `src/locales/artifact/effects/<slug>.json` and `src/locales/seasonal/artifact/effects/<slug>.json` | structural file exists in the dir matching the feed's set, both ways; a name file per artifact; `stats` equal feed `statBonuses` through the stat-code map | deletes seasonal effects only |
| `import:charms`     | `<locale>/charms.json` (all 16) | `src/data/seasonal/charm/charms.json`, `src/locales/skill/<code>/_charms.json`                     | identical slug sets and hero lists across feeds; exactly 4 tiers; `[[label\|key]]` tokens exist in each language's `_keywords.json`; no hero on two charms | deletes both outputs          |

Shared rules: `--src-dir <PATH>` / `--url-base <URL>` override the source; an absent or unreadable feed is a hard error, never a silent wipe; each importer prunes only its own generated files whose entry left the feed (a charm feed with zero charms retires). Charm heroes outside `src/data/character/` are skipped with a warning.

## Phantimals

### Id namespace (`src/lib/characters/phantimal.ts`)

- `PHANTIMAL_ID_OFFSET = 100000`; `isPhantimalId` covers `[100000, SYNERGY_ID_OFFSET)` so synergy-band units never read as phantimals. `toPhantimalId` / `toLocalPhantimalId` convert to the local ids in `src/data/seasonal/phantimal/<slug>.json` (`{id, name, season, range, faction}`, hand-written: the ids are baked into URL serialization and `range` is board-sim semantics no feed carries).
- The band sits above every companion id (`N * COMPANION_ID_OFFSET + characterId`); `isCompanionId` (`companion.ts`) classifies the decomposed local id and is bounded by `Grid.phantimalIdOffset`.
- A tile whose `characterId` is in the band holds a phantimal. Targeting, pathfinding, swap, move and occupancy read the tile slot rather than the character store, so they treat it as another unit for free.

Three rules differ from characters:

1. **No team slot**: `getAvailableTeamSize` skips phantimal ids and `canPlaceCharacterOnTeam` returns `true` for them (`character.ts`).
2. **One per team**: `placePhantimal` / `autoPlacePhantimal` (`useGridContext.ts`) clear the team's current phantimal (`findTeamPhantimalHex`) before placing; `handleDrop` routes a cross-team move through the same clear.
3. **Same-team swaps only**: `executeSwapCharacters` (`swap.ts`) rejects any cross-team swap involving a phantimal.

### Seams

| Concern           | Where                                                                                                                                                                     |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data lookup       | `stores/gameData.ts`: `getPhantimalById` (namespaced or local id); `getCharacterRange`, `getCharacterNameById`, `getCharacterFaction` short-circuit phantimal ids         |
| Targeting range   | `useGridContext.ts` `buildUnitRanges` seeds the base-id-keyed range map with every on-grid namespaced unit before `getClosestTargetMap`, so a phantimal's `range` applies |
| Spirit Mark skill | `lib/skills/seasonal/phantimal.ts`, discovered by the `./seasonal/*.ts` glob in `skill.ts`                                                                                |
| Rendering         | `GridCharacters.vue`: an `isPhantimalId` branch swaps image source (`phantimalImageUrl`, remote) and colour; an id with no data renders a "?" placeholder                 |
| Roster            | `PhantimalSelection.vue`, composed with the artifact roster in `SeasonalSelection.vue`                                                                                    |
| URL               | dedicated `s` section (below)                                                                                                                                             |

Spirit Mark: each phantimal registers a tile highlight under its namespaced id on its priority-behind tile (Necrodrakon: priority-front) via `findAdjacentPriorityTarget`, shared with Daimon. Activation is gated only by the registry (`hasSkill`), so activate on place, deactivate on remove and re-derive on every mutation ride the generic `execute*` ops; the skill system holds no phantimal-aware code. The file must go together with the data files, including on a data-only rotation: retired ids restored from old URLs still place and would keep activating it.

Skill descriptions use the same `[[value]]` / `<STAT>` markup as character skills; `highlightSkillText` renders both.

### Faction requirement (`src/lib/characters/phantimalFaction.ts`)

A phantimal may only stand on a team fielding at least `PHANTIMAL_FACTION_REQUIREMENT` (3) distinct main characters of its faction; companions and phantimals do not count. `requiredFactions` carries overrides: `midnight-hunter` counts both `hypogean` and `celestial`. The rule takes a `factionOf(id)` resolver so it stays free of the data store; each board's `useGridContext.ts` injects `gameDataStore.getCharacterFaction` and enforces it at four points:

- **Placement gate**: `placePhantimal` / `autoPlacePhantimal` return `false` when the team is short, so a click or drop does nothing.
- **Cross-team gate**: `handleDrop` blocks moving a phantimal to an empty tile on the other team unless that team qualifies.
- **Reconcile watcher**: `watch(placements, reconcilePhantimals)` removes an on-field phantimal whose team dropped below the requirement and auto-places a faction's phantimal when a team crosses into qualifying, unless it already has one.
- **Roster tooltip**: `PhantimalSelection.vue` shows `app.phantimal-deployable` / `app.phantimal-locked` (`src/locales/app/messages/`) with the live `count/required`.

Auto-placement is edge-triggered: `lastQualifyingPhantimal` records the phantimal each team last qualified for, so placement fires once per transition and a manually removed phantimal stays gone while the count holds. `findQualifyingPhantimalId` walks data order, so when a synergy hero lets a roster satisfy two factions the first match wins and a seated phantimal keeps its seat. Bulk restores (URL, board moves, team loads) apply many characters at once, which the watcher would read as a fresh transition; callers run `seedPhantimalBaseline` afterward so a saved state that omits its phantimal loads without one. With phantimal data unloaded (unit tests) the rule is inert and placement is allowed.

### URL serialization

Phantimal ids do not fit the character section's id field, so they get their own section:

- `GridState.s`: `[hexId, localPhantimalId, team][]` (`gridStateSerializer.ts`), stored by local id.
- `binaryEncoder.ts`: section bitmap bit 3; a 4-bit count, then `hexId(6) + localId(4) + team(1)` per entry, written after the artifact section. States without phantimals leave the bit unset and encode as if the section did not exist.
- `urlState.ts` restores via `placePhantimalOnHex` after characters and artifacts, then calls `seedPhantimalBaseline`.

## Seasonal Artifacts

The 6 pre-season artifacts (`season: 0`) persist across rollovers; the 12 seasonal ones rotate. The directory tree encodes the split and the loaders merge one glob per location:

| Content                                | Pre-season                      | Seasonal                                  | Owner                                                                |
| -------------------------------------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Structural `{id, name, season, stats}` | `src/data/artifact/`            | `src/data/seasonal/artifact/`             | hand-curated (compact URL ids)                                       |
| Display names (en/zh)                  | `src/locales/artifact/`         | `src/locales/seasonal/artifact/`          | hand-curated (shortened; the feed's en names carry a "Spell" suffix) |
| Effect text                            | `src/locales/artifact/effects/` | `src/locales/seasonal/artifact/effects/`  | `import:artifacts`                                                   |
| Targeting arrows                       | `src/lib/skills/artifact.ts`    | same file, entries under a season comment | hand-curated (see [SKILLS.md](./SKILLS.md), "Artifact Targeting")    |

- `season` drives newest-first grouping in `ArtifactSelection.vue` and the icon source: `isRemoteArtifact` (`src/utils/artifactImage.ts`) sends every season but 0 to the remote image host at `seasonal/artifact/<slug>.webp`; phantimal icons live beside them at `seasonal/phantimal/<slug>.webp`.
- Retiring a season's artifacts: delete the seasonal data and name files and the season's targeting entries with their cases in `tests/unit/skills/artifact.test.ts`; the importer prunes its effect files. A lingering targeting entry would draw the old season's arrows for whichever new artifact reuses the id.

## Charms

Per-hero seasonal skill upgrades with four tiers (Elite, Epic, Legendary, Mythic). One charm is a skill family shared by several heroes, so the model is charm-keyed: text is stored once per charm and heroes reference it. Charms have no player-facing name; identity is the feed slug (`SkillName` minus the `gemskill_` prefix, e.g. `ep7mpregen`), which the feed derives from the raw `GemSuit` table so a season rollover needs no season literal.

### Data (`src/data/seasonal/charm/charms.json`, `src/locales/skill/<code>/_charms.json`)

- `charms.json`: `{ "<slug>": { "heroes": [...] } }`; the hero to charm inverse is derived at load (`getCharmForHero`).
- `_charms.json`: `{ "tiers": [4 labels], "charms": { "<slug>": [4 descriptions] } }`, one per language.
- The underscore file rides the reserved `_` namespace of the skill locale dirs (like `_keywords.json`): the eager en/zh globs and each other language's lazy chunk, so charm text is warm exactly when the surrounding skill text is, and the SSG route walk (`vite.config.ts`) and hero-slug walks already skip `_` files. `splitSkillDict` (`dataLoader.ts`) splits it out; `getSkillCharms(lang)` reads it (en fallback at the call site), `loadCharms` / `getCharmForHero` serve the structural map (an unmatched glob is an empty map).
- `src/data/seasonal/charm/` is listed in `.prettierignore`: the importer's compact output would churn against formatting.

### UI

- `SkillCharmSection.vue` is rendered by `SkillSections.vue` after the slot sections and before the per-hero snippet, so it appears on every `SkillSections` surface (skill pages, skills browser, roster skill modal). `GuideCharacterPanel` and `PhantimalModal` compose `SkillSection` directly and show no charms.
- An active tag-chip filter hides the block: charm rows carry no tags, the same rule as EX refinements.
- `#charm` anchors search deep links. `useSkillSearch` indexes tier text per sharing hero (`loc: 'charm'`, `tier` 1-4), deduped under one pseudo-slot so a hero surfaces once per charm; `SkillSearchOverlay.vue` type-lines hits as `<charm label> · <tier name>`.
- Labels: `src/locales/app/charm.json`, `src/locales/app/charm-shared.json`.

## Season Provenance (`src/lib/seasonal.ts`)

Seasonal artifact and phantimal ids are reused each season, so a bare id cannot say which season's content it names.

- **Stamp**: `serializeMultiGridState` writes `season = CURRENT_SEASON` on every `MultiGridState`. `canonicalTeamData` preserves a record's stamp rather than re-stamping it. `stampLegacySeason` (`src/utils/upgradeMigration.ts`, TEMPORARY) stamps pre-field payloads with 7 at the JSON decode choke point and the storage pass persists it; after the shim an unstamped payload has no provenance and resolves against the current pool.
- **Current season**: max `season` over loaded artifacts and phantimals; 0 with empty seasonal dirs, which retires every stamp.
- **Retired references**: a payload whose season is not current has its seasonal references treated as retired. `stripRetiredSeasonal` removes all phantimals and every artifact id outside the `season: 0` permanent set; `normalizeTeamPayload` (every Teams ingress) and side-load strip, while saved records keep theirs until re-saved. Display surfaces mask instead (`lib/teams/preview.ts`): an "S{n}" placeholder carrying only the season, tooltip `app.seasonal-retired`, raw id withheld so nothing can resolve it.
- **Notice**: every strip (explicit loads, quiet slot and link restores, the arena rotation pass) raises the session-scoped, dismissible banner (`useSeasonNotice` + `SeasonNotice.vue` on HomeView and TeamsView), so a first visit after a cutover explains what was removed.
- **Links**: binary links carry no season, so an old link's bare ids resolve as current-pool content (the accepted links-are-expendable mis-render).
- **Arena autosave**: binary and stampless, so `runSeasonRotationPass` (`src/utils/seasonRotation.ts`, permanent) keeps a `stargazer.season` marker and strips the stored value once per season flip; an absent marker seeds season 7.

### Cutover checklist

1. Rebuild the upstream data feed so it carries the new season.
2. Run the three importers with `--retire`.
3. Replace the hand-curated structural and name files; new content reuses the freed ids with the new `season`. `tests/unit/lib/seasonal.test.ts` asserts every non-zero data season equals `CURRENT_SEASON` and pins the value, so a partial or forgotten bump fails loudly.
4. Replace `lib/skills/seasonal/phantimal.ts` and the season's targeting entries in `lib/skills/artifact.ts`, with their tests.
5. `npm run import:seasonal`.
6. Rotate seasonal preset maps onto freed `MAP_WIRE_IDS` (`src/lib/teams/wire.ts`) and edit the `sl` row of `TEAM_VARIANTS` (`src/lib/teams/modes.ts`) if the Supreme League list changed. Nothing resets: slots and records keep their maps, and boards on the old list simply stop reading as Supreme League (no chip, out of the type filter).
7. Full tests, deploy. No stored-data rewrites: the derived season flips the read rule everywhere, and each device's rotation pass cleans its arena autosave on first visit.

### Feature retirement

- **Phantimals**: delete `phantimal.ts`, `phantimalFaction.ts`, `PhantimalSelection.vue`, `modals/PhantimalModal.vue`, the skill file with `tests/unit/skills/phantimal.test.ts`, the data and locale files (including the two `app/messages` strings), and `scripts/import-phantimals.ts` with its npm scripts. Remove the `s` section from `binaryEncoder.ts` / `gridStateSerializer.ts` / `urlState.ts`, `getPhantimalById` and the phantimal branches of the other `gameData` accessors, the context and store helpers (placement, faction gate, reconcile watcher), the `isPhantimalId` guards including the swap rejection (they collapse to "always a character"), the `GridCharacters` branch, and `Grid.phantimalIdOffset`. The `./seasonal/*.ts` glob may stay (an unmatched literal glob compiles to an empty map) and `findAdjacentPriorityTarget` stays for Daimon. `GridTile`, pathfinding, move and the `c` section were never modified.
- **Charms**: no URL, grid or store seams exist. `npm run import:charms -- --retire` (or delete `src/data/seasonal/charm/` and `src/locales/skill/*/_charms.json`) and drop the `.prettierignore` line; delete `SkillCharmSection.vue`, the charm computed and block in `SkillSections.vue`, the charm branches in `useSkillSearch.ts` and `SkillSearchOverlay.vue`, `tests/unit/charms.test.ts`; remove `loadCharms`, `getCharmForHero`, `getSkillCharms`, the `_charms` branch of `splitSkillDict` and the `SkillCharms` / `CharmData` types; delete `scripts/import-charms.ts`, the `import:charms` script and its `import:seasonal` entry, and the two `app/charm*.json` labels.
- The `s` board section is file format, not season data: it stays if phantimals are replaced by another seasonal unit type. Charms have no URL presence, so their retirement has no decode story.

## Related Documentation

- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - Board sections, including the phantimal `s` section and map wire ids
- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - Team ingress, canonical records and team types
- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill registry and artifact targeting
