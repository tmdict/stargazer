# Screenshot Import

The screenshot imports read the game's own screens on the device and turn what they show into app data. The team import reads match result screens, formation panels and replay frames into a new team on the Teams page. The roster import reads the hero roster (the Resonating Hall) into a new roster. Who Would Win?'s import reads the Supreme League's knockout matchup list into that page's five games. Each import has its own review and plan. Under them they share the image code, the hero card reader, the workers, the references and the faces learned from corrections.

What makes it hard is that screenshots vary. Players crop them, phones have different shapes, desktop captures have other windows around the game, and the in-game card zooms each portrait slightly differently. So every reader finds its screen before it reads anything, and says how sure it is of every field. Nothing reads text: every landmark is a shape, a colour or a picture.

## How it fits together

```
┌─ import modal ───────────┐            ┌─ import composable ──────┐
│ drop areas, review,      │───────────▶│ its shots and edits      │
│ save                     │files, edits│ its plan                 │
│                          │◀───────────│                          │
└──────────────────────────┘  readings  └────────────────────┬──▲──┘
                                                       files │  │ readings
                                                             ▼  │
┌─ import.worker ──────────┐            ┌─ useImportEngine ──┴──┴──┐
│ a reader per kind        │◀───────────│ decoding, read queue     │
│ hero, board, unit tables │   images   │ references               │
│ artifacts, arena         │───────────▶│ learned faces            │
└──────────────────────────┘  readings  └──────────────────────────┘
```

Recognition is pure TypeScript over RGBA buffers (`src/lib/import/`), so it runs unchanged in the worker, in unit tests and in offline checks against labelled screenshots kept outside this repo. Each import's composable (`useTeamImport`, `useRosterImport`, `useWwwImport`) holds its screenshots and the user's corrections and builds its plan from them (`buildTeamImportPlan`, `buildRosterImportPlan`, `buildWwwImportPlan`). Only Save changes the app's data.

## Decisions

Landmarks come before templates. Each reader first finds its screen's own landmark: the result screen's Ally and Enemy tabs, the formation panel's board outline, the replay's arena, the roster's cream gutters, or the matchup list's blue and red team bars. Template matching then only settles exact positions and identities. A screen therefore reads from any crop and any device.

Each field of a reading comes from its own signal: the hero from the face, the paragon level from the card's frame, the refinement from the star row above the face, and the artifact from its icon. Each field carries its own sure flag, so a doubt about a frame never hides behind a sure hero, and a correction to one field never moves another.

A reading never changes once made. A correction is an override stored beside it, so the review can show each reading's confidence and undo any edit. The plan is worked out again from the readings and overrides on every change, so it comes out the same whichever screenshot reads first, and removing a screenshot drops its corrections with it. A plan is plain data built with no store access, and the page that owns the data applies it with its own placement code.

The bar for marking a reading sure is that nothing read wrongly is marked sure on the labelled samples. A misreading may slip by only as an unsure reading the review asks about.

## Layers

`src/lib/import/` is built in layers, and a layer imports only those below it, so a new screen is a reader on top of what the others share. `core/` holds the RGBA and rectangle types and the image primitives. `card/` reads the game's hero card wherever a screen shows one: the frame match names the paragon level and pins the card's box, the face is ranked against the hero table, and the star row gives the refinement. Cards shown together are settled against each other, since they show different heroes. `artifact/` reads the artifact icon that the result, formation and matchup screens show. `screens/` has one reader per screen, and `screens/match/` holds what the three match screens share. On top sit the review rules every import asks of a card, the reference assembly, the learned-face store and the sorter, which tells which import and kind a screenshot shows.

## The engine

`useImportEngine` is module-level state for one opening of an import. Closing the modal, or leaving the page with it open, stops the workers and drops the references, so a closed import holds none of that memory, while the learned faces stay. The pages never import it, so its code loads with the modal on first use.

Every file goes through the engine's `addFiles`. It is sorted first, then the import places it as a kind to read or turns it away, so each import refuses a screenshot that belongs to another. A placed screenshot is decoded on the main thread and handed to a worker as pixels. Save waits until every file is added and read.

The references come in two parts (`src/lib/import/kinds.ts`). The hero part serves every kind. The match part serves the match screens and the matchup list, so a roster read never waits on it. Each part is fetched once per opening. When a part fails to load, the screenshots waiting on it fail but stay queued, and the next screenshot added retries the load.

One worker script reads every kind. One reader starts, and more start while screenshots wait, up to a limit set by the device's cores, its reported memory and whether it has a touch screen. A reader that crashes is dropped with the screenshot it was reading, and the pool grows no further in that opening, since a device short of memory would fail a new reader the same way.

## Hero identity

A face descriptor is a 32 × 24 RGB crop with each channel normalised to zero mean and unit norm, which cancels the warm tint the card's frame casts. It is stored as signed bytes at ×400, in the worker's table and in every saved descriptor.

The hero table cuts every portrait over a grid of crop windows, because the in-game card frames the same painting differently for each hero. A pick needs a floor score and a lead over the best candidate of any other hero, and a wider lead when the winning window came from an outfit, since an outfit's looser framing fits strangers more easily.

## Face examples

Three sources feed the hero table, assembled by `buildImportHeroTable` (`src/lib/import/references.ts`) for the worker and the offline checks alike. Portraits and outfits give general coverage. A file of approved face examples from the data pack, bundled into the site, covers cards the portraits cannot match. Browser learning adds examples private to that browser. Ranking and confidence do not depend on which source a row came from.

The bundled file and browser storage (`stargazer.import.learned`) share one shape, validated by `readLearnedIcons`:

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

`spec` pins how the descriptors were made, so data whose `spec` differs, or that is not an object with an `icons` array, reads as nothing learned.

