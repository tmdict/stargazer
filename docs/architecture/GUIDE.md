# Guide

The guide is an index page and the reference pages it links: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, each season's PvP report, the PvP team generator and Who Would Win?. Each guide page has one address, shows in the site language and is pre-rendered in English, as `/skills` is ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages

`GUIDE_PAGES` and `guidePath` (`src/lib/guide.ts`) feed the router, the pre-render route list and the page meta, so a page added there is routed, pre-rendered and titled together. The top bar's Guide tab lists the pages for a mouse hovering over it (`GuideMenu`), so a new page also joins that list; a season's report joins it once its summary is in the pack. The site language can switch while a page is open, so `setupGuideContentMeta` passes `useHead` a computed that follows it instead of the value at setup.

Each index panel's title link is stretched over its `.guide-link` area (`src/styles/guide.css`), so the whole panel opens the page. A control placed inside that area must raise itself with `position: relative; z-index: 2`, or the stretched link swallows its clicks.

## Mechanics page

The page has one card per tag, holding every hero that carries it, and one for initial energy, holding every hero that starts a battle with any. [Skill Pages](./SKILL_PAGES.md) defines tags, modifiers, the energy filter and when a hero satisfies a pick. Picks combine as all-of.

A pick dims the heroes outside the selection where they stand, so every card keeps its place and shape while picks change. The faction and class icons narrow the page instead, and drop a card they empty unless it is picked. `useMechanicPicks` keeps whether a tag's title is picked apart from its picked modifiers, so switching the last modifier off returns the tag to what it was before any was on.

The energy card's value is the energy filter's, shared with the hero lists, so the card opens on whatever a list left it at. A hero's skill modal opens on the picks the hero has skill text for, else on its card's tag, never on an empty list. No skill level carries a hero's energy, so the energy pick is never one of them.

The selection lives in memory only. A tag or energy link replaces it after mount, because the baked page has nothing picked ([Pre-Rendering](./PRE_RENDERING.md)). The index's tiles put the card's id in the URL fragment, so the router's `scrollBehavior` brings the card into view.

## Season summaries

A season's summary comes with the data pack. It is generated with the season's report and never edited here. While a season is played its summary is renewed with each new report and says so (`live`), and once it ends it stays as it is. Nothing derives these numbers, so the index never disagrees with the report. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) finds the summaries and lists them newest first, so a new season needs no entry here. A build stops on a summary with no report beside it, and a report with no summary yet still gets its page and stays off the index.

A summary lists the languages its report is written in (`languages`, English first) and carries each team's label in each of them. In an app locale the report is not written in (`reportReadsIn`), a team is named by its heroes in that locale (`pvpTeamName`), so a season needs nothing per app locale beyond the hero names the app already has. Report links ask for the site language (`pvpReportHref`), and a report written without it opens in English.

The external report generator owns the summary's format and documents it where it writes the file.

A report's page is built from its template alone ([Pre-Rendering](./PRE_RENDERING.md)), so a report can be published before the index lists it.

## PvP team generator

`/guide/pvp/generator` (`SL_GENERATOR_PATH`) picks, for the heroes and levels a visitor selects, the set of recorded Supreme League teams, one per board and no hero twice, with the best chance to win a match. Its records and its prediction model come from an external report generator, which writes the data file into the data pack with each export, and Stargazer chooses the set.

The page is pre-rendered in English with its heading alone, so search engines find it. The picker and the set follow the rosters the browser holds, so they are drawn after mount. The guide index's card for the generator draws a default set worked out once per build: `scripts/slPreview.ts` runs `defaultSlSet` (`src/lib/pvp/sl/generator/defaultSet.ts`) through Vite's module runner, so the app's imports resolve, and hands the result to the card as `virtual:sl-preview`. The index therefore loads neither the data file nor the model, and its boards are in the baked HTML.

