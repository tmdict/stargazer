# Skills

Placed units carry abilities that paint tiles, draw arrows and lines, or spawn companions. The skill engine keeps that state correct while units are placed, moved, swapped and removed, on several boards at once, when two skills may paint the same tile and a failed activation must leave the board as it was.

Skill text and the skill pages are a separate system, described in [Skill Pages](./SKILL_PAGES.md).

## How it fits together

```
┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
│ Grid components    │      │ useGridContext     │      │ lib/characters     │
│ GridManager,       │─────▶│ one per board:     │─────▶│ place, move, swap, │
│ GridTiles,         │      │ Grid, SkillManager │      │ remove, each in    │
│ SkillTargeting     │      │ and computeds      │      │ a transaction      │
└────────────────────┘      └────────────────────┘      └────────────────────┘
           ▲                           │                           │
           │                           │ creates with              │
           │ computeds                 │ store lookups   activate, │
           │ re-read on                │               deactivate, │
           │ targetVersion             ▼                    update │
           │                ┌────────────────────┐                 │
           │                │ SkillManager       │                 │
           └────────────────│ active skills,     │◀────────────────┘
                            │ paint refcounts,   │
                            │ targets, lines     │
                            └────────────────────┘
                                       ▲
                                       │ definition     self-register when
                                       │ by base id     skill.ts globs them
                            ┌────────────────────┐      ┌────────────────────┐
                            │ registry           │◀─────│ characters/*.ts    │
                            │ one Skill per hero │      │ seasonal/*.ts      │
                            └────────────────────┘      └────────────────────┘
```

Each board's context (`src/composables/useGridContext.ts`) owns a `Grid` and a `SkillManager` and hands both to the character operations. The Pinia `skill` and `character` stores only forward to the active board, for the debug panel and the Arena roster. Boards, contexts and id ranges are covered in [Grid](./GRID.md).

## Registry and skill lifecycle

The registry (`src/lib/skills/registry.ts`) holds one `Skill` per base hero. Skill files register themselves as an import side effect: the eager `import.meta.glob` calls at the bottom of `skill.ts` load `characters/*.ts` and `seasonal/*.ts`. The registry stores `SkillBase<unknown>`, and `skill.ts` binds it to `SkillContext` through typed wrappers, because `SkillContext` refers to `SkillManager` and a direct import would be circular.

A synergy copy runs its base hero's skill. Only the definition lookup strips the synergy band (`decomposeUnitId`), while every piece of instance state stays keyed by the placed id, so a builder must read `ctx.characterId` and never the id in its own config.

`SkillManager` is a plain class, one per board. The board wraps it in `reactive`, and its computeds call `getTargetVersion()` before reading, so every visible mutation bumps `targetVersion` to trigger a re-derive. Instance state is keyed `characterId-team`, so the same unit can be active on both teams.

Place, move, swap and remove run their tile changes and skill hooks inside `executeTransaction` (`src/lib/characters/transaction.ts`). When `onActivate` throws, `activateCharacterSkill` drops the entry and returns false, and the transaction rolls the whole operation back. `updateActiveSkills` isolates each skill in its own try/catch so one failure cannot leave the rest stale, and a unit that vanished without going through removal is fully deactivated so its companions and capacity change are not leaked. Companions cannot be placed directly: only a skill creates them ([Companions](./skills/COMPANION.md)).

## Builders and composition

`src/lib/skills/utils/builders.ts` covers the common shapes: one target with an optional arrow, one highlighted tile, a painted tile set, a line set, and companions. Target helpers are documented in [Targeting](./skills/TARGETING.md).

The registry allows one skill per character, so a hero with several behaviors decorates a base skill. `withTilePaint` and `withSkillLine` run after the base hooks on activate and update, and clear before the base on deactivate. Elijah-Lailah, for example, is a companion skill wrapped in both. `createTilePaintSkill` and `createLineSkill` are the same decorators over an empty base. Kulu and Reinier pass a hand-written object to `registerSkill`.

A companion's id is `N × grid.companionIdOffset + characterId`, so lookups resolve it to its main hero. The synergy and phantimal bands mirror this arithmetic, so it holds inside them too ([Seasonal Content](./SEASONAL.md)). `createCompanionSkill` raises team capacity by its count unless `raisesCapacity: false`, which a phantimal uses because it holds no team slot.

