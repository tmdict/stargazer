# Guide

The guide is an index of reference material for arena planning plus the pages it points at: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, the seasons' PvP reports and the Supreme League generator. Each guide page has one address and shows in the site language. It is pre-rendered in English, as `/skills` is ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages

`GUIDE_PAGES` and `guidePath` (`src/lib/guide.ts`) feed the router, the pre-render route list and the page meta, so a page added there is routed, pre-rendered and titled together. The site language can switch while a page is open, so `setupGuideContentMeta` passes `useHead` a computed that follows it instead of the value at setup.

Each index panel's title link is stretched over its `.guide-link` area (`src/styles/guide.css`), so the blurb, the previews and empty space open the page too. A control placed inside that area, such as a chip or tile, must raise itself with `position: relative; z-index: 2`, or the stretched link swallows its clicks.

The upgrade tracks on the index place each band's levels at their share of that band's own maximum on the energy ramp, so a band that starts higher or climbs in smaller steps shows it in the spacing.

## Mechanics page

The page has one card per tag, holding every hero that carries it, and one for initial energy, holding every hero that starts a battle with any. The tags and modifiers are themselves the controls: a click anywhere on a card picks it, except on a hero or a chip, and its chips pick modifiers. [Skill Pages](./SKILL_PAGES.md) defines tags, modifiers, the energy filter and when a hero satisfies a pick. The card's title is a button without a handler of its own, so the same click reaches the card from the keyboard. Picks combine as all-of, so two picks answer which heroes have both.

A pick never hides or moves anything. Heroes outside the selection dim where they stand, so every card keeps its place and shape while picks change, and a card's count is the heroes still lit. With two or more picks no single card holds the answer, so the selection strip lists the matching heroes itself. The faction and class icons work differently: they narrow the page and drop a card they empty, unless it is picked. A name search keeps only the cards its heroes appear in, rings those heroes and dims the rest, and leaves each card's count alone. When it finds a single hero, the page lists the cards that hero is in as chips, and a chip picks its card as a click on the card does.

`useMechanicPicks` keeps whether a tag's title is picked apart from its picked modifiers. Switching the last modifier off therefore returns the tag to what it was before any was on: still picked if its title was, unpicked otherwise.

The energy card shows each hero's total under its face and has a control in place of chips, which steps the energy filter's value. Picked, the card dims the heroes at or under the value, here and in every other card, like any hero outside the selection. A new value picks the card, as a modifier picks its tag. The value is the one the hero lists filter by, so the card opens on whatever a list left it at.

Skill text is read in the skill modal, which a click on a hero opens. From a picked card it opens on the picks the hero has skill text for, and from an unpicked card on that card's tag. A dimmed hero may satisfy none of the picks, and then it opens on its card's tag as well, never on an empty list. No skill level carries a hero's energy, so the energy pick is never one of them and the energy card stands for no tag: its heroes open on the other picks they have text for, or on the whole skill list.

The selection lives in memory only. A tag or energy link replaces it, applied after mount because the baked page has nothing picked ([Pre-Rendering](./PRE_RENDERING.md)). The index's tiles also put the card's id in the URL fragment, so the router's `scrollBehavior` brings the card into view and Back restores the earlier position as on any page. The energy tile names the starting value and counts the heroes above it, which are the ones its link leaves lit.

## Season summaries

A season's summary (`src/content/pvp/s<N>/summary.ts`) is a typed literal generated with the season's report and never edited here: the season's team groups, most played first. While a season is played its summary is copied again with each new report, and once it ends it stays as it is. Nothing derives these numbers, so the index never disagrees with the report. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) lists the summaries newest first. The index shows a card for every entry's report, with its most played team groups as chips. While a season is played its summary says so (`live`), and its card carries a Current chip. It can also name the Supreme League event the report's title names (`league`), and the card's title then names it as the report's does ("Season 8 Supreme League 1 report"), not "PvP report".

