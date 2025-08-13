# Drag and Drop System

## Overview

The drag and drop system enables intuitive character placement through native HTML5 drag events combined with SVG coordinate detection. It uses Vue 3's provide/inject pattern for global state management and implements a two-phase detection system for accurate hex targeting.

## Design Principles

1. **Multi-Layer Architecture**: Separates visual, interactive, and event layers for independent control
2. **Hybrid Detection**: Combines SVG events with position-based verification
3. **Visual Feedback**: Immediate hover states and clear drop zone indicators
4. **Native HTML5**: Uses browser drag API with custom data transfer
5. **Z-Order Management**: Strategic layer ordering solves event blocking issues

## Core Components

### DragDropProvider (`/src/components/DragDropProvider.vue`)

Global state provider that wraps the application:

```typescript
interface DragDropState {
  draggedCharacter: Ref<CharacterType | null>
  isDragging: Ref<boolean>
  hoveredHexId: Ref<number | null>
  dropHandled: Ref<boolean>
}
```

Key features:

- **Global event listeners** for drag operations
- **Drag preview component** that follows cursor
- **State injection** via Vue's provide/inject

### useDragDrop Composable (`/src/composables/useDragDrop.ts`)

Core logic for drag and drop operations:

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

## Layer Implementation Details

### Component Responsibilities

**GridManager**: Orchestrates all layers and registers position-based detection
**GridTiles**: Renders hexes with three-layer SVG structure and invisible events
**GridArtifacts**: Shows team artifacts in fixed corner positions (renders before characters)
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
const CHAR_DATA_TYPE = 'application/x-stargazer-character'

// Transfer structure
interface DragData {
  character: CharacterType
  sourceHexId?: number // Present for moves/swaps
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
- **Cache Invalidation Batching**: Drop operations benefit from transaction-level cache batching

## Browser Compatibility

- **HTML5 Drag API**: Supported in all modern browsers
- **SVG Events**: Pointer events with proper configuration
- **Touch Support**: Planned enhancement for mobile
- **Fallback Handling**: Graceful degradation for older browsers
