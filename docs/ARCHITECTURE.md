# Architecture Overview

## Overview

Stargazer is an AFK Journey arena simulator built with Vue 3, TypeScript, Pinia, and vite-ssg. Game logic lives in a framework-agnostic domain layer (`src/lib/`) that stores and composables adapt to Vue reactivity, and every arena board is one self-contained entity, so pages differ only in how many boards they hold. This document states the layering rules and cross-cutting invariants; each subsystem has a deep dive under `docs/architecture/`.

## Design Principles

1. **Framework-agnostic domain**: `src/lib/` imports no Vue or Pinia, so it runs unchanged in tests and in the team-import web worker
2. **Board as entity**: `createGridContext` bundles one board's `Grid`, `SkillManager`, map, artifacts, derived values, and operations; `useGrids` holds N of them
3. **One-way dependencies**: components call composables and stores, stores call the domain, and no layer imports from the layer above it
4. **Atomic operations**: place, remove, move, and swap run through `executeTransaction`, so a failed step rolls back every earlier step
5. **Layered rendering**: SVG has no z-index, so the grid stacks visual layers in draw order and puts an invisible event-capture layer on top

## Architecture

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

Arrows show import direction. The one reverse arrow is `useGrids` building boards through `createGridContext`; the domain and utilities import each other per module (see Layer Rules).

## Layer Rules

| Layer                | Path                            | Imports                         | Never imports                               |
| -------------------- | ------------------------------- | ------------------------------- | ------------------------------------------- |
| Views and components | `src/views/`, `src/components/` | composables, stores, lib, utils |                                             |
| Composables          | `src/composables/`              | stores, lib, utils              | `.vue` components                           |
| Stores               | `src/stores/`                   | other stores, lib, utils        | composables, components                     |
| Domain               | `src/lib/`                      | lib, utils, `src/data/` JSON    | Vue, Pinia, stores, composables, components |
| Utilities            | `src/utils/`                    | lib, utils, Vue reactivity      | composables, components                     |

Deliberate exceptions, each singular:

- `src/stores/grids.ts` imports `createGridContext` from `src/composables/useGridContext.ts`. That file is the board entity factory, and the collection store is what constructs boards. No other store imports a composable; `src/stores/teamLibrary.ts` states the rule in its header and returns typed results instead of toasting.
- `src/utils/contentMeta.ts` reads `useI18nStore`. Every other utility is store-free.
- The domain and utilities import each other per module: `lib/seasonal.ts` and `lib/maps.ts` read `utils/dataLoader.ts`, `lib/teams/` reads the serializers, and `utils/binaryEncoder.ts` reads `lib/characters/attributes.ts` and `lib/teams/wire.ts`. The "Never imports" column is the rule that holds between them, not an ordering.

## Boards: the Entity Pattern