A summary lists the languages its report is written in (`languages`, English first) and carries each team's label in each of them. In an app locale the report is not written in (`reportReadsIn`), a team is named by its `heroes`, in portrait order, each by its name in that locale (`pvpTeamName`). The report links ask for the site language (`pvpReportHref`), and a report written without it opens in English, which the report entry's title marks. A season therefore needs nothing per app locale beyond the hero names the app already has.

`tests/unit/content/pvpSeasons.test.ts` checks every summary's hero slugs against the hero list, and that each team is named in every language the summary lists.

To add a season, write `s<N>/summary.ts` beside `s<N>/index.template.html` and put it at the front of `PVP_SEASONS`. The report's page is built from its template alone (Pre-Rendering, "PvP reports"), so a report can be published before the index lists it: its folder then holds the template only, and its summary comes with its `PVP_SEASONS` entry.

## Supreme League generator

`/guide/pvp/sl` (`SL_GENERATOR_PATH`) picks, for the heroes and levels a visitor selects, the set of five recorded Supreme League teams, one per map and no hero twice, with the best chance to win a match. Its records and its choice come from an external report generator, which writes the data file `src/content/pvp/sl/sl.bin` with each export, and whose check runs its own chooser beside `chooseSlSet` (`src/lib/pvp/sl/chooser.ts`) on each file, requiring the same answer to the last digit. A card of its own on the guide index links it (`SlGuideEntry`) and draws the first three maps of the set the page gives before a roster is picked, every hero at P4 R4, with the page's own map column (`SlMapColumn`, sized down by its host's `--pt` and `--sl-scale`, without tile numbers) in the page's dark board colours. Each map keeps its first swap and two heroes to swap in, so the three fit a phone. `scripts/slPreview.ts` works that set out once per build, running `defaultSlSet` (`src/lib/pvp/sl/defaultSet.ts`) through Vite's module runner so the app's imports resolve, and hands the result to the card as `virtual:sl-preview`: the index loads neither the data file nor the chooser, and its boards are in the baked HTML. The page is pre-rendered in English with its heading alone, so search engines find it: the picker and the set follow the rosters the browser holds, so they are drawn after mount and never reach the baked HTML.

The picker is the Rosters tab's `RosterEditor` ([Teams](./TEAMS.md)), without its mechanics filter (`hideMechanics`), bound to a copy of the active roster, so trying a hero out never reaches the roster. The copy is taken again only when another roster becomes active, never when the roster object is replaced by a library write. With no roster every hero starts at P4 R4, the level the recorded opponents are counted at. A hero added on the page takes the level its roster gives it, P4 R4 under All heroes, and 0 only when the roster does not hold it. A rosters file import or a screenshot import makes its roster the active one, so the page takes it up at once. The set is chosen only on Generate, and it keeps the selection it was chosen with, which is what Save as team saves.

