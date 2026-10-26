# Team Import

The team import reads the game's match result screenshots on the device and saves what they show as a new team: both lineups with each hero's paragon and refinement, both artifacts, and a record name. A match's formation screenshots add where each unit stands, and formation screenshots can also be imported on their own ([Formation screenshots](#formation-screenshots)). The screens are read by the shared screenshot import ([Screenshot Import](./IMPORT.md)), pure TypeScript over RGBA buffers run in a web worker. It produces evidence, the review turns evidence plus the user's edits into a plan, and only Save as New changes the boards.

The hard part is that screenshots vary. Players crop them, phones have different shapes, and the in-game card zooms each portrait slightly differently. The readers have to find the cards before they can read them, and say how sure they are.

## How it fits together

```
┌─ TeamImportModal ────────┐            ┌─ TeamsView ──────────────┐
│ drop zone, review,       │    plan    │ grids.applyLineups       │
│ Save as New              │───────────▶│ teamLibrary.saveAsNew    │
└───────────────────┬──┬───┘            └──────────────────────────┘
       shots, edits │  ▲
                    ▼  │  readings, plan
┌─ useTeamImport ───┴──┴───┐
│ shots and overrides      │
│ buildTeamImportPlan      │
└───────────────────┬──┬───┘
              files │  ▲
                    ▼  │  readings
┌─ useImportEngine ─┴──┴───┐            ┌─ import.worker ──────────┐
│ decoding, read queue     │───────────▶│ lib/import readers       │
│ references               │   images   │ hero table               │
│ learned icons            │◀───────────│ artifact table           │
└──────────────────────────┘  readings  └──────────────────────────┘
```

## Decisions

Landmarks come before templates. The Ally and Enemy tabs place the card columns, and template matching only settles exact positions and identities. `layout.ts` holds every nominal position and size on the result screen along with its per-shot range, while each reader owns its own template searches and score floors.

A reading never changes once made. Every review decision is an override stored beside it, so each cell can show its confidence, and every edit can be undone.

The plan is pure data. Readings plus overrides become a `TeamImportPlan` with no store access (`src/lib/teams/teamImport.ts`, a sibling of `sideLoad.ts`), and the grids store applies it with its own placement primitives.

## Evidence

Each field of a reading comes from its own visual signal. The readers therefore stay separate, and a correction to one never moves another.

| Reading        | Evidence                                                                                                                                  | Consequence                                                                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero           | face crop against portrait and learned descriptors                                                                                        | new face examples improve identity without touching any other reader                                                                                                                                                                                                       |
| Paragon        | card frame against the six frame templates, searched up to 12 px from where the anchor puts each card                                     | a wrong frame also displaces the face and star crops, so doubt covers the cell                                                                                                                                                                                             |
| Refinement     | the star row's six places against the gaps between them (a full row lights all six) and their colour, where the screen draws the row      | independent of the hero descriptor; a short row is R0 (refinement needs six), and waits for review when a refined colour is strong (a full row's outer stars hidden); a refined reading on weak colour evidence, or a full R0 row with a faint pink tint, waits for review |
| Artifact       | the header icon's art disc against each artifact image's centre, by shape and colour, every image scored on the disc the best match found | sure only with a clear lead, a good shape match and art in the crop; otherwise it waits for review. A header with no badge (no artifact fielded) reads as none, unless the screenshot is cropped through the search window                                                 |
| Map and result | strip ring and badges, Ally tab colour                                                                                                    | which board a shot fills is settled in review                                                                                                                                                                                                                              |

## Pipeline

`readScreenshot` (`src/lib/import/screens/result/result.ts`) works through these steps:

1. The composable rejects shots under 600 px wide and draws the rest at their own size, up to `RESULT_MAX_WIDTH`. `framePanel` (`panel.ts`) then frames the panel: `findTabs` finds the Ally and Enemy tabs at whatever scale and offset the shot has them, and the shot is resampled so the tab's width and left edge match `TABS` at `CANONICAL_WIDTH` (1150). The game lays the panel out from the screen's width, so the tab's width gives the scale on every device, and its left edge discounts whatever margin a crop kept: a desktop window with its title and buttons, or a whole phone screen. A shot whose tab touches its left edge, or that has no tabs, is taken to start at the panel and scaled by its own width. The resampling is area-weighted (`resample`), so at a scale near 1 the star rows keep their faint tints. A crop may lose height at either end.
2. The tabs seed each card column, and the frame comb in `findPanelAnchor` settles it. Without tabs, the columns are tried at their crop positions, then `scanForColumns` looks for a pair anywhere in the shot. A column found from tabs or by the scan is trusted down to `LANDMARK_FLOOR`, and one at its crop position only down to `ANCHOR_FLOOR`. Below its floor a column's cells come back empty instead of carrying a stranger's face.
3. For each card, the best frame match (`matchCard`) gives both the paragon level and the card's exact box. `rankHeroes` ranks the face described at nine small offsets, `readStars` reads the star row where the screen draws it (`CARD_STARS`), a fixed distance above the card's centre whichever frame matched, and `assignUnique` settles each side so no hero is read twice.
4. `readStrip` places the strip from the green ring around the current map, `readArtifact` matches the header icons, and the Ally tab's colour says who won the map.

