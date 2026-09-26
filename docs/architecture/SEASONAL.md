# Seasonal Content

## Overview

Three mechanics rotate with the game's seasons: phantimals (grid units), seasonal artifacts (the rotating subset of artifacts), and charms (per-hero seasonal skill upgrades shown with skill text). Text for all three originates in an upstream data feed outside this repo, whose per-locale files are consumed by importers that generate the derivable files and lint the hand-curated ones. Season provenance on stored payloads (`src/lib/seasonal.ts`) keeps reused seasonal ids from resolving to another season's content.

## Design Principles

1. **Wholesale replacement**: a cutover deletes a season's data files and the next season reuses the freed ids; no version fields or archives (git history is the archive).
2. **Scripts own the derivable, humans own judgment**: importers write everything the feed carries and lint the hand-written parts (compact ids, `season`, `range`, curated names) against it, failing loudly on drift.
3. **Namespaced units, not new models**: phantimals share the grid's single occupant slot through an id band, so occupancy, move, targeting and pathfinding need no phantimal-aware code.
4. **Deploy-derived season**: `CURRENT_SEASON` is the max `season` across loaded data files, so the boundary flips with the cutover deploy, never the calendar.
5. **Retirement is deletion**: each feature is confined to dedicated files plus a short seam list keyed on `inPhantimalBand` / `isPhantimalId`, and stored payloads self-heal at read through provenance rather than per-season migrations.
6. **Structure first, text later**: a season's ids, names, stats and portraits can ship at the game's flip while its text (and later its targeting) follows in separate phases; nothing in the app requires text to exist.

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

- `PHANTIMAL_ID_OFFSET = 100000`; the band `[100000, SYNERGY_ID_OFFSET)` sits above every companion id and below the synergy band. `toPhantimalId` / `toLocalPhantimalId` convert to the local ids in `src/data/seasonal/phantimal/<slug>.json` (`{id, name, season, range, faction}` plus optional `qualifyingFactions` and `targeting`; hand-written: the ids are baked into URL serialization and `range` is board-sim semantics no feed carries).
- The band mirrors the base namespace like the synergy band: the phantimal at `offset + L`, companions its skill spawns at `offset + N * 10000 + L`. `inPhantimalBand` covers both, `isPhantimalId` only the phantimal itself, `phantimalOwnerId` maps a companion to its phantimal, `companionLocalId` strips the band offset for `isCompanionId` / `isCompanionUnitId`, and `split`/`joinPhantimalBandLocal` build the serialized form. The band's id math lives in `phantimal.ts`; its stride is a literal pinned equal to `COMPANION_ID_OFFSET` by a test. The skill registry must not strip the phantimal offset: it keys phantimal skills by their namespaced id, and stripping would resolve phantimal `100005` to hero 5.
- Id budget: local ids 1-12 (4-bit wire field; 13-15 are reserved for tests), companion index N 1-3.
- A tile whose `characterId` is in the band holds a phantimal or its companion. Targeting, pathfinding, swap, move and occupancy read the tile slot rather than the character store, so they treat it as another unit for free.

Three rules differ from characters:

1. **No team slot**: `getAvailableTeamSize` skips the whole band (a phantimal and its companions) and `canPlaceCharacterOnTeam` returns `true` for phantimals (`character.ts`).
2. **One per team**: `placePhantimal` / `autoPlacePhantimal` (`useGridContext.ts`) clear the team's current phantimal (`findTeamPhantimalHex`) before placing; `handleDrop` routes a cross-team move through the same clear.
3. **Same-team swaps only**: `executeSwapCharacters` (`swap.ts`) rejects any cross-team swap involving a phantimal.

### Seams

