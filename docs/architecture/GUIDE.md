# Guide

The guide is an index page and the reference pages it links: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, each season's PvP report, the Supreme League generator and Who Would Win?. Each guide page has one address, shows in the site language and is pre-rendered in English, as `/skills` is ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages

`GUIDE_PAGES` and `guidePath` (`src/lib/guide.ts`) feed the router, the pre-render route list and the page meta, so a page added there is routed, pre-rendered and titled together. The top bar's Guide tab lists the pages for a mouse hovering over it (`GuideMenu`), so a new page also joins that list; a season's report joins it with its `PVP_SEASONS` entry. The site language can switch while a page is open, so `setupGuideContentMeta` passes `useHead` a computed that follows it instead of the value at setup.

Each index panel's title link is stretched over its `.guide-link` area (`src/styles/guide.css`), so the whole panel opens the page. A control placed inside that area must raise itself with `position: relative; z-index: 2`, or the stretched link swallows its clicks.

## Mechanics page

The page has one card per tag, holding every hero that carries it, and one for initial energy, holding every hero that starts a battle with any. [Skill Pages](./SKILL_PAGES.md) defines tags, modifiers, the energy filter and when a hero satisfies a pick. Picks combine as all-of.

A pick dims the heroes outside the selection where they stand, so every card keeps its place and shape while picks change. The faction and class icons narrow the page instead, and drop a card they empty unless it is picked. `useMechanicPicks` keeps whether a tag's title is picked apart from its picked modifiers, so switching the last modifier off returns the tag to what it was before any was on.

The energy card's value is the energy filter's, shared with the hero lists, so the card opens on whatever a list left it at. A hero's skill modal opens on the picks the hero has skill text for, else on its card's tag, never on an empty list. No skill level carries a hero's energy, so the energy pick is never one of them.

The selection lives in memory only. A tag or energy link replaces it after mount, because the baked page has nothing picked ([Pre-Rendering](./PRE_RENDERING.md)). The index's tiles put the card's id in the URL fragment, so the router's `scrollBehavior` brings the card into view.

## Season summaries

A season's summary (`src/content/pvp/s<N>/summary.ts`) is a typed literal generated with the season's report and never edited here. While a season is played its summary is copied again with each new report and says so (`live`), and once it ends it stays as it is. Season 7's is the exception: it lists the teams on its report's counter ladder and is kept by hand, since its report is not built again. Nothing derives these numbers, so the index never disagrees with the report. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) lists the summaries newest first.

A summary lists the languages its report is written in (`languages`, English first) and carries each team's label in each of them. In an app locale the report is not written in (`reportReadsIn`), a team is named by its heroes in that locale (`pvpTeamName`), so a season needs nothing per app locale beyond the hero names the app already has. Report links ask for the site language (`pvpReportHref`), and a report written without it opens in English.

A report's page is built from its template alone ([Pre-Rendering](./PRE_RENDERING.md)), so a report can be published before the index lists it. Its folder then holds the template only, and its summary arrives with its `PVP_SEASONS` entry.

## Supreme League generator

`/guide/pvp/generator` (`SL_GENERATOR_PATH`) picks, for the heroes and levels a visitor selects, the set of five recorded Supreme League teams, one per board and no hero twice, with the best chance to win a match. Its records come from an external report generator, which writes the data file `src/content/pvp/sl/sl.bin` with each export. Stargazer learns its prediction model from the file's games and chooses the set itself.

The page is pre-rendered in English with its heading alone, so search engines find it. The picker and the set follow the rosters the browser holds, so they are drawn after mount. The guide index's card for the generator draws a default set worked out once per build: `scripts/slPreview.ts` runs `defaultSlSet` (`src/lib/pvp/sl/generator/defaultSet.ts`) through Vite's module runner, so the app's imports resolve, and hands the result to the card as `virtual:sl-preview`. The index therefore loads neither the data file nor the model, and its boards are in the baked HTML.

The picker is the Rosters tab's `RosterEditor` ([Teams](./TEAMS.md)), bound to a copy of the active roster so that trying a hero out never reaches the roster. With no roster every hero starts at P4 R4, the level the recorded opponents are counted at. A hero the file cannot rate yet, one out in the file's season or later that no decided game fields (`unratedHeroes`, `data/games.ts`), is locked: the picker shows it greyed, never adds it, and a hover or tap shows that its data is being collected, and the set leaves it out whatever the roster holds. `useSlFile` works these heroes out once the file loads, so a hero unlocks with the first export that records a game with it. The set is chosen only on Generate and keeps the selection it was chosen with, which is what Save as team saves. The Teams page's type picker (`TeamVariantPicker`) chooses the boards: SL, where the page opens, stands them on the file's maps, and Default on the Teams page's default 5v5 maps, map 1 on all five, so each board takes the teams recorded on map 1 while the model still learns from every map's games. A set keeps the type it was chosen with until the next Generate.

