# Guide

The guide is an index of reference material for arena planning plus the pages it points at: the Paragon and EX Refinement matrix, the heroes grouped by skill mechanic, and the finished seasons' PvP reports with the newest season's counter ladder. Pages exist in the two app locales and are pre-rendered ([Pre-Rendering](./PRE_RENDERING.md)).

## Pages (`/src/lib/guide.ts`, `/src/views/`)

| Route                      | View                 | Body                                                                                                 |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `/{en,zh}/guide`           | `GuideView`          | Report entries, upgrade tracks, counter ladder, mechanic tiles                                       |
| `/{en,zh}/guide/upgrades`  | `GuideUpgradesView`  | `GuideUpgradeSection`, the stat matrix                                                               |
| `/{en,zh}/guide/mechanics` | `GuideMechanicsView` | One `GuideTagSection` per tag; each section's id is its tag, the deep-link target of the index tiles |

- **One page list**: `GUIDE_PAGES` and `guidePath` feed the router (`routes.ts`), the SSG route list (`vite.config.ts`) and `setupGuideContentMeta`, so a page added there is routed, pre-rendered and titled together
- **Index layout**: `GuideView` places the four panels as grid areas, report beside upgrades and ladder beside mechanics from 1100px, stacked in that order below. Panels are size containers (`guide.css`), so the ladder, the tiles and the upgrade tracks compact to their column rather than to the viewport
- **Whole-box links**: every panel's title link is stretched over its `.guide-link` area (`guide.css`), so the blurb, previews and empty space open the page too. Any control placed inside that area (chips, tiles, the ladder's team buttons and curves) must raise itself above the stretched layer with `position: relative; z-index: 2`, or the box link swallows it. The ladder's SVG sits at that layer with `pointer-events: none`, so only its curves' hit strokes take the pointer and the space between them still opens the report

## Season Summaries (`/src/content/pvp/s<N>/summary.ts`, `/src/content/pvp/seasons.ts`)

A finished season's summary is a typed literal (`PvpSeasonSummary`) written once from the season's report and never edited: the team groups (short name, hero slugs, games, rating, tier) and the counters between them (winner, loser, record, evidence band, evidence anchor). `PVP_SEASONS` lists them newest first; the index renders every entry's report block and the first entry's ladder.

- **Locked snapshot**: nothing derives these numbers; they are the report's. A season is added by writing `s<N>/summary.ts` beside `s<N>/index.template.html` and putting it at the front of `PVP_SEASONS`
- **Ids are anchor slugs**: `PvpTeam.id` and `PvpCounter.anchor` follow the report's `counter-<winner>-vs-<loser>` fragment ids, so curves link straight to the evidence
- **The band is the report's class**, kept explicit rather than recomputed from the record, so the index never disagrees with the report
- Every summary is checked against the roster and its report (known hero slugs, counters between listed teams, anchors present in the template) in `tests/unit/content/pvpSeasons.test.ts`

## Counter Ladder (`/src/lib/pvp/ladderLayout.ts`, `/src/components/guide/GuideCounterLadder.vue`)

`layoutLadder` turns a summary into a drawing: rows by rating (`ladderTeams`), a rule where the tier changes, and one cubic curve per counter, in viewBox units of `LADDER_WIDTH` by `LADDER_ROW` per team.

- **Side says direction**: a higher-rated winner's curve runs down the right side of the node column, a lower-rated winner's runs up the left, so an upset reads from the side its curve is on
- **Bow per span**: control points sit `BOW_BASE` plus `BOW_STEP` per row spanned outside the column, so longer counters run outside shorter ones
- **Fanned ends**: curve ends sharing a node edge spread `FAN` apart in the order of the row they connect to
- **Labels**: each record sits at its curve's outermost point; labels closer than `LABEL_H` on one side are pushed down in turn
- **Centred on its extremes**: `offset` shifts the whole drawing so its outermost labels, not the node column, are centred in the box; the side with the longer bows would otherwise pull it off-centre

These are the report's own drawing rules, so a regenerated ladder matches the report it came from. The component adds the interaction: selecting a team dims every curve not touching it and turns the curves it loses red; a pointer-up anywhere else or Escape clears it (pointerup rather than click, since a touch that scrolls ends in pointercancel and keeps the selection). Curves are links to the report's evidence sections.

## Index Entries

- **Report chips**: `mostPlayedTeams` orders a season's teams by games; `GuidePvpReport` shows the first `CHIP_COUNT`, each linking to the report's team table
- **Upgrade tracks**: `GuideUpgradesIndex` places each band's level pills along a track at their share of the band's own max (the energy ramp; the other stat groups differ by a couple of percent), so the Celestial and Hypogean band's higher start and smaller steps read from the bead spacing. Bands cannot share one scale: refinement's max is a fraction of paragon's
- **Mechanic tiles**: `GuideMechanicsIndex` takes `guideTagGroups` and shows `PREVIEW` portraits per tag with the hero count

## Related Documentation

- [Pre-Rendering](./PRE_RENDERING.md): SSG route list, page meta, the report hydration
- [Skills](./SKILLS.md): the tag data behind the mechanics page
