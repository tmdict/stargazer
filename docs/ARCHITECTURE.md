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
│ useGridContext: one board │◀───│ useGrids: N boards        │
│ useDragDrop, useGridEvents│───▶│ active-board facades,     │
│ useSelectionState, ...    │    │ gameData, i18n, urlState  │
└─────────────┬─────────────┘    └─────────────┬─────────────┘
              ▼                                ▼
┌────────────────────────────────────────────────────────────┐
│ Domain  src/lib/               ◀──▶  Utilities  src/utils/ │
│ grid, hex, characters/, pathfinding, binaryEncoder,        │
│ skills/, teams/, import/, seasonal   urlStateManager,      │
│                                      dataLoader, viewport  │
└────────────────────────────────────────────────────────────┘
```

Arrows show import direction.

| Layer                | Path                            | Imports                         | Never imports                               |
| -------------------- | ------------------------------- | ------------------------------- | ------------------------------------------- |
| Views and components | `src/views/`, `src/components/` | composables, stores, lib, utils |                                             |
| Composables          | `src/composables/`              | stores, lib, utils              | `.vue` components                           |
| Stores               | `src/stores/`                   | other stores, lib, utils        | composables, components                     |
| Domain               | `src/lib/`                      | lib, utils, `src/data/` JSON    | Vue, Pinia, stores, composables, components |
| Utilities            | `src/utils/`                    | lib, utils, Vue reactivity      | composables, components                     |

Three exceptions are deliberate. `src/stores/grids.ts` imports `createGridContext` from a composable, because the store that holds the boards is the one that builds them; no other store imports a composable. `src/utils/contentMeta.ts` reads the i18n store, and `src/utils/teamsBoardSize.ts` imports a type from the grid store; every other utility is store-free. Domain and utility modules import each other where needed (`lib/seasonal.ts` reads the data loader, the binary encoder reads `lib/teams/wire.ts`), so the "never imports" column is the only rule between them.

## Boards

`createGridContext` (`src/composables/useGridContext.ts`) builds one board: its `Grid`, its `SkillManager`, map, artifact slots, upgrade levels, derived values such as layout and closest targets, and the operations that change it. Its watchers run in their own effect scope, so disposing a board leaves nothing behind.

`useGrids` (`src/stores/grids.ts`) holds the boards, which one is active, the settings every board shares (hex size, team view, invert, perspective), and the rules that span boards: a hero or artifact can appear once per team across the whole page, and a drop may move a unit between boards. The single-board stores (`useGridStore`, `useCharacterStore` and the others) forward to the active board, so Arena code never needs a board id. Board components read their own board with `useGridContext()`.

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

| Key                                                                                | Holds                                                                   | Shape in                                                 |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| `stargazer.arena`                                                                  | the Arena board, as a binary link payload                               | [URL Serialization](./architecture/URL_SERIALIZATION.md) |
| `stargazer.season`                                                                 | the season the Arena board was last cleaned for                         | [Seasonal Content](./architecture/SEASONAL.md)           |
| `stargazer.teams.mode`, `.active.<mode>`, `.display`, `.saved`, `.sort`            | Teams modes, working boards, toggles, library, sort                     | [Teams](./architecture/TEAMS.md)                         |
| `stargazer.rosters`, `stargazer.rosters.active`                                    | the roster library and the active roster                                | [Teams](./architecture/TEAMS.md)                         |
| `stargazer.import.names`                                                           | the team import's record names                                          | [Team Import](./architecture/IMPORT_TEAM.md)             |
| `stargazer.import.learned`                                                         | the screenshot imports' learned faces                                   | [Screenshot Import](./architecture/IMPORT.md)            |
| `stargazer.skillLocale`, `stargazer.skillLocaleHintSeen`, `stargazer.recentHeroes` | skill text language, tip dismissal, recent heroes                       | [Skill Pages](./architecture/SKILL_PAGES.md)             |
| `stargazer.tags.expanded`                                                          | whether the hero lists show the mechanic filter as chips or as a menu   | [Skill Pages](./architecture/SKILL_PAGES.md)             |
| `stargazer.prefs`                                                                  | device preferences                                                      | below                                                    |
| `stargazer.locale`                                                                 | the app language, `"en"`, `"zh"` or `"ko"`; anything else reads as `en` | here                                                     |

The one `sessionStorage` key is covered in [Pre-Rendering](./architecture/PRE_RENDERING.md). Every reader falls back to a default when it cannot read a value, and the next write replaces what was there. Readers ignore fields they do not know, and the next write drops them.

`stargazer.prefs` holds two fields, `gridInfo` for Grid Info and `theme` for the site's look, and a write replaces its own field and keeps the other. In `gridInfo` a missing or non-boolean field takes its default, and a value that does not parse is replaced with the defaults. `theme` is `"light"` or `"dark"`, written only when the top bar's light and dark button is pressed; while it is missing or holds anything else, the site follows the device's light or dark setting, live. The example shows the Grid Info defaults with the dark look picked:

```json
{
  "gridInfo": {
    "master": false,
    "tileIds": true,
    "hover": true,
    "heroCard": false,
    "upgrades": false,
    "targeting": false,
    "coordinates": false,
    "heroSkin": false
  },
  "theme": "dark"
}
```

Only links (`?g=`) and the Arena board use the binary format; everything else stores the JSON interchange format ([URL Serialization](./architecture/URL_SERIALIZATION.md)). Stored data is never migrated per season. Instead, every Teams page load passes through `normalizeTeamPayload`, which fixes the shape and drops other seasons' content ([Seasonal Content](./architecture/SEASONAL.md)), and the Arena board is cleaned once per season change.

## Rules that apply everywhere

Window size is read only through `src/utils/viewport.ts`. ESLint bans `window.innerWidth` and `innerHeight` elsewhere, because they include classic scrollbars that fixed overlays are not laid out against.

The light and dark looks are colour tokens in `src/styles/variables.css`, with light values on `:root` and dark values under `[data-theme='dark']`. A script in the head of `index.html` sets `data-theme` on `<html>` before the first paint, from `theme` in `stargazer.prefs` or else the device's setting, and `useTheme` takes it over after mount. An element carrying `data-theme="dark"` stays dark inside it whatever the site's look, and a dropdown's list floated onto `<body>` copies its region's value. A token defined from another token takes its value where it is defined, so the dark block declares such tokens again.

Every modal uses `useScrollLock`, `useFocusTrap` and `useOverlay` through `BaseModal`: page scrolling locks while it is open, focus stays inside and returns to the opener, and Escape or a click outside closes it.

Action buttons never show a tooltip on touch devices; info-only triggers show theirs on tap (`useHoverTooltip`, `useInfoTip`).

Text carries its language in the `lang` attribute, and nothing else decides how a language is treated. `<body lang>` is the app locale (`src/stores/i18n.ts`), so everything the app draws reads as that language wherever it is mounted, a popup or tooltip moved to `<body>` included. Text in another language declares its own: a skill article, the content of a popup with its own language menu (`BaseModal`'s `localeOverride`), a keyword tooltip, a search hit, a hero note, and the app-locale labels inside a skill article (filter chips, slot tags, the Charm heading). `<html lang>` is the page's language, which on a skill page is the skill text's, for the document head and for crawlers. Browsers pick fonts and screen readers pick a voice from the same attribute, and per-language styling in `src/styles/base.css` keys off it: Korean breaks lines only at spaces, and a Korean interface names a Latin font ahead of `sans-serif`, which brings Korean labels, set high by the Mac's Korean font, in line with English and Chinese ones.

## Content and data

The About popup's text is in `src/content/about/` and the Help page's in `src/content/help/`, one file per app locale (`APP_LOCALES`: en, zh and ko), each imported directly by its view. Per-hero skill notes are in `src/content/skill/<slug>/`, also one file per app locale, while skill text for all languages is in the data pack's `text/skill/<lang>/`. Game data (`src/data/`) and dictionaries (`src/locales/`) load through `src/utils/dataLoader.ts`, but for three files of single values that the modules using them import: the map lists of Supreme League and Guild Duel (`maps.json`, in `src/lib/teams/modes.ts`), the board's tile layout (`grid.json`, in `src/lib/types/grid.ts`), and the upgrade ramps with their top levels (`upgrades.json`, in `src/lib/characters/upgradeStats.ts` and `attributes.ts`). The external report generator reads these three files too, so their field names are part of its format. PvP reports produced by an external report generator sit in `src/content/pvp/s<N>/` and are published at build time ([Pre-Rendering](./architecture/PRE_RENDERING.md)).

### The data pack

The game's own files are kept outside this repo as the data pack, which the data export writes: hero portraits and outfits, artifact and seasonal pictures, skill and effect text, skill cooldowns and the screenshot import's references. `npm run data` copies it into the ignored `src/pack/`, which the app imports from:

- from the folder `DATA_PACK_DIR` names in `.env.local` (template: `.env.example`);
- else, where `DATA_PACK_URL`, `DATA_PACK_TOKEN` and `DATA_PACK_PATH` are set, as on the host, by downloading the version `data.lock` pins;
- else it writes empty stand-ins for the files the app imports directly and prints one line, and the app runs with plain portraits and no skill text.

The copy mirrors its source. The step also writes a bundling module (`text/skill/<code>/index.ts`) into each skill language folder present. `dev`, `test` and `prep` run it first. A build runs it as `tsx scripts/data.ts build`, which stops, naming each problem, when the pack is missing or disagrees with `src/data/` in a way that would ship a broken page, such as an artifact with no picture or skill text for a hero with no hero file. Content that is only waiting for the pack, such as a new hero's portrait or a season's text, is printed as a note.

`npm run data:pin` writes the commit of the `DATA_PACK_DIR` folder into `data.lock`, and refuses while that folder has uncommitted files or unpushed commits. After pinning it prints the build's problems and notes without stopping. `data.lock` holds that one line:

```
3f9a1c07d2e84b6f9a0c1e2d3b4a5f6e7d8c9b0a
```
