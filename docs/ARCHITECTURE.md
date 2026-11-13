# Architecture

Stargazer is an AFK Journey arena planner built with Vue 3, TypeScript, Pinia and vite-ssg. Two ideas organize the code. Game rules live in `src/lib/` and import no Vue or Pinia, so they run unchanged in tests and in the screenshot-import web worker. And each board is one self-contained object, so the Arena (one board) and the Teams page (up to five) share all of their board code.

Each system has its own doc under `docs/architecture/`; the index is in `AGENTS.md`.

## Layers

```
┌────────────────────────────────────────────────────────────┐
│ Views and components   src/views/   src/components/        │
│ HomeView (/)   TeamsView (/teams)   SkillView   GuideView  │
└─────────────┬────────────────────────────────┬─────────────┘
              ▼                                ▼
┌───────────────────────────┐    ┌───────────────────────────┐
│ Composables               │    │ Stores (Pinia)            │
│ useGridContext: the board │    │ useGrids: N boards, built │
│ a component stands on     │───▶│ by gridContext            │
│ useDragDrop, useGridEvents│    │ active-board facades,     │
│ useSelectionState, ...    │    │ gameData, i18n            │
└─────────────┬─────────────┘    └─────────────┬─────────────┘
              ▼                                ▼
┌────────────────────────────────────────────────────────────┐
│ Domain  src/lib/               ◀───  Utilities  src/utils/ │
│ grid, hex, characters/, pathfinding, storage, viewport,    │
│ skills/, teams/, import/, seasonal,  localeLoader,         │
│ dataLoader                           imageLoader           │
└────────────────────────────────────────────────────────────┘
```

Arrows show import direction.

| Layer                | Path                            | Imports                         | Never imports                                      |
| -------------------- | ------------------------------- | ------------------------------- | -------------------------------------------------- |
| Views and components | `src/views/`, `src/components/` | composables, stores, lib, utils |                                                    |
| Composables          | `src/composables/`              | stores, lib, utils              | `.vue` components                                  |
| Stores               | `src/stores/`                   | other stores, lib, utils        | composables, components                            |
| Domain               | `src/lib/`                      | lib, `src/data/` JSON           | Vue, Pinia, stores, composables, components, utils |
| Utilities            | `src/utils/`                    | lib, utils, Vue reactivity      | composables, components                            |

One exception is deliberate: `src/utils/contentMeta.ts` reads the i18n store, and every other utility is store-free. The domain imports no utility, so it knows nothing of the browser page around it; the temporary site-move code in `src/lib/move/` is the one exception, reading storage through `src/utils/`.

The code in `src/lib/pvp/` that the PvP team generator and Who Would Win? share is split by job into `data/` (the data file and its shape check), `model/` (the model's answers), `generator/` (the set search) and `www/` (Who Would Win?'s result). Each folder imports only from the folders before it in that order, so both pages read the file and the model through the same code.

## Boards

`createGridContext` (`src/stores/gridContext.ts`) builds one board: its `Grid`, its `SkillManager`, map, artifact slots, upgrade levels, derived values such as layout and closest targets, and the operations that change it. Its watchers run in their own effect scope, so disposing a board leaves nothing behind.

`useGrids` (`src/stores/grids.ts`) holds the boards, which one is active, the settings every board shares (hex size, team view, invert, perspective), and the rules that span boards: a hero or artifact can appear once per team across the whole page, and a drop may move a unit between boards. The single-board stores (`useGridStore`, `useCharacterStore`, `useArtifactStore`) forward to the active board, so Arena code never needs a board id. Board components read their own board with `useGridContext()`.

## From a tap to the screen

```
  tap, click or drag on a board
             │
             ▼
  event layer on top of the SVG ──▶ useGridEvents / useDragDrop
             │
             ▼
  component handler ──▶ board operation (GridContext)
                        or cross-board rule (useGrids)
             │
             ▼
  src/lib/characters: check the rules, then change the Grid
  inside executeTransaction (every step or none)
             │
             ▼
  SkillManager.updateActiveSkills re-derives every active skill
             │
             ▼
  computed values (placements, targets, overlays) ──▶ layers redraw
             │
             └──▶ watchers: phantimal faction check, autosave
```

SVG has no z-index, so the board draws its layers in order and puts an invisible layer on top to catch input ([Board Input](./architecture/DRAG_AND_DROP.md)). The event bus only notifies; whoever subscribes owns the state change. `executeTransaction` (`src/lib/characters/transaction.ts`) stops at the first step that fails and undoes the earlier ones in reverse, so a half-finished move never reaches the screen. The board's computed values do not track `SkillManager`'s internal maps; they read a version counter (`targetVersion`) that every skill change bumps.

## Where state is stored

Everything persists in the browser's `localStorage` under `stargazer.*` keys. Each key's exact shape, with an example, lives in the doc of the feature that owns it:

| Key                                                                     | Holds                                                                   | Shape in                                                 |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `stargazer.arena`                                                       | the Arena board, as a binary link payload                               | [URL Serialization](./architecture/URL_SERIALIZATION.md) |
| `stargazer.arena.variant`                                               | the mode of the Arena's map dropdown pick, `sl` or `gd`                 | [Grid](./architecture/GRID.md#map-editor)                |
| `stargazer.season`                                                      | the season the Arena board was last cleaned for                         | [Seasonal Content](./architecture/SEASONAL.md)           |
| `stargazer.teams.mode`, `.active.<mode>`, `.display`, `.saved`, `.sort` | Teams modes, working boards, toggles, library, sort                     | [Teams](./architecture/TEAMS.md)                         |
| `stargazer.rosters`, `stargazer.rosters.active`                         | the roster library and the active roster                                | [Teams](./architecture/TEAMS.md)                         |
| `stargazer.import.names`                                                | the team import's record names                                          | [Screenshot Import](./architecture/IMPORT.md)            |
| `stargazer.import.learned`                                              | the screenshot imports' learned faces                                   | [Screenshot Import](./architecture/IMPORT.md)            |
| `stargazer.skillLocale`, `stargazer.recentHeroes`                       | skill text language, recent heroes                                      | [Skill Pages](./architecture/SKILL_PAGES.md)             |
| `stargazer.tags.expanded`                                               | whether the hero lists show the mechanic filter as chips or as a menu   | [Skill Pages](./architecture/SKILL_PAGES.md)             |
| `stargazer.prefs`                                                       | device preferences                                                      | below                                                    |
| `stargazer.locale`                                                      | the app language, `"en"`, `"zh"` or `"ko"`; anything else reads as `en` | here                                                     |
| `stargazer.flags`                                                       | one-time flags, each the date it happened                               | below                                                    |
| `stargazer.fits`                                                        | the points Generate's fit checks found, for later visits                | [Placement](./architecture/PLACEMENT.md)                 |
| `stargazer.placement.lists`                                             | a visitor's changed hero lists from the Hero lists page                 | [Placement](./architecture/PLACEMENT.md)                 |

The one `sessionStorage` key is covered in [Pre-Rendering](./architecture/PRE_RENDERING.md). Every reader falls back to a default when it cannot read a value, and the next write replaces what was there. Readers ignore fields they do not know, and the next write drops them, except in `stargazer.prefs`, where a write keeps every field but its own.

`stargazer.prefs` holds two fields, `gridInfo` for Grid Info and `theme` for the site's look. In `gridInfo` a missing or non-boolean field takes its default, and `hover` and `rules` are never both true: a stored value with both true reads as `hover` on and `rules` off. `theme` is `"light"` or `"dark"`, written only when the visitor picks a look. While it is missing or holds anything else, the site follows the device's setting. The example shows the Grid Info defaults with the dark look picked:

```json
{
  "gridInfo": {
    "master": false,
    "tileIds": true,
    "hover": false,
    "rules": true,
    "heroCard": false,
    "upgrades": false,
    "targeting": false,
    "coordinates": false,
    "heroSkin": false,
    "buffTiles": true
  },
  "theme": "dark"
}
```

`stargazer.flags` holds every "has this happened" flag as one object, each entry a date as plain text such as `2026-11-06`. A reader takes only the entries `src/utils/flags.ts` lists, an entry that is not a date reads as unset, and a write drops everything else, so retiring a flag is removing its name from that list.

| Entry      | Holds                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `whatsNew` | The date of the What's New edition last opened, written when the popup opens. While it is missing or another date, the top bar's What's New tab shows a dot. |

```json
{
  "whatsNew": "2026-11-06"
}
```

Only links (`?g=`) and the Arena board use the binary format; everything else stores the JSON interchange format ([URL Serialization](./architecture/URL_SERIALIZATION.md)). Stored data is never migrated per season. Instead, every Teams page load passes through `normalizeTeamPayload`, which fixes the shape and drops other seasons' content ([Seasonal Content](./architecture/SEASONAL.md)), and the Arena board is cleaned once per season change.

## Rules that apply everywhere

Window size is read only through `src/utils/viewport.ts`. ESLint bans `window.innerWidth` and `innerHeight` elsewhere, because they include classic scrollbars that fixed overlays are not laid out against.

The light and dark looks are colour tokens in `src/styles/variables.css`, with light values on `:root` and dark values under `[data-theme='dark']`. A script in the head of `index.html` sets `data-theme` on `<html>` before the first paint, from `theme` in `stargazer.prefs` or else the device's setting, and `useTheme` takes it over after mount. An element carrying its own `data-theme` takes that look's tokens inside it whatever the site's look. A token defined from another token takes its value where it is defined, so the dark block declares such tokens again.

Every modal uses `useScrollLock`, `useFocusTrap` and `useOverlay` through `BaseModal`: page scrolling locks while it is open, focus stays inside and returns to the opener, and Escape or a click outside closes it.

A tap never shows an action button's tooltip; info-only triggers show theirs on tap (`useHoverTooltip`, `useInfoTip`). Touch is decided for each event (`isTouchHover` in `src/utils/pointer.ts`), so a mouse keeps its hover on a device that also has a touchscreen.

Text carries its language in the `lang` attribute, and nothing else decides how a language is treated. `<body lang>` is the app locale (`src/stores/i18n.ts`), so everything the app draws reads as that language wherever it is mounted. Text in another language, such as a skill article, declares its own. `<html lang>` is the page's language, which on a skill page is the skill text's, for the document head and for crawlers. Browsers pick fonts and screen readers pick a voice from the same attribute, and per-language styling in `src/styles/base.css` keys off it.

## Content and data

Page text written for the site lives in `src/content/`, while skill text for all languages comes with the data pack. Game data (`src/data/`) loads through `src/lib/dataLoader.ts` and dictionaries (`src/locales/`) through `src/utils/localeLoader.ts`, except three files of single values that the modules using them import directly: `maps.json`, `grid.json` and `upgrades.json`. The external report generator reads these three files too, so their field names are part of its format. PvP reports produced by an external report generator come with the data pack and are published at build time ([Pre-Rendering](./architecture/PRE_RENDERING.md)).