| Concern         | Where                                                                                                                                                                                                                                                                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data lookup     | `stores/gameData.ts`: `getPhantimalById` (namespaced or local id); `getCharacterRange`, `getCharacterNameById`, `getCharacterFaction` short-circuit the band, resolving a companion through its phantimal; `getPhantimalUnitSlug` names a band unit's portrait                |
| Targeting range | `useGridContext.ts` `buildUnitRanges` seeds the base-id-keyed range map with every on-grid namespaced unit before `getClosestTargetMap`, so a phantimal's `range` (a companion's `companionRange`) applies                                                                    |
| Seasonal skills | `lib/skills/seasonal/phantimal.ts` (Spirit Marks, companion registrations), discovered by the `./seasonal/*.ts` glob in `skill.ts`                                                                                                                                            |
| Companions      | `createCompanionSkill` with `raisesCapacity: false` on the phantimal's id; the generic companion rules (cascade removal, move/swap restore, no team change) apply unchanged                                                                                                   |
| Rendering       | `GridCharacters.vue` and `TeamPreview.vue` (fed by `lib/teams/preview.ts`'s `phantimalLocal`): an `inPhantimalBand` branch swaps image source (`phantimalImageUrl` of `getPhantimalUnitSlug`, remote) and colour; an id whose phantimal has no data renders a "?" placeholder |
| Roster          | `PhantimalSelection.vue`, composed with the artifact roster in `SeasonalSelection.vue`; companions have no data file, so they never list                                                                                                                                      |
| Teams boards    | `stores/grids.ts`: phantimal-aware routing, dedupe and board moves; side-load applies the phantimal, then settles its companions                                                                                                                                              |
| Provenance      | `lib/seasonal.ts`: `stripRetiredSeasonal` drops a stale board's whole `s` section                                                                                                                                                                                             |
| URL             | dedicated `s` section (below)                                                                                                                                                                                                                                                 |

Spirit Mark: a phantimal listed in `spiritMarks` registers a tile highlight under its namespaced id on its priority-behind or priority-front tile via `findAdjacentPriorityTarget`, shared with Daimon. Activation is gated only by the registry (`hasSkill`), so activate on place, deactivate on remove and re-derive on every mutation ride the generic `execute*` ops; the skill system holds no phantimal-aware code. The registry holds one skill per id, so a phantimal that already has a skill (a companion) takes its mark as `withTilePaint` over that skill. Every registration is named `phantimal-<slug>`, and a data-contract test (`tests/unit/lib/seasonal.test.ts`) fails when that slug no longer matches the phantimal its id holds, so an unreplaced skill file cannot run one season's skill on the next season's phantimal.

Targeting switch: a Spirit Mark paints only while its phantimal's data file sets `"targeting": true` (read through the `seasonalTargeting` skill lookup); absent means off. A new season's files omit it, so a mark can be written and tested before its in-game unlock and turned on with a one-field edit; with it off, the mark stays hidden even with the Skills toggle on. Closest-target arrows are not switched: every phantimal and companion targets at its range. The flag is developer-only and has no UI.

Companions: a phantimal whose skill is `createCompanionSkill` (`raisesCapacity: false`) enters with its companion on a random free tile of its team; removing either removes both, and faction loss removes the phantimal and, through deactivation, its companion. `companionImageModifier` names the companion's remote portrait slug and `companionRange` its range. A companion has no data file or modal.

Skill descriptions use the same `[[value]]` / `<STAT>` markup as character skills; `highlightSkillText` renders both.

### Faction requirement (`src/lib/characters/phantimalFaction.ts`)

A phantimal may only stand on a team fielding at least `PHANTIMAL_FACTION_REQUIREMENT` (3) distinct main characters of its faction; companions and phantimals do not count. A data file's optional `qualifyingFactions` lists every faction that counts (the season's hypogean/celestial phantimal lists both); `requiredFactions` falls back to `[faction]`. The rule takes a `factionOf(id)` resolver so it stays free of the data store; each board's `useGridContext.ts` injects `gameDataStore.getCharacterFaction` and enforces it at four points:

