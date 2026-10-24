# Guide

The guide is an index of reference material for arena planning plus the pages it points at: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, and the finished seasons' PvP reports with the newest season's counter ladder. Beside the reports sits the Supreme League generator. Each guide page has one address and shows in the site language. It is pre-rendered in English, as `/skills` is ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages

`GUIDE_PAGES` and `guidePath` (`src/lib/guide.ts`) feed the router, the pre-render route list and the page meta, so a page added there is routed, pre-rendered and titled together. The site language can switch while a page is open, so `setupGuideContentMeta` passes `useHead` a computed that follows it instead of the value at setup.

Each index panel's title link is stretched over its `.guide-link` area (`src/styles/guide.css`), so the blurb, the previews and empty space open the page too. A control placed inside that area, such as a chip or tile, must raise itself with `position: relative; z-index: 2`, or the stretched link swallows its clicks. The counter ladder is the exception: only its title is a link, so a click on its empty space clears the team selection as it does in the report.

The upgrade tracks on the index place each band's levels at their share of that band's own maximum on the energy ramp, so a band that starts higher or climbs in smaller steps shows it in the spacing.

## Mechanics page

The page has one card per tag, holding every hero that carries it, and one for initial energy, holding every hero that starts a battle with any. The tags and modifiers are themselves the controls: a click anywhere on a card picks it, except on a hero or a chip, and its chips pick modifiers. [Skill Pages](./SKILL_PAGES.md) defines tags, modifiers, the energy filter and when a hero satisfies a pick. The card's title is a button without a handler of its own, so the same click reaches the card from the keyboard. Picks combine as all-of, so two picks answer which heroes have both.

A pick never hides or moves anything. Heroes outside the selection dim where they stand, so every card keeps its place and shape while picks change, and a card's count is the heroes still lit. With two or more picks no single card holds the answer, so the selection strip lists the matching heroes itself. The faction and class icons work differently: they narrow the page and drop a card they empty, unless it is picked. A name search keeps only the cards its heroes appear in, rings those heroes and dims the rest, and leaves each card's count alone. When it finds a single hero, the page lists the cards that hero is in as chips, and a chip picks its card as a click on the card does.

`useMechanicPicks` keeps whether a tag's title is picked apart from its picked modifiers. Switching the last modifier off therefore returns the tag to what it was before any was on: still picked if its title was, unpicked otherwise.

The energy card shows each hero's total under its face and has a control in place of chips, which steps the energy filter's value. Picked, the card dims the heroes at or under the value, here and in every other card, like any hero outside the selection. A new value picks the card, as a modifier picks its tag. The value is the one the hero lists filter by, so the card opens on whatever a list left it at.

Skill text is read in the skill modal, which a click on a hero opens. From a picked card it opens on the picks the hero has skill text for, and from an unpicked card on that card's tag. A dimmed hero may satisfy none of the picks, and then it opens on its card's tag as well, never on an empty list. No skill level carries a hero's energy, so the energy pick is never one of them and the energy card stands for no tag: its heroes open on the other picks they have text for, or on the whole skill list.

The selection lives in memory only. A tag or energy link replaces it, applied after mount because the baked page has nothing picked ([Pre-Rendering](./PRE_RENDERING.md)). The index's tiles also put the card's id in the URL fragment, so the router's `scrollBehavior` brings the card into view and Back restores the earlier position as on any page. The energy tile names the starting value and counts the heroes above it, which are the ones its link leaves lit.

## Season summaries

A finished season's summary (`src/content/pvp/s<N>/summary.ts`) is a typed literal written once from the season's report and never edited: the team groups and the counters between them. Nothing derives these numbers, and each counter's evidence band is copied from the report rather than recomputed from its record, so the index never disagrees with the report. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) lists the summaries newest first. The index shows every entry's report block and the first entry's ladder.

A report is written in English and Chinese (`ReportLocale`), and a summary carries each team's label in those two only. In an app locale the report is not written in, a team is named by its `heroes`, in portrait order, each by its name in that locale (`pvpTeamName`). The report links open the English report (`pvpReportHref`), which the report entry's title marks. A season therefore needs nothing per app locale beyond the hero names the app already has.

