# Architecture Overview

## Introduction

Stargazer is an AFK Journey arena simulator built with Vue 3 and TypeScript. The architecture maintains a framework-agnostic core domain layer, ensuring game logic remains portable and testable while leveraging Vue's reactivity for the UI.

## Design Principles

1. **Framework Agnostic Core**: Game logic in pure TypeScript, independent of Vue or any UI framework
2. **Separation of Concerns**: Clear boundaries between UI, state management, business logic, and utilities
3. **Atomic Operations**: Transaction pattern ensures complex state changes are all-or-nothing
4. **Unidirectional Data Flow**: Predictable state changes from UI → Store → Domain → State
5. **Multi-Layer Rendering**: Solves SVG limitations through independent visual and event layers

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    UI Components Layer                      │
│                                                             │
│  ┌──────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │ GridManager  │  │ Characters  │  │  Map Editor      │    │
│  │(Orchestrator)│  │  Selection  │  │                  │    │
│  └───────┬──────┘  └──────┬──────┘  └────────┬─────────┘    │
│          │                │                  │              │
├──────────┼────────────────┼──────────────────┼──────────────┤
│          ▼                ▼                  ▼              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Pinia Stores (State Layer)             │    │
│  │                                                     │    │
│  │  Grid Store │ Character Store │ GameData │ Artifact │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                   │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │            Domain Logic (Business Layer)            │    │
│  │                                                     │    │
│  │   Grid │ Characters │ Pathfinding │ Skills │ Hex    │    │
│  └──────────────────────┬──────────────────────────────┘    │
│                         │                                   │
├─────────────────────────┼───────────────────────────────────┤
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Utilities & Services                   │    │
│  │                                                     │    │
│  │  URL Serialization │ Binary Encoder │ Data Loading  │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Core Systems

### Grid & Characters System

Separates spatial operations (Grid) from entity management (Characters folder). Grid handles hexagonal tiles and state, while Characters manages placement, removal, movement, and team operations with automatic skill integration.

### Pathfinding System

Pure functional algorithms (A\* and BFS) for movement calculation and target selection, with deterministic tie-breaking for consistent gameplay. Results are memoized by Vue computed properties in the pathfinding store, recomputing only when relevant grid state changes.

### Skill System

Handles character abilities, visual modifiers, and companion placement. Uses composition pattern for combining multiple skill effects.

### Event System

Type-safe component communication using Vue's provide/inject pattern. Namespaced events (`hex:*`, `character:*`) enable decoupled interactions.

### Drag & Drop System

Multi-layer architecture separates visual rendering from event detection. Invisible detection layer ensures reliable hex targeting even with overlapping elements.

## Architectural Layers

### UI Layer (`/src/components/`)

Vue components with single responsibilities. Multi-layer rendering solves SVG limitations.

### Composables Layer (`/src/composables/`)

Shared reactive state and reusable Vue logic. Composables can call stores (one-way dependency) but stores must not call composables to prevent circular dependencies.

**Key Composables:**

