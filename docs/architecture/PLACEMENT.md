# Placement

The placement engine (`src/lib/placement/`) works out where a team stands on one map: five heroes, the phantimal and the artifact, on the map's ally tiles. It scores a placement by what each unit's skill does from where it stands when the battle starts, read from the same skill code the boards draw, and by the side each hero leans to. The PvP team generator draws a board in its formation where the board's team has no recorded formation on the map, and on every other board when the board's switch asks for it. A board on a map with no recorded games yet, or whose map's teams make no set, takes each lineup's record over every recorded map. The generator scales every team's odds, a team recorded on the board's map included, by the share of its goals' points the engine's best placement keeps there, against the map where the lineup has the most games (`effectPoints`, `src/lib/pvp/generator/fit.ts`). The search on the board's map stops at the first start whose best placement keeps all of the home map's points, since the share is capped there. A press's fit checks, and the boards of the set it picks, run side by side in up to three helpers of the Supreme League worker (`src/workers/slHelpers.ts`), which start with the first press that needs a fit check or has a board without records, never before a press. A device that reports three cores gets two helpers and one with fewer gets none, and the worker then works alone, as it does once a helper fails. A search's random starts are seeded from the team and the map, so a helper finds what the worker would. A team with more units than the map has tiles for gets no chance there.

Two things make it hard. A team has too many placements to score them all on a page: five heroes on 13 tiles are 154,440 placements, and a phantimal makes eight times as many. And most goals leave many placements as good as each other, so the engine has to say how sure it is as well as pick one.

## What it takes

`placeTeam(team, layout, data, lookups)` (`engine.ts`) returns the placement it picks, the best score found, how many placements were about as good and the tiles each hero stands on among them. Three inputs come from outside the engine:

| Input     | From                                                                                                                                                       | Holds                                                                                                                                                       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rules     | `rules` in each hero's, phantimal's, artifact's and charm's data file (`src/lib/types/rule.ts`)                                                            | What the engine wants from one effect: who it should land on, or what it should reach. A unit can have one rule for its own team and one against the other. |
| `data`    | `placement` in the PvP data file, written by the external report generator, with each map's pick rates from that map's entry (`PlacementData`, `types.ts`) | The lists the rules name, the heroes who lean to the front or the back, the weights, and how often each enemy hero with a rule against us is on each map.   |
| `lookups` | `PLACEMENT_LOOKUPS` (`lookups.ts`), over the data files                                                                                                    | Each unit's faction, class, range and rules, each hero's charm and each artifact's rules.                                                                   |