Team ids and counter anchors follow the report's `counter-<winner>-vs-<loser>` fragment ids, so the ladder's curves link straight to the evidence. `tests/unit/content/pvpSeasons.test.ts` checks every summary against the hero list and its report: known hero slugs, counters only between listed teams, and anchors present in the template.

To add a season, write `s<N>/summary.ts` beside `s<N>/index.template.html` and put it at the front of `PVP_SEASONS`. The report's page is built from its template alone (Pre-Rendering, "PvP reports"), so a report can be published before the index lists it: its folder then holds the template only, and its summary comes with its `PVP_SEASONS` entry.

## Counter ladder

`layoutLadder` (`src/lib/pvp/ladderLayout.ts`) reproduces the report's own drawing rules, so a ladder matches the report it came from. Teams stack by rating with a rule where the tier changes, and each counter is one cubic curve. A higher-rated winner's curve runs down the right side of the team column and a lower-rated winner's runs up the left, so the side alone says whether a counter is an upset. Curves bow out further the more rows they span, so longer counters run outside shorter ones.

Each curve is labeled with the winner's share of the games and how many games that is, and a share from under `FEW_GAMES` games is dimmed. A label tries fixed stops along its own curve, on the curve and just outside it, and takes the position that covers the least of the other curves, labels and cards. Short curves place first because they have the least room, and equal spans place in the report's team order (most played first), so every label lands where the report put it. The whole drawing is then shifted so its outermost curves and labels, not the team column, are centered.

Selecting a team dims every curve not touching it and turns the curves it loses red. A pointer-up anywhere else, or Escape, clears it. It listens for pointerup rather than click, since a touch that scrolls ends in pointercancel and keeps the selection.

## Supreme League generator

`/guide/pvp/sl` (`SL_GENERATOR_PATH`) picks, for the heroes and levels a visitor selects, the set of five recorded Supreme League teams, one per map and no hero twice, with the best chance to win a match. Its records and its choice come from an external report generator, which writes the data file `src/content/pvp/sl/sl.bin` with each export and runs its own chooser beside `chooseSlSet` (`src/lib/pvp/sl/chooser.ts`) on every file it writes, requiring the same answer to the last digit. The guide index's PvP panel opens with an entry linking it. The page is pre-rendered in English with its heading alone, so search engines find it: the picker and the set follow the rosters the browser holds, so they are drawn after mount and never reach the baked HTML.

The picker is the Rosters tab's `RosterEditor` ([Teams](./TEAMS.md)) bound to a copy of the active roster, so trying a hero out never reaches the roster. The copy is taken again only when another roster becomes active, never when the roster object is replaced by a library write. With no roster every hero starts at P4 R4, the level the recorded opponents are counted at. A hero added on the page takes the level its roster gives it, P4 R4 under All heroes, and 0 only when the roster does not hold it. A rosters file import or a screenshot import makes its roster the active one, so the page takes it up at once. The set is chosen only on Generate, and it keeps the selection it was chosen with, which is what Save as team saves.

The page wears the dark look of the season reports it comes from, not the app's light panels. `src/components/guide/sl/sl.css` keeps every rule under the view's root, `.sl-page`: there it sets Stargazer's own colour tokens to the report's dark values, which re-themes the shared roster controls, and adds the report's square buttons, filter boxes and grey portraits over them. A dropdown's floating list renders on `<body>`, outside that root, so the view marks `<html>` with `sl-page-open` while it is mounted and the stylesheet darkens floating lists under that mark. The boards draw from `BoardThumbnail`'s crisp style, whose tiles, numbers and unit frames carry classes naming their zone, so the stylesheet gives them the report's colours and shows numbers only on free deployment tiles.

### The chooser

