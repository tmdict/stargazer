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

Pure functional algorithms (A\* and BFS) for movement calculation and target selection. Features LRU caching and deterministic tie-breaking for consistent gameplay.

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

- `useStateReset`: Cross-store orchestration for clearing state
- `useSelectionState`: Shared team selection state
- `useDragDrop`: Global drag state management
- `useGridEvents`: Event system using provide/inject pattern
- `useBreakpoint`: Responsive breakpoint detection
- `useOverlay`: Escape + click-outside-to-close for modal-style surfaces
- `useCharacterFilters`: Shared faction/class/damage/tag filter state for the Characters tab and `/skills`
- `useSkillSearch`: Lazy per-language skill-text index for the skill browser (`/skills` + skill permalinks)
- `useLocaleToggle`: Language switch that navigates between `/en`↔`/zh` URLs on locale-prefixed routes, otherwise flips the global locale

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
- `Pathfinding`: A\* and BFS algorithms with caching
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
    ├── GridArrows (SVG overlay)
    └── SkillTargeting (SVG overlay)
```

GridArtifacts renders before GridCharacters in the DOM, ensuring that enemy artifacts appear behind character icons when they overlap in perspective view, while ally artifacts naturally avoid overlap due to their corner positioning. Skill-highlighted hexes render above elevated hexes to ensure skill borders are always visible. SkillTargeting renders above arrows for targeting skills like Silvina's First Strike.

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

- **LRU Caching**: Pathfinding results cached to avoid recalculation
- **Cache Invalidation Batching**: Transaction-based operations trigger single cache clear instead of multiple
- **Lazy Evaluation**: Computed properties calculate only when needed
- **Granular Reactive State**: Character store uses separate computed properties to minimize unnecessary recalculations
- **Layer Independence**: Each rendering layer updates separately
- **Throttled Events**: Map editor drag-paint throttled to 50ms

## Related Documentation

- [`/docs/architecture/GRID.md`](./architecture/GRID.md) - Grid & character system details
- [`/docs/architecture/SKILLS.md`](./architecture/SKILLS.md) - Skill system implementation
- [`/docs/architecture/PATHFINDING.md`](./architecture/PATHFINDING.md) - Pathfinding algorithms
- [`/docs/architecture/PRE_RENDERING.md`](./architecture/PRE_RENDERING.md) - SSG/pre-rendering implementation
- [`/docs/architecture/DRAG_AND_DROP.md`](./architecture/DRAG_AND_DROP.md) - Multi-layer drag system
- [`/docs/architecture/EVENT_SYSTEM.md`](./architecture/EVENT_SYSTEM.md) - Event communication
- [`/docs/architecture/URL_SERIALIZATION.md`](./architecture/URL_SERIALIZATION.md) - State sharing
- [`/docs/architecture/MAP_EDITOR.md`](./architecture/MAP_EDITOR.md) - Map creation tools