## Paint channels and lines

A tile has two paint channels, `tileColorModifiers` for the border and `tileFillModifiers` for the fill. Each maps a hex to its colors with a refcount per color, so independent skills can paint the same color on one tile and one skill's cleanup never removes another's paint. Kulu depends on this: its two teams' zones overlap, and it never repaints on update. `paintTiles` diffs against the set the instance painted last time, and `TilePaint.fill` picks the channel for both the add and the remove, so a tile always leaves the channel it entered.

Lines need no diff: `setSkillLines` replaces the instance's set outright and the renderer draws the flattened list. A `SkillLine` runs border to border between hex centers by default. With `fromCorner` and `toCorner` it runs between hex corners instead. On a single hex that is an exact tile edge, as `outlineEdges` and `zoneOutline` produce. Across two hexes it is a lane boundary that `SkillTargeting` clips to the visible region (`clipLaneBoundary`).

Arrows take their color from the definition's `targetingColorModifier`, while lines and paints carry their own color. Every effect color comes from `SKILL_COLORS` (`utils/colors.ts`), referenced by name, so a hue shared across heroes changes in one place. `SkillTargeting` draws arrows and lines and `GridTiles` draws paints, both only while the Skills toggle is on.

## Lookups

A skill that needs data-store facts reads them from `ctx.lookups`, never from the store. `SkillLookups` (`factionOf`, `classOf`, `seasonalTargeting`) is injected into each `SkillManager` by its board, because that data lives in the game-data store outside the pure lib. Each lookup is optional so hand-built test contexts supply only what they read.

`seasonalTargeting` reports whether a phantimal's data file sets `"targeting": true`. A Spirit Mark paints nothing while it is off, even with the Skills toggle on, so a mark can ship before its in-game unlock. Artifacts have no such switch ([Seasonal Content](./SEASONAL.md)).

## Artifact targeting

Some artifacts act on specific units, such as Enlightening on the rearmost ally, and draw arrows from their slot's host cell (`artifactHostHex`). This is not a Skill. A skill belongs to a placed unit and lives with its placement, while an artifact belongs to board-level slot state and has no hex for the lifecycle to track. Each board instead derives `artifactArrows` as a computed over both slots and the grid, the same way the closest-target arrows are derived, so no place, move or remove path needs wiring.

`ARTIFACT_TARGETING` (`src/lib/skills/artifact.ts`) is keyed by artifact id. A rule receives the team whose slot holds the artifact and may pick units on either team, using the same whole-team helpers as hero skills (`frontmostUnit`, `frontmostUnits`, `rearmostUnit` in `src/lib/skills/utils/distance.ts`), so phantimals and companions count the same way. An artifact draws exactly when it has an entry, and only its base-level targets are drawn. Each entry names its artifact, and a test fails when the name no longer matches the data file holding that id, because seasonal ids are reused.

The arrows render in `SkillTargeting` in the team colors (`TEAM_ARROW_COLORS`) and share the Skills toggle. Team view hides the enemy slot's arrows, and also any arrow whose target tile it crops out, such as an ally artifact pointing at enemies. `GridArrow` prefixes its SVG marker id with the board id, because marker ids are document-wide and the Teams page renders several boards.

If an artifact ever needs a side effect such as a spawned unit or a capacity change, give skills a caster-agnostic source instead of extending this table.

## Adding a skill

Add `src/lib/skills/characters/<slug>.ts`, or `seasonal/` for a unit that rotates. The block comment above `registerSkill` describing the in-game behavior is the skill's only documentation. Start from a builder. If none fits, register a plain object and pair every paint or line it adds with a removal (`paintTiles` and `clearPaintedTiles` handle the diff). Useful references are `himmel.ts` for a tile paint using `classOf`, `elijah-lailah.ts` for a companion with decorators, and `kulu.ts` for a custom lifecycle.

## Related documentation

- [Grid](./GRID.md): boards, transactions and the synergy id band
- [Companions](./skills/COMPANION.md): companion spawning, links and capacity
- [Targeting](./skills/TARGETING.md): distance, ring and symmetry helpers
- [Seasonal Content](./SEASONAL.md): phantimal skills and seasonal artifact rules
- [Skill Pages](./SKILL_PAGES.md): skill text, locales and search