`chooseSlSet` is a port of the generator's own chooser, and the audit compares the two on hundreds of random selections, so it keeps that code's order of arithmetic and every sort's tie order: a change that is harmless in isolation fails the audit. Ties between teams break by `rank` and between swaps by `order`, both from the file. It imports types alone, since the audit loads the file in Node by stripping its types. A team is judged from its comp's strength, then the comp's record on its map, then its own games, each step starting from the one before with `prior` notional games, and its chance is averaged over how unsure that estimate is. Each team's chance is moved by its upgrade gap against an opponent at the top levels, priced in Rivalry points by `prices` and scaled by `theta`. A complete search keeps the set with the best chance to win three maps.

Last season's teams (`before`) join when the selection holds fewer than `beforeUnder` Celestial and Hypogean heroes that some recorded team holds, so a new hero with no records cannot keep them out, and whenever this season's teams alone make no set. Such a team is judged on its own season's numbers and takes this season's artifact, the first of `like` that no team before it in the set holds.

### Seasons and rotations

Seasonal artifact and phantimal ids are reused each season ([Seasonal Content](./SEASONAL.md)). The file keeps working across a cutover until the next season's file arrives: when its `season` is not `CURRENT_SEASON`, the page says the sets are last season's and `slTeamData` (`src/lib/pvp/sl/team.ts`) leaves out their seasonal artifacts and phantimals. Each map's layout is in the file, so a set recorded on a map Stargazer has retired still draws and saves, and the page says when the file's maps are not `TEAM_VARIANTS.sl.maps`. `tests/unit/sl/slData.test.ts` checks seasonal ids only while the seasons match, and never checks map keys, so neither a cutover nor a rotation holds up a deploy.

The page draws each map's board from the encoded team `slTeamData` builds, the same string Save as team stores, so a saved set opens on the Teams page as it was drawn.

### The data file

The file is UTF-8 JSON compressed with raw deflate, each byte then XORed with a mulberry32 keystream from the seed in `src/lib/pvp/sl/codec.ts`, which the writer holds too. It keeps the file from reading as data in the network panel and protects nothing, since the decoder is public. `decodeSlData` refuses a file of another shape whole, and the page keeps the decoded data in a plain variable, out of any store. A load that fails, as in a tab left open across a deploy, reloads the page once through `reloadOntoCurrentBuild` ([Pre-Rendering](./PRE_RENDERING.md)), then shows one line. The file carries no version field: it and the code that reads it reach visitors in the same deploy, and the unit test reads the shipped file.

| Field                   | Meaning                                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `season`, `exportedAt`  | The records' season and the date of the export behind them (YYYY-MM-DD).                                                                                                                                                                                            |
| `maps`                  | The Supreme League maps in order, each once: its arena key and its tile lists as the arena files have them. A team's `map` indexes it.                                                                                                                              |
| `theta`, `oneOffStart`  | The season's upgrade effect per Rivalry point on a team's log-odds, and the chance a team outside every group starts from.                                                                                                                                          |
| `prior`, `alpha`        | The notional games every chance starts with, and the weight of use against results when a team's board is chosen.                                                                                                                                                   |
| `evidence`              | What a team needs to be picked, the strict rule then the relaxed one: its group's decided games on the map, its players or its own decided games, and whether a team outside every group may be picked.                                                             |
| `flex`                  | How many heroes get swaps, and how many swaps each.                                                                                                                                                                                                                 |
| `prices`                | Each level's Rivalry points, paragon by faction and refinement for all, the level being the index. Each list has one entry per level Stargazer offers, and the opponent stands at the last.                                                                         |
| `order`                 | Every hero id the file names, in plain string order of their English names.                                                                                                                                                                                         |
| `games`                 | Every recorded league game on these maps: the team's index, `w`, `l` or `t`, the upgrade gap toward the team in Rivalry points, and the opponent's log rating.                                                                                                      |
| `teams`                 | Every five-hero team on one map: its map, group (`family`, null outside every group), hero ids, tie `rank`, players, games, the decided games behind its board (`lineup`), its artifacts with the share of its boards that used each, and its placements.           |
| `teams[].placements`    | Each recorded placement with its games, use, players, set-ups, agreement and tie `order`. `c` holds the heroes and their companions as `[tile, id]` (a companion as N × 10000 plus its hero's id), `s` the phantimal and its companions, tiles from the ally side.  |
| `families`              | Every team group: its name by language code (a missing language names it by its `core`), its chance against the average opponent and that chance's spread in log-odds, its core heroes, its recorded teams with their chances (`swaps`) and its record on each map. |
| `before`, `beforeUnder` | Last season's teams on these maps with its own `season`, `theta`, `oneOffStart`, `games` and `families`, its teams carrying `like` (this season's artifacts it can take, best first) instead of `artifacts`. Absent when there is no such season.                   |