The header's About the data opens a note on the records: every team is a real one, the season's recorded matches, games and players (`sample`, and last season's beside them when its teams are in the file), a link to the season's report in the site language (`pvpReportHref`), how the records trail new heroes, and credit to the content creators many of the teams start with.

The page keeps the dark look in both of the site's looks, the style of the season reports it comes from. Its root, `.sl-page`, carries `data-theme="dark"`, so Stargazer's colour tokens take their dark values inside it and the shared roster controls keep their shapes in dark colours ([Architecture](../ARCHITECTURE.md)). `src/components/guide/sl/sl.css` keeps every rule under that root, and the generator's own parts read the same tokens and Stargazer's own font. The picker's roster controls are a size above the Rosters tab's: it sets `--control-height-compact` to the regular control height and `--dock-scale` to 1.4, or 1 on a phone, where its picker is narrower than the Rosters panel. The boards draw from `BoardThumbnail`'s crisp style in the dark board colours, and its tile numbers carry classes naming their zone, so the stylesheet shows numbers only on free deployment tiles.

### The chooser

`chooseSlSet` is a port of the generator's own chooser, and the audit compares the two on hundreds of random selections, so it keeps that code's order of arithmetic and every sort's tie order: a change that is harmless in isolation fails the audit. Ties between teams break by `rank` and between swaps by `order`, both from the file. It imports types alone, since the audit loads the file in Node by stripping its types. A team is judged from its comp's strength, then the comp's record on its map, then its own games, each step starting from the one before with `prior` notional games, and its chance is averaged over how unsure that estimate is. Each team's chance is moved by its upgrade gap against an opponent at the top levels, priced in Rivalry points by `prices` and scaled by this season's `theta`, last season's teams included, since `prices` are the prices this season's `theta` was measured with. A complete search keeps the set with the best chance to win three maps.

Under each team the page shows the swaps its comp's recorded teams make with heroes the set leaves free, best first. A one-hero swap puts a hero out for one of up to `flex.options` heroes, and a core hero with one moves out of the core. The rows the one-hero swaps leave of `flex.heroes` take two-hero swaps: two heroes that are neither core nor in a one-hero swap shown, out together for one of up to `flex.options` pairs.

Last season's teams (`before`) join when the selection holds fewer than `beforeUnder` Celestial and Hypogean heroes that some recorded team holds, so a new hero with no records cannot keep them out, and whenever this season's teams alone make no set. Such a team is judged on its own season's games and numbers, its upgrade gap aside, and takes this season's artifact, the first of `like` that no team before it in the set holds.

### Seasons and rotations

Seasonal artifact and phantimal ids are reused each season ([Seasonal Content](./SEASONAL.md)). The file keeps working across a cutover until the next season's file arrives: when its `season` is not `CURRENT_SEASON`, the page says the sets are last season's and `slTeamData` (`src/lib/pvp/sl/team.ts`) leaves out their seasonal artifacts and phantimals. Each map's layout is in the file, so a set recorded on a map Stargazer has retired still draws and saves, and the page says when the file's maps are not `TEAM_VARIANTS.sl.maps`. `tests/unit/sl/slData.test.ts` checks seasonal ids only while the seasons match, and never checks map keys, so neither a cutover nor a rotation holds up a deploy.

The page draws each map's board from the encoded team `slTeamData` builds, the same string Save as team stores, so a saved set opens on the Teams page as it was drawn. Save as team then goes to the Teams page with the saved team's id in the history entry (`openTeam`), and that page loads it as its own Load does. That replaces the Teams page's 5v5 boards, so when they hold work no saved team keeps (`holdsUnsavedWork`, read from the mode's slot by `readTeamsSlot`), the button takes a second press first and the message after saving says they were replaced.

### The data file

The file is UTF-8 JSON compressed with raw deflate, each byte then XORed with a mulberry32 keystream from the seed in `src/lib/pvp/sl/codec.ts`, which the writer holds too. It keeps the file from reading as data in the network panel and protects nothing, since the decoder is public. `decodeSlData` refuses a file of another shape whole, and the page keeps the decoded data in a plain variable, out of any store. A load that fails, as in a tab left open across a deploy, reloads the page once through `reloadOntoCurrentBuild` ([Pre-Rendering](./PRE_RENDERING.md)), then shows one line. The file carries no version field: it and the code that reads it reach visitors in the same deploy, and the unit test reads the shipped file.