The engine imports from `src/lib` alone, and its lookups from the data loader, so its tests run it without a page. It reads the map's tiles and buff tiles from `layout` (`MapLayout`, `src/lib/maps.ts`), never from `data`: a preset's tiles from its map file under the preset's key, or a Map Editor map's from its tiles under a key built from them (`tilesLayout`). The buff tiles are the board's on its mode's list ([Teams](./TEAMS.md#modes-and-types)): a Teams or generator set that reads as Supreme League or Guild Duel as a whole, or the Arena after a pick from its map dropdown ([Grid](./GRID.md#map-editor)). Any other board, a Map Editor map among them, has none. Fit checks place both maps without buff tiles, so a lineup's share measures its own effects alone and the points kept for a map do not depend on the mode that asked. The key seeds the search and picks the enemies' pick rates in `data`.

## The board

`PlacementBoard` (`board.ts`) holds one team on one map in a `Grid` with its own `SkillManager`. It places each unit once with `executePlaceCharacter`, so each skill spawns its companions, and from then on lifts the units that move and writes them onto their new tiles with `setCharacterOnTile`, the step `performPlace` ends with, every skill updated once after the move, as a board does after a drag. It checks only that each new tile is free for an ally: the same units trading tiles cannot change the team's size or its duplicates. The units are the heroes in the team's order, then the phantimal and the companions skills spawned, so a companion with a tile of its own, such as Lailah, is placed like a hero.

## Scoring

`PlacementScorer` (`score.ts`) scores the board as it stands. Each rule reads where its effect lands from the unit's skill: the skill's target and arrows, and the tiles it marks (`getMarkedTiles`, [Skills](./SKILLS.md)). A rule for an effect Stargazer draws no skill for, such as every charm's, Ludovic's everbloom field and Phraesto's Crimson Contracts, names its tile instead: the ally behind or in front of its holder, the tiles around it (up to `distance` tiles out, 1 when unset), the other tiles on its row, or the tiles mirroring its own side's tiles around it (`tile`). With `from: 'companion'` the tile is read from the holder's other body, for an effect each body gives on its own, such as the Crimson Contract of Phraesto's Illusion. An artifact's rule reads the artifact's arrows (`reach.ts`). A companion counts as its hero and a phantimal's companion as its phantimal, except for `exactly` and `{ most: 'allies' }`, where each counts as a unit of its own, and the effect's holder never counts for itself. A phantimal and each of its companions give a Spirit Mark of their own, so the Wedges' effect is on two even where one mark finds no hero. A hero's lean comes before a Spirit Mark: the Mark counts only on a hero standing in the half of the ally tiles it leans to, or on one with no lean.

A list names heroes best first and can bring in another list's heroes at that point. It can hold one line: below it order stops mattering, and an `every` entry adds each hero whose class, range (melee is a range of one tile) or damage type matches. A list brought in above the line keeps its own order and line, one brought in below it counts all its heroes the same, and a hero named twice counts at its first place.

| Goal                     | Met                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`                 | The effect lands on the team's first hero on the list. An effect on two wants the first two, half each. A place the heroes above the line leave open goes to any hero below it. A team with none of the list's heroes falls back on the `damage` list, unless `fallback: false`, which leaves the goal unmet there. With `others`, another hero the effect lands on earns that share of the goal, never a phantimal. |
| `include`                | A share for each of the team's listed heroes the effect reaches, 0.9 of one for a hero below the line while a hero above it is on the team. An effect on one unit needs only one of them.                                                                                                                                                                                                                            |
| `avoid`                  | The effect misses the team's first hero on the list. A team with no hero above the line has no goal.                                                                                                                                                                                                                                                                                                                 |
| `atMost`, `exactly`      | The count of units on the marked tiles, with `sameFaction` one faction among them, and with `nonHero` the share of the goal met when a unit other than the team's heroes, a phantimal or a companion, is among them.                                                                                                                                                                                                 |
| `most`, `{most:'walls'}` | The enemy tiles, or the walls on the enemy's side, among the marked tiles, as a share of the most the holder can mark from any of its tiles on that map, worked out on a board of its own.                                                                                                                                                                                                                           |
| `{most:'allies'}`        | The team's units on the marked tiles, as a share of the most ally tiles the holder can mark from any of its tiles, at most the rest of the team.                                                                                                                                                                                                                                                                     |
| `companion`              | The holder's other body, such as Phraesto's Illusion, stands on the marked tiles.                                                                                                                                                                                                                                                                                                                                    |
| `back`                   | The holder stands in the back half of the ally tiles, measured as its lean is. It reads no effect, so a unit with no skill can hold it, such as Senea.                                                                                                                                                                                                                                                               |

A placement's score has two parts, compared in this order. `goals` adds each rule's weight times how much of its goal is met and the buff weight for each hero on the map's ally buff tile, and takes off the `walled` weight for each hero with a range of one tile on a tile with no way to the enemy at the start. `total` adds to the goals how far toward the side it leans each hero stands, times the `lean` weight. How far front a tile is comes from its fewest steps to an enemy tile walking round the walls, and a tile with no way there counts as the back.

A rule against us is read with its enemy unit alone on the enemy's side, tried on each enemy tile in turn, every tile as likely, so a skill that reads its own teammates finds none; a rule that names its tile, such as Reinier's, reads that tile from each enemy tile instead. Its points are its weight times the share of those tiles where its goal is met, times how often the unit is on the map (`threats()`). They choose only among placements equally good on the team's own score, since a team's own goals come first and trying each enemy unit on every enemy tile costs several times as much as the rest of a score. The engine weighs a rule against us only for the heroes the data file gives a pick rate on the map, so a rule against us added to a hero counts once the file is written again with that hero in it.

## Search and choice

The search climbs from 32 placements drawn at random, seeded from the map and the team so a rebuild gives the same placement. Each climb takes the best step until none improves, a step being one unit moved to a free tile or two units trading tiles, and then the best move of two units together, each to a free tile or to the other's, since some goals need two units to move at once, such as Saida's two seeds. A goal that needs three units to move together, such as two heroes of one faction between Elijah and Lailah when the team has only those two, is reached only from a start near it, which is why there are 32 starts and not 16. Scores are kept by placement, so a placement two climbs reach is scored once.

Equally good placements are those with `goals` within the `margin` weight of the best. They are found by spreading step by step from the ones the climbs scored, until the count reaches 1,000, which the result reports as not complete. A better placement found on the way becomes the best and the spread starts again. The pick is the one with the highest total and threat points among them, then the lowest tiles in the units' order, and each hero keeps the tiles it stands on in any of them. Threat points are slow to read, since each enemy unit is tried on every enemy tile, so the placements are tried from the highest total down, and a placement's enemy rules are read heaviest first and stop once the rest could not lift it to the best so far. `full: true` scores every placement instead, which the tests compare the search with. `held` keeps the units it names on their tiles and moves only the others; the PvP team generator tries a swap that way (`swapPreview.ts`), the heroes swapped in placed around the units that stay where the board draws them, and reads a recorded placement with every unit held (`formation.ts`). A placement recorded in an earlier season holds no phantimal, so the engine places the one the heroes summon around the held units. Where freeing a recorded team's phantimal, alone or with one of its heroes, lets the phantimal's own goals (its Spirit Mark's) score higher, the generator draws the best such try, fewer units moved winning a tie, with every other unit on its recorded tile. A set on the Supreme League's maps, which the league plays without Spirit Marks, draws every recorded formation as recorded.

## Why a unit stands there

`explainPlacement` (`explain.ts`) gives the reasons for a placement `placeTeam` picked or held, which the PvP team generator shows in a card on each unit of a board, recorded or placed by the engine, and for an ally side placed by hand on the Arena or Teams, which Placement tips shows (`sideExplanation` in `formation.ts`, run in the Supreme League worker). A side with a unit the engine would not place there, such as a synergy copy, gets no card. A unit's reasons are the effects it gives or reaches, naming every ally a `target` goal's effect lands on and the heroes any other goal counts as met on, and those it receives where its goal counts it; the buff tile; the side its hero leans to, when no hero or other body stands on a row ahead of it (behind, for the back) nor nearer the enemy walking round the walls, as its lean is scored; and the back half, for a `back` goal met, when its lean's line does not already put it at the back. A unit's other tiles are the free tiles the engine itself would pick for it moved alone: goals within the margin of the best, then the highest total. Each is measured against the best score the search found, or against the placement's own score when none is given, as for a side placed by hand: one where the placement would be better by more than the margin (`beats`: more goals by more than the margin) is drawn green, and one where it stays as good (`asGoodAs`, as the search counts equally good) dashed. The enemy units' rules give no reasons, since they only choose among placements as good.

A reason names units by id and an effect by the data file its rule sits in: the hero's or phantimal's name, the charm's id or the artifact's name. The card words a `target`, `include` or `exactly` goal by `placement-gives-<file>` (`{heroes}`) and `placement-receives-<file>` (`{giver}`), and a `most` or `companion` goal by `placement-reaches-<file>`, in `src/locales/app/placement/effects/`, while a `back` goal takes the place line `placement-stands-back-half`. An effect a unit's other body gives (`from: 'companion'`) takes `<file>-companion` as its file. A goal about enemy heroes gives no line. The rules test fails when a weighted rule has no words, or words name no rule.

## The Formation engine rules page

The Formation engine rules page (`/guide/pvp/generator/rules`) shows each unit's rules and the lists they read: `formationRules.ts` builds its cards and lists, and `src/components/guide/rules/` draws them. A rule's note is `placement-note-<file>-<team>-<goal word>` (`<file>-companion` for the other body) in `src/locales/app/placement/notes/`, its English the rule's `note`, and an `avoid` rule's targets `placement-targets-<file>` in `.../targets/`. A list is named by `rules-list-<name>`, else after the one unit whose rule reads it.

## A visitor's lists

The Hero lists page (`/guide/pvp/generator/rules/lists`) lets a visitor change the lists the rules read and copy or export the changed ones; the site always places heroes by its own. The browser keeps the changed lists under `stargazer.placement.lists` as they are made (`src/lib/placement/listEdits.ts`), and Back to the site's lists for every list removes the key:

```json
{
  "lists": {
    "temp-buff": {
      "entries": [120, 92, 128, 105],
      "site": [120, 92, 128, 13, 105]
    },
    "taichi": {
      "entries": [
        { "list": "temp-buff" },
        115,
        { "line": true },
        { "every": { "class": ["warrior", "rogue", "mage", "marksman", "support"] } }
      ],
      "site": [
        { "list": "temp-buff" },
        { "line": true },
        { "every": { "class": ["warrior", "rogue", "mage", "marksman", "support"] } }
      ]
    }
  }
}
```

| Field             | Type   | Rule                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lists`           | object | Keyed by the name of a list the data file has. A name it does not have is dropped, with a line on the page.                                                                                                                                                                                                                                                                                                                                       |
| `lists.*.entries` | array  | The visitor's version, in the data file's entry forms. An unknown hero number is dropped and a list that cannot be read is dropped whole, each with a line on the page. The page refuses a change that breaks the data file's rules (one line at most, `every` entries only below it, no list bringing itself in), but a site update can still leave a list breaking one: it is kept and shown with its problem, and left out of Copy and Export. |
| `lists.*.site`    | array  | The data file's version of the list when the visitor first changed it, or last chose Keep mine. When it differs from the data file's version now, the page says the site changed the list.                                                                                                                                                                                                                                                        |

Export writes the changed lists the rules can read, entries only, to a file, and Copy puts the same text on the clipboard:

```json
{
  "app": "stargazer",
  "kind": "placement-lists",
  "exportedAt": "2026-11-08T10:00:00.000Z",
  "lists": {
    "temp-buff": [120, 92, 128, 105]
  }
}
```

| Field        | Type   | Rule                                                       |
| ------------ | ------ | ---------------------------------------------------------- |
| `app`        | string | Always `"stargazer"`.                                      |
| `kind`       | string | Always `"placement-lists"`.                                |
| `exportedAt` | string | When the file was made, ISO 8601.                          |
| `lists`      | object | List name to entries, each under the stored value's rules. |

## Fits kept between visits

The browser keeps the points fit checks find under `stargazer.fits`, so a later visit checks only the fits it has not met. The page hands the stored value to the Supreme League worker with the worker's first press, and the worker uses it only when its `build` is the worker's own file name, whose hash changes with the code and the data file. Each press answers with the points it measured, stamped with that name, and the page adds them and saves (`src/lib/pvp/generator/storedFits.ts`). A save over a value of another build replaces it, and a value that does not parse is removed when read. Past 2,000 entries a save removes whole maps, the one that gained points longest ago first; the map that gained points last always stays. A save the browser refuses removes the value. The development server's worker has no hash in its file name, so nothing is kept there.

```json
{
  "build": "sl.worker-B7x2kQ9a.js",
  "maps": {
    "arena1": {
      "68,74,94,116,121": 21.5,
      "54,68,104,106,109": 33
    },
    "arena4": {
      "68,74,94,116,121": 16.125,
      "54,68,104,106,109": 23
    }
  }
}
```

| Field               | Type   | Rule                                                                                                                                                                                                                         |
| ------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`             | string | The file name of the worker that measured the points. A value with another name is never used.                                                                                                                               |
| `maps`              | object | One object per map checked, under the map's layout key: a preset's key such as `arena4`, or `edited:` and the map's tiles for a Map Editor map. Maps are in the order they last gained points, the oldest first.             |
| `maps[map][lineup]` | number | The points the lineup's own goals earn in the fit check's placement on that map, at full precision, so a fit worked out from them equals the one measured. The lineup is its hero ids in the team's order, joined by commas. |
