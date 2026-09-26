# Seasonal Content

Three things rotate with the game's seasons: phantimals (units that stand on the grid beside the heroes), the seasonal artifacts, and charms (per-hero skill upgrades shown with the skill text).

Two facts shape the design. The game reuses ids from one season to the next, so a bare id cannot say which season's unit it names. And a new season's skill text usually reaches the upstream data feed weeks after the game flips, so a season has to ship without it and pick the text up later.

## Where the content comes from

```
  upstream data feed
          │
          ▼
      import:* ────────▶  skill, effect and charm text ─┐
          │                                             │
          │ checks                                      │
          ▼                                             ▼
  hand-written files ──▶  ids, stats, ranges, names ──▶ app
                                                        ▲
  image host ──────────▶  icons ────────────────────────┘
```

| Content                             | Files                                                                          | Written by          |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------- |
| Phantimal id, faction, range, flags | `src/data/seasonal/phantimal/<slug>.json`                                      | hand                |
| Phantimal name and skill text       | `src/locales/seasonal/phantimal/<slug>.json`                                   | `import:phantimals` |
| Artifact id and stats               | `src/data/seasonal/artifact/` (pre-season: `src/data/artifact/`)               | hand                |
| Artifact names                      | `src/locales/seasonal/artifact/`                                               | hand                |
| Artifact effect text                | `src/locales/seasonal/artifact/effects/`                                       | `import:artifacts`  |
| Charms                              | `src/data/seasonal/charm/charms.json`, `src/locales/skill/<code>/_charms.json` | `import:charms`     |
| Charm tags                          | `src/data/seasonal/charm/tags.json`                                            | hand                |
| Phantimal skills, artifact arrows   | `src/lib/skills/seasonal/phantimal.ts`, `src/lib/skills/artifact.ts`           | hand                |
| Icons                               | image host, `seasonal/{artifact,phantimal}/<slug>.webp`                        | exported per season |

Ids and ranges are hand-written because ids are baked into share links and range is a board-simulation judgment the feed does not carry.

`npm run import:seasonal` runs `import:skills`, `import:charms`, `import:artifacts` and `import:phantimals` in that order (charm text is checked against the skill keyword glossaries, so skills go first). Each importer writes what the feed carries and checks the hand-written files against it: slug sets must match in both directions, phantimal factions must agree, and artifact stats must equal the feed's through the stat-code map in `scripts/import-artifacts.ts`. Any mismatch fails the run. A missing feed is an error, never a wipe. `--retire` deletes an importer's generated files on purpose, and `--src-dir` / `--url-base` point at another feed.

## Reused ids

`CURRENT_SEASON` (`src/lib/seasonal.ts`) is the highest `season` in the loaded data files, so the season changes when a cutover deploys, not on a date. Every saved team records the season it was saved in. When a stored team comes from another season, its phantimals and seasonal artifacts are dropped as it is read (`stripRetiredSeasonal`, applied by `normalizeTeamPayload` on every Teams page load and by side-load), and a dismissible banner says what was removed (`useSeasonNotice`). The saved record itself keeps them until it is saved again, and its card shows an "S7"-style placeholder instead of looking the reused id up. `teamContentKey` includes the stamp only when a team has seasonal content, so a season change does not mark other teams as edited.

The arena autosave is stored without a season, so `runSeasonRotationPass` (`src/utils/seasonRotation.ts`) keeps a marker (`stargazer.season`) and strips the autosave once per season change. A missing marker counts as season 7 (`PRE_MARKER_SEASON`), the season the marker shipped in. Teams saved before stamps existed are stamped 7 by the temporary shim in `src/utils/upgradeMigration.ts`.

Share links carry no season, so an old link shows whatever the current season has under its ids. Links are treated as disposable, so this is accepted.

Code keyed by id has the same problem: a leftover phantimal skill or artifact rule would apply to the next season's unit with that id. Each registration therefore names its unit (`phantimal-<slug>` for skills, `name` on each `ARTIFACT_TARGETING` entry), and tests fail when a name no longer matches the data file holding its id. Another test pins `CURRENT_SEASON` and requires every data file's `season` to equal it, so a partial bump fails too.