- `createGridContext(id, mapKey, globals)` (`src/composables/useGridContext.ts`) builds one board: its `Grid`, `SkillManager`, map, artifact slots, derived values (layout, team-view crop, closest-target maps as `computed`), and the place/remove/move/swap/clear operations. Its watchers live in a detached `effectScope`, so `dispose()` tears a board down without leaking.
- `useGrids` (`src/stores/grids.ts`) holds the `contexts` array, the active-board pointer, the globals every board shares (hex size, team view, invert), and the cross-board rules: page-wide character and artifact uniqueness, drop routing, place-on-active, remove-from-any-board. `setGridCount(n)` rebuilds the array (Arena: 1; Teams: the mode's count, at most `MAX_GRID_COUNT`).
- `useGridStore`, `useCharacterStore`, `useArtifactStore`, `useSkillStore`, and `usePathfindingStore` are facades over the active context, so single-board callers need no board id.
- Board components read their own board through `useGridContext()`. `GridContainer` provides it through a Proxy bound to its `context` prop, so the Arena's descendants follow the active board when `setGridCount` swaps instances.

## Data Flow

1. A component handles the DOM event, or the grid event bus notifies it (`useGridEvents` only notifies; the subscriber owns any state change)
2. The component calls a store action or a context operation
3. Single-board stores forward to the active `GridContext`; the context calls a `src/lib/characters/` operation
4. The operation validates, then mutates the `Grid` inside `executeTransaction`
5. Vue reactivity re-renders the layers that read the changed state

Transactions: `executeTransaction(operations: (() => boolean)[], rollbackOperations: (() => void)[] = []): boolean` in `src/lib/characters/transaction.ts` stops at the first operation that returns false or throws, then runs the rollbacks in LIFO order. See [Grid & Characters](./architecture/GRID.md).

## Views and Components (`src/views/`, `src/components/`)

| Route                    | View         | Role                                                                                            |
| ------------------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| `/`                      | `HomeView`   | Arena: one board, autosaved                                                                     |
| `/teams`                 | `TeamsView`  | Multi-board team builder and saved-team library ([Teams](./architecture/TEAMS.md))              |
| `/share`                 | `ShareView`  | Read-only render of a `?g=` link                                                                |
| `/skills`                | `SkillsView` | Skill browser                                                                                   |
| `/:lang/skill/:name`     | `SkillView`  | Per-hero skill page, pre-rendered per locale ([Pre-Rendering](./architecture/PRE_RENDERING.md)) |
| `/en/guide`, `/zh/guide` | `GuideView`  | Guide pages, pre-rendered                                                                       |

Grid rendering: `GridContainer` wraps `GridManager`, which composes `GridTiles` (SVG: regular hexes, elevated hexes, text, then the invisible event layer), `GridArtifacts` and `GridCharacters` (HTML overlays), and `SkillTargeting` and `GridArrows` (SVG overlays). Layer order and hit-testing: [Drag & Drop](./architecture/DRAG_AND_DROP.md).

## Composables (`src/composables/`)

Composables whose triggers and consumers sit far apart in the tree, or whose state is device-global, keep state at module scope (`useSelectionState`, `useDragDrop`, `useGridSwap`, `useSearchOverlay`, `useTouchDetection`, `useSeasonNotice`, `useAttrLayerSelection`). The ones that carry a cross-cutting contract:

| Composable                                    | Contract                                                                                                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGridContext`                              | Board entity and its injection (above)                                                                                                                                                |
| `useGridEvents`                               | Typed provide/inject pub/sub for grid DOM events, provided by `GridManager` ([Event System](./architecture/EVENT_SYSTEM.md))                                                          |
| `useDragDrop`                                 | Module-singleton drag state for SVG and HTML drag sources, with position-based hex detection ([Drag & Drop](./architecture/DRAG_AND_DROP.md))                                         |
| `useSelectionState`                           | Roster team selection plus the mobile tap state: the placement-target hex and the lifted hero, each board-qualified                                                                   |
| `useDisplayFlags`                             | Grid toggle flags, serialized together into the link and the autosave                                                                                                                 |
| `useGridPersistence`, `useTeamsRestore`       | Autosave slots (one for the Arena, one per Teams mode) and the Teams mode-switch sequence ([Teams](./architecture/TEAMS.md))                                                          |
| `useTeamImport`                               | Screenshot import state and its worker ([Team Import](./architecture/IMPORT_TEAM.md))                                                                                                 |
| `useScrollLock`, `useFocusTrap`, `useOverlay` | Modal-surface contract: ref-counted scroll lock, dialog focus that cycles inside the surface and returns to the opener, Escape and click-outside to close; `BaseModal` uses all three |
| `useHoverTooltip`, `useInfoTip`               | Tooltip policy: action triggers never show a tooltip on touch, info-only triggers show it on tap; `useInfoTip`'s header is the reference                                              |
| `useSkillSearch`, `useSearchOverlay`          | Lazy per-language skill-text index and the shared overlay state behind `SkillSearchOverlay`                                                                                           |

## Stores (`src/stores/`)

| Store                                                                                           | Role                                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useGrids`                                                                                      | Board collection (above)                                                                                                                                                               |
| `useGridStore`, `useCharacterStore`, `useArtifactStore`, `useSkillStore`, `usePathfindingStore` | Active-board facades; `usePathfindingStore` serves only the debug panel, the per-board target maps live on the context                                                                 |
| `useGameDataStore`                                                                              | Character, artifact, and phantimal definitions loaded by `dataLoader`; resolves companion and synergy ids to their base hero                                                           |
| `useI18nStore`                                                                                  | App locale and the skill-text locale preference; loads the dictionaries                                                                                                                |
| `useMapEditorStore`                                                                             | Tile-state painting on the active grid ([Map Editor](./architecture/MAP_EDITOR.md))                                                                                                    |
| `useTeamLibrary`                                                                                | Saved-team library in one versioned localStorage blob; returns typed results and never surfaces feedback ([Teams](./architecture/TEAMS.md))                                            |
| `useUrlStateStore`                                                                              | Decodes link and stored payloads and applies them to the boards; `restoreMultiFromEncodedState` is the only bulk-apply path ([URL Serialization](./architecture/URL_SERIALIZATION.md)) |

## Domain (`src/lib/`)

| Module                                      | Role                                                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `grid.ts`, `hex.ts`, `layout.ts`, `maps.ts` | Hexagonal grid, coordinates, screen layout, arena presets ([Grid & Characters](./architecture/GRID.md))                                                                                          |
| `characters/`                               | Queries and the place/remove/move/swap operations with skill integration; unit id namespaces (companion, phantimal, placeholder, synergy); upgrade registry (`attributes.ts`, `upgradeStats.ts`) |
| `pathfinding.ts`                            | A\* and BFS with tie-breaking rules ([Pathfinding](./architecture/PATHFINDING.md))                                                                                                               |
| `skills/`                                   | Skill registry, `SkillManager`, per-character skills ([Skills](./architecture/SKILLS.md))                                                                                                        |
| `teams/`                                    | Saved-team records, modes, side-load, import plans ([Teams](./architecture/TEAMS.md))                                                                                                            |
| `import/`                                   | Screenshot recognition over RGBA buffers; runs in `src/workers/teamImport.worker.ts`, so it stays DOM-free ([Team Import](./architecture/IMPORT_TEAM.md))                                        |
| `seasonal.ts`                               | Season provenance for stored payloads ([Seasonal Content](./architecture/SEASONAL.md))                                                                                                           |

## Content and Data (`src/content/`, `src/data/`, `src/locales/`)

- `src/content/page/<Name>.<lang>.vue` (en, zh): page prose, resolved by `useContentComponent`
- `src/content/skill/<slug>/`: optional per-hero snippet component per language plus `<Name>.data.ts` grid styles; skill text for all 16 locales lives in `src/locales/skill/<lang>/`
- `src/data/` JSON (arena, artifact, character, import, seasonal) and `src/locales/` dictionaries load through `src/utils/dataLoader.ts`
- Skill pages, guide pages, `/`, `/share`, and `/skills` are pre-rendered by vite-ssg ([Pre-Rendering](./architecture/PRE_RENDERING.md))

## Utilities (`src/utils/`)

- **Two serialization formats**: binary (`binaryEncoder.ts`) carries every `?g=` link and the Arena autosave; JSON (`urlStateManager.ts`) carries the saved-team library, mode slots, and export files. Links never use JSON ([URL Serialization](./architecture/URL_SERIALIZATION.md))
- **Season stamping**: every serialized `MultiGridState` carries `season`, the current season is the max `season` across loaded seasonal data, and a stale payload's seasonal references are masked on display and stripped before reaching a board (`lib/seasonal.ts`). `seasonRotation.ts` re-aligns the stampless Arena autosave once per cutover; `upgradeMigration.ts` is a temporary shim whose header carries its removal runbook ([Seasonal Content](./architecture/SEASONAL.md))
- **Viewport reads**: `viewport.ts` owns every window-size read; ESLint bans `window.innerWidth`/`innerHeight` elsewhere because they include classic scrollbars that fixed overlays are not laid out against

## Related Documentation

- [`/docs/architecture/GRID.md`](./architecture/GRID.md) - Grid & character system, transactions
- [`/docs/architecture/TEAMS.md`](./architecture/TEAMS.md) - Teams page: modes, boards, saved-team library
- [`/docs/architecture/IMPORT_TEAM.md`](./architecture/IMPORT_TEAM.md) - Team import: match screenshot readers, review, plan
- [`/docs/architecture/SEASONAL.md`](./architecture/SEASONAL.md) - Phantimals, seasonal artifacts, and charms
- [`/docs/architecture/SKILLS.md`](./architecture/SKILLS.md) - Skill system implementation
- [`/docs/architecture/skills/COMPANION.md`](./architecture/skills/COMPANION.md) - Companion skills
- [`/docs/architecture/skills/TARGETING.md`](./architecture/skills/TARGETING.md) - Targeting skills
- [`/docs/architecture/PATHFINDING.md`](./architecture/PATHFINDING.md) - Pathfinding algorithms
- [`/docs/architecture/PRE_RENDERING.md`](./architecture/PRE_RENDERING.md) - SSG pre-rendering
- [`/docs/architecture/DRAG_AND_DROP.md`](./architecture/DRAG_AND_DROP.md) - Multi-layer drag system
- [`/docs/architecture/EVENT_SYSTEM.md`](./architecture/EVENT_SYSTEM.md) - Event communication
- [`/docs/architecture/URL_SERIALIZATION.md`](./architecture/URL_SERIALIZATION.md) - State sharing and storage formats
- [`/docs/architecture/MAP_EDITOR.md`](./architecture/MAP_EDITOR.md) - Map creation tools