- **Placement gate**: `placePhantimal` / `autoPlacePhantimal` return `false` when the team is short, so a click or drop does nothing.
- **Cross-team gate**: `handleDrop` blocks moving a phantimal to an empty tile on the other team unless that team qualifies.
- **Reconcile watcher**: `watch(placements, reconcilePhantimals)` removes an on-field phantimal whose team dropped below the requirement and auto-places a faction's phantimal when a team crosses into qualifying, unless it already has one.
- **Roster tooltip**: `PhantimalSelection.vue` shows `app.phantimal-deployable` / `app.phantimal-locked` (`src/locales/app/messages/`) with the live `count/required`.

Auto-placement is edge-triggered: `lastQualifyingPhantimal` records the phantimal each team last qualified for, so placement fires once per transition and a manually removed phantimal stays gone while the count holds. `findQualifyingPhantimalId` walks data order, so when a synergy hero lets a roster satisfy two factions the first match wins and a seated phantimal keeps its seat. Bulk restores (URL, board moves, team loads) apply many characters at once, which the watcher would read as a fresh transition; callers run `seedPhantimalBaseline` afterward so a saved state that omits its phantimal loads without one. With phantimal data unloaded (unit tests) the rule is inert and placement is allowed.

### URL serialization

Phantimal ids do not fit the character section's id field, so they get their own section:

- `GridState.s`: `[hexId, bandLocalId, team][]` (`gridStateSerializer.ts`), stored band-local like `y`: the phantimal as `L`, its companion as `N * 10000 + L`, phantimals first.
- `binaryEncoder.ts`: phantimals in section bit 3 (a 4-bit count, then `hexId(6) + localId(4) + team(1)` per entry, after the artifact section); companions in section bit 6 (`hexId(6) + ownerLocalId(4) + N(2) + team(1)`, last). The encoder splits `s` and the decoder merges it back, so payloads without phantimals or companions leave the bits unset and encode as if the sections did not exist. Companions got their own section rather than a wider phantimal entry so the entry layout, and every existing link and autosave, stay unchanged.
- `urlState.ts` restores through `restoreCharacterBand` with `placePhantimalOnHex` after characters and artifacts, settling each companion onto its saved hex after its phantimal places, then calls `seedPhantimalBaseline`. Side-load (`lib/teams/sideLoad.ts`) carries companions as settle targets of the phantimal.

## Seasonal Artifacts

The 6 pre-season artifacts (`season: 0`) persist across rollovers; the 12 seasonal ones rotate. The directory tree encodes the split and the loaders merge one glob per location:

| Content                                | Pre-season                      | Seasonal                                  | Owner                                                                |
| -------------------------------------- | ------------------------------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Structural `{id, name, season, stats}` | `src/data/artifact/`            | `src/data/seasonal/artifact/`             | hand-curated (compact URL ids)                                       |
| Display names (en/zh)                  | `src/locales/artifact/`         | `src/locales/seasonal/artifact/`          | hand-curated (shortened; the feed's en names carry a "Spell" suffix) |
| Effect text                            | `src/locales/artifact/effects/` | `src/locales/seasonal/artifact/effects/`  | `import:artifacts`                                                   |
| Targeting arrows                       | `src/lib/skills/artifact.ts`    | same file, entries under a season comment | hand-curated (see [SKILLS.md](./SKILLS.md), "Artifact Targeting")    |

- `season` drives newest-first grouping in `ArtifactSelection.vue` and the icon source: `isRemoteArtifact` (`src/utils/artifactImage.ts`) sends every season but 0 to the remote image host at `seasonal/artifact/<slug>.webp`; phantimal icons live beside them at `seasonal/phantimal/<slug>.webp`.
- Targeting has no switch: an artifact draws exactly when it has an entry in `ARTIFACT_TARGETING`, added once its mechanic is known.
- Retiring a season's artifacts: delete the seasonal data and name files and the season's targeting entries with their cases in `tests/unit/skills/artifact.test.ts`; the importer prunes its effect files. Each targeting entry names its artifact, and a test fails when that name no longer matches the data file holding its id, so a leftover entry cannot draw for the artifact that reuses the id.

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

### Season cutover

A cutover runs in three phases, because the upstream data feed usually carries a season's text after the game flips, and seasonal targeting mechanics unlock later still. Each phase ships on its own; an earlier phase never waits for a later one.

**Phase 1, structural (at the game's flip).** Needs the new season's ids, names (en/zh), artifact stats, phantimal factions and ranges, and portraits; not its text.

1. Publish the new artifact and phantimal portraits (companions included) to the image host at `seasonal/{artifact,phantimal}/<slug>.webp`, live before the deploy.
2. `npm run import:phantimals -- --retire`, `import:artifacts -- --retire`, `import:charms -- --retire`. Charms carry no provenance, so the outgoing season's text must not stay up.
3. Replace the hand-curated structural and name files; new content reuses the freed ids with the new `season`. Phantimal structural files omit `targeting` and set `qualifyingFactions` where a phantimal draws on several factions. Phantimal names live in importer-owned locale files, so write name-only stubs (`{"name": {"en", "zh"}, "skills": []}`) that phase 2 overwrites. A stat new to the season needs an `ArtifactStatKey`, a `src/locales/game/<key>.json` label and its feed code in `import-artifacts.ts`'s stat-code map.
4. Replace `lib/skills/seasonal/phantimal.ts` (Spirit Marks, usually none yet; one `createCompanionSkill` per phantimal with a companion) and delete the outgoing season's `ARTIFACT_TARGETING` entries, with their season-specific tests.
5. Bump the season pin in `tests/unit/lib/seasonal.test.ts`.
6. Rotate seasonal preset maps onto freed `MAP_WIRE_IDS` (`src/lib/teams/wire.ts`) and edit the `sl` row of `TEAM_VARIANTS` (`src/lib/teams/modes.ts`) if the Supreme League list changed. Nothing resets: slots and records keep their maps, and boards on the old list simply stop reading as Supreme League.
7. Full tests, deploy. No stored-data rewrites: the derived season flips the read rule everywhere, and each device's rotation pass cleans its arena autosave on first visit.

Exit check: the data-contract tests pass (every data season equals the pin; every phantimal skill and artifact rule names the unit its id holds), every new slug's portrait loads, and modals without text show `app.skill-details-pending`. Until the feed carries the season, `import:phantimals` fails its slug-set lint before writing, so the stubs cannot be pruned by accident; `import:skills` still runs alone.

**Phase 2, text (when the feed carries the season).** Each content kind may land separately.

1. `npm run import:seasonal`. The importers write the text and lint phase 1's hand-written files against the feed; a failure means a phase 1 value (stat, faction, slug) or a stat-code mapping is wrong, so fix the data file, not the lint.
2. Review the diff (the stubs' names should survive unchanged), full tests, deploy.

Exit check: no phantimal locale file still has `"skills": []`, every seasonal artifact has an effects file, and the charm suite runs its per-charm checks instead of skipping them.

**Phase 3, targeting.** Artifacts: add an `ARTIFACT_TARGETING` entry with tests whenever the mechanic is known; it draws from that deploy on. Phantimals: a Spirit Mark (composed onto the companion skill where one exists) can be written and tested at any time, and paints only once `"targeting": true` is set in that phantimal's structural file, flipped when the mechanic unlocks in-game. The flag has no UI. Exit check: the data-contract tests pass.

**Season literals.** A cutover bumps the pin in `seasonal.test.ts` and replaces the `season N` block in `tests/unit/skills/phantimal.test.ts`. `PRE_MARKER_SEASON` (`seasonRotation.ts`, the season the marker shipped in) is permanent, and `stampLegacySeason`'s 7 is deleted with its temporary shim; neither changes at a cutover.

### Feature retirement

- **Phantimals**: delete `phantimal.ts`, `phantimalFaction.ts`, `PhantimalSelection.vue`, `modals/PhantimalModal.vue`, the skill file with `tests/unit/skills/phantimal.test.ts` and `tests/unit/characters/phantimalCompanion.test.ts`, the data and locale files (including the two `app/messages` strings), and `scripts/import-phantimals.ts` with its npm scripts. Remove the `s` and phantimal-companion sections from `binaryEncoder.ts` / `gridStateSerializer.ts` / `urlState.ts` / `sideLoad.ts`, the phantimal apply and companion settle in `grids.ts`, `phantimalLocal` in `lib/teams/preview.ts` and its `TeamPreview.vue` branch, the `s` handling in `stripRetiredSeasonal`, `getPhantimalById`, `getPhantimalUnitSlug`, `hasSeasonalTargeting` with the `seasonalTargeting` lookup (`skill.ts`, `useGridContext.ts`) and the phantimal branches of the other `gameData` accessors, the context and store helpers (placement, faction gate, reconcile watcher), the `inPhantimalBand` / `isPhantimalId` guards including the swap rejection (they collapse to "always a character"), the `GridCharacters` branch, the phantimal data-contract test in `seasonal.test.ts`, and `Grid.phantimalIdOffset`. The `./seasonal/*.ts` glob may stay (an unmatched literal glob compiles to an empty map) and `findAdjacentPriorityTarget` stays for Daimon. `GridTile`, pathfinding, move and the `c` section need no change.
- **Phantimal companions only** (phantimals stay): with no companion registration in the seasonal skill file, every seam is inert, since no id above the phantimals is ever produced. To remove the support itself:
  - `phantimal.ts`: drop `companionLocalId`, `phantimalOwnerId`, `phantimalBandLocal`, the stride and `split`/`joinPhantimalBandLocal`, and merge `inPhantimalBand` back into `isPhantimalId`;
  - companion predicates (`companion.ts`, `isCompanionUnitId`) return to `decomposeUnitId`;
  - `gameData`: the band branches collapse to `getPhantimalById` (including the `companionRange` branch of `getCharacterRange` and `getPhantimalUnitSlug`, whose callers in `GridCharacters.vue` / `TeamPreview.vue` go back to the phantimal's name);
  - serialization: drop the serializer's phantimals-first sort, the binary section at bit 6 (it returns to the spare pool; old links that set it then fail to decode, accepted since links are expendable), the restore and side-load companion splits and the `grids.ts` phantimal companion settle;
  - drop the `raisesCapacity` option and `tests/unit/characters/phantimalCompanion.test.ts`.
- **Charms**: no URL, grid or store seams exist. `npm run import:charms -- --retire` (or delete `src/data/seasonal/charm/` and `src/locales/skill/*/_charms.json`) and drop the `.prettierignore` line; delete `SkillCharmSection.vue`, the charm computed and block in `SkillSections.vue`, the charm branches in `useSkillSearch.ts` and `SkillSearchOverlay.vue`, `tests/unit/charms.test.ts`; remove `loadCharms`, `getCharmForHero`, `getSkillCharms`, the `_charms` branch of `splitSkillDict` and the `SkillCharms` / `CharmData` types; delete `scripts/import-charms.ts`, the `import:charms` script and its `import:seasonal` entry, and the two `app/charm*.json` labels.
- The `s` board section is file format, not season data: it stays if phantimals are replaced by another seasonal unit type. Charms have no URL presence, so their retirement has no decode story.

## Related Documentation

- [`/docs/architecture/URL_SERIALIZATION.md`](./URL_SERIALIZATION.md) - Board sections, including the phantimal `s` section and map wire ids
- [`/docs/architecture/TEAMS.md`](./TEAMS.md) - Team ingress, canonical records and team types
- [`/docs/architecture/SKILLS.md`](./SKILLS.md) - Skill registry and artifact targeting