- `useSelectionState`: Shared team selection + the mobile tap interaction state: the placement-target hex (tap an empty cell to add from the roster) and the lifted hex (tap a placed hero to move/swap it)
- `useDragDrop`: Global drag state management (desktop/mouse only: touch placement is tap-based)
- `useBottomSheet`: Pull-up sheet state: peek/expanded detents; drag-to-resize by touch **or** mouse (narrow desktop) from the handle or the content; tap-, flick-, or drag-to-toggle; and overscroll-to-collapse (swipe the content down once it's scrolled to the top). SSR-safe (CSS drives the resting layout; the composable only adds the inline `transform` once mounted). Consumed by the shared `BottomSheet` component (`components/ui/BottomSheet.vue`), which both the grid (`HomeView`) and `/skills` (`SkillsBrowser`) use for the roster column (desktop card + mobile sheet); each page slots its own content, which owns its in-sheet fill/scroll
- `useGridEvents`: Pure pub/sub bus for grid DOM events (typed InjectionKey provide/inject; see EVENT_SYSTEM.md)
- `useBreakpoint`: Responsive breakpoint detection
- `useOverlay`: Escape + click-outside-to-close for modal-style surfaces
- `useScrollLock`: Locks the page behind an open modal, ref-counted for stacked surfaces. Default strategy is `overflow: hidden` on `<html>` with scrollbar-gutter padding compensation, which keeps `window.scrollY` live for vue-router's synchronous popstate scroll snapshot; iOS/iPadOS keeps the `position: fixed` body hack (the only method it honors). Both add `overscroll-behavior: none` on `<html>` against pull-to-refresh / rubber-band. Used by `BaseModal`, `BottomSheet`, and the search overlay
- `useCharacterFilters`: Shared faction/class/damage/tag filter state for the Characters tab and `/skills`
- `useSkillSearch`: Lazy per-language skill-text index across all 16 skill locales (en/zh from the eager bundle; the rest stream in on first query), backing the global search overlay (`SkillSearchOverlay`); `matchCharacterNames` also serves the on-grid picker popup
- `useSearchOverlay`: Shared open/query/select-handler state for the search overlay; `open()` is the navigate flavor, `openSelect(handler)` the pick-a-hero flavor (arena roster placement); also exports `useShortcutLabel`, the platform-aware shortcut chip label shared by the triggers
- `useRecentHeroes`: Recently viewed skill pages (localStorage `stargazer.recentHeroes`, capped at 5), recorded by `SkillReader` and shown in the overlay's empty state
- `useLocaleToggle`: Chrome-language switch that navigates between `/en`↔`/zh` URLs on app-locale-prefixed routes, otherwise flips the global locale (non-en/zh skill prefixes parse as unprefixed, so there it flips chrome in place without rewriting the content URL)
- `useToast`: Global toast queue (success/error), rendered by the single `ToastContainer` in `App.vue` so toasts surface on every route
- `useGridExport`: Captures the grid DOM to a PNG for copy/download
- `useTouchDetection`: Module-singleton input-modality detection (touch vs mouse): gates hover tooltips
- `useHoverTooltip`: Hover-tooltip visibility with touch suppression, the contract for action triggers (tap performs the action, never shows the tooltip): roster icons, filter buttons, save actions
- `useInfoTip`: Tooltip for info-only triggers where click/tap shows it like hover does (the touch path; outside press or Escape dismisses): keyword glossary spans, info icons, confidence badges. Its header comment is the tooltip policy reference (including when native `title` suffices)
- `usePressClick`: Press-duration gate so HTML5 drags don't also fire click handlers
- `useModalLocale`: Modal-local language override (en/zh content: artifact/phantimal modals) that resets to the global locale each time the modal opens
- `useModalSkillLocale`: Skill-modal variant across all 16 skill locales: seeds from the saved globe preference and gates rendering on the locale chunk being warm

### State Layer (`/src/stores/`)

Thin reactive wrappers around domain objects using Pinia. Bridges framework-agnostic domain with Vue's reactivity.

**Key Stores:**

- `GridStore`: Reactive grid state
- `CharacterStore`: Character selection and placement
- `GameDataStore`: Character definitions and ranges

### Domain Layer (`/src/lib/`)

Pure TypeScript game logic, completely framework-agnostic. Can be tested in isolation or ported to different frameworks.

**Key Components:**

- `Grid`: Hexagonal grid with public state properties (122 lines)
- `Characters/`: Character operations folder
  - `character.ts`: Queries, team management, tile helpers
  - `place.ts`, `remove.ts`, `move.ts`, `swap.ts`: Complex operations with skills
  - `companion.ts`: Companion system helpers
  - `transaction.ts`: Atomic operation utilities
- `Pathfinding`: A\* and BFS algorithms
- `Skills`: Ability system with visual effects

### Content Layer (`/src/content/`)

Localized content components separated from UI logic. Single source of truth for all translatable content, with locale-specific files (`.en.vue`, `.zh.vue`) and shared data files (`.data.ts`). These content pages are pre-rendered at build time for SEO and performance.

**Component Architecture:**

```
GridContainer (Reusable grid wrapper)
└── GridManager
    ├── GridTiles (SVG base with 5 internal layers)
    │   ├── Regular Hexes (visual)
    │   ├── Elevated Hexes (visual)
    │   ├── Skill-Highlighted Hexes (visual, topmost)
    │   ├── Text Layer (hex IDs and coordinates)
    │   └── Event Capture (invisible)
    ├── GridArtifacts (HTML overlay)
    ├── GridCharacters (HTML overlay)
    ├── SkillTargeting (SVG overlay)
    └── GridArrows (SVG overlay, Debug tab only)
```

GridArtifacts renders before GridCharacters in the DOM, ensuring that enemy artifacts appear behind character icons when they overlap in perspective view. Artifacts sit in purely-visual host cells (dashed hexes beside grid cells 1 and 45) that are excluded from the grid simulation. Skill-highlighted hexes render above elevated hexes to ensure skill borders are always visible. GridArrows (closest-target arrows) is a debug-level visual, rendered only while the Arena's Debug tab is active and last in the layer stack so the arrows stay readable over the pathfinding debug lines.

### Utility Layer (`/src/utils/`)

Helper functions and services supporting the application.

**Key Utilities:**

- Binary encoding for URL serialization
- Data loading and asset management
- Formatting helpers for consistency

## Data Flow Patterns

### User Interaction Flow

1. Component captures user event
2. Component emits event or calls store action
3. Store delegates to domain logic
4. Domain validates and updates state
5. Reactive system updates UI

### Transaction Pattern

```typescript
grid.executeTransaction(
  operations: (() => boolean)[],
  rollbacks: (() => void)[]
): boolean
```

Ensures atomic operations - all succeed or all rollback.

## Performance Optimizations

- **Reactive Memoization**: Pathfinding target maps are Vue computed properties, recomputing only when the grid state they read changes
- **Lazy Evaluation**: Computed properties calculate only when needed
- **Granular Reactive State**: Character store uses separate computed properties to minimize unnecessary recalculations
- **Layer Independence**: Each rendering layer updates separately
- **Throttled Events**: Map editor drag-paint throttled to 50ms

## Related Documentation

- [`/docs/architecture/GRID.md`](./architecture/GRID.md) - Grid & character system details
- [`/docs/architecture/TEAMS.md`](./architecture/TEAMS.md) - Teams page: modes, boards, saved-team library
- [`/docs/architecture/SEASONAL.md`](./architecture/SEASONAL.md) - Phantimals, seasonal artifacts, and charms
- [`/docs/architecture/SKILLS.md`](./architecture/SKILLS.md) - Skill system implementation
- [`/docs/architecture/PATHFINDING.md`](./architecture/PATHFINDING.md) - Pathfinding algorithms
- [`/docs/architecture/PRE_RENDERING.md`](./architecture/PRE_RENDERING.md) - SSG/pre-rendering implementation
- [`/docs/architecture/DRAG_AND_DROP.md`](./architecture/DRAG_AND_DROP.md) - Multi-layer drag system
- [`/docs/architecture/EVENT_SYSTEM.md`](./architecture/EVENT_SYSTEM.md) - Event communication
- [`/docs/architecture/URL_SERIALIZATION.md`](./architecture/URL_SERIALIZATION.md) - State sharing
- [`/docs/architecture/MAP_EDITOR.md`](./architecture/MAP_EDITOR.md) - Map creation tools
