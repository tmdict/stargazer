# Team Import

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both rosters with each hero's paragon and refinement, both artifacts, and a record name. Recognition is pure TypeScript over RGBA buffers (`src/lib/import/`), run in a web worker. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save as New changes the boards.

The hard part is that screenshots vary. Players crop them, phones have different shapes, and the in-game card zooms each portrait slightly differently. The readers have to find the cards before they can read them, and say how sure they are.

## How it fits together

```
┌─ TeamImportModal ────────┐            ┌─ TeamsView ──────────────┐
│ drop zone, review,       │    plan    │ grids.applyRosters       │
│ Save as New              │───────────▶│ teamLibrary.saveAsNew    │
└───────────────────┬──┬───┘            └──────────────────────────┘
       shots, edits │  ▲
                    ▼  │  readings, plan
┌─ useTeamImport ───┴──┴───┐            ┌─ teamImport.worker ──────┐
│ shots and overrides      │───────────▶│ lib/import readers       │
│ learned icons            │   images   │ hero table               │
│ buildTeamImportPlan      │◀───────────│ artifact table           │
└──────────────────────────┘  readings  └──────────────────────────┘
```

Shots are decoded to pixels on the main thread and read in the worker by canvas-free code. `scripts/check-import.ts` drives the same readers and reference assembly from Node, so the checker and the app cannot drift apart.

## Decisions

Landmarks come before templates. The Ally and Enemy tabs place the card columns, and template matching only settles exact positions and identities. `layout.ts` holds every nominal position and size on the result screen along with its per-shot range, while each reader owns its own template searches and score floors.

A reading never changes once made. Every review decision is an override stored beside it, so each cell can show its confidence, every edit can be undone, and a corrections export carries the original prediction next to the fix.

The plan is pure data. Readings plus overrides become a `TeamImportPlan` with no store access (`src/lib/teams/teamImport.ts`, a sibling of `sideLoad.ts`), and the grids store applies it with its own placement primitives.

## Evidence

Each field of a reading comes from its own visual signal. The readers therefore stay separate, and a correction to one never moves another.

| Reading        | Evidence                                           | Consequence                                                                    |
| -------------- | -------------------------------------------------- | ------------------------------------------------------------------------------ |
| Hero           | face crop against portrait and learned descriptors | new face examples improve identity without touching any other reader           |
| Paragon        | card frame against the six frame templates         | a wrong frame also displaces the face and star crops, so doubt covers the cell |
| Refinement     | count and colour of the stars above the face       | independent of the hero descriptor                                             |
| Artifact       | header icon against the artifact images            | margins are thin, so artifacts are always offered for review                   |
| Map and result | strip ring and badges, Ally tab colour             | which board a shot fills is settled in review                                  |

## Pipeline

`readScreenshot` (`src/lib/import/pipeline.ts`) works through these steps:

1. The composable rejects shots under 600 px wide and draws the rest at `CANONICAL_WIDTH` (1150). Full screen width is the one invariant, because the game lays the panel out from it. A crop may lose height at either end.
2. `findTabs` locates the Ally and Enemy tabs, which seed each card column, and the frame comb in `findPanelAnchor` settles it. Without tabs, the columns are tried at their crop positions, then `scanForColumns` looks for a pair anywhere in the shot. A column found from tabs or by the scan is trusted down to `LANDMARK_FLOOR`, and one at its crop position only down to `ANCHOR_FLOOR`. Below its floor a column's cells come back empty instead of carrying a stranger's face.
3. For each card, the best frame match (`matchCard`) gives both the paragon level and the card's exact box. `rankHeroes` ranks the face described at nine small offsets, `readStars` counts the star row, and `assignUnique` settles each side so no hero is read twice.
4. `readStrip` places the strip from the green ring around the current map, `readArtifact` matches the header icons, and the Ally tab's colour says who won the map.

## Hero identity

A descriptor is a 32 × 24 RGB face crop with each channel normalised to zero mean and unit norm, which cancels the warm tint the frame casts. It is stored as Int8 at ×400 in the worker table and in every saved descriptor.

The table cuts every bundled portrait over a grid of crop windows, because the in-game card zooms the same painting differently per hero. A costume reference is captured from the game's skin card, where the face sits smaller, so it adds a second grid of smaller windows. Learned and bundled descriptors join as extra rows. Ranking scores the whole table at the centre offset, re-scores the leaders at the other offsets, and gives the top portrait candidates (`REFINE_KEEP`) a finer window search. Learned rows keep their scores and do not use up that budget.

A pick needs `HERO_SCORE_FLOOR` and a lead of `HERO_SURE_MARGIN` over the best candidate of any other hero, learned or bundled. The lead must reach `COSTUME_SURE_MARGIN` when the winning window came from a costume, since the looser costume framing fits strangers more easily.

## Review

`cellState` and `reviewStates` derive each cell's state once, so the review grid and each card's "to review" count agree. A cell is sure, needs its hero confirmed, needs its paragon confirmed (hero settled but the frame match doubtful), has no candidate over the floor, or is a duplicate of another cell on its side after edits. Confirming or picking a hero settles identity separately from the paragon level. Artifacts are reviewed beside the icon crop from the screenshot and do not count toward a card's review count.

