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

`useGrids` (`src/stores/grids.ts`) holds the boards, which one is active, the settings every board shares (hex size, team view, invert), and the rules that span boards: a hero or artifact can appear once per team across the whole page, and a drop may move a unit between boards. The single-board stores (`useGridStore`, `useCharacterStore` and the others) forward to the active board, so Arena code never needs a board id. Board components read their own board with `useGridContext()`.

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

| Key                                                                                      | Holds                                             | Format                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------- | --------------------------------------------------- |
| `stargazer.arena`                                                                        | the Arena board                                   | binary, same as a link                              |
| `stargazer.season`                                                                       | the season the Arena board was last cleaned for   | number                                              |
| `stargazer.teams.*`                                                                      | Teams modes, slots, display, library, sort        | JSON ([Teams](./architecture/TEAMS.md))             |
| `stargazer.import.learned`, `stargazer.import.names`                                     | screenshot-import corrections                     | JSON ([Team Import](./architecture/IMPORT_TEAM.md)) |
| `stargazer.prefs`, `stargazer.locale`, `stargazer.skillLocale`, `stargazer.recentHeroes` | device preferences                                | JSON or string                                      |
| `stargazer.migration.*`                                                                  | one-time conversion markers of the temporary shim | string                                              |

Only links (`?g=`) and the Arena board use the binary format; everything else stores the JSON interchange format ([URL Serialization](./architecture/URL_SERIALIZATION.md)). Stored data is never migrated per season. Instead, every Teams page load passes through `normalizeTeamPayload`, which fixes the shape and drops other seasons' content ([Seasonal Content](./architecture/SEASONAL.md)), and the Arena board is cleaned once per season change. `src/utils/upgradeMigration.ts` is a temporary shim for older formats; its header explains when and how to delete it.

## Rules that apply everywhere

Window size is read only through `src/utils/viewport.ts`. ESLint bans `window.innerWidth` and `innerHeight` elsewhere, because they include classic scrollbars that fixed overlays are not laid out against.

Every modal uses `useScrollLock`, `useFocusTrap` and `useOverlay` through `BaseModal`: page scrolling locks while it is open, focus stays inside and returns to the opener, and Escape or a click outside closes it.

Action buttons never show a tooltip on touch devices; info-only triggers show theirs on tap (`useHoverTooltip`, `useInfoTip`).

## Content and data

Page prose is in `src/content/page/` (en and zh). Per-hero skill notes are in `src/content/skill/<slug>/`, while skill text for all languages is in `src/locales/skill/<lang>/`. Game data (`src/data/`) and dictionaries (`src/locales/`) load through `src/utils/dataLoader.ts`. PvP reports produced by an external report generator sit in `src/content/pvp/s<N>/` and are published at build time ([Pre-Rendering](./architecture/PRE_RENDERING.md)).
