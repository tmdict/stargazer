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
│  │   Grid │ Character │ Pathfinding │ Skills │ Hex     │    │
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

### Grid & Character System

Manages hexagonal tiles, character positions, and state transitions with atomic transactions. Integrates automatic skill activation and companion management.

### Pathfinding System

Pure functional algorithms (A\* and BFS) for movement calculation and target selection. Features LRU caching and deterministic tie-breaking for consistent gameplay.

### Skill System

Handles character abilities, visual modifiers, and companion placement. Uses composition pattern for combining multiple skill effects.

### Event System

Type-safe component communication using Vue's provide/inject pattern. Namespaced events (`hex:*`, `character:*`) enable decoupled interactions.

### Drag & Drop System

Multi-layer architecture separates visual rendering from event detection. Invisible detection layer ensures reliable hex targeting even with overlapping elements.

## Architectural Layers

### Domain Layer (`/src/lib/`)

Pure TypeScript game logic, completely framework-agnostic. Can be tested in isolation or ported to different frameworks.

**Key Components:**

- `Grid`: Hexagonal grid with transaction support
- `Pathfinding`: A\* and BFS algorithms with caching
- `Character`: Placement and team management
- `Skills`: Ability system with visual effects

### State Layer (`/src/stores/`)

Thin reactive wrappers around domain objects using Pinia. Bridges framework-agnostic domain with Vue's reactivity.

**Key Stores:**

- `GridStore`: Reactive grid state
- `CharacterStore`: Character selection and placement
- `GameDataStore`: Character definitions and ranges

### UI Layer (`/src/components/`)

Vue components with single responsibilities. Multi-layer rendering solves SVG limitations.

**Component Architecture:**

```
GridManager
├── GridTiles (SVG base with 3 internal layers)
│   ├── Regular Hexes (visual)
│   ├── Elevated Hexes (visual)
│   └── Event Capture (invisible)
├── GridArtifacts (HTML overlay)
├── GridCharacters (HTML overlay)
└── GridArrows (SVG overlay)
```

GridArtifacts renders before GridCharacters in the DOM, ensuring that enemy artifacts appear behind character icons when they overlap in perspective view, while ally artifacts naturally avoid overlap due to their corner positioning.

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
- **Lazy Evaluation**: Computed properties calculate only when needed
- **Layer Independence**: Each rendering layer updates separately
- **Throttled Events**: Map editor drag-paint throttled to 50ms

## Type Safety Strategy

- Strict TypeScript with no `any` types
- Comprehensive interfaces for all domain models
- Typed event system with compile-time checking
- Strict null checks preventing runtime errors

## Module Organization

```
src/
├── lib/              # Domain logic
│   ├── types/        # Type definitions
│   ├── skills/       # Skill implementations
│   └── arena/        # Map configurations
├── stores/           # Pinia state
├── components/       # Vue components
├── composables/      # Vue composition API
├── utils/            # Helper utilities
└── views/            # Page components
```

## Related Documentation

- [`/docs/architecture/GRID.md`](./architecture/GRID.md) - Grid & character system details
- [`/docs/architecture/SKILLS.md`](./architecture/SKILLS.md) - Skill system implementation
- [`/docs/architecture/PATHFINDING.md`](./architecture/PATHFINDING.md) - Pathfinding algorithms
- [`/docs/architecture/DRAG_AND_DROP.md`](./architecture/DRAG_AND_DROP.md) - Multi-layer drag system
- [`/docs/architecture/EVENT_SYSTEM.md`](./architecture/EVENT_SYSTEM.md) - Event communication
- [`/docs/architecture/URL_SERIALIZATION.md`](./architecture/URL_SERIALIZATION.md) - State sharing
- [`/docs/architecture/MAP_EDITOR.md`](./architecture/MAP_EDITOR.md) - Map creation tools