| Field                   | Meaning                                                                                                                                                                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `season`, `exportedAt`  | The records' season and the date of the export behind them (YYYY-MM-DD).                                                                                                                                                                                                        |
| `sample`                | What the season's numbers come from, for the note on the data: its recorded `matches` and `games` in every format, and the `players` in them.                                                                                                                                   |
| `maps`                  | The Supreme League maps in order, each once: its arena key and its tile lists as the arena files have them. A team's `map` indexes it.                                                                                                                                          |
| `theta`, `oneOffStart`  | The season's upgrade effect per Rivalry point on a team's log-odds, which scales every team's upgrade gap, last season's included, and the chance a team outside every group starts from.                                                                                       |
| `prior`, `alpha`        | The notional games every chance starts with, and the weight of use against results when a team's board is chosen.                                                                                                                                                               |
| `evidence`              | What a team needs to be picked, the strict rule then the relaxed one: its group's decided games on the map, its players or its own decided games, and whether a team outside every group may be picked.                                                                         |
| `flex`                  | How many swap rows a team shows, and how many options each.                                                                                                                                                                                                                     |
| `prices`                | Each level's Rivalry points, paragon by faction and refinement for all, the level being the index. Each list has one entry per level Stargazer offers, and the opponent stands at the last.                                                                                     |
| `order`                 | Every hero id the file names, in plain string order of their English names.                                                                                                                                                                                                     |
| `games`                 | Every recorded league game on these maps: the team's index, `w`, `l` or `t`, the upgrade gap toward the team in Rivalry points, and the opponent's log rating.                                                                                                                  |
| `teams`                 | Every five-hero team on one map: its map, group (`family`, null outside every group), hero ids, tie `rank`, players, games, the decided games behind its board (`lineup`), its artifacts with the share of its boards that used each, and its placements.                       |
| `teams[].placements`    | Each recorded placement with its games, use, players, set-ups, agreement and tie `order`. `c` holds the heroes and their companions as `[tile, id]` (a companion as N × 10000 plus its hero's id), `s` the phantimal and its companions, tiles from the ally side.              |
| `families`              | Every team group: its name by language code (a missing language names it by its `core`), its chance against the average opponent and that chance's spread in log-odds, its core heroes, its recorded teams with their chances (`swaps`) and its record on each map.             |
| `before`, `beforeUnder` | Last season's teams on these maps with its own `season`, `sample`, `theta` (for its own games), `oneOffStart`, `games` and `families`, its teams carrying `like` (this season's artifacts it can take, best first) instead of `artifacts`. Absent when there is no such season. |

A complete example, each list cut to one or two entries:

```json
{
  "season": 8,
  "exportedAt": "2026-10-24",
  "sample": { "matches": 402, "games": 2010, "players": 294 },
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
  "theta": 0.03498973087535196,
  "oneOffStart": 0.29540868177404,
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
    "sample": { "matches": 267, "games": 1203, "players": 131 },
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

The feature lives in `src/content/pvp/sl/`, `src/lib/pvp/sl/`, `src/views/GuideSlView.vue`, `src/components/guide/sl/`, `src/locales/app/sl/`, `tests/unit/sl/` and this section, plus its route, its `SL_GENERATOR_PATH` line and its place in the pre-render list, its `setupSlContentMeta` entry, its card on the guide index (`SlGuideEntry`) and the card's place in `GuideView`, `scripts/slPreview.ts` with its line in `vite.config.ts` and its declaration in `env.d.ts`, and the sentences that name it in [Pre-Rendering](./PRE_RENDERING.md), [Teams](./TEAMS.md), this page's opening paragraph, the guide index's description in `contentMeta.ts` and the index line in `AGENTS.md`. These serve it alone and go with it: `RosterEditor`'s `hideMechanics` (the filter strip's `mechanicPool` is then required again), the Teams page's `openTeam`, the class names on `BoardThumbnail`'s tiles, numbers and unit frames that only `sl.css` reads (`tile` and `tile-<zone>`, `tile-bevel`, `unit-frame`, and the zone and `occupied` classes on numbers), the export of `reloadOntoCurrentBuild`, the note in `DropdownSelect` about a page's floating lists, and the comment that names it in `usePreviewImages.ts`. `RosterEditor`'s `largeDock`, with its breakpoints, serves this page alone and goes too. `RosterEditor`, `RosterTransferActions`, `usePreviewImages`, `reloadOntoCurrentBuild` itself, `IconHelpSmall`, the colour, scale and compact-height tokens and the rosters import's switch to the first roster it adds belong to the rest of the app and stay.

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, the report hydration plugin and chunk error recovery
- [Teams](./TEAMS.md): rosters, the roster editor and saved teams
- [Skill Pages](./SKILL_PAGES.md): the tags behind the mechanics page
