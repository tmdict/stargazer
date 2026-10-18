# Team Import

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both lineups with each hero's paragon and refinement, both artifacts, and a record name. Formation screenshots, optional, add where each unit stands ([Formation screenshots](#formation-screenshots)). Recognition is pure TypeScript over RGBA buffers (`src/lib/import/`), run in a web worker. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save as New changes the boards.

The hard part is that screenshots vary. Players crop them, phones have different shapes, and the in-game card zooms each portrait slightly differently. The readers have to find the cards before they can read them, and say how sure they are.

## How it fits together

```
┌─ TeamImportModal ────────┐            ┌─ TeamsView ──────────────┐
│ drop zone, review,       │    plan    │ grids.applyLineups       │
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

| Reading        | Evidence                                                                                              | Consequence                                                                                                                          |
| -------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Hero           | face crop against portrait and learned descriptors                                                    | new face examples improve identity without touching any other reader                                                                 |
| Paragon        | card frame against the six frame templates, searched up to 12 px from where the anchor puts each card | a wrong frame also displaces the face and star crops, so doubt covers the cell                                                       |
| Refinement     | count and colour of the stars above the face                                                          | independent of the hero descriptor; a refined reading on weak colour evidence, or an R0 row with a faint pink tint, waits for review |
| Artifact       | the header icon's art disc against each artifact image's centre, by shape and colour                  | sure only with a clear lead, a good shape match and art in the crop; otherwise it waits for review                                   |
| Map and result | strip ring and badges, Ally tab colour                                                                | which board a shot fills is settled in review                                                                                        |

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

`cellState` and `reviewStates` derive each cell's state once, so the review grid and each card's "to review" count agree. A cell is sure, needs its hero confirmed, needs its paragon confirmed (hero settled but the frame match doubtful), needs its refinement confirmed (hero and paragon settled but the star colour doubtful), has no candidate over the floor, or is a duplicate of another cell on its side after edits. Confirming or picking a hero settles identity separately from the paragon level. `artifactState` treats each side's artifact the same way: settled once read surely or edited, otherwise counted in the card's review number, with the icon crop from the screenshot shown beside it.

`useTeamImport` keeps its state at module level, so the modal can close and reopen without losing shots. Save as New clears them once the plan is handed over, and `TeamsView` calls `disposeTeamImport` when the page is left. The worker lives for one page visit. References are fetched on first open and posted once, shots dropped meanwhile queue until the worker is ready, and a failed load retries on the next open.

`swapSides` puts every screenshot's Ally column on the enemy side of its board. The game's Ally tab is always the viewing player, whichever side of the board they fought from. It is one choice per match, since a player keeps one side for every map and the boards hold a hero once per side page-wide. It is a placement choice, so it stays out of the export and resets with the shots.

### Learning

A hero correction teaches the face only when the reader was unsure of the hero and sure of the frame. A doubtful frame means the crop may be off the face, and storing it would teach noise. Picking the reader's own top candidate, or no hero, takes back an earlier lesson for that face. Lessons persist in `stargazer.import.learned`, capped at `LEARNED_ICONS_CAP` with the oldest dropped first, and the worker rebuilds its table on every change.

## Plan and save

Player names are optional. Without both, the record name stays blank and the library picks its automatic name. With both, the name follows the form `S7 - GNX > 10 (1,3,4,5 > 2)`: the ally-side player first, `>` when they won more maps, and each player's map numbers. The name follows board sides, so after a swap it reads `S7 - 10 < GNX (2 < 1,3,4,5)`.

The prefix and names persist in `stargazer.import.names`. A missing or non-string field takes its default: the current season as `S<season>`, and empty names.

```json
{
  "prefix": "S8",
  "left": "GNX",
  "right": "10"
}
```

`isBlockingIssue` separates issues that would put a wrong lineup on a board (a map filled twice, a duplicate hero, a hero or artifact repeated across boards) from ones that only leave something out. Blocking issues and invalid names stop Save as New, and warnings do not. Applying and saving belong to the Teams page ([Teams](./TEAMS.md)). They are not one transaction: a full library leaves the boards as an unsaved team carrying the name, and skipped placements are reported.

## Formation screenshots

A formation screenshot is the game's formation panel for one team: the board under the formation camera with that team's deployment tiles lit and its units standing on them, the slot circles of the match's maps under it, and the team's card row with its artifact. The modal takes them in a drop area of their own, beside the result screenshots, and each fills one side of the board its slot names. A board's heroes, upgrades and artifact come from its result screenshot when there is one; a formation screenshot adds the tile every unit stands on, its companions and its phantimal. A board with only formation screenshots takes its lineup from their card rows, or, without a card row, from the portraits at paragon and refinement 0, and only the sides they show are replaced.

`readFormation` (`src/lib/import/formation.ts`) places every region from the board, so a capture's size and padding do not matter:

1. `fitBoard` (`board.ts`) finds the board. The game draws Stargazer's own grid under the camera the perspective view reproduces (`PERSPECTIVE`), so with that shape fixed a fit is a scale and a centre. The thin light outline is the evidence: each outline sample scores how far it stands above its neighbours, less the same for points just off the line. The search runs on a copy 480 px wide, coarse over every board wholly inside the shot, then finer; under a quarter of the outline found means no board, which is also how a result screenshot dropped there reads.
2. Each tile is checked for a portrait ring standing above it: units stand with their pointer's tip at the tile centre, so the ring sits 0.83 hex radii above it, 0.63 across, on every row. The ring is light and grey, and a tile holds a unit when enough of its circle reads so; a nearer portrait can hide part of a far one's ring.
3. The lower half of each tile, less what portraits cover, reads lit or not, split at the widest gap between the board's own tile readings. Every map's ally tiles lean to the near half and its enemy tiles to the far half, so the lit tiles say which team the shot shows.
4. The slot circles sit at a fixed distance under the board; the selected one is ringed in green (`ringGreen`), and the circles with a numeral give the count.
5. The card row starts at one of two places, as the phantimal slot is there or not, and is read on a copy resampled to the scale the frame templates were cut at, with the result reader's `readCards`. The artifact card's disc before it goes to `readArtifact`.
6. Each portrait's face is ranked against the hero table and against a table of the units drawn with art of their own, the phantimals and companions such as Zanie's turrets (`companionImages`), kept apart so a result card never ranks against them.

The plan (`src/lib/teams/formationImport.ts`, joined in by `buildTeamImportPlan`) takes each portrait for one of the units the side can field: the lineup's heroes, their companions (`companionCount` on the skill) and the phantimal the portraits match best. Best matches go first, and portraits left over take the units left over by elimination, for review: Lailah, drawn on her own in game but beside Elijah in the app's art, is placed so. A companion sharing its owner's image is told apart from the others only by tile order. A match is sure at a score of 0.6 with a lead of 0.08 over every unit of other art.

The map is the one of the mode's lists whose deployment tiles for that side are exactly the lit tiles, the lists' map for that board first, and the board moves to it before placing (`moveToMap`). With Swap sides on, a formation screenshot's team lands on the other half like its result column, its tiles turned a half-turn. Two formation screenshots of one side of a board, or a board whose formation screenshots show different maps, block Save as New; tiles of no map of the mode's, and lineup heroes with no portrait (they take random tiles), are warnings.

`applyLineups` places every side with `placeSide`, the Load menu's placement, so a unit with a tile takes it and one without takes a random free tile. A side placed from a formation screenshot re-seeds its phantimal baseline once placed, so it keeps the phantimal the screenshot showed, or none; a side without one gets the phantimal its lineup qualifies for, as before.

The review shows a formation screenshot's units over two numbered boards: the screenshot's own, with each unit's ring coloured by its state, and the side as the plan places it on its map (`BoardThumbnail`), so a tile can be checked against both; pointing at a unit in the list rings it on each. Under them each unit shows its portrait as shot, its tile, and the unit it is taken for, which a dropdown of the side's units changes. A board without a result screenshot also shows the formation's card row and artifact. Learning and the corrections export cover result screenshots only.

## Reference descriptors

Three sources feed one hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the checker alike. Portraits and costumes give general coverage. The bundled [`hero-icons.json`](../../src/data/import/hero-icons.json) holds approved face examples for cards the portraits cannot match, shipped with the app as ordinary data. Browser learning adds examples private to that browser. Geometry, ranking and confidence do not depend on which source a row came from.

The bundled file, browser storage (`stargazer.import.learned`) and the corrections export share one object, validated by `readLearnedIcons`:

```json
{
  "spec": {
    "descriptor": [32, 24],
    "box": [0.23, 0.2, 0.69]
  },
  "icons": [
    {
      "characterId": 104,
      "descriptor": "<base64 of 2304 bytes>",
      "learnedAt": 1789347604297
    }
  ]
}
```

| Field                 | Type      | Rule                                                                                                        |
| --------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| `spec.descriptor`     | [w, h]    | Must equal the app's descriptor size, `[32, 24]`.                                                           |
| `spec.box`            | [x, y, w] | Must equal the app's face box, as fractions of the card.                                                    |
| `icons`               | array     | Must be an array. At most `LEARNED_ICONS_CAP` (100) entries in browser storage, oldest dropped first.       |
| `icons[].characterId` | integer   | The hero. Not an integer: that face is dropped.                                                             |
| `icons[].descriptor`  | string    | The face descriptor: 2304 signed bytes, base64 encoded. Not decodable to that length: that face is dropped. |
| `icons[].learnedAt`   | number    | Milliseconds since the epoch. Not a finite number: that face is dropped.                                    |

`spec` pins how the descriptors were made, so data whose `spec` differs, or that is not an object with an `icons` array, reads as nothing learned. The reference-file test rejects unknown hero ids, invalid files and duplicate descriptors.

Each descriptor appears once. A local lesson for identical descriptor bytes overrides the bundled label, and forgetting local learning restores it. Different crops of one hero stay separate examples, and nothing is averaged or voted. No client correction ever edits the bundled file.

### Corrections export

`exportCorrections` writes a user-controlled download, never an upload. It holds one entry per screenshot with at least one correction. Each side of a reading holds five hero readings, one per row from top to bottom; the example shows the first of each. Card images and per-card descriptors are left out.

```json
{
  "app": "stargazer",
  "kind": "import-corrections",
  "createdAt": "2026-09-27T10:00:00.000Z",
  "learnedIcons": {
    "spec": { "descriptor": [32, 24], "box": [0.23, 0.2, 0.69] },
    "icons": []
  },
  "shots": [
    {
      "source": {
        "name": "match-2.png",
        "size": 1834211,
        "sha256": "<64 hex characters>"
      },
      "context": { "season": 8, "mapCount": 3, "imageWidth": 1150 },
      "predicted": {
        "mapIndex": 1,
        "mapCount": 3,
        "winner": 1,
        "mapResults": [1, 1, null],
        "sides": {
          "1": [
            {
              "candidates": [
                { "characterId": 43, "score": 0.91, "learned": false, "costume": false },
                { "characterId": 33, "score": 0.62, "learned": false, "costume": false }
              ],
              "recognised": true,
              "margin": 0.29,
              "sure": true,
              "box": { "x": 212, "y": 318, "w": 96, "h": 118 },
              "paragon": { "level": 4, "score": 0.88, "runnerUp": 0.41, "sure": true },
              "refinement": { "level": 2, "stars": 6, "family": "gold", "sure": true }
            }
          ],
          "2": [
            {
              "candidates": [
                { "characterId": 36, "score": 0.47, "learned": true, "costume": false }
              ],
              "recognised": false,
              "margin": 0.47,
              "sure": false,
              "box": { "x": 842, "y": 318, "w": 96, "h": 118 },
              "paragon": { "level": 0, "score": 0.52, "runnerUp": 0.49, "sure": false },
              "refinement": { "level": 0, "stars": 0, "family": "white", "sure": true }
            }
          ]
        },
        "artifacts": {
          "1": { "candidates": [{ "artifactId": 3, "score": 1.52 }], "margin": 0.4, "sure": true },
          "2": null
        },
        "warnings": [{ "kind": "unrecognised", "side": 2, "row": 0 }]
      },
      "labels": {
        "cells": { "2:0": { "characterId": 36, "paragon": 1 } },
        "artifacts": { "2": 5 },
        "winner": 1
      }
    }
  ]
}
```

| Field                              | Rule                                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app`, `kind`                      | Always `"stargazer"` and `"import-corrections"`: which Stargazer file this is.                                                                                                                                                                                                                                |
| `createdAt`                        | When the file was made, ISO 8601.                                                                                                                                                                                                                                                                             |
| `learnedIcons`                     | The learned faces, in the format above.                                                                                                                                                                                                                                                                       |
| `source`                           | The screenshot's file name, size in bytes, and SHA-256 in hex. It identifies the file, never a face.                                                                                                                                                                                                          |
| `context`                          | The app's season, the board count of the Teams mode at export, and the width screenshots are scaled to before reading.                                                                                                                                                                                        |
| `predicted.mapIndex`, `mapCount`   | The map shown (from 0) and how many maps the match had, both `null` when the map strip was not found.                                                                                                                                                                                                         |
| `predicted.winner`                 | Who won this map (1 ally, 2 enemy), read from the Ally tab's colour, or `null`.                                                                                                                                                                                                                               |
| `predicted.mapResults`             | Who won each map on the strip, `null` where a result was cropped off.                                                                                                                                                                                                                                         |
| `predicted.sides`                  | Keyed `"1"` (ally) and `"2"` (enemy). A hero reading's `candidates` come best first; `margin` is the best score minus the runner-up's; `box` is the card in the scaled screenshot's pixels; `refinement.family` is `white`, `purple`, `gold` or `red`, and `refinement.sure` whether the review needs to ask. |
| `predicted.artifacts`              | Keyed like `sides`, each an artifact reading or `null`: up to three `candidates` best first, `margin` between the first two, and whether the reading is `sure`.                                                                                                                                               |
| `predicted.warnings`               | `{ "kind": "no-panel", "side" }`, `{ "kind": "no-strip" }` or `{ "kind": "unrecognised", "side", "row" }`.                                                                                                                                                                                                    |
| `labels.cells`                     | The user's edits per hero cell, keyed `"<side>:<row>"`, each with any of `characterId`, `paragon` and `refinement`. A `characterId` of `null` means the cell was cleared.                                                                                                                                     |
| `labels.artifacts`                 | Keyed by side: a corrected artifact id, or `null` for removed.                                                                                                                                                                                                                                                |
| `labels.mapIndex`, `labels.winner` | A corrected map or winner, present only when the user changed it.                                                                                                                                                                                                                                             |

