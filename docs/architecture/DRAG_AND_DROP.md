# Drag and Drop System

## Overview

The drag and drop system enables intuitive character placement through native HTML5 drag events combined with SVG coordinate detection. Drag state lives in a module-singleton composable (`useDragDrop`); a thin provider component scopes the document-level listeners and exposes a typed registration channel for the grid's hex detection. A two-phase detection system gives accurate hex targeting.

## Design Principles

1. **Multi-Layer Architecture**: Separates visual, interactive, and event layers for independent control
2. **Hybrid Detection**: Combines SVG events with position-based verification
3. **Visual Feedback**: Immediate hover states and clear drop zone indicators
4. **Native HTML5**: Uses browser drag API with custom data transfer
5. **Z-Order Management**: Strategic layer ordering solves event blocking issues

## Core Components

### DragDropProvider (`/src/components/DragDropProvider.vue`)

Thin lifecycle wrapper around the drag UI. It owns the document-level
`drop`/`dragover`/`mousemove` listeners (its global `dragover` calls
`preventDefault()`, which makes the page a drop target — that must not outlive
the drag UI, so it is mount-scoped rather than module state), and it provides
the typed registration channel:

```typescript
// provided under a typed InjectionKey (useDragDrop.ts), consumed via
// useDragDropRegistration(), which throws outside a DragDropProvider.
// Each board registers under its own gridId so multiple boards coexist;
// the provider probes every detector to find the board (and hex) under
// the pointer.
interface DragDropRegistration {
  registerHexDetector: (gridId: number, detector: HexDetector) => void
  unregisterHexDetector: (gridId: number) => void
  registerDropHandler: (gridId: number, handler: DropHandler) => void
  unregisterDropHandler: (gridId: number) => void
}
```

GridManager registers its pointer→hex detector (built on the SVG element that
GridTiles exposes via `defineExpose`) and its drop handler on mount, skipping
both in readonly grids, and unregisters on unmount. All other drag state and
actions come straight from `useDragDrop()`; components don't inject them.

### useDragDrop Composable (`/src/composables/useDragDrop.ts`)

Core state and logic, as module-level singletons: at most one drag exists at a
time, and the document listener add/remove pairs must share function identity
no matter which component starts or ends the drag. `startDrag` also attaches a
once-only document `dragend` listener as a safety net — if the source element's
own `@dragend` binding is gone when the drag ends, state still resets and the
ghost preview can't get stuck. `endDrag` records the drop tile in
`lastDropHexId`, which GridTiles consumes (read + clear) to restore the hover
highlight after its post-drag grace period.

The safety net depends on `dragend` bubbling to the document, which requires
the drag _source node_ to still be attached (or detach as part of a subtree
whose root carries the `@dragend` binding) when the drag ends. Browsers pick
the innermost draggable element as the source, and images are draggable by
default — so inner `<img>`s in grid drag wrappers must set `draggable="false"`
to keep the keyed wrapper as the source. Otherwise a drop that replaces the
image node mid-drag (e.g. a character↔phantimal swap flipping a `v-if` branch)
orphans the source, `dragend` never reaches any listener, and the ghost
freezes.

```typescript
// Key functions exposed
startDrag(event, character, characterId, imageSrc)
handleDragOver(event)
handleDrop(event, hexId)
endDrag(event)
```

### Multi-Layer Architecture

The GridManager orchestrates multiple independent layers to solve complex rendering and event handling challenges:

```
GridManager (Orchestrator)
├── GridTiles (SVG base with event detection)
│   ├── Regular Hexes (visual layer 1)
│   ├── Elevated Hexes (visual layer 2)
│   └── Invisible Event Layer (topmost)
├── GridArtifacts (HTML overlay - behind characters)
├── GridCharacters (HTML overlay)
├── GridArrows (SVG overlay)
├── SkillTargeting (SVG overlay)
└── PathfindingDebug (conditional)
```

**GridTiles Internal Structure:**

```
┌─────────────────────────────────────────────────┐
│            GridTiles SVG Container              │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Layer 1: Regular Hexes (background)       │  │
│  │ - Unoccupied tiles                        │  │
│  │ - Visual representation only              │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Layer 2: Elevated Hexes (mid-ground)      │  │
│  │ - Occupied tiles with different styling   │  │
│  │ - Still purely visual                     │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │ Layer 3: Event Capture (invisible top)    │  │
│  │ - Transparent polygons                    │  │
│  │ - Captures all mouse/drag events          │  │
│  │ - MUST be rendered last (topmost)         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘

[GridArtifacts, GridCharacters, GridArrows, SkillTargeting
 render above with selective pointer-events control]
```