## Review

`cellState` and `reviewStates` derive each cell's state once, so the review grid and each card's "to review" count agree. A cell is sure, needs its hero confirmed, needs its paragon confirmed (hero settled but the frame match doubtful), needs its refinement confirmed (hero and paragon settled but the star colour doubtful), has no candidate over the floor, or is a duplicate of another cell on its side after edits. Confirming or picking a hero settles identity separately from the paragon level. `artifactState` treats each side's artifact the same way: settled once read surely or edited, otherwise counted in the card's review number, with the icon crop from the screenshot shown beside it.

Each opening of the modal is a new import. Closing it, by Save as New or otherwise, drops the shots with their review edits, the side choice and any unsaved name edits (`clearImport`), so the next opening starts from the names last saved and nothing else. The engine, its references and the learned faces stay for the page visit ([Screenshot Import](./IMPORT.md#the-engine)).

A swap puts every result screenshot's Ally column on the enemy side of its board. The game's Ally tab is always the viewing player, whichever side of the board they fought from, while formation screenshots and replay frames show each team on the half it fought from. Those halves are the board's sides, so a swap changes only which result column's lineup a formation shot or replay frame takes, never its half or its tiles. It is one choice per match, since a player keeps one side for every map and the boards hold a hero once per side page-wide.

Swap sides (`swapSides`) holds the choice, offered once result screenshots make the import a match. The record name follows it, listing the player on the ally half first. Formation screenshots set it when they tell which way the match went (`formationsSwapped`), with a note beside it saying so, and the user can still change it. A choice stands until the formation screenshots give a new answer. A portrait counts only when its best match is a hero at 0.6 or more, so phantimal and companion portraits do not. It counts for a swap when only the result column across the board from its half holds that hero (the Enemy column on the ally half, the Ally column on the enemy half), and against one when only its own half's column does. The match goes the way more portraits count, so a shot mapped to the wrong board, which can match a lineup only by chance, weighs little. It is a placement choice, so it resets with the shots. When the sides change, a formation shot's portrait corrections start over, since they were made against the other column's lineup. A replay frame's picks stay on their tiles: a pick counts while its unit is one the side fields, so swapping back brings it back.

### Learning

A hero correction teaches the face only when the reader was unsure of the hero and sure of the frame. A doubtful frame means the crop may be off the face, and storing it would teach noise. Picking the reader's own top candidate, or no hero, takes back an earlier lesson for that face. Lessons go to the store of learned faces every import shares ([Reference descriptors](./IMPORT.md#reference-descriptors)).

## Plan and save

Player names are optional. Without both, the record name stays blank and the library picks its automatic name. With both, the name follows the form `S7 - GNX > 10 (1,3,4,5 > 2)`: the ally-side player first, `>` when they won more maps, and each player's map numbers. The name follows board sides, so after a swap it reads `S7 - 10 < GNX (2 < 1,3,4,5)`. The review can type a name of its own in its place; that name stays until the field is cleared, is not stored past the import, and holds only the library's length limit, since the characters the built name keeps out matter only to its form.

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

A paste lands in no drop area, so each pasted screenshot goes to the section of its kind (`sortScreenshot`): a formation screenshot when `fitBoard` finds a whole board in it, a result screen when its tabs are found, a replay frame while that step is open (below). One the sorter cannot place goes with the results, or with the formations while those are imported alone. A result screenshot pasted while formation screenshots are imported alone is refused, and the toast says why. Every screenshot is sorted, dropped and picked ones too, and a roster screenshot is refused with a toast pointing to the Rosters tab ([Roster Import](./IMPORT_ROSTER.md)); a dropped screenshot is otherwise read as the kind of its drop area.

`readFormation` (`src/lib/import/screens/formation/formation.ts`) places every region from the board, so a capture's size and padding do not matter:

1. `fitBoard` (`board.ts`) finds the board. The game draws Stargazer's own grid under the camera the perspective view reproduces (`PERSPECTIVE`), so with that shape fixed a fit is a scale and a centre. The thin light outline is the evidence: each outline sample scores how far it stands above its neighbours, less the same for points just off the line. The search runs on a copy 480 px wide, coarse over every board wholly inside the shot, then finer; under 0.4 of the outline found means no board, a cut formation captures clear and result screens stay well under.
2. Each tile is checked for a portrait ring standing above it: units stand with their pointer's tip at the tile centre, so the ring sits 0.83 hex radii above it, 0.63 across, on every row. The ring is light and grey, and a tile holds a unit when enough of its circle reads so; a nearer portrait can hide part of a far one's ring.
3. The lower half of each tile, less what portraits cover, reads lit or not, split at the widest gap between the board's own tile readings. Every map's ally tiles lean to the near half and its enemy tiles to the far half, so the lit tiles say which team the shot shows.
4. The slot circles sit at a fixed distance under the board; the selected one is ringed in green (`ringGreen`), and the circles with a numeral give the count.
5. The card row starts at one of two places, as the phantimal slot is there or not, and is read on a copy resampled to the scale the frame templates were cut at, with `readCards` (`src/lib/import/card/card.ts`), as a result screen's columns are. The artifact card's disc before it goes to `readArtifact`.
6. Each portrait's face is ranked against the hero table and against a table of the units drawn with art of their own, the phantimals and companions such as Zanie's turrets (`companionImages`), kept apart so a result card never ranks against them.

The plan (`src/lib/teams/formationImport.ts`, joined in by `buildTeamImportPlan`) takes each portrait for one of the units the side can field: the lineup's heroes, their companions (`companionCount` on the skill) and the phantimal the portraits match best, when the heroes qualify for it (`lineupQualifies`, the board's faction rule). A portrait showing a phantimal they do not qualify for is none of the side's units, and so is one corrected to it, until they qualify again. Best matches go first, and portraits left over take the units left over by elimination, for review: Lailah, drawn on her own in game but beside Elijah in the app's art, is placed so. A companion sharing its owner's image is told apart from the others only by tile order. A match is sure at a score of 0.6 with a lead of 0.08 over every unit of other art.

The map is the one of the mode's lists whose deployment tiles for that side are exactly the lit tiles, the lists' map for that board first, and the board moves to it before placing (`moveToMap`). When the sides are swapped, a formation screenshot's team stays on its own half and tiles and takes the other column's lineup. Two formation screenshots of one side of a board, or a board whose formation screenshots show different maps, block Save as New; tiles of no map of the mode's, lineup heroes with no portrait (they take random tiles), and a match's formation screenshot of a map with no result, are warnings.

`applyLineups` places every side with `placeSide`, the Load menu's placement, so a unit with a tile takes it and one without takes a random free tile. A side placed from a formation screenshot re-seeds its phantimal baseline once placed, so it keeps the phantimal the screenshot showed, or none; a side without one gets the phantimal its lineup qualifies for. So does a side whose screenshot misses lineup heroes and shows no phantimal, until the review picks one: the panel cannot draw a hero the screenshotting account lacks, and can drop a phantimal whose faction count needed that hero.

The review shows a formation screenshot's units over two numbered boards: the screenshot's own, with each unit's ring coloured by its state (an unsure or unrecognised one thicker), and the side as the plan places it on its map (`TeamImportPlaced`, which the replay step shares), so a tile can be checked against both; pointing at a unit in the list rings it on each. Under them each unit shows its portrait as shot, its tile, and the unit it is taken for, which a dropdown of the side's units changes. A portrait on the screenshot opens the same choices under it, the reading to confirm first, so a small screen need not scroll to the unit's card. While the other portraits field a phantimal, the dropdown offers no other phantimal's units, except the unit the portrait is already taken for (`portraitOptions`). Formation screenshots imported on their own also show their card row and artifact. Learning covers result screenshots only.

Units the screenshot does not show are listed after the portraits, amber until placed, and placed as on a replay frame (`useTilePlacing`, which both reviews share): the side's free deployment tiles are tinted on the screenshot's board, a click on one places the next unit (the units of the side's placing order no portrait is taken for: heroes, companions, and the side's phantimal with its companions), a click with nothing left to place opens the picker, and a tile number can be typed beside each. The side's phantimal is the one a portrait or pick shows. A shot that shows every hero and no phantimal fields none, while one short of heroes may have lost its phantimal with them, so the lineup's phantimal joins its order, as the plan fields it. A tile a portrait stands on cannot be picked, nor a unit a portrait is taken for, nor, while the portraits field a phantimal, another one (`pickableUnit`). The plan applies the same rule, so a portrait reassigned later wins over a pick. The picks are kept on the shot like a replay frame's (`tilePicks`), and a hero placed so leaves the "placed at random" warning. Once nothing is left to review, the card counts the missing units still without a tile, from the same `missingUnits` the review lists them by. They are tiles of the screenshot, so they stay through a swap or a change of board, counting while their unit is one the side fields.

## Replay frames

When an account cannot save a match's formations (a formation holds only heroes the account owns), a 5v5 Supreme League import can place the heroes from paused replay screenshots instead. The step appears once result screenshots are imported and while no formation screenshot is (`replayOpen`), and a replay frame closes the formation drop until it is removed, so one match never mixes the two. The heroes and upgrades still come from the result screenshots; a frame only says where each unit started. Frames are taken by pausing a replay or a screen recording some moments into the fight, so they are desktop captures of the game window at any size, cropped to keep most of its width, with units already moving and effects on screen.

`readReplay` (`src/lib/import/screens/replay/replay.ts`) finds where the board lies in a frame. Every Supreme League map is fought in one arena under one fixed camera, so a frame differs from the reference frame the camera was measured in only by the window's size and the crop: a scale and a shift. They are found by matching the arena around the fight against the data pack's `screenshot-import/replay-arena.png`, a grey picture of it at a quarter of the reference frame's size with the units taken out, coarse at a sixteenth of the size and then fine at a quarter, the scales searched around the frame's width over the reference's. Under 0.45 the frame has no arena (`no-arena`): replay frames clear it although units and effects differ, and other screenshots stay well under. The camera is six numbers, a floor tilted away from the viewer and turned 0.55°, which take each tile's centre and corners to the frame (`replayHexCentre`, `replayHexCorners`). The map strip's green ring names the map when the game's UI is in view, searched a few pixels either side of each circle; a frame with the UI hidden is mapped on its card, as a result screenshot can be.

A paste goes to the replay step when the step is open, no board is found in it, its result tabs are not found (`findTabs`) and the arena matches it (`isReplayFrame`); the sorter worker holds its own copy of the arena. Without the arena picture (it failed to load) only replay frames fail to read, and pastes still sort between formations and results.

The review draws the board over the frame (`TeamImportReplay`): every tile numbered, the ally and enemy deployment tiles tinted in the app's side colours, as the "As placed" board beside it draws them, the blocked tiles hatched (they sit on the map's walls). The units a side can field are the lineup the map's result screenshot names, their companions, and the phantimals the lineup qualifies for with theirs. The frame shows each team on the half it fought from, so a tile's tint is its board side and it takes the units of the result column that fills that side. A click on a free deployment tile places that side's next unit there: the one chosen in its list, else the first unit without a tile, which its list highlights and the tile under the pointer previews. The units come in turn (`placingOrder`): each hero with its companions after it, then the side's phantimal with its companions, the one its picks field or else the one its lineup qualifies for, which the plan fields anyway. The frame's card counts the units of that order still without a tile. Choosing the highlighted unit again stops placing for that side. A click on a placed unit, or with nothing to place, opens a picker of the side's units instead, its heroes as a row of portraits over the rest. The lists under the frame, one per board side, hold a tile box per unit: a number typed there places the unit as a click does, Enter moving on to the next box so a team is typed in one go, an empty box takes the unit off the board, and a number that is not one of that team's deployment tiles is refused with a line saying so. Either way a unit picked for another tile moves there and a tile's previous unit comes off it (`setTilePick`). A side fields one phantimal, so a unit of another phantimal takes the place of the side's earlier phantimal picks. Heroes may have moved before the pause, so the tile is the reviewer's call. An "As placed" board beside the frame shows both sides as the plan will place them. Changing a frame's map starts its picks over, since they are tiles of the old board's map.

