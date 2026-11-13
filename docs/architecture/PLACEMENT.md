# Placement

The placement engine (`src/lib/placement/`) works out where a team stands on one map: five heroes, the phantimal and the artifact, on the map's ally tiles. It scores a placement by what each unit's skill does from where it stands when the battle starts, read from the same skill code the boards draw, and by the side each hero leans to.

Two things make it hard. A team has too many placements to score them all on a page. And most goals leave many placements as good as each other, so the engine has to say how sure it is as well as pick one.

The PvP team generator is its main caller. It draws a board in the engine's formation where the board's team has no recorded formation on the map. Where it has one, it scores both and shows the recorded one when the rules score it within the margin of the engine's, or when its own win record makes up the difference (`boardDraw`, `src/lib/pvp/generator/formation.ts`); the generator page's debug view (`?t=debug`) puts a switch between the two on the board. A recorded formation that keeps fewer [hard rules](#hard-rules) than the engine's, or as many with fewer met in full, is never the one shown. It also scales every team's odds by the share of its goals' points the engine's best placement keeps on the board's map, against the map where the lineup has the most games, and gives a board no team whose best placement on its map breaks a hard rule (`effectPoints`, `src/lib/pvp/generator/fit.ts`). Fit checks and drawn boards run in the Supreme League worker and its helpers (`src/workers/slHelpers.ts`). A search's random starts are seeded from the team and the map, so a helper finds what the worker would.

## What it takes

`placeTeam(team, layout, data, lookups)` (`engine.ts`) returns the placement it picks, the best score found, how many placements were about as good and the tiles each hero stands on among them. Three inputs come from outside the engine:

| Input     | From                                                                                            | Holds                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Rules     | `rules` in each hero's, phantimal's, artifact's and charm's data file (`src/lib/types/rule.ts`) | What the engine wants from one effect: who it should land on, or what it should reach.           |
| `data`    | `placement` in the PvP data file, written by the external report generator (`PlacementData`)    | The lists the rules name, the heroes who lean to the front or the back, the weights, pick rates. |
| `lookups` | `PLACEMENT_LOOKUPS` (`lookups.ts`), over the data files                                         | Each unit's faction, class, range and rules, each hero's charm and each artifact's rules.        |

The engine imports from `src/lib` alone, and its lookups from the data loader, so its tests run it without a page. It reads the map's tiles and buff tiles from `layout` (`MapLayout`, `src/lib/maps.ts`), never from `data`. The layout's key seeds the search and picks the enemies' pick rates in `data`. Buff tiles come from the board's mode list ([Teams](./TEAMS.md#modes-and-types)), and fit checks place both maps without them, so a lineup's share measures its own effects alone and does not depend on the mode that asked.

## The board

`PlacementBoard` (`board.ts`) holds one team on one map in a `Grid` with its own `SkillManager`. It places each unit once with `executePlaceCharacter`, so each skill spawns its companions. From then on it lifts the units that move and writes them onto their new tiles with `setCharacterOnTile`, with every skill updated once after the move, as a board does after a drag. A companion with a tile of its own, such as Lailah, is placed like a hero.

## Scoring

`PlacementScorer` (`score.ts`) scores the board as it stands. Each rule reads where its effect lands from the unit's skill: the skill's target and arrows, and the tiles it marks (`getMarkedTiles`, [Skills](./SKILLS.md)). A rule for an effect Stargazer draws no skill for, such as every charm's, names its tile instead (`tile`), and an artifact's rule reads the artifact's arrows (`reach.ts`).

A list names heroes best first and can bring in another list's heroes at that point. It can hold one line: below it order stops mattering, and an `every` entry adds each hero whose class, range or damage type matches.

| Goal                     | Met                                                                                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`                 | The effect lands on the team's first hero on the list. A team with none of the list's heroes falls back on the `damage` list, unless `fallback: false`.  |
| `include`                | A share for each of the team's listed heroes the effect reaches, with the same fallback.                                                                 |
| `avoid`                  | The effect misses the team's first hero on the list.                                                                                                     |
| `atMost`, `exactly`      | The count of units on the marked tiles, with `sameFaction` one faction among them.                                                                       |
| `most`, `{most:'walls'}` | The enemy tiles, or the walls on the enemy's side, among the marked tiles, as a share of the most the holder can mark from any of its tiles on that map. |
| `{most:'allies'}`        | The team's units on the marked tiles, as a share of the most ally tiles the holder can mark from any of its tiles.                                       |
| `companion`              | The holder's other body, such as Phraesto's Illusion, stands on the marked tiles.                                                                        |
| `back`                   | The holder stands in the back half of the ally tiles. It reads no effect, so a unit with no skill can hold it.                                           |

A placement's score has four parts, compared in this order. `kept` and `whole` count the team's hard rules, below. `goals` adds each rule's weight times how much of its goal is met, plus the buff weight for each hero on an ally buff tile, less the `walled` weight for each melee hero on a tile with no way to the enemy. `total` adds to the goals how far toward the side it leans each hero stands, times the `lean` weight.

### Hard rules

A rule with `hard: true`, on a `target` or an `exactly` goal of the team's own, comes before the weights: a placement that keeps more of the team's hard rules (`kept`) is the better one whatever its goals score. The rule still scores its weight as any other does.

| Goal                   | Kept                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `target`               | The effect reaches any hero of the team, on the list or not. A hero's other body counts as the hero, and a phantimal never does.                              |
| `exactly`              | The goal is met.                                                                                                                                              |
| `exactly` with `least` | At least that many heroes stand among the units counted, all of one faction with `sameFaction`. Meeting the whole goal counts next (`whole`), before `goals`. |

`whole` counts only for a team that can meet the whole goal: with `sameFaction`, one that has that many heroes of one faction beside the holder.

A rule against us is read with its enemy unit alone on the enemy's side, tried on each enemy tile in turn. Its points (`threats()`) choose only among placements equally good on the team's own score: a team's own goals come first, and trying each enemy unit on every enemy tile costs several times as much as the rest of a score.

## Search and choice

The search climbs from placements drawn at random, seeded from the map and the team so a rebuild gives the same placement. Each climb takes the best step until none improves, a step being one unit moved to a free tile or two units trading tiles, and then the best move of two units together, since some goals need two units to move at once. Scores are kept by placement, so a placement two climbs reach is scored once. A search whose best placement breaks a hard rule, or leaves one short of a whole goal the team can meet, climbs from more starts (`MORE_STARTS`) and stops at the first placement that does neither.

Equally good placements are those that keep the hard rules the best one keeps, with `goals` within the `margin` weight of it. They are found by spreading step by step from the ones the climbs scored, up to a cap, past which the result reports itself as not complete. The pick is the one with the highest total and threat points among them, and each hero keeps the tiles it stands on in any of them, which is how the engine says how sure it is.

`full: true` scores every placement instead, which the tests compare the search with. `held` keeps the units it names on their tiles and moves only the others. The PvP team generator tries a swap that way (`swapPreview.ts`) and reads a recorded placement with every unit held (`formation.ts`).

## Why a unit stands there

`explainPlacement` (`explain.ts`) gives the reasons for a placement, which the PvP team generator shows on each unit of a board and Placement tips shows for an ally side placed by hand (`sideExplanation` in `formation.ts`, run in the Supreme League worker). The enemy units' rules give no reasons, since they only choose among placements as good.

A reason names units by id and an effect by the data file its rule sits in. Its words are locale keys built from that file name, `placement-gives-<file>`, `placement-receives-<file>` and `placement-reaches-<file>` in `src/locales/app/placement/effects/`, and the rules test fails when a weighted rule has no words or words name no rule.

## The Formation engine rules page

The Formation engine rules page (`/guide/pvp/generator/rules`) shows each unit's rules and the lists they read: `formationRules.ts` builds its cards and lists, and `src/components/guide/rules/` draws them. Its words follow the same pattern, keyed by the rule's data file, under `src/locales/app/placement/notes/` and `.../targets/`. A hard rule's card carries a Hard rule tag in its heading.

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

## The fit table

The data pack's fit table holds what the generator's fit checks find for every lineup of the PvP data file on every preset map, so a visit runs a fit check only on a Map Editor map. `npm run fits` makes it with the app's own fit check (`src/lib/pvp/generator/fitTable.ts`) and writes it into the pack folder, wrapped like the data file and with its key. The Supreme League worker loads the table beside the data file and hands it to its fit stores, which read a placement from it before placing a lineup. The development server uses no table, since its code changes under one.

A table is used only while its `stamp` is the one the build works out: a digest of the data file and of the repo's files the fit check is built of, its code and game data alike (`scripts/lib/fitTable.ts`). `npm run data` compares the two each time it fills `src/pack/`. Where they differ, or the pack has no table, it prints a line and the app is built without one, so the generator checks fits in the browser until `npm run fits` has run again.

```json
{
  "stamp": "3f9c1a7e52b0",
  "maps": ["arena1", "arena2", "preset-sr1"],
  "seasonal": {
    "points": [
      [21.5, 16.125, null],
      [33, 30, 23]
    ],
    "refused": [[1, 2]]
  },
  "plain": {
    "points": [
      [18, 16.125, null],
      [33, 30, 23]
    ],
    "refused": []
  }
}
```

| Field      | Type   | Rule                                                                                                                                                                                                                                        |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `stamp`    | string | What the table was made from. A table with another stamp than the build's own is left out of the build.                                                                                                                                     |
| `maps`     | array  | The preset maps by key, one per column of a row.                                                                                                                                                                                            |
| `seasonal` | object | Every lineup placed with the phantimal it summons.                                                                                                                                                                                          |
| `plain`    | object | Every lineup placed without a phantimal, for Non-Seasonal boards.                                                                                                                                                                           |
| `points`   | array  | One row per lineup, in the order of the data file's lineups over every map. A row holds, per map, the points the lineup's own goals earn in the fit check's placement there, at full precision, or `null` where the lineup is never placed. |
| `refused`  | array  | `[row, map]` pairs, both as indexes into `points`, whose placement breaks a hard rule of the lineup. Its points stay in `points`, since a lineup's main map measures its other maps.                                                        |

A table whose rows are not one per lineup of the data file, or that does not decode, is not used, and the fit checks run in the browser.

## Fits kept between visits

The browser keeps the points fit checks find under `stargazer.fits`, so a later visit checks only the fits it has not met; with a fit table in the build those are the fits on Map Editor maps. The page hands the stored value to the Supreme League worker with the worker's first press, and the worker uses it only when its `build` is the worker's own file name, whose hash changes with the code and the data file. Each press answers with the points it measured, stamped with that name, and the page adds them and saves (`src/lib/pvp/generator/storedFits.ts`). A save over a value of another build replaces it, and a value that does not parse is removed when read. Past 2,000 entries a save removes whole maps, the one that gained points longest ago first; the map that gained points last always stays. A save the browser refuses removes the value. The development server's worker has no hash in its file name, so nothing is kept there. The points of a placement that breaks a hard rule stay with the worker for the visit and are never saved, so a later visit checks that fit again. The same holds for a Non-Seasonal press: its boards field no phantimal, so its fit checks place every lineup without one and keep their points apart.

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

| Field               | Type   | Rule                                                                                                                                                                                                                                                                       |
| ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `build`             | string | The file name of the worker that measured the points. A value with another name is never used.                                                                                                                                                                             |
| `maps`              | object | One object per map checked, under the map's layout key: a preset's key such as `arena4`, or `edited:` and the map's tiles for a Map Editor map. Maps are in the order they last gained points, the oldest first.                                                           |
| `maps[map][lineup]` | number | The points the lineup's own goals earn in the fit check's placement on that map, one that keeps every hard rule of the lineup, at full precision, so a fit worked out from them equals the one measured. The lineup is its hero ids in the team's order, joined by commas. |