A missing label means unreviewed, and `null` means an explicit removal. Learned descriptors carry no source image, so checking or regenerating one needs the original screenshots.

## Checking against real screenshots

The checker is the only regression check on real images and the first thing to run when the game changes its result screen. `scripts/lib/importTooling.ts` decodes references the way the app does (EXIF applied, portraits re-encoded as WebP, icons capped at 128 px), from the image host or from a local copy of its `img/` tree.

```sh
npm run check:import -- --samples <dir> [--truth <json>] [--references <dir>] [--maps 5]
```

Truth defaults to `truth.json` beside the samples. Cells `a1` to `a5` and `e1` to `e5` score hero, paragon and refinement separately, and every field is optional, since an omitted field is unreviewed. Artifacts score only where labelled, and a strip count that disagrees with `maps` is flagged. Every hero and artifact slug must be in the current data, and the checker stops on one that is not, such as a retired season's artifact.

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

Formation screenshots have a checker of their own. It builds the plan as the app does, so it runs the app modules through Vite's server-side loader (the map registry and skills load with `import.meta.glob`). A set folder holds the formation screenshots under `formations/` and the same match's result screenshots, which name each board's lineup, under `results/`.

```sh
npm run check:formation -- --samples <dir> [--truth <json>] [--references <dir>] [--mode 5v5]
```