This architecture separates responsibilities: SVG handles tile rendering and base events, HTML overlays handle interactive elements, and the invisible layer ensures reliable event capture.

### Hex Detection System

Dual detection systems work together for robust drag handling:

1. **Position-Based Detection (Primary)**: GridManager uses point-in-polygon algorithm for accurate boundaries
2. **SVG Event Capture (Secondary)**: Invisible layer in GridTiles provides immediate event feedback

```typescript
// Layer 3 handles all events
<polygon
  v-for="hex in hexes"
  fill="transparent"       // Invisible
  @dragover="handleHexDragOver($event, hex)"
  @drop="handleHexDrop($event, hex)"
/>
```

## Drag Sources

### Character Selection Panel

Characters dragged from roster:

- Custom MIME type: `application/character`
- Includes character metadata
- No source hex (new placement)

### Grid Characters

Characters dragged from existing positions:

- Includes `sourceHexId` for move/swap
- Preserves team assignment
- Enables position tracking

## Drop Operations

### Placement Types

**New Placement**:

- From selection panel to grid
- Auto-assigns team based on tile
- Validates team capacity

**Move Operation**:

- From one hex to empty hex
- Preserves character team
- Updates position atomically

**Swap Operation**:

- Between two occupied hexes
- Exchanges positions
- Maintains consistency

### Validation Flow

```typescript
function validateDrop(hexId: number, character: CharacterType): boolean {
  const tile = grid.getTile(hexId)

  // Check tile accepts placement
  if (!canAcceptCharacter(tile.state)) return false

  // Check team capacity
  if (!hasTeamSpace(character, tile.team)) return false

  // Check for duplicates
  if (isDuplicate(character, tile.team)) return false

  return true
}
```

### Cross-board drag (multigrid)

On a multi-board page (the Teams "5 v 5" view) a drag can end on a different board than it started. Each dragged character carries its `sourceGridId`, and the drop routes through `useGrids.routeDrop(payload, targetGridId, targetHexId)`.

Every drop first passes `canDropCharacter(characterId, sourceGridId, sourceHexId, targetCtxId, targetHexId)`, the routing-layer gate covering page-wide per-team uniqueness (including same-board cross-team moves and swaps), companions staying on their main's board, destination capacity, and phantimal faction. GridTiles reads the same gate for the drag-hover cue, so hover and drop agree for every routing-layer rule. The engine's per-grid checks still have the last word at drop time: the gate's same-board leg checks only the page-wide rule, so a same-board engine rejection (a full team on a team change, a companion changing teams, a phantimal cross-team swap) or a mid-transaction failure resolves as a silent no-op. Paragon levels move with a hero across boards.

- **Roster or same-board drop**: handled by the target board's own context (place / move / swap).
- **Cross-board drop**: a compensating transaction across two `Grid` instances (remove from the source, place on the target, restore the source on failure), since the single-board atomic `move.ts` wrapper can't span two grids. Dropping onto an occupied cell is a paired swap with the same envelope.

A successful drop of any kind (including a roster drop) makes the target board active. Drop handlers register by `gridId`, so every board's `GridManager` resolves hovers/drops against its own context (see the multigrid section in [`GRID.md`](./GRID.md)).

### Artifact drag (cross-team / cross-board)

Artifacts live in off-grid host cells (`GridArtifacts`), not on grid hexes, so they bypass the hex-detection pipeline entirely and use native element-level drag instead. A filled artifact icon is the drag source; an empty host-cell polygon and a filled icon are the drop targets (the same two-surface split as the click affordances, with the inner `<img>` set `draggable="false"` so the keyed wrapper stays the source). The drag carries `{ sourceCtxId, sourceTeam }` (engine team, not the invert-derived display team) under a distinct `application/artifact` MIME. Because `dataTransfer` data is unreadable during `dragover`, the in-flight payload is also mirrored in `useDragDrop`'s `artifactDragPayload`: a target the router would reject refuses the drop at `dragover` (native not-allowed cursor plus an `invalid-drop` cue), and an accepted drop calls `stopPropagation()` so it never reaches the character pipeline's global drop.