A complete example, each list cut to one or two entries:

```json
{
  "season": 8,
  "exportedAt": "2026-10-24",
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
  "theta": 0.0377862658715483,
  "oneOffStart": 0.29429106938094785,
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
    "refinement": [0, 0.8571428571428571, 3.8571428571428568, 4.714285714285714, 7.7142857142857135]
  },
  "order": [91, 100],
  "games": [[0, "w", 32.9, -0.6070737875427862]],
  "teams": [
    {
      "map": 0,
      "family": 8,
      "heroes": [100, 113, 111, 94, 116],
      "rank": 339,
      "players": 1,
      "games": [0, 1931, 2000],
      "lineup": [0, 1931, 2000],
      "artifacts": [[7, 1]],
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
      "name": { "en": "Alna/Syph/Mehira", "zh": "冬喉／鸟神／魅魔", "ko": "아르나/실피라/메히라" },
      "expected": 0.5874840424644535,
      "spread": 0.25300763158359046,
      "core": [116, 100, 94],
      "swaps": [[[100, 113, 111, 94, 116], 0.6616790799491998]],
      "perMap": [
        [17, 27, 13],
        [13, 11, 8],
        [4, 0, 6],
        [1, 0, 1],
        [18, 21, 16]
      ]
    }
  ],
  "before": {
    "season": 7,
    "theta": 0.04860339605577315,
    "oneOffStart": 0.24440289397843082,
    "games": [[4, "w", 0, -1.1286902371968028]],
    "teams": [
      {
        "map": 2,
        "family": 2,
        "heroes": [74, 109, 68, 54, 87],
        "rank": 498,
        "players": 1,
        "games": [4, 12, 20],
        "lineup": [20, 4, 12],
        "like": [10, 7, 14, 9, 12, 13, 11, 3, 8],
        "placements": [
          {
            "games": [20, 4, 12],
            "use": 1,
            "players": 1,
            "setups": 1,
            "agree": 1,
            "order": 0,
            "c": [
              [1, 68],
              [4, 87],
              [5, 54],
              [7, 109],
              [9, 74],
              [14, 10068]
            ],
            "s": [
              [16, 5],
              [21, 10005]
            ]
          }
        ]
      }
    ],
    "families": [
      {
        "name": {
          "en": "Contess/Saida/Twins",
          "zh": "书魔／悉达／双子",
          "ko": "칸티아스/시타/일리아&라이라"
        },
        "expected": 0.5218483659369982,
        "spread": 0.16486471136781408,
        "core": [109, 68, 87],
        "swaps": [[[74, 109, 68, 54, 87], 0.4714958360179488]],
        "perMap": [
          [18, 26, 18],
          [18, 24, 10],
          [1, 1, 3],
          [4, 4, 4],
          [29, 20, 23]
        ]
      }
    ]
  },
  "beforeUnder": 8
}
```

### Removing it

The feature lives in `src/content/pvp/sl/`, `src/lib/pvp/sl/`, `src/views/GuideSlView.vue`, `src/components/guide/sl/`, `src/locales/app/sl/`, `tests/unit/sl/` and this section, plus its route, its `SL_GENERATOR_PATH` line and its place in the pre-render list, its `setupSlContentMeta` entry and the `SlGuideEntry` line in the PvP panel. `RosterEditor`, `usePreviewImages`, `reloadOntoCurrentBuild`, the class names on `BoardThumbnail`'s tiles and the rosters import's switch to the first roster it adds belong to the rest of the app and stay.

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, the report hydration plugin and chunk error recovery
- [Teams](./TEAMS.md): rosters, the roster editor and saved teams
- [Skill Pages](./SKILL_PAGES.md): the tags behind the mechanics page