The picker is the Rosters tab's `RosterEditor` ([Teams](./TEAMS.md)), bound to a copy of the active roster so that trying a hero out never reaches the roster. With no roster every hero starts at P4 R4, the level the recorded opponents are counted at. A hero the file cannot rate yet, one out in the file's season or later that no decided game fields (`unratedHeroes`, `data/sides.ts`), is locked: the picker shows it greyed, never adds it, and a hover or tap shows that its data is being collected, and the set leaves it out whatever the roster holds. `useSlFile` works these heroes out once the file loads, so a hero unlocks with the first export that records a game with it. The set is chosen only on Generate and keeps the selection it was chosen with, which is what Save as team saves. The page's type picker (`SlTypePicker`) chooses the boards (`slBoards`, `src/lib/pvp/sl/generator/setType.ts`): SL, where the page opens, stands five on `TEAM_VARIANTS.sl.maps` whatever the file holds, and 5v5 and 3v3 stand five or three on the Teams page's default maps, map 1 on all of them, so each board takes the teams recorded on map 1 while the model's numbers still come from every map's games. A set keeps the type it was chosen with until the next Generate, and Save as team stores it in that type's Teams mode.

The formation switch (`SlFormationPicker`) sits beside the set's type and is read on Generate, as the type is: Recorded, where the page opens, draws each team in the placement the file picks for it (below), and Generated in the placement engine's formation ([Placement](./PLACEMENT.md)). Both show the same teams, swaps and chance, so only where the heroes stand differs. `suggestedUnits` (`generator/suggested.ts`) places each team from its heroes, the artifact the set gives it and the phantimal its heroes can summon, three of them being of the phantimal's factions, and reads no recorded placement. The worker works the formations out as part of Generate, which can take a second or two more, and switching afterwards leaves the boards as they are until the next Generate. Save as team stores the set as it is drawn. A map Stargazer no longer holds has no formation from the engine, which reads its tiles from the map files, so its board keeps the recorded one.

The page keeps the dark look in both of the site's looks, the style of the season reports it comes from. Its root, `.sl-page`, carries `data-theme="dark"`, so the colour tokens take their dark values inside it and the shared roster controls keep their shapes in dark colours ([Architecture](../ARCHITECTURE.md#rules-that-apply-everywhere)). `src/components/guide/sl/sl.css` keeps every rule under that root. The page sizes the shared roster controls up through their tokens (`--control-height-compact`, `--dock-scale`).

### Code layout

`src/lib/pvp/sl/` is split by job, and each part uses only the ones above it in this table:

| Folder       | Holds                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/`      | The file's shape (`types.ts`), its decoder and shape check (`codec.ts`), a team as the model reads it and the heroes the file cannot rate yet (`sides.ts`), the kind rule (`kinds.ts`), the records Who Would Win? shows (`records.ts`) and upgrade points (`upgrades.ts`).            |
| `model/`     | What the pages ask the model (`types.ts`), the reading of the file's model (`reader.ts`), the split of a chance into reasons (`reasons.ts`) and the chance of winning each number of games (`odds.ts`).                                                                                |
| `generator/` | The search (`chooser.ts`), the artifact rule (`artifacts.ts`), the swaps shown under each team (`swaps.ts`), the engine's formations (`suggested.ts`), the picker's types (`setType.ts`), the team Save as team stores (`team.ts`) and the index card's default set (`defaultSet.ts`). |
| `www/`       | Who Would Win?'s result for a game (`panel.ts`), and its games and a match's result (`match.ts`).                                                                                                                                                                                      |

### The model

The data file carries the model's numbers, and `readModel` (`model/reader.ts`) answers the two questions the pages ask (`model/types.ts`): how strong a team is against a typical opponent of the season at the top levels (`againstTypical`), and what a match-up's edge, the log-odds of A winning, adds up from (`explain`). The external report generator learns the numbers and documents how they add up. A team with no artifact, or one the file has no number for, counts as having a typical one, and a team of fewer heroes than `TEAM_HEROES` has an empty slot for each missing hero, with a number of its own and no counters.

A team's kind is a group in the file. A recorded team's is its own `family`; any other five heroes, last season's teams included, take theirs from the kind rule (`data/kinds.ts`), by the recorded teams sharing the most heroes with them.

### The worker

The file is read, the search run, the engine's formations worked out and Who Would Win?'s result built in a module worker (`src/workers/sl.worker.ts`), so a long search never freezes the page. `useSlEngine` starts it when a page that needs it mounts and keeps it for the visit, so the file is read once. Until it is ready, Generate and Predict winner say so and wait. A worker that fails is dropped, the page shows its failure line, and the next page to mount starts another.

### The search

A team's chance is the model's against a typical opponent at the top levels, at the visitor's levels: its upgrade gap is the Rivalry points its heroes fall short of the top levels, priced by `prices`. The teams the `evidence` rules allow, the strict rule first and then the relaxed one, enter a complete search that keeps the set with the best chance to win most of its boards. A branch is bounded by each team's best chance over the artifacts it can end up with, so the bound holds before the artifacts are handed out. Ties between teams break by `rank` and between swaps by `order`, both from the file.

The set's artifacts go by how much the teams played them, never by the model's numbers (`generator/artifacts.ts`). This season's teams take artifacts they were recorded with, the way that gives out the most games played winning. A team left without one takes the first free artifact on the file's list for its group (`fallback`), which has one more list for the teams outside every group. Last season's teams take the first free artifact on their `like` list.

A team's board is the placement the file picks for the artifact the set gives it (`pick`), and its first placement, the usual one, for an artifact the file picks none for.

Each team shows the swaps its comp's recorded teams make with heroes the set leaves free, best by the model's chance at the visitor's levels. A one-hero swap puts a hero out for one of up to `flex.options` heroes, and a core hero with one moves out of the core. The rows the one-hero swaps leave of `flex.heroes` take two-hero swaps: two heroes that are neither core nor in a shown one-hero swap, out together for one of up to `flex.options` pairs.

Last season's teams (`before`) join when the selection holds too few Celestial and Hypogean heroes that some recorded team holds, by a count the file sets, so a new hero with no records cannot keep them out, and whenever this season's teams alone make no set. Such a team is rated by this season's model, its kind from the kind rule.

### Seasons and rotations

Seasonal artifact and phantimal ids are reused each season ([Seasonal Content](./SEASONAL.md)). The file keeps working across a cutover until the next season's file arrives: when its `season` is not `CURRENT_SEASON`, the page says the sets are last season's and that there are not enough games yet to choose this season's seasonal artifacts. The set still hands out the file's artifacts by the rule, but `artifactSurvives` counts a seasonal one as a typical artifact, and `slTeamData` (`src/lib/pvp/sl/generator/team.ts`) leaves out the seasonal artifacts and phantimals. After a rotation the file is a list behind until its first export with a game on the new maps. A map on `TEAM_VARIANTS.sl.maps` that the file does not hold takes the teams of a map that has left the list, the first missing with the first gone, and stands them in the engine's formation (`suggestedUnits`) under either formation choice, with no record shown, since the record is the replaced map's. The enemy heroes the engine weighs are the replaced map's too. The page says so while any SL board is in this state, and each board moves to its recorded teams and formations as soon as the file holds its map. Every board is drawn on Stargazer's own map files, and a set always saves as Supreme League. The file's unit test checks seasonal ids only while the seasons match and never checks map keys, so neither a cutover nor a rotation holds up a deploy.

The page draws each board from the encoded team `slTeamData` builds, the same string Save as team stores, so a saved set opens on the Teams page as it was drawn. Save as team goes to the Teams page with the saved team's id in the history entry (`openTeam`), and that page loads it as its own Load does. That replaces the Teams page's 5v5 boards, so when they hold work no saved team keeps (`holdsUnsavedWork`), the button takes a second press first.

### The data file

The file comes with the data pack. The external report generator owns its format and documents it where it writes the file; `src/lib/pvp/sl/data/types.ts` holds the fields Stargazer reads, and `decodeSlData` (`codec.ts`) refuses a file of another shape whole. The encryption keeps the file from reading as data in the network panel and protects nothing, since every visitor downloads the key with the decoder. Browsers decrypt only on https or localhost, so over plain http the page shows its load failure line.

Without the data pack `npm run build` stops at the data step, the dev server prints one line and runs with no preview on the guide index, and the tests that read the PvP data are left out, with one line (`vitest.config.ts`). The page and the worker keep the decoded data in plain variables, out of any store. A load that fails, as in a tab left open across a deploy, reloads the page once through `reloadOntoCurrentBuild` ([Pre-Rendering](./PRE_RENDERING.md)), then shows one line. The file carries no version field: it and the code that reads it reach visitors in the same deploy, and the unit test reads the shipped file.

## Who Would Win?

`/guide/pvp/www` (`WWW_PATH`) says which of two teams of up to five heroes, at their levels and with their artifacts, should win a Supreme League game, and why, from the generator's data file and model. It shares the generator's root and look (`.sl-page`, `sl.css`), its heading (`SlHead`), its file load (`useSlFile`), its About dialog (`SlAbout`) and its worker, and like the generator it is pre-rendered with its heading alone. The teams live in the page alone. A hero added to Team A starts at the active roster's levels and one added to Team B at the top levels, as the generator rates a visitor's heroes against opponents at the top levels. The result is made only on Predict winner. The hero grid and the slot's hero picker lock the heroes the generator's picker locks. A hero that reaches a team another way, from screenshots or picked before the file has loaded, counts as an average hero, and the result says so.

A switch chooses between One game and Match, the five games of a Supreme League match. The games, the mode and the slot being filled live in `useWwwGames` (`src/components/guide/www/`), and switching keeps them: One game shows game 1, and Match all five. The page's buttons act on the games shown: in Match the Upgrades menus set a level on a side's heroes in all five games, Swap sides swaps every game's teams, Clear empties all five, and Predict winner waits until every team shown has a hero. A player fields each hero and each artifact once in a match, so in Match the pickers leave out what that side fields in its other games; One game has no such rule. Each mode keeps the result last made in it.

The Screenshots button fills the games from screenshots of the Supreme League's knockout list, which shows a match's five games ([Matchup Import](./IMPORT_WWW.md)). Its Save replaces all five games, the left team of each game as Team A, and switches to Match from either mode; a game the screenshots do not show becomes an empty one. The heroes keep the levels read, and an artifact not recognised is left empty.

In Match, Predict winner asks the worker for each game's result as One game does, one request a game, and the page works out the match from the five chances as shown, each game won or lost on its own as the generator takes its boards (`matchOdds`, on the `oddsInto` the generator's search uses), so the match's numbers agree with the game lines. The match result (`WwwMatchResult`) gives Team A's chance to win the match, three games of five, the chance of each final score, and a line per game, its name in the middle and each team's chance growing from it toward that team's side; picking a line shows that game's result below, drawn by `WwwResult` as in One game with the game's name at its top.

The worker builds the result whole (`wwwPanel`, `src/lib/pvp/sl/www/panel.ts`), and the page only draws it. An artifact with no games in the file, or one `artifactSurvives` rejects, reaches the model as a typical one. The records are the wins and losses the file keeps beside the model's numbers (`data/records.ts`). A team with empty slots shows each under Heroes beside its heroes, each under Upgrades as falling short of the top levels by all a hero's Rivalry points, and a warning that no recorded game has one; empty slots both teams have cancel out and are not shown, as a hero on both teams is not.

Each of the four reasons is its Shapley value: the average, over the 24 orders of adding the reasons, of how far it moves the chance. The same part of the edge is worth less near 0% and 100% than near an even match, and this way the four add up to the chance less 50% however lopsided the match (`model/reasons.ts`). The page shows tenths of a point, and the rounding keeps that sum: each reason rounds half away from zero, so swapping the teams mirrors every value, and when the four then miss the shown chance, the reasons closest to rounding the other way take the difference, a tenth each.

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list, the report plugin and chunk error recovery
- [Teams](./TEAMS.md): rosters, the roster editor and saved teams
- [Matchup Import](./IMPORT_WWW.md): Who Would Win?'s screenshot import
- [Skill Pages](./SKILL_PAGES.md): the tags behind the mechanics page