`useGrids.routeArtifactDrop(payload, targetCtxId, targetTeam)` resolves every drop with one rule (`resolveArtifactDrop`, also exposed as the `canDropArtifact` predicate driving the drag-over feedback), identical on the Arena (1 board) and Teams (5 boards): an empty target moves, an occupied target swaps, and page-wide per-team uniqueness (`isArtifactUsed`) is re-checked only when the team changes, excluding each artifact's **destination** board so a copy on the other team of either board still counts. A rejected drop is a silent no-op; a successful one makes the target board active. Team view renders one slot per board, so cross-team artifact swaps are structurally unavailable there.

## Layer Implementation Details

### Component Responsibilities

**GridManager**: Orchestrates all layers and registers position-based detection
**GridTiles**: Renders hexes with three-layer SVG structure and invisible events
**GridArtifacts**: Shows team artifacts in their host cells, dashed cells beside grid cells 1 (ally) and 45 (enemy): outside the grid simulation and the hex pipeline, with their own artifact drag surfaces (renders before characters)
**GridCharacters**: Positions character portraits with absolute positioning
**GridArrows**: Displays pathfinding visualization with SVG arrows
**SkillTargeting**: Shows skill-specific targeting arrows (e.g., Silvina's First Strike)

### Visual Layer Separation

```typescript
// Hexes split into two visual groups for z-order control
const regularHexes = computed(() => hexes.filter((hex) => !isOccupied(hex)))
const elevatedHexes = computed(() => hexes.filter((hex) => isOccupied(hex)))
```

This separation allows occupied tiles to render above empty ones, creating visual hierarchy without blocking events.

### Event Layer Strategy

The invisible event layer solves a critical problem:

1. **Problem**: Character images block hex drag events
2. **Traditional Solution**: Complex event bubbling/capturing
3. **Our Solution**: Separate invisible event layer on top

```vue
<!-- Characters have pointer-events disabled -->
<div class="character" style="pointer-events: none">
  <!-- Visual elements -->
</div>

<!-- Event layer captures everything -->
<polygon fill="transparent" @drop="handleDrop" />
```

## Visual Feedback

### Hover States

Dynamic CSS classes applied to the event layer:

- `.drag-hover` - Active drag over hex
- `.valid-drop` - Placement allowed
- `.invalid-drop` - Placement blocked
- `.occupied` - Contains character

### Hover Race Condition Fix

Prevents immediate hover after drag end:

```typescript
const blockHover = ref(false)

watchEffect(() => {
  if (isDragging.value) {
    blockHover.value = true
  } else if (blockHover.value) {
    setTimeout(() => (blockHover.value = false), 100)
  }
})
```

### Drag Preview

Floating character portrait that follows cursor:

- Semi-transparent overlay
- Positioned at cursor with offset
- Hidden immediately on drop

## Event Flow

### Drag Lifecycle

1. **dragstart**: Capture character data, show preview
2. **dragover**: Detect hex, update hover state
3. **drop**: Validate and execute operation
4. **dragend**: Clean up state, hide preview

### Data Transfer

Custom data format prevents conflicts:

```typescript
const CHARACTER_MIME_TYPE = 'application/character'

// Transfer structure
interface DragData {
  character: CharacterType // carries sourceHexId/sourceGridId for moves/swaps
  characterId: number
}
```

## Integration Points

### Grid System

- Queries tile states for validation
- Executes character operations
- Maintains position consistency

### Character Store

- Checks team capacity
- Updates character placements
- Triggers reactive updates

### Event System

- Emits character placement events
- Coordinates with hex click handlers
- Manages state transitions

## Performance Optimizations

- **Throttled Updates**: Mouse position tracked at 60fps max
- **Event Delegation**: Single set of global listeners
- **Conditional Rendering**: Preview only shown when dragging
- **Cached Calculations**: Hex boundaries computed once
- **Reactive State Optimization**: Character store uses granular computed properties to minimize recalculations during drag

## Browser Compatibility

- **HTML5 Drag API**: Supported in all modern browsers (mouse-only — `dataTransfer` doesn't fire on touch)
- **SVG Events**: Pointer events with proper configuration
- **Touch**: Drag is desktop-only; mobile placement is tap-based instead (tap a tile to target it, then tap a roster character) — see [GRID.md](./GRID.md#placement-interaction-desktop-vs-mobile)
- **Fallback Handling**: Graceful degradation for older browsers