## Phantimals

A phantimal takes a grid tile like any unit, under the id `100000 + L`, where L is the local id from its data file. Occupancy, targeting, pathfinding and movement read whatever stands on a tile, so they need no phantimal-specific code. Three rules differ from heroes:

- It holds no team slot, and a team fields at most one.
- It can only swap places within its own team.
- Its team needs at least `PHANTIMAL_FACTION_REQUIREMENT` (3) heroes of its faction. A data file's `qualifyingFactions` lets it count more than one faction.

The faction rule is checked on placement, on cross-team moves, and by a watcher on each board. The watcher removes a phantimal whose team stops qualifying and places one when a team starts qualifying. It fires once per change, so a phantimal the user removed stays removed. Bulk restores (links, team loads, board moves) reset its baseline with `seedPhantimalBaseline`, so a saved team without a phantimal loads without one.

Local ids 1 to 12 are available per season. Ids 13 to 15 are reserved for tests, and the 4-bit link field allows nothing higher.

### Companions

The phantimal id range mirrors the hero range: a phantimal's companion is `100000 + N × 10000 + L`, the same arithmetic hero companions use. That lets the generic companion skill (`createCompanionSkill` with `raisesCapacity: false`) handle spawning, removing both together, moving and restoring. All id math for this range lives in `src/lib/characters/phantimal.ts`. The skill registry must not strip the phantimal offset, or phantimal 5 would pick up hero 5's skill.

A companion spawns on a random free tile of its team, and if there is none, placing the phantimal fails. It has no data file: its portrait slug and range come from the owning phantimal's skill (`companionImageModifier`, `companionRange`).

### Spirit Marks and the targeting switch

A Spirit Mark highlights the unit on the tile behind (or in front of) its phantimal. In the game this unlocks weeks into a season, so a mark paints only when the phantimal's data file sets `"targeting": true`. The mark can be written and tested early and turned on with a one-field edit; until then it stays hidden even with the Skills toggle on. The flag has no UI. Phantimals always draw their normal attack arrows at their range. The registry holds one skill per id, so a phantimal that has a companion takes its mark as `withTilePaint` over the companion skill. A mark goes to a hero, so another phantimal or phantimal companion on the chosen tile is passed over for the next tile in the chain. A companion can carry its own mark, measured from its own tile and painted by its owner's skill (Wedge of Power marks the hero behind it).

Links store phantimals in each board's `s` section by local id, with companions as `N × 10000 + L` (bit layout in [URL Serialization](./URL_SERIALIZATION.md)). An id with no data renders on the grid as a removable "?".

## Seasonal artifacts

The six pre-season artifacts (`season: 0`) never rotate. `season` orders the roster newest first and picks the icon source: pre-season icons are bundled, all others load from the image host (`isRemoteArtifact`). An artifact draws targeting arrows exactly when `ARTIFACT_TARGETING` has an entry for it, so adding the rule turns it on and deleting it at a cutover turns it off.

## Charms

A charm is a four-tier skill upgrade shared by several heroes, so its text is stored once under the feed's slug and each hero points to it. `_charms.json` sits in each language's skill locale folder so it loads with that language's skill text; the route and hero walks skip files starting with `_`. Charms show under a hero's skills (`SkillCharmSection.vue`) and are indexed by skill search.

Charms can carry tags. `src/data/seasonal/charm/tags.json` is hand-written, and gives each tagged charm every tier (1 to 4) whose text carries the effect. Each tier's text is complete on its own, so an effect present from Elite lists all four:

```json
{ "ep8heal": { "temp-buff": [1, 2, 3, 4] } }
```

`loadCharacters` adds these to every hero sharing the charm as `{ "charm": <tier> }` pins, so the roster filter, the Mechanics guide and the skill-page chips treat them as the hero's own tags. The charm's tiers filter like skill levels. A charm's effects change with the season, so `import:charms` fails when the file names a charm the feed lacks, and `--retire` deletes it with the text.

