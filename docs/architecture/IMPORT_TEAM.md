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

| Reading        | Evidence                                                                                    | Consequence                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Hero           | face crop against portrait and learned descriptors                                          | new face examples improve identity without touching any other reader                                                         |
| Paragon        | card frame against the six frame templates, searched around where the anchor puts each card | a wrong frame also displaces the face and star crops, so doubt covers the cell                                               |
| Refinement     | the star row's six places and their colour, where the screen draws the row                  | independent of the hero descriptor. A short row is R0, since refinement needs six, and weak colour evidence waits for review |
| Artifact       | the header icon's art disc against each artifact image's centre, by shape and colour        | sure only with a clear lead, a good shape match and art in the crop. A header with no badge reads as none                    |
| Map and result | strip ring and badges, Ally tab colour                                                      | which board a shot fills is settled in review                                                                                |

## Pipeline

`readScreenshot` (`src/lib/import/screens/result/result.ts`) works through these steps:

1. `framePanel` (`panel.ts`) frames the panel. `findTabs` finds the Ally and Enemy tabs at whatever scale and offset the shot has them, and the shot is resampled so the tab's width and left edge match `TABS` at `CANONICAL_WIDTH`. The game lays the panel out from the screen's width, so the tab's width gives the scale on every device, and its left edge discounts whatever margin a crop kept. The resampling is area-weighted (`resample`), so at a scale near 1 the star rows keep their faint tints.
2. The tabs seed each card column, and the frame comb in `findPanelAnchor` settles it. Without tabs, the columns are tried at their crop positions, then `scanForColumns` looks for a pair anywhere in the shot. A column found from tabs or by the scan is trusted down to `LANDMARK_FLOOR`, and one at its crop position only down to `ANCHOR_FLOOR`. Below its floor a column's cells come back empty instead of carrying a stranger's face.
3. For each card, the best frame match (`matchCard`) gives both the paragon level and the card's exact box. `rankHeroes` ranks the face, `readStars` reads the star row a fixed distance above the card's centre (`CARD_STARS`), and `assignUnique` settles each side so no hero is read twice.
4. `readStrip` places the strip from the green ring around the current map, `readArtifact` matches the header icons, and the Ally tab's colour says who won the map.

## Review

`cellState` and `reviewStates` derive each cell's state once, so the review grid and each card's "to review" count agree. Confirming or picking a hero settles identity separately from the paragon level, and `artifactState` treats each side's artifact the same way.