The plan places a replay frame's sides the way formation shots place theirs (`formationSide`): each picked hero on its tile, and an unpicked hero on a random free tile (`unplaced`). A picked phantimal stays as picked, and so does the phantimal of a picked companion (Wedge of Power fields Wedge of Matter), on a random free tile until it is picked too, since a phantimal's companion exists only with it. A formation screenshot's units field a phantimal the same way. A phantimal the side's heroes do not qualify for is left out, as the board would refuse it. With neither picked, the side gets the phantimal its lineup qualifies for. Two frames of one board block Save as New (`duplicate-replay`), and a frame of a map with no result screenshot is left out with a warning (`replay-unused`). A frame the arena was not found in has no board to place and is left out too, its card saying so.

The camera, the arena picture and the strip's circles were measured on the frames of one match. Supreme League maps change every couple of months, apart from the seasons. A change needs frames of the new maps checked against the reader and, when the arena around the fight changes, a new picture and camera.

## Related documentation

- [Screenshot Import](./IMPORT.md): the engine, worker, hero cards and references every import shares
- [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md): what each screen gives, what a screenshot needs, and the limits
- [Teams](./TEAMS.md): where the import lands, and how it applies and saves
- [Grid & Characters](./GRID.md): page-wide uniqueness and the pickers the review reuses
- [Seasonal Content](./SEASONAL.md): where the seasonal artifact icons come from