## Season cutover

```
game flips ──────▶ phase 1: structure ──▶ deploy   (no skill text yet)
feed catches up ─▶ phase 2: text ───────▶ deploy
in-game unlock ──▶ phase 3: targeting ──▶ deploy   (one phantimal at a time)
```

Each phase ships on its own.

### Phase 1: structure, at the game's flip

It needs the new ids, en/zh names, artifact stats, phantimal factions and ranges, and portraits, but no text.

1. Publish the new icons, companions included, to the image host before deploying.
2. Retire the old generated text: `npm run import:phantimals -- --retire`, then the same for `import:artifacts` and `import:charms`. Charms carry no season stamp, so the old text cannot stay up.
3. Replace the hand-written data and name files, reusing the freed ids. Leave `targeting` out, and set `qualifyingFactions` where a phantimal counts two factions. Phantimal names live in importer-owned files, so write name-only stubs (`{"name": {"en", "zh"}, "skills": []}`) for phase 2 to overwrite. A new stat needs an `ArtifactStatKey`, a label in `src/locales/game/`, and its feed code in the importer's stat-code map.
4. Replace `src/lib/skills/seasonal/phantimal.ts` (usually no Spirit Marks yet, one companion skill per phantimal that has a companion) and delete the old season's `ARTIFACT_TARGETING` entries, with their tests.
5. Bump the season pin in `tests/unit/lib/seasonal.test.ts` and replace the `season N` block in `tests/unit/skills/phantimal.test.ts`.
6. If the Supreme League map list changed, move the new preset maps onto the ids the old ones free in `MAP_WIRE_IDS` (`src/lib/teams/wire.ts`) and edit the `sl` row of `TEAM_VARIANTS` (`src/lib/teams/modes.ts`). Boards on the old list stop reading as Supreme League.
7. Run the tests and deploy. Nothing stored is rewritten: stale teams are cleaned as they are read, and each device's arena autosave on its first visit.

Phase 1 is done when the tests pass, every new icon loads, and modals without text show "Skill details not yet available" (`app.skill-details-pending`). Until the feed has the season, `import:phantimals` fails its slug check before writing anything, so the stubs are safe; `import:skills` can still run on its own.

### Phase 2: text, when the feed carries the season

Artifacts, phantimals and charms may arrive on different builds. Run `npm run import:seasonal`, review the diff, and deploy. Once the charm text is in, read every tier and write the season's `tags.json`, using the tags' meanings in the hero data. A failed check means a phase 1 value or a stat-code mapping is wrong: fix the data file, not the check. It is done when no phantimal locale file still has `"skills": []`, every seasonal artifact has an effects file, and the charm tests run instead of skipping.

### Phase 3: targeting

Add an artifact rule whenever its mechanic is known; it draws from that deploy on. Write a phantimal's Spirit Mark whenever convenient, and set `"targeting": true` in its data file once the mark is live in the game.

`PRE_MARKER_SEASON` and the shim's 7 do not change at a cutover.

## Removing a feature

Phantimals, their companions and charms each live in their own files plus a few call sites. To remove one, delete its files and follow the call sites:

```sh
grep -rn "inPhantimalBand\|isPhantimalId\|Phantimal" src tests scripts
grep -rn "companionLocalId\|phantimalOwnerId\|PhantimalBandLocal\|raisesCapacity" src tests
grep -rni "charm" src tests scripts .prettierignore
```

The first finds phantimals, the second only their companions, the third charms. Removing phantimals also removes the link sections at bits 3 and 6; old links that set those bits then fail to decode, which is accepted. Charms have no presence in links.

## Related documentation

- [URL Serialization](./URL_SERIALIZATION.md): the `s` section and its bit layout
- [Teams](./TEAMS.md): where saved teams are loaded and normalized
- [Skills](./SKILLS.md): the skill registry and artifact targeting
