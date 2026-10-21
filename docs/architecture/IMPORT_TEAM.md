# Team Import

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both lineups with each hero's paragon and refinement, both artifacts, and a record name. A match's formation screenshots add where each unit stands, and formation screenshots can also be imported on their own ([Formation screenshots](#formation-screenshots)). Recognition is pure TypeScript over RGBA buffers (`src/lib/import/`), run in a web worker. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save as New changes the boards.

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

A reading never changes once made. Every review decision is an override stored beside it, so each cell can show its confidence, and every edit can be undone.

The plan is pure data. Readings plus overrides become a `TeamImportPlan` with no store access (`src/lib/teams/teamImport.ts`, a sibling of `sideLoad.ts`), and the grids store applies it with its own placement primitives.

## Evidence

Each field of a reading comes from its own visual signal. The readers therefore stay separate, and a correction to one never moves another.

| Reading        | Evidence                                                                                                                                  | Consequence                                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hero           | face crop against portrait and learned descriptors                                                                                        | new face examples improve identity without touching any other reader                                                                                                                                                                                                                       |
| Paragon        | card frame against the six frame templates, searched up to 12 px from where the anchor puts each card                                     | a wrong frame also displaces the face and star crops, so doubt covers the cell                                                                                                                                                                                                             |
| Refinement     | count and colour of the star row, read a fixed distance above the card's centre                                                           | independent of the hero descriptor; a row of five stars or fewer is R0 (refinement needs six), and waits for review when a refined colour is strong (two stars merged or one hidden); a refined reading on weak colour evidence, or a full R0 row with a faint pink tint, waits for review |
| Artifact       | the header icon's art disc against each artifact image's centre, by shape and colour, every image scored on the disc the best match found | sure only with a clear lead, a good shape match and art in the crop; otherwise it waits for review. A header with no badge (no artifact fielded) reads as none, unless the screenshot is cropped through the search window                                                                 |
| Map and result | strip ring and badges, Ally tab colour                                                                                                    | which board a shot fills is settled in review                                                                                                                                                                                                                                              |

## Pipeline

`readScreenshot` (`src/lib/import/pipeline.ts`) works through these steps:

1. The composable rejects shots under 600 px wide and draws the rest at their own size, up to `RESULT_MAX_WIDTH`. `framePanel` (`panel.ts`) then frames the panel: `findTabs` finds the Ally and Enemy tabs at whatever scale and offset the shot has them, and the shot is resampled so the tab's width and left edge match `TABS` at `CANONICAL_WIDTH` (1150). The game lays the panel out from the screen's width, so the tab's width gives the scale on every device, and its left edge discounts whatever margin a crop kept: a desktop window with its title and buttons, or a whole phone screen. A shot whose tab touches its left edge, or that has no tabs, is taken to start at the panel and scaled by its own width. The resampling is area-weighted (`resample`), so at a scale near 1 the star rows keep their faint tints. A crop may lose height at either end.
2. The tabs seed each card column, and the frame comb in `findPanelAnchor` settles it. Without tabs, the columns are tried at their crop positions, then `scanForColumns` looks for a pair anywhere in the shot. A column found from tabs or by the scan is trusted down to `LANDMARK_FLOOR`, and one at its crop position only down to `ANCHOR_FLOOR`. Below its floor a column's cells come back empty instead of carrying a stranger's face.
3. For each card, the best frame match (`matchCard`) gives both the paragon level and the card's exact box. `rankHeroes` ranks the face described at nine small offsets, `readStars` reads the star row a fixed distance above the card's centre, where it sits whichever frame and scale matched, and `assignUnique` settles each side so no hero is read twice.
4. `readStrip` places the strip from the green ring around the current map, `readArtifact` matches the header icons, and the Ally tab's colour says who won the map.

## Hero identity

A descriptor is a 32 × 24 RGB face crop with each channel normalised to zero mean and unit norm, which cancels the warm tint the frame casts. It is stored as Int8 at ×400 in the worker table and in every saved descriptor.

The table cuts every bundled portrait over a grid of crop windows, because the in-game card zooms the same painting differently per hero. A costume reference is captured from the game's skin card, where the face sits smaller, so it adds a second grid of smaller windows. Learned and bundled descriptors join as extra rows. Ranking scores the whole table at the centre offset, re-scores the leaders at the other offsets, and gives the top portrait candidates (`REFINE_KEEP`) a finer window search. Learned rows keep their scores and do not use up that budget.

A pick needs `HERO_SCORE_FLOOR` and a lead of `HERO_SURE_MARGIN` over the best candidate of any other hero, learned or bundled. The lead must reach `COSTUME_SURE_MARGIN` when the winning window came from a costume, since the looser costume framing fits strangers more easily.

## Review

`cellState` and `reviewStates` derive each cell's state once, so the review grid and each card's "to review" count agree. A cell is sure, needs its hero confirmed, needs its paragon confirmed (hero settled but the frame match doubtful), needs its refinement confirmed (hero and paragon settled but the star colour doubtful), has no candidate over the floor, or is a duplicate of another cell on its side after edits. Confirming or picking a hero settles identity separately from the paragon level. `artifactState` treats each side's artifact the same way: settled once read surely or edited, otherwise counted in the card's review number, with the icon crop from the screenshot shown beside it.

Each opening of the modal is a new import. Closing it, by Save as New or otherwise, drops the shots with their review edits, the side choice and any unsaved name edits (`clearImport`), so the next opening starts from the names last saved and nothing else. `useTeamImport` keeps the worker, its references and the learned faces at module level for the page visit, and `TeamsView` calls `disposeTeamImport` when the page is left. References are fetched on first open and posted once, shots dropped meanwhile queue until the worker is ready, and a failed load retries on the next open.

A swap puts every result screenshot's Ally column on the enemy side of its board. The game's Ally tab is always the viewing player, whichever side of the board they fought from, while formation screenshots and replay frames show each team on the half it fought from. Those halves are the board's sides, so a swap changes only which result column's lineup a formation shot or replay frame takes, never its half or its tiles. It is one choice per match, since a player keeps one side for every map and the boards hold a hero once per side page-wide.

Swap sides (`swapSides`) holds the choice, offered once result screenshots make the import a match. The record name follows it, listing the player on the ally half first. Formation screenshots set it when they tell which way the match went (`formationsSwapped`), with a note beside it saying so, and the user can still change it. A choice stands until the formation screenshots give a new answer. A portrait counts only when its best match is a hero at 0.6 or more, so phantimal and companion portraits do not. It counts for a swap when only the result column across the board from its half holds that hero (the Enemy column on the ally half, the Ally column on the enemy half), and against one when only its own half's column does. The match goes the way more portraits count, so a shot mapped to the wrong board, which can match a lineup only by chance, weighs little. On four sample matches, one of them swapped, every shot whose portraits lean either way leans the right way. It is a placement choice, so it resets with the shots. When the sides change, a formation shot's portrait corrections start over, since they were made against the other column's lineup. A replay frame's picks stay on their tiles: a pick counts while its unit is one the side fields, so swapping back brings it back.

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

`isBlockingIssue` separates issues that would put a wrong lineup on a board (a map filled twice, a duplicate hero, a hero or artifact repeated across boards) from ones that only leave something out. Blocking issues and invalid names stop Save as New, and warnings do not. Applying and saving belong to the Teams page ([Teams](./TEAMS.md)). An import always starts a new team, so nothing on the boards before it is kept or checked against, and Save as New confirms first when the boards have content. Applying and saving are not one transaction: a full library leaves the boards as an unsaved team carrying the name, and skipped placements are reported.

## Formation screenshots

A formation screenshot is the game's formation panel for one team: the board under the formation camera with that team's deployment tiles lit and its units standing on them, the slot circles of the match's maps under it, and the team's card row with its artifact. The panel draws every hero at the screenshotting player's own upgrades, never a match's, so the two kinds of screenshot never mix their upgrades, and an import starts from one of them. The modal takes each kind in a drop area of its own, the two the same size:

- A match starts from its result screenshots, which give both sides' heroes, upgrades and artifacts. Its formation screenshots, each filling one side of the board its slot names, add the tile every unit stands on, its companions and its phantimal, and their cards are not read. A formation screenshot of a map with no result screenshot has no heroes to place and is left out, with a warning. A match saves without them, its heroes on random tiles, so once result screenshots are in, the formation and replay-frame drops are marked optional.
- Formation screenshots dropped first are imported on their own, and close the result drop until they are removed. Each fills its side with the heroes, upgrades and artifact of its card row, or, without a card row, the portraits' heroes at paragon and refinement 0. Sides and boards no screenshot shows stay empty, and no record name is made.

A paste lands in no drop area, so each pasted screenshot goes to the section of its kind (`sortScreenshot`): a formation screenshot when `fitBoard` finds a whole board in it, else a result screen or, while that step is open, a replay frame (below). A second instance of the import worker does the sorting, so a paste is sorted at once while the first worker reads. A result screenshot pasted while formation screenshots are imported alone is refused, and the toast says why.

`readFormation` (`src/lib/import/formation.ts`) places every region from the board, so a capture's size and padding do not matter:

1. `fitBoard` (`board.ts`) finds the board. The game draws Stargazer's own grid under the camera the perspective view reproduces (`PERSPECTIVE`), so with that shape fixed a fit is a scale and a centre. The thin light outline is the evidence: each outline sample scores how far it stands above its neighbours, less the same for points just off the line. The search runs on a copy 480 px wide, coarse over every board wholly inside the shot, then finer; under 0.4 of the outline found means no board (formation captures measure 0.47 to 0.73, result screens at most 0.25).
2. Each tile is checked for a portrait ring standing above it: units stand with their pointer's tip at the tile centre, so the ring sits 0.83 hex radii above it, 0.63 across, on every row. The ring is light and grey, and a tile holds a unit when enough of its circle reads so; a nearer portrait can hide part of a far one's ring.
3. The lower half of each tile, less what portraits cover, reads lit or not, split at the widest gap between the board's own tile readings. Every map's ally tiles lean to the near half and its enemy tiles to the far half, so the lit tiles say which team the shot shows.
4. The slot circles sit at a fixed distance under the board; the selected one is ringed in green (`ringGreen`), and the circles with a numeral give the count.
5. The card row starts at one of two places, as the phantimal slot is there or not, and is read on a copy resampled to the scale the frame templates were cut at, with the result reader's `readCards`. The artifact card's disc before it goes to `readArtifact`.
6. Each portrait's face is ranked against the hero table and against a table of the units drawn with art of their own, the phantimals and companions such as Zanie's turrets (`companionImages`), kept apart so a result card never ranks against them.

The plan (`src/lib/teams/formationImport.ts`, joined in by `buildTeamImportPlan`) takes each portrait for one of the units the side can field: the lineup's heroes, their companions (`companionCount` on the skill) and the phantimal the portraits match best, when the heroes qualify for it (`lineupQualifies`, the board's faction rule). A portrait showing a phantimal they do not qualify for is none of the side's units, and so is one corrected to it, until they qualify again. Best matches go first, and portraits left over take the units left over by elimination, for review: Lailah, drawn on her own in game but beside Elijah in the app's art, is placed so. A companion sharing its owner's image is told apart from the others only by tile order. A match is sure at a score of 0.6 with a lead of 0.08 over every unit of other art.

The map is the one of the mode's lists whose deployment tiles for that side are exactly the lit tiles, the lists' map for that board first, and the board moves to it before placing (`moveToMap`). When the sides are swapped, a formation screenshot's team stays on its own half and tiles and takes the other column's lineup. Two formation screenshots of one side of a board, or a board whose formation screenshots show different maps, block Save as New; tiles of no map of the mode's, lineup heroes with no portrait (they take random tiles), and a match's formation screenshot of a map with no result, are warnings.

`applyLineups` places every side with `placeSide`, the Load menu's placement, so a unit with a tile takes it and one without takes a random free tile. A side placed from a formation screenshot re-seeds its phantimal baseline once placed, so it keeps the phantimal the screenshot showed, or none; a side without one gets the phantimal its lineup qualifies for. So does a side whose screenshot misses lineup heroes and shows no phantimal, until the review picks one: the panel cannot draw a hero the screenshotting account lacks, and can drop a phantimal whose faction count needed that hero.

The review shows a formation screenshot's units over two numbered boards: the screenshot's own, with each unit's ring coloured by its state, and the side as the plan places it on its map (`TeamImportPlaced`, which the replay step shares), so a tile can be checked against both; pointing at a unit in the list rings it on each. Under them each unit shows its portrait as shot, its tile, and the unit it is taken for, which a dropdown of the side's units changes. Formation screenshots imported on their own also show their card row and artifact. Learning covers result screenshots only.

Units the screenshot does not show are listed after the portraits, amber until placed, and placed as on a replay frame (`useTilePlacing`, which both reviews share): the side's free deployment tiles are tinted on the screenshot's board, a click on one places the next unit (the units of the side's placing order no portrait is taken for: heroes, companions, and the phantimal and its companions once fielded), a click with nothing left to place opens the picker, where a phantimal the panel dropped can be added, and a tile number can be typed beside each. A tile a portrait stands on cannot be picked, nor a unit a portrait is taken for, nor, while the portraits field a phantimal, another one (`pickableUnit`). The plan applies the same rule, so a portrait reassigned later wins over a pick. The picks are kept on the shot like a replay frame's (`tilePicks`), and a hero placed so leaves the "placed at random" warning. Once nothing is left to review, the card counts the missing units still without a tile, from the same `missingUnits` the review lists them by. They are tiles of the screenshot, so they stay through a swap or a change of board, counting while their unit is one the side fields.

## Replay frames

When an account cannot save a match's formations (a formation holds only heroes the account owns), a 5v5 Supreme League import can place the heroes from paused replay screenshots instead. The step appears once result screenshots are imported and while no formation screenshot is (`replayOpen`), and a replay frame closes the formation drop until it is removed, so one match never mixes the two. The heroes and upgrades still come from the result screenshots; a frame only says where each unit started. Frames are taken by pausing a replay or a screen recording some moments into the fight, so they are desktop captures of the game window at any size, cropped to keep most of its width, with units already moving and effects on screen.

`readReplay` (`src/lib/import/replay.ts`) finds where the board lies in a frame. Every Supreme League map is fought in one arena under one fixed camera, so a frame differs from the reference frame the camera was measured in only by the window's size and the crop: a scale and a shift. They are found by matching the arena around the fight against `src/assets/import/replay-arena.png`, a grey picture of it at a quarter of the reference frame's size with the units taken out, coarse at a sixteenth of the size and then fine at a quarter, the scales searched around the frame's width over the reference's. Replay frames score 0.68 to 0.88 although units and effects differ, and result, formation and crop screenshots 0.13 to 0.25; under 0.45 the frame has no arena (`no-arena`). The camera is six numbers, a floor tilted away from the viewer and turned 0.55°, which take each tile's centre and corners to the frame (`replayHexCentre`, `replayHexCorners`). The map strip's green ring names the map when the game's UI is in view, searched a few pixels either side of each circle; a frame with the UI hidden is mapped on its card, as a result screenshot can be. On nine frames of one match the placement is within 3 px of the measured positions (0.02 tiles) and every frame showing the strip names its map, at about 0.8 s per frame.

A paste goes to the replay step when the step is open, no board is found in it, its result tabs are not found (`findTabs`) and the arena matches it (`isReplayFrame`); the sorter worker holds its own copy of the arena. On the samples (9 replay frames, 10 formation screenshots, 29 result screens and crops) every paste sorts right. Without the arena picture (it failed to load) only replay frames fail to read, and pastes still sort between formations and results.

The review draws the board over the frame (`TeamImportReplay`): every tile numbered, the ally and enemy deployment tiles tinted in the game's result colours (orange for the ally side, blue for the enemy side), the blocked tiles hatched (they sit on the map's walls). The units a side can field are the lineup the map's result screenshot names, their companions, and the phantimals the lineup qualifies for with theirs. The frame shows each team on the half it fought from, so a tile's tint is its board side and it takes the units of the result column that fills that side. A click on a free deployment tile places that side's next unit there: the one chosen in its list, else the first unit without a tile, which its list highlights and the tile under the pointer previews. The units come in turn (`placingOrder`): each hero with its companions after it, then the phantimal the side's picks field with its companions. The frame's card counts the units of that order still without a tile. Choosing the highlighted unit again stops placing for that side. A click on a placed unit, or with nothing to place, opens a picker of the side's units instead, its heroes as a row of portraits over the rest. The lists under the frame, one per board side, hold a tile box per unit: a number typed there places the unit as a click does, Enter moving on to the next box so a team is typed in one go, an empty box takes the unit off the board, and a number that is not one of that team's deployment tiles is refused with a line saying so. Either way a unit picked for another tile moves there and a tile's previous unit comes off it (`setTilePick`). A side fields one phantimal, so a unit of another phantimal takes the place of the side's earlier phantimal picks. Heroes may have moved before the pause, so the tile is the reviewer's call. An "As placed" board beside the frame shows both sides as the plan will place them. Changing a frame's map starts its picks over, since they are tiles of the old board's map.

The plan places a replay frame's sides the way formation shots place theirs (`formationSide`): each picked hero on its tile, and an unpicked hero on a random free tile (`unplaced`). A picked phantimal stays as picked, and so does the phantimal of a picked companion (Wedge of Power fields Wedge of Matter), on a random free tile until it is picked too, since a phantimal's companion exists only with it. A formation screenshot's units field a phantimal the same way. A phantimal the side's heroes do not qualify for is left out, as the board would refuse it. With neither picked, the side gets the phantimal its lineup qualifies for. Two frames of one board block Save as New (`duplicate-replay`), and a frame of a map with no result screenshot is left out with a warning (`replay-unused`). A frame the arena was not found in has no board to place and is left out too, its card saying so.

The camera, the arena picture and the strip's circles were measured on the frames of one match. Supreme League maps change every couple of months, apart from the seasons. A change needs frames of the new maps checked against the reader and, when the arena around the fight changes, a new picture and camera.

## Reference descriptors

Three sources feed one hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the checker alike. Portraits and costumes give general coverage. The bundled [`hero-icons.json`](../../src/data/import/hero-icons.json) holds approved face examples for cards the portraits cannot match, shipped with the app as ordinary data. Browser learning adds examples private to that browser. Geometry, ranking and confidence do not depend on which source a row came from.

The bundled file and browser storage (`stargazer.import.learned`) share one object, validated by `readLearnedIcons`:

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
