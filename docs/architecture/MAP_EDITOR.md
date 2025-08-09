# Map Editor

## Overview

The Map Editor provides intuitive hex painting for creating game maps. It features click-to-paint and drag-to-paint with performance optimizations for smooth editing.

## Design Principles

1. **Direct Manipulation**: Click or drag to paint hex states immediately
2. **State-Based Design**: Each hex has a gameplay state that determines behavior
3. **Performance Optimized**: Throttled updates prevent lag during rapid painting
4. **Character Aware**: Automatically removes characters when painting over them
5. **Visual Consistency**: Editor colors match gameplay for clarity

## Core Components

### MapEditor Component (`/src/components/MapEditor.vue`)

UI for state selection and clear operations:

```typescript
// State palette with visual previews
emit('stateSelected', state)
emit('clearMap')
```

### MapEditor Store (`/src/stores/mapEditor.ts`)

Manages editor state and hex operations:

```typescript
interface MapEditorState {
  selectedState: State
  isActive: boolean
}
```

## State Types

Available hex states for painting:

- **DEFAULT**: Neutral unoccupied hex
- **BLOCKED**: Impassable terrain
- **AVAILABLE_ALLY**: Ally placement zone
- **AVAILABLE_ENEMY**: Enemy placement zone
- **OCCUPIED_ALLY**: Pre-placed ally character
- **OCCUPIED_ENEMY**: Pre-placed enemy character

## Interaction Modes

### Click-to-Paint

Single hex modification:

1. Select state from palette
2. Click hex to paint
3. Character removed if present
4. State updates immediately

### Drag-to-Paint

Continuous painting implementation:

```typescript
const isMapEditorDragging = ref(false)
const paintedHexes = ref(new Set<number>())
const PAINT_THROTTLE_MS = 50

// Throttled painting
if (now - lastPaintTime >= PAINT_THROTTLE_MS) {
  mapEditorStore.setHexState(hexId, selectedState)
  paintedHexes.value.add(hexId)
  lastPaintTime = now
}
```

Process:

1. Mouse down starts session
2. Drag paints hexes with throttling
3. Duplicate prevention via Set
4. Mouse up ends session

## State Management

### Hex Updates

```typescript
setHexState(hexId: number, state: State): boolean {
  if (grid.hasCharacter(hexId)) {
    grid.removeCharacter(hexId)
  }
  grid.setState(hexId, state)
  return true
}
```

### Clear Map

Resets entire grid to default state, removing all characters and artifacts.

## Performance Optimizations

- **50ms Throttle**: Prevents excessive updates during drag
- **Session Tracking**: Set prevents duplicate paints per session
- **Batch Updates**: Vue reactivity batches DOM changes
- **Memory Cleanup**: Clear sets on unmount

## Visual Feedback

- **Crosshair Cursor**: Indicates editor mode
- **State Colors**: Match gameplay for consistency
- **Hover Highlights**: Show paintable hexes