Its truth defaults to `formations/truth.json`, keyed by file name:

```json
{
  "sl-1.png": {
    "slots": 5,
    "slot": 1,
    "side": "ally",
    "map": "arena1",
    "artifact": "soulshock",
    "phantimal": "wedge-of-matter",
    "units": [
      { "hex": 16, "hero": "dunlingr" },
      { "hex": 3, "phantimal": "wedge-of-matter" },
      { "hex": 5, "companionOf": "wedge-of-matter" }
    ]
  }
}
```

| Field       | Rule                                                                                                                                                                                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `slots`     | How many slot circles the strip has.                                                                                                                                                                                                                                                     |
| `slot`      | The selected circle, numbered from 1 as in game.                                                                                                                                                                                                                                         |
| `side`      | `"ally"` or `"enemy"`: the team the screenshot shows.                                                                                                                                                                                                                                    |
| `map`       | The map key the lit tiles are, under `src/data/arena/`.                                                                                                                                                                                                                                  |
| `artifact`  | The artifact card's slug, or `null` for none.                                                                                                                                                                                                                                            |
| `phantimal` | The phantimal fielded, or `null` for none.                                                                                                                                                                                                                                               |
| `cards`     | For a set without result screenshots: `c1` to `c5` left to right, each `{ hero, p, r }` as a result truth's cells. Left out where the result screenshots' truth holds the lineup.                                                                                                        |
| `units`     | Every unit on the board, so a tile not listed is empty. Each has `hex` (1 to 45, as the board shows it) and one of `hero`, `phantimal`, or `companionOf` naming an owner listed in the same array; `index` (from 1) pins one of an owner's companions, which otherwise compare as a set. |

Every field is optional, an omitted one is unreviewed, and every slug must be in the current data.

`importReferenceUrl` fetches the import references from the image host under `img/import/`: the paragon frames `frame-p0` to `frame-p4-crown`, a `skins.json` manifest shaped `{ "<hero slug>": ["<file>", …] }`, and the costume captures under `skin/`. A missing manifest means no costumes. Artifact references are the bundled permanent icons plus the hosted seasonal set, capped at 128 px.

## Related documentation

- [Teams](./TEAMS.md): where the import lands, and how it applies and saves
- [Grid & Characters](./GRID.md): page-wide uniqueness and the pickers the review reuses
- [Seasonal Content](./SEASONAL.md): seasonal artifact icons on the image host