A hero correction teaches the face only when the reader was unsure of the hero and the card's frame was placed surely. A doubtful frame means the crop may be off the face, and storing it would teach noise. Picking the reader's own top candidate, or no hero, takes back an earlier lesson for that face. Every import teaches the one store, and each reader takes the store's new list into its table before its next read.

Each descriptor appears once. A local lesson for identical descriptor bytes overrides the bundled label. Different crops of one hero stay separate examples, and nothing is averaged or voted. No correction ever edits the bundled file.

## Reference pictures

Every reference picture, the paragon frames included, is built into the site from the data pack (`src/pack/`), encoded at the settings the matching was tuned on. Without a pack the frames are missing, and the import says its reference images could not be loaded.

## The team import

A match starts from its result screenshots, which give both lineups with each hero's paragon and refinement, both artifacts, which map of the match each shows and who won it. Formation screenshots or replay frames then add where each unit stands, never both in one match. Formation screenshots can also be imported on their own, each filling its side from its own card row.

### Sides

The game's Ally tab is always the viewing player, whichever side of the board they fought from, while formation screenshots and replay frames show each team on the half it fought from. Those halves are the board's sides. Swap sides (`swapSides`) therefore puts every result screenshot's Ally column on the enemy side of its board, and changes only which column's lineup a formation screenshot or replay frame takes, never its half or its tiles. It is one choice per match, since a player keeps one side for every map.

### Formation screenshots

The formation panel draws every hero at the screenshotting player's own upgrades, never at the match's. So a match's upgrades come only from its result screenshots, and its formation screenshots' cards are not used. `fitBoard` finds the board through the same camera the perspective view draws (`PERSPECTIVE`, [Grid](./GRID.md)), so a fit is only a scale and a centre. The lit tiles tell which team the screenshot shows, and the map is the one whose deployment tiles for that side are exactly the lit tiles.

Each portrait is taken for one of the units the side can field, best matches first. Units a screenshot does not show are placed by hand on its board, as on a replay frame (`useTilePlacing`).

### Replay frames

An account that cannot save a match's formations can place a 5v5 Supreme League match's heroes from paused replay frames instead. The heroes and upgrades still come from the result screenshots, and the user places each unit on the frame's tiles. Every Supreme League map is fought in one arena under one fixed camera, so a frame differs from the reference frame only by a scale and a shift, found by matching the arena against the data pack's picture of it. The measurements hold only while Supreme League maps are fought in that arena under that camera.

### Record names and save

Player names are optional. With both, the record name takes the form `S7 - A > B (1,3,4,5 > 2)`: the prefix, the player on the ally half first, `<` when the other player won more maps and `>` otherwise, then each player's map numbers. Without both, the library picks its automatic name. A name typed in the review replaces the built one for that import only.

The prefix and names persist in `stargazer.import.names`: `prefix`, then `left` for the player of the result screenshots' Ally tab and `right` for the player of their Enemy tab. A missing or non-string field takes its default: the current season as `S<season>`, and empty names.

```json
{
  "prefix": "S8",
  "left": "A",
  "right": "B"
}
```

`isBlockingIssue` separates issues that would put a wrong lineup on a board from ones that only leave something out. Blocking issues and invalid names stop Save as New, and warnings do not. An import always starts a new team. Applying and saving are not one transaction: a full library leaves the boards as an unsaved team carrying the name ([Teams](./TEAMS.md)).

## The roster import

A whole roster takes several screenshots, taken any way as long as each hero shows whole in at least one. The reader finds the grid from the cream ground and fits a comb of six columns to its gutters. A row the scroll cuts is skipped, since its cards are whole in another screenshot. Heroes below S+ have no paragon frame, and Stargazer does not use them, so the import takes them as P0, R0.

A roster holds a hero once, so the plan merges every screenshot's cards into one entry per hero. Cards that disagree on a hero's levels, or a hero read twice in one screenshot, hold back Save. Save creates the roster with its name and heroes in one write and makes it the active roster ([Teams](./TEAMS.md#rosters)).

## The matchup import

Players take the knockout list in one or two screenshots. Each game's panel is found from the blue and red bars over its two teams, and every other measurement is a share of the bar's width, so crops and screen sizes need nothing else. A team box whose foot is out of view reads no cards, since a hidden card row still matches the frames and its faces can read as heroes on blank ground.

The plan puts the panels together into games. A screenshot's panels are consecutive games, and two panels of different screenshots are one game when a side's settled heroes overlap, since a player fields each hero once in a match. For each part of a card the sure readings stand over the unsure ones. An artifact not read surely is left empty, so another season's artifact, whose icon the app does not have, never goes in as a wrong one.

A card or artifact its screenshots read differently, or that its side fields in two games, holds back Save. Save replaces all five games, and a game the screenshots do not show becomes an empty one.

## Limits

Every screenshot must be at least 400 px wide; narrower ones are refused unread.

Nothing reads text, but other game languages are untested on the match screens. A game update that moves or recolours a landmark stops that screen reading until its reader is measured again on new samples.

Seasonal artifacts are matched against the icons the app ships, so a new season's artifacts read once the data pack holds their icons ([Seasonal Content](./SEASONAL.md)), and a new hero once its portrait is in the app. Until then the reader marks them unsure.

## Privacy

Screenshots never leave the device. The references are fetched, each screenshot is drawn to a canvas and handed to a worker as pixels, and nothing of it is stored. What persists is what the user saves (a team or a roster) and the learned face descriptors, which are numbers describing a face crop, not images.

## Related documentation

- [Teams](./TEAMS.md): where the team and roster imports land, and how a team is applied and saved
- [Grid](./GRID.md): page-wide uniqueness and the perspective camera the formation reader shares
- [Seasonal Content](./SEASONAL.md): where the seasonal artifact icons come from