The page keeps the dark look in both of the site's looks, the style of the season reports it comes from. Its root, `.sl-page`, carries `data-theme="dark"`, so the colour tokens take their dark values inside it and the shared roster controls keep their shapes in dark colours ([Architecture](../ARCHITECTURE.md#rules-that-apply-everywhere)). `src/components/guide/sl/sl.css` keeps every rule under that root. The page sizes the shared roster controls up through their tokens (`--control-height-compact`, `--dock-scale`).

### Code layout

`src/lib/pvp/sl/` is split by job, and each part uses only the ones above it in this table:

| Folder       | Holds                                                                                                                                                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/`      | The file's shape (`types.ts`) and reader (`codec.ts`), this season's decided games as two sides each (`games.ts`), the kind rule (`kinds.ts`), the records Who Would Win? shows (`records.ts`) and upgrade points (`upgrades.ts`).                                  |
| `model/`     | The shape every prediction model fits (`types.ts`), the list of models (`models.ts`), the shared model (`shared.ts`), its fitting routine (`fit.ts`), the split of a chance into reasons (`reasons.ts`) and the chance of winning each number of games (`odds.ts`). |
| `generator/` | The search (`chooser.ts`), the artifact rule (`artifacts.ts`), boards and swaps (`boards.ts`), the team Save as team stores (`team.ts`) and the index card's default set (`defaultSet.ts`).                                                                         |
| `www/`       | Who Would Win?'s result for a game (`panel.ts`), and its games and a match's result (`match.ts`).                                                                                                                                                                   |

### The model

Every prediction model fits one shape (`model/types.ts`). It learns from one season's decided games, then answers who should win a match-up and by how much (`edge`, the log-odds of A winning), how strong a team is against a typical opponent of the season at the top levels (`againstTypical`), and what a match-up's edge adds up from (`explain`). `MODELS` lists every model, which the external report generator's studies measure side by side, and `PAGE_MODEL` is the one the pages use.

The shared model (`model/shared.ts`) learns, by penalised logistic regression (`model/fit.ts`), a number for each hero, each recorded five-hero team, each hero against each kind of team, each artifact, each artifact on each kind of team, and one Rivalry point of upgrade gap. Each kind of number is held toward zero by its own amount (`HOLD`). The fit starts from zero, so the same games always give the same numbers. A typical opponent is the average of every side in the season's decided games, and artifact numbers are measured from that same average, so a team with no artifact, or one the games never show, counts as having a typical one. Every recorded game is five against five, so an empty slot, in a team of fewer heroes (`TEAM_HEROES`), has no number of its own: it counts as far below the season's weakest hero as that hero is below the average hero fielded, with no counters and no Rivalry points.

A team's kind is a group in the file. A recorded team's is its own `family`; any other five heroes, last season's teams included, take theirs from the kind rule (`data/kinds.ts`): the recorded teams sharing the most heroes with them, at least three, vote, a team outside every group has no vote, and a tie goes to the group listed first.

### The worker

The model is learned, the search run and Who Would Win?'s result built in a module worker (`src/workers/sl.worker.ts`), so a long search never freezes the page. `useSlEngine` starts it when a page that needs it mounts and keeps it for the visit, so the file is read and the model learned once. Until it is ready, Generate and Predict winner say so and wait. A worker that fails is dropped, the page shows its failure line, and the next page to mount starts another.

### The search

A team's chance is the model's against a typical opponent at the top levels, at the visitor's levels: its upgrade gap is the Rivalry points its heroes fall short of the top levels, priced by `prices`. The teams the `evidence` rules allow, the strict rule first and then the relaxed one, enter a complete search that keeps the set with the best chance to win three boards. A branch is bounded by each team's best chance over the artifacts it can end up with, so the bound holds before the artifacts are handed out. Ties between teams break by `rank` and between swaps by `order`, both from the file.

The set's artifacts go by how much the teams played them, never by the model's numbers (`generator/artifacts.ts`). This season's teams take artifacts they were recorded with, the way that gives out the most games played winning. A team left without one takes the free artifact its kind played most, then the season's most played. Last season's teams take the first free artifact on their `like` list.

A team's board is the placement with the best results times use to the power `alpha`, ties broken by players, set-ups, agreement and `order`. A placement's results start from the team's chance with the artifact the set gives it, at equal upgrades, with `prior` notional games, and each of its games counts, by the model, its opponent, the game's other entry, and the artifact the team played it with.

Each team shows the swaps its comp's recorded teams make with heroes the set leaves free, best by the model's chance at the visitor's levels. A one-hero swap puts a hero out for one of up to `flex.options` heroes, and a core hero with one moves out of the core. The rows the one-hero swaps leave of `flex.heroes` take two-hero swaps: two heroes that are neither core nor in a shown one-hero swap, out together for one of up to `flex.options` pairs.

Last season's teams (`before`) join when the selection holds fewer than `beforeUnder` Celestial and Hypogean heroes that some recorded team holds, so a new hero with no records cannot keep them out, and whenever this season's teams alone make no set. Such a team is rated by this season's model, its kind from the kind rule.

### Seasons and rotations

Seasonal artifact and phantimal ids are reused each season ([Seasonal Content](./SEASONAL.md)). The file keeps working across a cutover until the next season's file arrives: when its `season` is not `CURRENT_SEASON`, the page says the sets are last season's and that there are not enough games yet to choose this season's seasonal artifacts. The set still hands out the file's artifacts by the rule, but `artifactSurvives` counts a seasonal one as a typical artifact, and `slTeamData` (`src/lib/pvp/sl/generator/team.ts`) leaves out the seasonal artifacts and phantimals. Each map's layout is in the file, so a set recorded on a map Stargazer has retired still draws and saves, and the page says when the file's maps are not `TEAM_VARIANTS.sl.maps`. The file's unit test checks seasonal ids only while the seasons match and never checks map keys, so neither a cutover nor a rotation holds up a deploy.

The page draws each board from the encoded team `slTeamData` builds, the same string Save as team stores, so a saved set opens on the Teams page as it was drawn. Save as team goes to the Teams page with the saved team's id in the history entry (`openTeam`), and that page loads it as its own Load does. That replaces the Teams page's 5v5 boards, so when they hold work no saved team keeps (`holdsUnsavedWork`), the button takes a second press first.

### The data file

The file is UTF-8 JSON compressed with raw deflate, each byte then XORed with a mulberry32 keystream from a seed (`src/lib/pvp/sl/data/codec.ts`). The writer holds the seed, and the repository none: the build takes it from the `VITE_SL_SEED` setting, on the host and in `.env.local`, and Vite writes it into the page's script. It keeps the file from reading as data in the network panel and protects nothing, since every visitor downloads the seed with the decoder. Without the setting, `npm run build` stops, naming it, at the guide index's preview, the dev server prints one line and runs with no preview on the guide index, and the two tests that read the shipped file are left out, with one line (`vitest.config.ts`). `decodeSlData` refuses a file of another shape whole, and the page and the worker keep the decoded data in plain variables, out of any store. A load that fails, as in a tab left open across a deploy, reloads the page once through `reloadOntoCurrentBuild` ([Pre-Rendering](./PRE_RENDERING.md)), then shows one line. The file carries no version field: it and the code that reads it reach visitors in the same deploy, and the unit test reads the shipped file.

A game's two sides are consecutive entries starting at an even index, so entries 2k and 2k + 1 are one game, in both seasons. Both the model and the boards find a game's opponent this way.

| Field                   | Meaning                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `season`, `exportedAt`  | The records' season and the date of the export behind them (YYYY-MM-DD).                                                                                                                                                                                                                                                 |
| `sample`                | What the season's numbers come from, for the note on the data: its recorded `matches` and `games` in every format, and the `players` in them.                                                                                                                                                                            |
| `maps`                  | The Supreme League maps in order, each once: its arena key and its tile lists as the arena files have them. A team's `map` indexes it.                                                                                                                                                                                   |
| `prior`, `alpha`        | The notional games a placement's results start with, and the weight of use against results, when a team's board is chosen.                                                                                                                                                                                               |
| `evidence`              | What a team needs to be picked, the strict rule then the relaxed one: its group's decided games on the map, its players or its own decided games, and whether a team outside every group may be picked.                                                                                                                  |
| `flex`                  | How many swap rows a team shows, and how many options each.                                                                                                                                                                                                                                                              |
| `prices`                | Each level's Rivalry points, paragon by faction and refinement for all, the level being the index. Each list has one entry per level Stargazer offers, and the opponent stands at the last.                                                                                                                              |
| `order`                 | Every hero id the file names, in plain string order of their English names.                                                                                                                                                                                                                                              |
| `games`                 | Every recorded league game on these maps, two entries a game: the team's index, `w`, `l` or `t`, the upgrade gap toward the team in Rivalry points, and the artifact on its board (null for none).                                                                                                                       |
| `teams`                 | Every five-hero team on one map: its map, group (`family`, null outside every group), hero ids, tie `rank`, players, games, the ids of the artifacts its boards used (most used first, ties in order of their English names), and its placements.                                                                        |
| `teams[].placements`    | Each recorded placement with its games, use, players, set-ups, agreement and tie `order`. `c` holds the heroes and their companions as `[tile, id]` (a companion as N × 10000 plus its hero's id), `s` the phantimal and its companions, tiles from the ally side.                                                       |
| `families`              | Every team group: its name by language code (a missing language names it by its `core`), its core heroes, its recorded teams with a decided game (`swaps`, each as its hero ids) and its record on each map.                                                                                                             |
| `before`, `beforeUnder` | Last season's teams on these maps with its own `season`, `sample`, `games` and `families`, its games carrying no artifact, since its seasonal ids name other artifacts now, and its teams carrying `like` (this season's artifacts it can take, best first) instead of `artifacts`. Absent when there is no such season. |

A complete example, each list cut to one or two entries:

```json
{
  "season": 8,
  "exportedAt": "2026-10-26",
  "sample": { "matches": 432, "games": 2160, "players": 295 },
  "maps": [
    {
      "key": "arena1",
      "grid": {
        "ally": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 16],
        "enemy": [30, 33, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
        "blocked": [],
        "breakable": []
      }
    },
    {
      "key": "arena2",
      "grid": {
        "ally": [1, 2, 3, 4, 5, 6, 7, 8, 10, 13],
        "enemy": [33, 36, 38, 39, 40, 41, 42, 43, 44, 45],
        "blocked": [9, 11, 12, 15, 31, 34, 35, 37],
        "breakable": []
      }
    }
  ],
  "prior": 20,
  "alpha": 0.3,
  "evidence": [
    { "groupGames": 3, "players": 2, "games": 3, "oneOffs": false },
    { "groupGames": 1, "players": 1, "games": 1, "oneOffs": true }
  ],
  "flex": { "heroes": 2, "options": 3 },
  "prices": {
    "paragon": {
      "lightbearer": [0, 4.5, 9, 13.5, 18],
      "mauler": [0, 4.5, 9, 13.5, 18],
      "wilder": [0, 4.5, 9, 13.5, 18],
      "hypogean": [4, 7.5, 11, 14.5, 18],
      "graveborn": [0, 4.5, 9, 13.5, 18],
      "celestial": [4, 7.5, 11, 14.5, 18],
      "dimensional": [0, 4.5, 9, 13.5, 18]
    },
    "refinement": [0, 1, 4.5, 5.5, 9]
  },
  "order": [91, 100],
  "games": [
    [0, "w", 35.5, 7],
    [1, "l", -35.5, 9]
  ],
  "teams": [
    {
      "map": 0,
      "family": 14,
      "heroes": [100, 113, 111, 94, 116],
      "rank": 347,
      "players": 1,
      "games": [0, 1931, 2000],
      "artifacts": [7],
      "placements": [
        {
          "games": [0, 1931, 2000],
          "use": 1.2,
          "players": 1,
          "setups": 2,
          "agree": 1,
          "order": 0,
          "c": [
            [1, 111],
            [2, 94],
            [9, 113],
            [12, 100],
            [13, 116]
          ],
          "s": [
            [7, 5],
            [6, 10005]
          ]
        }
      ]
    }
  ],
  "families": [
    {
      "name": { "en": "Sylph/Alna/Mehira", "zh": "鸟神／冬喉／魅魔", "ko": "실피라/아르나/메히라" },
      "core": [116, 100, 94],
      "swaps": [
        [100, 113, 111, 94, 116],
        [100, 110, 94, 116, 88]
      ],
      "perMap": [
        [19, 29, 14],
        [13, 11, 10],
        [5, 0, 7],
        [1, 0, 1],
        [18, 22, 16]
      ]
    }
  ],
  "before": {
    "season": 7,
    "sample": { "matches": 267, "games": 1203, "players": 131 },
    "games": [
      [0, "w", 7],
      [1, "l", -7]
    ],
    "teams": [
      {
        "map": 0,
        "family": 3,
        "heroes": [100, 111, 94, 116, 88],
        "rank": 367,
        "players": 1,
        "games": [0, 8, 16],
        "like": [8, 7, 14, 9, 10, 11, 3, 12, 13],
        "placements": [
          {
            "games": [16, 0, 8],
            "use": 1,
            "players": 1,
            "setups": 1,
            "agree": 1,
            "order": 0,
            "c": [
              [1, 111],
              [2, 94],
              [4, 88],
              [12, 100],
              [13, 116]
            ],
            "s": [
              [7, 5],
              [6, 10005]
            ]
          }
        ]
      }
    ],
    "families": [
      {
        "name": {
          "en": "Alna/Sylph/Mehira",
          "zh": "冬喉／鸟神／魅魔",
          "ko": "아르나/실피라/메히라"
        },
        "core": [116, 100, 94],
        "swaps": [
          [100, 111, 94, 116, 88],
          [100, 94, 116, 83, 88]
        ],
        "perMap": [
          [23, 29, 30],
          [28, 32, 21],
          [3, 3, 1],
          [0, 0, 0],
          [17, 25, 13]
        ]
      }
    ]
  },
  "beforeUnder": 8
}
```

## Who Would Win?

`/guide/pvp/www` (`WWW_PATH`) says which of two teams of up to five heroes, at their levels and with their artifacts, should win a Supreme League game, and why, from the generator's data file and model. It shares the generator's root and look (`.sl-page`, `sl.css`), its heading (`SlHead`), its file load (`useSlFile`), its About dialog (`SlAbout`) and its worker, and like the generator it is pre-rendered with its heading alone. The teams live in the page alone. A hero added to Team A starts at the active roster's levels and one added to Team B at the top levels, as the generator rates a visitor's heroes against opponents at the top levels. The result is made only on Predict winner. The hero grid and the slot's hero picker lock the heroes the generator's picker locks. A hero that reaches a team another way, from screenshots or picked before the file has loaded, counts as an average hero, and the result says so.

A switch chooses between One game and Match, the five games of a Supreme League match. The games, the mode and the slot being filled live in `useWwwGames` (`src/components/guide/www/`), and switching keeps them: One game shows game 1, and Match all five. The page's buttons act on the games shown: in Match the Upgrades menus set a level on a side's heroes in all five games, Swap sides swaps every game's teams, Clear empties all five, and Predict winner waits until every team shown has a hero. A player fields each hero and each artifact once in a match, so in Match the pickers leave out what that side fields in its other games; One game has no such rule. Each mode keeps the result last made in it.

The Screenshots button fills the games from screenshots of the Supreme League's knockout list, which shows a match's five games ([Matchup Import](./IMPORT_WWW.md)). Its Save replaces all five games, the left team of each game as Team A, and switches to Match from either mode; a game the screenshots do not show becomes an empty one. The heroes keep the levels read, and an artifact not recognised is left empty.

In Match, Predict winner asks the worker for each game's result as One game does, one request a game, and the page works out the match from the five chances as shown, each game won or lost on its own as the generator takes its boards (`matchOdds`, on the `oddsInto` the generator's search uses), so the match's numbers agree with the game lines. The match result (`WwwMatchResult`) gives Team A's chance to win the match, three games of five, the chance of each final score, and a line per game, its name in the middle and each team's chance growing from it toward that team's side; picking a line shows that game's result below, drawn by `WwwResult` as in One game with the game's name at its top.

The worker builds the result whole (`wwwPanel`, `src/lib/pvp/sl/www/panel.ts`), and the page only draws it. An artifact with no games in the file, or one `artifactSurvives` rejects, reaches the model as a typical one. The records (`data/records.ts`) count each side of every decided game on its own, so a hero on both teams of a game has a win and a loss from it. A team with empty slots shows each under Heroes beside its heroes, each under Upgrades as falling short of the top levels by all a hero's Rivalry points, and a warning that no recorded game has one; empty slots both teams have cancel out and are not shown, as a hero on both teams is not.

Each of the four reasons is its Shapley value: the average, over the 24 orders of adding the reasons, of how far it moves the chance. The same part of the edge is worth less near 0% and 100% than near an even match, and this way the four add up to the chance less 50% however lopsided the match (`model/reasons.ts`). The page shows tenths of a point, and the rounding keeps that sum: each reason rounds half away from zero, so swapping the teams mirrors every value, and when the four then miss the shown chance, the reasons closest to rounding the other way take the difference, a tenth each.

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, the report plugin and chunk error recovery
- [Teams](./TEAMS.md): rosters, the roster editor and saved teams
- [Matchup Import](./IMPORT_WWW.md): Who Would Win?'s screenshot import
- [Skill Pages](./SKILL_PAGES.md): the tags behind the mechanics page
