# Guide

The guide is an index of reference material for arena planning plus the pages it points at: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, and the finished seasons' PvP reports with the newest season's counter ladder. Guide pages exist in the two app locales and are pre-rendered ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages

`GUIDE_PAGES` and `guidePath` (`src/lib/guide.ts`) feed the router, the pre-render route list and the page meta, so a page added there is routed, pre-rendered and titled together. The en and zh routes of a page share one view instance, so `setupGuideContentMeta` passes `useHead` a computed that follows the locale instead of the value at setup.

Each index panel's title link is stretched over its `.guide-link` area (`src/styles/guide.css`), so the blurb, the previews and empty space open the page too. A control placed inside that area, such as a chip or tile, must raise itself with `position: relative; z-index: 2`, or the stretched link swallows its clicks. The counter ladder is the exception: only its title is a link, so a click on its empty space clears the team selection as it does in the report.

The upgrade tracks on the index place each band's levels at their share of that band's own maximum on the energy ramp, so a band that starts higher or climbs in smaller steps shows it in the spacing.

## Season summaries

A finished season's summary (`src/content/pvp/s<N>/summary.ts`) is a typed literal written once from the season's report and never edited: the team groups and the counters between them. Nothing derives these numbers, and each counter's evidence band is copied from the report rather than recomputed from its record, so the index never disagrees with the report. `PVP_SEASONS` (`src/content/pvp/seasons.ts`) lists the summaries newest first. The index shows every entry's report block and the first entry's ladder.

Team ids and counter anchors follow the report's `counter-<winner>-vs-<loser>` fragment ids, so the ladder's curves link straight to the evidence. `tests/unit/content/pvpSeasons.test.ts` checks every summary against the roster and its report: known hero slugs, counters only between listed teams, and anchors present in the template.

To add a season, write `s<N>/summary.ts` beside `s<N>/index.template.html` and put it at the front of `PVP_SEASONS`.

## Counter ladder

`layoutLadder` (`src/lib/pvp/ladderLayout.ts`) reproduces the report's own drawing rules, so a ladder matches the report it came from. Teams stack by rating with a rule where the tier changes, and each counter is one cubic curve. A higher-rated winner's curve runs down the right side of the team column and a lower-rated winner's runs up the left, so the side alone says whether a counter is an upset. Curves bow out further the more rows they span, so longer counters run outside shorter ones.

Each curve is labeled with the winner's share of the games and how many games that is, and a share from under `FEW_GAMES` games is dimmed. A label tries fixed stops along its own curve, on the curve and just outside it, and takes the position that covers the least of the other curves, labels and cards. Short curves place first because they have the least room, and equal spans place in the report's team order (most played first), so every label lands where the report put it. The whole drawing is then shifted so its outermost curves and labels, not the team column, are centered.

Selecting a team dims every curve not touching it and turns the curves it loses red. A pointer-up anywhere else, or Escape, clears it. It listens for pointerup rather than click, since a touch that scrolls ends in pointercancel and keeps the selection.

## Related documentation

- [Pre-Rendering](./PRE_RENDERING.md): the route list and the report hydration plugin
- [Skill Pages](./SKILL_PAGES.md): the tags behind the mechanics page