`useTeamImport` keeps its state at module level, so the modal can close and reopen without losing shots. Save as New clears them once the plan is handed over, and `TeamsView` calls `disposeTeamImport` when the page is left. The worker lives for one page visit. References are fetched on first open and posted once, shots dropped meanwhile queue until the worker is ready, and a failed load retries on the next open.

`swapSides` puts every screenshot's Ally column on the enemy side of its board. The game's Ally tab is always the viewing player, whichever side of the board they fought from. It is one choice per match, since a player keeps one side for every map and the boards hold a hero once per side page-wide. It is a placement choice, so it stays out of the export and resets with the shots.

### Learning

A hero correction teaches the face only when the reader was unsure of the hero and sure of the frame. A doubtful frame means the crop may be off the face, and storing it would teach noise. Picking the reader's own top candidate, or no hero, takes back an earlier lesson for that face. Lessons persist in `stargazer.import.learned`, capped at `LEARNED_ICONS_CAP` with the oldest dropped first, and the worker rebuilds its table on every change.

## Plan and save

Player names are optional. Without both, the record name stays blank and the library picks its automatic name. With both, the name follows the form `S7 - GNX > 10 (1,3,4,5 > 2)`: the ally-side player first, `>` when they won more maps, and each player's map numbers. The name follows board sides, so after a swap it reads `S7 - 10 < GNX (2 < 1,3,4,5)`.

`isBlockingIssue` separates issues that would put a wrong roster on a board (a map filled twice, a duplicate hero, a hero or artifact repeated across boards) from ones that only leave something out. Blocking issues and invalid names stop Save as New, and warnings do not. Applying and saving belong to the Teams page ([Teams](./TEAMS.md)). They are not one transaction: a full library leaves the boards as an unsaved team carrying the name, and skipped placements are reported.

## Reference descriptors

Three sources feed one hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the checker alike. Portraits and costumes give general coverage. The bundled [`hero-icons.json`](../../src/data/import/hero-icons.json) holds approved face examples for cards the portraits cannot match, shipped as ordinary versioned data. Browser learning adds examples private to that browser. Geometry, ranking and confidence do not depend on which source a row came from.

The bundled file, browser storage and the corrections export share one envelope, validated by `readLearnedIcons`:

```json
{
  "v": 1,
  "spec": { "descriptor": [32, 24], "box": [0.23, 0.2, 0.69] },
  "icons": [
    { "characterId": 104, "descriptor": "<Int8 × 2304, base64>", "learnedAt": 1757800000000 }
  ]
}
```

`spec` pins the descriptor size and face box, so a crop change discards stale data. A change to normalisation or quantisation must bump `v`. The reference-file test rejects unknown hero ids, invalid envelopes and duplicate descriptors.

Each descriptor appears once. A local lesson for identical descriptor bytes overrides the bundled label, and forgetting local learning restores it. Different crops of one hero stay separate examples, and nothing is averaged or voted. No client correction ever edits the bundled file.

### Corrections export

`exportCorrections` writes a user-controlled download, never an upload:

```
{
  format: 'stargazer-import-corrections', version: 2, createdAt,
  learnedIcons, // the envelope above
  shots: [{
    source: { name, size, sha256 },
    context: { season, mapCount, imageWidth },
    predicted: ScreenshotReading, // card pixels and descriptor buffers omitted
    labels: { cells, artifacts, mapIndex?, winner? }, // sparse explicit edits
  }],
}
```

A missing label means unreviewed, and `null` means an explicit removal. The SHA-256 identifies source files, never faces. Learned descriptors carry no source image, so checking or regenerating one needs the original screenshots.

## Checking against real screenshots

The checker is the only regression check on real images and the first thing to run when the game changes its result screen. `scripts/lib/importTooling.ts` decodes references the way the app does (EXIF applied, portraits re-encoded as WebP, icons capped at 128 px), from the image host or from a local copy of its `img/` tree.

```sh
npm run check:import -- --samples <dir> [--truth <json>] [--references <dir>] [--maps 5]
```

Truth defaults to `truth.json` beside the samples. Cells `a1` to `a5` and `e1` to `e5` score hero, paragon and refinement separately, and every field is optional, since an omitted field is unreviewed. Artifacts score only where labelled, and a strip count that disagrees with `maps` is flagged.

```json
{
  "match-1.png": {
    "maps": 5,
    "cells": {
      "a1": { "hero": "gunnar", "p": 4, "r": 4 },
      "e1": { "hero": "phraesto", "p": 2 }
    },
    "artifacts": { "a": "<artifact slug>", "e": null }
  }
}
```

Truth data measures the reader, and reference data changes it. Fixing a wrong expected label changes the evaluation, not the matcher. A descriptor update is judged by which cells it fixes and which it newly breaks, never by its total score alone.

`importReferenceUrl` fetches the import references from the image host under `img/import/`: the paragon frames `frame-p0` to `frame-p4-crown`, a `skins.json` manifest shaped `{ "<hero slug>": ["<file>", …] }`, and the costume captures under `skin/`. A missing manifest means no costumes. Artifact references are the bundled permanent icons plus the hosted seasonal set, capped at 128 px.

## Related documentation

- [Teams](./TEAMS.md): where the import lands, and how it applies and saves
- [Grid & Characters](./GRID.md): page-wide uniqueness and the pickers the review reuses
- [Seasonal Content](./SEASONAL.md): seasonal artifact icons on the image host
