# Seasonal Content

Three things rotate with the game's seasons: phantimals (units that stand on the grid beside the heroes), the seasonal artifacts, and charms (per-hero skill upgrades shown with the skill text).

Two facts shape the design. Stargazer's seasonal ids restart each season (artifacts from 7, phantimals by faction), so a bare id cannot say which season's unit it names. And a new season's skill text usually reaches the upstream data feed weeks after the game flips, so a season has to ship without it and pick the text up later.

## Where the content comes from

```
  upstream data feed
          │
          ▼
     the exports ──────▶  data pack: text and icons ───┐
          │                                            │ npm run data
          │ writes, checks                             ▼
          └────────────▶  seasonal data files ───────▶ app
                                                       ▲
  by hand ─────────────▶  tags, targeting, skill code ─┘
```

| Content                             | Files                                                                          | Written by   |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------ |
| Phantimal id, faction, range, flags | `src/data/seasonal/phantimal/<slug>.json`                                      | data export  |
| Phantimal names                     | `src/locales/seasonal/phantimal/`                                              | data export  |
| Phantimal skill text                | `src/pack/text/skill/<code>/_phantimals.json`                                  | data export  |
| Artifact id and stats               | `src/data/seasonal/artifact/` (pre-season: `src/data/artifact/`, by hand)      | data export  |
| Artifact names                      | `src/locales/seasonal/artifact/`                                               | data export  |
| Artifact effect text                | `src/pack/text/skill/<code>/_artifacts.json`, pre-season included              | data export  |
| Charm id, season, heroes            | `src/data/seasonal/charm/<id>.json`, `src/pack/text/skill/<code>/_charms.json` | data export  |
| Charm tags                          | `tags` in each charm data file                                                 | hand         |
| Phantimal and artifact tags         | `tags` in each phantimal and artifact data file                                | hand         |
| Phantimal skills, artifact arrows   | `src/lib/skills/seasonal/phantimal.ts`, `src/lib/skills/artifact.ts`           | hand         |
| Icons                               | `src/pack/images/seasonal/{artifact,phantimal}/<slug>.png`                     | image export |

The data export writes the structural files from the feed at a season's start, with each id, season, stat, range, damage type and faction as the feed gives it: an artifact's id is 6 plus its place in the season's set, a phantimal's follows its faction, and a phantimal that counts for both Hypogean and Celestial lists both. Ids are baked into share links, so it never changes an existing file's id within a season; a clash stops it for a hand decision. Hand-set fields such as `targeting` and `tags` are kept within a season (a slug that returns in a later season starts from the feed alone), and the previous season's files are removed.

It also writes the season's text and icons into the data pack, and checks the hand-written files against the feed: slug sets must match in both directions, phantimal factions must agree, and artifact ids, seasons and stats must equal the feed's. Any mismatch stops it. A missing feed is an error, never a wipe, and retiring a season's text is a step of its own. The app reads the pack's copy in `src/pack/` ([Architecture](../ARCHITECTURE.md)), and `npm run build` stops when a seasonal artifact or phantimal in the data files has no icon there, and lists those with no text yet.

## Reused ids

`CURRENT_SEASON` (`src/lib/seasonal.ts`) is the highest `season` in the loaded data files, so the season changes when a cutover deploys, not on a date. Every saved team records the season it was saved in. When a stored team comes from another season, its phantimals and seasonal artifacts are dropped as it is read (`stripRetiredSeasonal`, applied by `normalizeTeamPayload` on every Teams page load and by side-load), and a dismissible banner says what was removed (`useSeasonNotice`). The saved record itself keeps them until it is saved again, and its card shows an "S7"-style placeholder instead of looking the reused id up. `teamContentKey` includes the stamp only when a team has seasonal content, so a season change does not mark other teams as edited.

The arena autosave is stored without a season, so `runSeasonRotationPass` (`src/utils/seasonRotation.ts`) keeps a marker (`stargazer.season`, a decimal string such as `"8"`) and strips the autosave once per season change. A missing marker, or one that is not one to four digits, counts as season 7 (`PRE_MARKER_SEASON`), the season the marker shipped in.

Share links carry no season, so an old link shows whatever the current season has under its ids. Links are treated as disposable, so this is accepted.

Phantimal skills are keyed by id, so they have the same problem: a leftover skill would run on the next season's phantimal with that id. Each registration therefore names its phantimal (`phantimal-<slug>`), and a test fails when a name no longer matches the data file holding its id. Artifact rules are keyed by artifact name instead, so a leftover rule matches no artifact and draws nothing. Another test requires every seasonal data file's `season` to equal `CURRENT_SEASON`, so a partial bump fails too.

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

