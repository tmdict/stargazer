# Map Editor

## Overview

The Map Editor (the Arena's Maps tab) paints hex tile states directly on the live grid: click-to-paint and throttled drag-to-paint behind an opt-in "Edit tiles" toggle, plus Fill, Clear, and a preset arena picker. Painting is stateless beyond the grid itself, so a painted map is shared and persisted like any other board.

## Design Principles

1. **Direct Manipulation**: Click or drag to paint hex states immediately
2. **Opt-in Painting**: The Maps tab places characters like any other tab until the editor toggle is on
3. **Store Owns Mutation**: Every paint goes through `useMapEditorStore`, which keeps tile state and character occupancy consistent
4. **Performance**: Drag painting is throttled and deduplicated per drag session
5. **Visual Consistency**: Palette swatches use the grid's own tile fills

## Core Components

### MapEditor (`/src/components/MapEditor.vue`)

The panel: an `enabled` v-model toggle, a five-swatch state palette, Fill / Clear actions, and the preset picker (`ArenaPreviewGrid`). It holds only the selected state and emits intent:

```typescript
const emit = defineEmits<{
  stateSelected: [state: State]
  applyAllTiles: [state: State] // Fill
  resetMap: [] // Clear
  arenaSelected: [mapKey: string] // preset picker
}>()
```

### HomeView (`/src/views/HomeView.vue`)

Owns `selectedMapEditorState` and `editorEnabled`; `mapEditorActive` is both the Maps tab and the toggle. While active, grid info and team view are forced off (painting is incompatible with both), the team-view toggle is disabled, and the team controls (Clear all) and Syn toggle are hidden. `arenaSelected` goes to `gridStore.switchMap`.

### MapEditor Store (`/src/stores/mapEditor.ts`)

Actions only, no state of its own:

```typescript
setHexState(hexId, state) // removes the occupant of an OCCUPIED tile, then sets the state
resetAllHexesToState(state) // Fill: clears every character, sets every tile
resetToCurrentMap() // Clear: back to the current map config's tile states
```

## State Palette

- **DEFAULT**: Empty
- **AVAILABLE_ALLY**: Ally tile
- **AVAILABLE_ENEMY**: Enemy tile
- **BLOCKED**: Blocked
- **BLOCKED_BREAKABLE**: Breakable

Occupied states are not paintable: they arise from placing characters on available tiles.

## Interaction Modes

Both run only while `isMapEditorMode` is passed down to the grid.

### Click-to-Paint

`GridManager`'s `hex:click` handler routes to `setHexState` before any placement logic, so a click never opens the character popup in editor mode.

### Drag-to-Paint

In `GridTiles`: mouse down starts a session and clears the painted set; each hex entered paints once per session (`paintedHexes`) and no more often than `PAINT_THROTTLE_MS` (50 ms); mouse up or leaving the board ends the session. `onBeforeUnmount` clears the session state.

## Visual Feedback

- **Palette swatches**: hex previews filled by `getTileFillColor` (`/src/utils/tileStateFormatting.ts`), the same fills the grid renders
- **Hover**: the grid's normal hover highlight shows the hex about to be painted
- **Preset picker**: `ArenaPreviewGrid` thumbnails via `BoardThumbnail` (see [Teams](./TEAMS.md), Thumbnails)