Each opening of the modal is a new import. Closing it, by Save as New or otherwise, drops the shots with their review edits, the side choice and any unsaved name edits (`clearImport`). The engine, its references and the learned faces stay for the page visit ([Screenshot Import](./IMPORT.md#the-engine)).

### Sides

The game's Ally tab is always the viewing player, whichever side of the board they fought from, while formation screenshots and replay frames show each team on the half it fought from. Those halves are the board's sides. Swap sides (`swapSides`) therefore puts every result screenshot's Ally column on the enemy side of its board, and changes only which column's lineup a formation shot or replay frame takes, never its half or its tiles. It is one choice per match, since a player keeps one side for every map and the boards hold a hero once per side page-wide.

Formation screenshots preset the choice when they tell which way the match went (`formationsSwapped`), and the user can still change it. A portrait read surely as a hero counts for a swap when only the result column across the board from its half holds that hero, and against one when only its own half's column does, so a shot mapped to the wrong board weighs little. When the sides change, a formation shot's portrait corrections start over, since they were made against the other column's lineup. A replay frame's picks stay on their tiles and count while their unit is one the side fields.

### Learning

A hero correction teaches the face only when the reader was unsure of the hero and sure of the frame. A doubtful frame means the crop may be off the face, and storing it would teach noise. Picking the reader's own top candidate, or no hero, takes back an earlier lesson for that face. Only result screenshots teach, and lessons go to the store of learned faces every import shares ([Reference descriptors](./IMPORT.md#reference-descriptors)).

## Plan and save

Player names are optional. Without both, the record name stays blank and the library picks its automatic name. With both, the name takes the form `S7 - GNX > 10 (1,3,4,5 > 2)`: the prefix, the player on the ally half first, `<` when the other player won more maps and `>` otherwise, then each player's map numbers. After a swap the same match reads `S7 - 10 < GNX (2 < 1,3,4,5)`. A name typed in the review replaces the built one for that import only.

The prefix and names persist in `stargazer.import.names`: `prefix`, then `left` for the player of the result screenshots' Ally tab and `right` for the player of their Enemy tab. A missing or non-string field takes its default: the current season as `S<season>`, and empty names.

```json
{
  "prefix": "S8",
  "left": "GNX",
  "right": "10"
}
```

`isBlockingIssue` separates issues that would put a wrong lineup on a board (a map filled twice, a duplicate hero, a hero or artifact repeated across boards) from ones that only leave something out. Blocking issues and invalid names stop Save as New, and warnings do not. Applying and saving belong to the Teams page ([Teams](./TEAMS.md)). An import always starts a new team, so nothing on the boards before it is kept or checked against. Applying and saving are not one transaction: a full library leaves the boards as an unsaved team carrying the name, and skipped placements are reported.

## Formation screenshots

A formation screenshot is the game's formation panel for one team: the board under the formation camera with that team's deployment tiles lit and its units standing on them, the slot circles of the match's maps under it, and the team's card row with its artifact. The panel draws every hero at the screenshotting player's own upgrades, never a match's, so the two kinds of screenshot never mix their upgrades, and an import starts from one of them:

- A match starts from its result screenshots, which give both sides' heroes, upgrades and artifacts. Its formation screenshots, each filling one side of the board its slot names, add the tile every unit stands on, its companions and its phantimal, and their cards are not read. A match saves without them, its heroes on random tiles.
- Formation screenshots dropped first are imported on their own. Each fills its side with the heroes, upgrades and artifact of its card row, or, without a card row, the portraits' heroes at paragon and refinement 0. No record name is made.

Every screenshot, dropped, picked or pasted, is sorted by kind (`sortScreenshot`): a formation screenshot when `fitBoard` finds a whole board in it, a result screen when its tabs are found, a replay frame while that step is open. A paste the sorter cannot place goes with the results, or with the formations while those are imported alone, and a dropped screenshot it cannot place is read as the kind of its drop area. A roster screenshot is refused with a toast pointing to the Rosters tab ([Roster Import](./IMPORT_ROSTER.md)).

`readFormation` (`src/lib/import/screens/formation/formation.ts`) places every region from the board, so a capture's size and padding do not matter:

1. `fitBoard` (`board.ts`) finds the board. The game draws Stargazer's own grid under the camera the perspective view reproduces (`PERSPECTIVE`), so with that shape fixed a fit is a scale and a centre, found coarse then fine from the board's thin light outline.
2. Each tile is checked for a portrait ring standing above it, since units stand with their pointer's tip at the tile centre. A nearer portrait can hide part of a far one's ring.
3. The lower half of each tile, less what portraits cover, reads lit or not. Every map's ally tiles lean to the near half and its enemy tiles to the far half, so the lit tiles say which team the shot shows.
4. The slot circles sit at a fixed distance under the board, and the one ringed in green (`ringGreen`) is the map's.
5. The card row is read with `readCards` (`src/lib/import/card/card.ts`), as a result screen's columns are, and the artifact card's disc goes to `readArtifact`.
6. Each portrait's face is ranked against the hero table and against a table of the units drawn with art of their own, the phantimals and companions such as Zanie's turrets (`companionImages`), kept apart so a result card never ranks against them.

The plan (`src/lib/teams/formationImport.ts`, joined in by `buildTeamImportPlan`) takes each portrait for one of the units the side can field: the lineup's heroes, their companions and the phantimal the portraits match best, when the heroes qualify for it (`lineupQualifies`, the board's faction rule). Best matches go first, and portraits left over take the units left over by elimination, for review. Lailah, drawn alone in game but beside Elijah in the app's art, is placed this way. A companion sharing its owner's image is told apart from the others only by tile order.

The map is the one of the mode's lists whose deployment tiles for that side are exactly the lit tiles, and the board moves to it before placing (`moveToMap`). Two formation screenshots of one side of a board, or a board whose formation screenshots show different maps, block Save as New.

`applyLineups` places every side with `placeSide`, the Load menu's placement, so a unit with a tile takes it and one without takes a random free tile. A side placed from a formation screenshot keeps the phantimal the screenshot showed, or none, and a side without one gets the phantimal its lineup qualifies for. So does a side whose screenshot misses lineup heroes and shows no phantimal, since the panel cannot draw a hero the screenshotting account lacks and can drop a phantimal whose faction count needed that hero.

Units a formation screenshot does not show are placed on its board as on a replay frame (`useTilePlacing`, which both reviews share). A tile a portrait stands on cannot be picked, nor a unit a portrait is taken for, nor, while the portraits field a phantimal, another one (`pickableUnit`). The plan applies the same rule, so a portrait reassigned later wins over a pick. The picks are kept on the shot (`tilePicks`) as tiles of the screenshot, so they stay through a swap or a change of board.

## Replay frames

When an account cannot save a match's formations (a formation holds only heroes the account owns), a 5v5 Supreme League import can place the heroes from paused replay screenshots instead. The heroes and upgrades still come from the result screenshots, and a frame only says where each unit started. One match takes formation screenshots or replay frames, never both (`replayOpen`). Frames are desktop captures of the game window at any size, paused some moments into the fight, with units already moving and effects on screen.

`readReplay` (`src/lib/import/screens/replay/replay.ts`) finds where the board lies in a frame. Every Supreme League map is fought in one arena under one fixed camera, so a frame differs from the reference frame the camera was measured in only by the window's size and the crop: a scale and a shift. They are found by matching the arena around the fight against the data pack's `screenshot-import/replay-arena.png`, a grey picture of it with the units taken out, coarse and then fine. A frame that matches too weakly has no arena (`no-arena`). The camera is six numbers, a tilted and slightly turned floor, which take each tile's centre and corners to the frame (`replayHexCentre`, `replayHexCorners`). The map strip's green ring names the map when the game's UI is in view, and a frame with the UI hidden is mapped on its card, as a result screenshot can be.

A paste goes to the replay step when the step is open, no board is found in it, its result tabs are not found and the arena matches it (`isReplayFrame`). The sorter worker holds its own copy of the arena. Without the arena picture only replay frames fail to read, and pastes still sort between formations and results.

The review draws the board over the frame (`TeamImportReplay`) and places a side's units in turn (`placingOrder`): each hero with its companions after it, then the side's phantimal with its companions. A unit picked for another tile moves there and the tile's previous unit comes off it (`setTilePick`). A side fields one phantimal, so a unit of another phantimal takes the place of the side's earlier phantimal picks. Picks are tiles of the frame's map, so changing a frame's map starts them over.

The plan places a replay frame's sides the way formation shots place theirs (`formationSide`): each picked hero on its tile, and an unpicked hero on a random free tile (`unplaced`). A picked phantimal stays as picked, and so does the phantimal of a picked companion (Wedge of Power fields Wedge of Matter), on a random free tile until it is picked too, since a phantimal's companion exists only with it. A phantimal the side's heroes do not qualify for is left out, as the board would refuse it. With neither picked, the side gets the phantimal its lineup qualifies for. Two frames of one board block Save as New (`duplicate-replay`), and a frame of a map with no result screenshot is left out with a warning (`replay-unused`).

The camera, the arena picture and the strip's circles come from the frames of one match, so they hold only while Supreme League maps are fought in that arena under that camera.

## Related documentation

- [Screenshot Import](./IMPORT.md): the engine, worker, hero cards and references every import shares
- [Screenshots the Imports Read](./IMPORT_SCREENSHOTS.md): what each screen gives, what a screenshot needs, and the limits
- [Teams](./TEAMS.md): where the import lands, and how it applies and saves
- [Grid & Characters](./GRID.md): page-wide uniqueness and the pickers the review reuses
- [Seasonal Content](./SEASONAL.md): where the seasonal artifact icons come from