A Spirit Mark highlights the unit on the tile behind (or in front of) its phantimal. In the game this unlocks weeks into a season, so a mark paints only when the phantimal's data file sets `"targeting": true`, and stays hidden until then even with the Skills toggle on. Phantimals always draw their normal attack arrows at their range. The registry holds one skill per id, so a phantimal that has a companion takes its mark as `withEffects` over the companion skill. A mark goes to a hero, so another phantimal or phantimal companion on the chosen tile is passed over for the next tile in the chain. A companion can carry its own mark, measured from its own tile and painted by its owner's skill (Wedge of Power marks the hero behind it).

Links store phantimals in each board's `s` section by local id, with companions as `N × 10000 + L` (bit layout in [URL Serialization](./URL_SERIALIZATION.md)). An id with no data renders on the grid as a removable "?".

## Seasonal artifacts

The six pre-season artifacts (`season: 0`) never rotate. `season` orders the artifact picker newest first. An artifact draws targeting arrows exactly when `ARTIFACT_TARGETING` has an entry under its name, so adding the rule turns it on, and the artifact leaving the data at a cutover turns it off.

## Phantimal and artifact tags

Phantimal and artifact data files, the six pre-season artifacts included, can carry a hand-written `tags` list, which the Seasonal tab's filter reads. It names each hero tag whose effect appears anywhere in the skill or effect text, upgrade levels included. The list has no modifiers or level pins, so `debuff` counts a stat reduction on one enemy as well as on all of them. A file without the field has no tags.

```json
{
  "id": 16,
  "name": "hurricane",
  "season": 8,
  "stats": { "hp": 23.9, "def": 44.9, "ranged-def": 18.2 },
  "tags": ["temp-buff"]
}
```

## Charms

A charm is a four-tier skill upgrade shared by several heroes, so its text is stored once under its id (the season and the charm's place in the season's list, `s8-1`) and each hero points to it. `_charms.json` sits in each language's skill text folder so it loads with that language's skill text; the route and hero walks skip files starting with `_`. Charms show under a hero's skills (`SkillCharmSection.vue`) and are indexed by skill search.

Each charm has a data file, `src/data/seasonal/charm/<id>.json`, where the data export writes its id, season and the heroes sharing it. Charms can carry tags, written by hand in the same file: each tag gives every tier (1 to 4) whose text carries the effect, plus the modifiers that describe the effect when it has any. Each tier's text is complete on its own, so an effect present from Elite lists all four:

```json
{
  "id": "s8-10",
  "season": 8,
  "heroes": [
    "contess",
    "damian",
    "evie",
    "hewynn",
    "ludovic",
    "mikola",
    "rolan",
    "solise",
    "velara"
  ],
  "tags": { "temp-buff": { "tiers": [1, 2, 3, 4], "mods": ["orion", "perseus"] } }
}
```

`loadCharacters` adds these to every hero sharing the charm as `{ "charm": <tier> }` pins that carry the tag's modifiers, so the hero-list filter, the Mechanics guide and the skill-page chips treat them as the hero's own tags. The data export keeps a charm file's hand-written fields within the season. A charm's effects change with the season, so the export removes the file of a charm the feed lacks, stops instead when that file holds fields written by hand, and deletes every charm file with the text when the season retires.

## Season cutover

```
game flips ──────▶ phase 1: structure ──▶ deploy   (no skill text yet)
feed catches up ─▶ phase 2: text ───────▶ deploy
in-game unlock ──▶ phase 3: targeting ──▶ deploy   (one phantimal at a time)
```

Each phase ships on its own, because a season's text and its in-game unlocks arrive weeks after the flip. Phase 1 brings the new ids, names in every app locale, artifact stats, phantimal factions and ranges, and portraits. Until phase 2 brings the text, which artifacts, phantimals and charms may each get on a different build, their modals show a pending line (`app.skill-details-pending`). In phase 3 an artifact draws arrows from the deploy that adds its rule, and a phantimal's Spirit Mark from the one that sets its `targeting`.

Nothing stored is rewritten at a cutover: stale teams are cleaned as they are read, and each device's arena autosave on its first visit after it. `PRE_MARKER_SEASON` does not change. The steps of each phase are in [Getting Started](../CONTRIBUTING.md#a-new-season).

## Related documentation

- [URL Serialization](./URL_SERIALIZATION.md): the `s` section and its bit layout
- [Teams](./TEAMS.md): where saved teams are loaded and normalized
- [Skills](./SKILLS.md): the skill registry and artifact targeting
