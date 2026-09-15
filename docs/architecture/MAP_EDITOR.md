# Map Editor

## Overview

The Map Editor (the Arena's Maps tab) paints hex tile states directly on the live grid: click-to-paint and throttled drag-to-paint behind an opt-in "Edit Tiles" toggle, plus Fill, Clear, and a preset arena picker. Painting is stateless beyond the grid itself, so a painted map is shared and persisted like any other board.

## Design Principles

1. **Direct Manipulation**: Click or drag to paint hex states immediately
2. **Opt-in Painting**: The Maps tab places characters like any other tab until the editor toggle is on; the palette and actions are disabled until then
3. **Store Owns Mutation**: Every paint goes through `useMapEditorStore`, which keeps tile state, character occupancy, and skill paint consistent
4. **Throttled Drag**: Drag painting is throttled and deduplicated per drag session
5. **Visual Consistency**: Palette swatches use the grid's own tile fills

## Core Components

### MapEditor (`/src/components/MapEditor.vue`)

The panel: an `enabled` v-model toggle, a five-swatch palette (DEFAULT, AVAILABLE_ALLY, AVAILABLE_ENEMY, BLOCKED, BLOCKED_BREAKABLE), Fill / Clear actions, and the preset picker (`ArenaPreviewGrid`). Occupied states are not paintable: they arise from placing characters on available tiles. The panel holds only the selected state and emits intent:

```typescript
const emit = defineEmits<{
  stateSelected: [state: State]
  applyAllTiles: [state: State] // Fill
  resetMap: [] // Clear
  arenaSelected: [mapKey: string] // preset picker
}>()
```

### HomeView (`/src/views/HomeView.vue`)

Owns `selectedMapEditorState` and `editorEnabled`; `mapEditorActive` is both the Maps tab and the toggle, and is what the grid receives as `isMapEditorMode`. While active:

- **Team view**: forced off when the editor turns on (not on tab entry, so placing characters on the Maps tab keeps it), and its toggle is disabled
- **Grid info**: suppressed view-level (the effective `info` object is `GRID_INFO_NONE`; the pref is never written) and the Grid Info chip is hidden
- **Team controls**: Clear all and the Syn toggle are hidden
- **Presets**: `arenaSelected` goes to `gridStore.switchMap`

### MapEditor Store (`/src/stores/mapEditor.ts`)

Actions only, no state of its own:

- **`setHexState(hexId, state)`**: removes the occupant of an OCCUPIED tile first (its team could change under it), sets the state, then refreshes the board's skills, because terrain-aware skill paint (zone membership, blocked tiles) is not recomputed by a tile edit on its own
- **`resetAllHexesToState(state)`** (Fill): clears every character, then sets every tile
- **`resetToCurrentMap()`** (Clear): clears every character, resets every tile to DEFAULT, then applies the current map key's config

## Presets and Persistence

- **Presets** (`/src/lib/maps.ts`): `MAPS` is keyed by filename under `/src/data/arena/`; each JSON's `ally` / `enemy` / `blocked` / `breakable` id lists become a `MapConfig` of `{ type: State, hex: number[] }` entries
- **Switching**: `switchMap` rebuilds the grid from the config, so placed characters, upgrade attrs, and skill state are dropped
- **Serialization**: links and the persisted board share one serializer, which emits every non-default tile as `[hexId, state]`, so an edited layout round-trips exactly (see [URL Serialization](./URL_SERIALIZATION.md))
- **Restore**: a payload without a map key is matched to a preset by its tiles (`findMapByTiles`); an edited layout matches none and leaves the board's current map key as it is, which is what Clear returns to

## Interaction Modes

Both run only while `isMapEditorMode` is passed down to the grid.

### Click-to-Paint

`GridManager`'s `hex:click` handler routes to `setHexState` before any placement logic, so a click never opens the character popup in editor mode.

### Drag-to-Paint

In `GridTiles`: mouse down on the board SVG starts a session and clears the painted set; each hex entered paints once per session (`paintedHexes`) and no more often than `PAINT_THROTTLE_MS` (50 ms); mouse up or leaving the SVG ends the session, and `onBeforeUnmount` clears it. A hex crossed inside the throttle window is skipped rather than queued, so re-entering it paints.

## Visual Feedback

- **Palette swatches**: hex previews filled by `getTileFillColor` (`/src/utils/tileStateFormatting.ts`), the same fills the grid renders
- **Hover**: the grid's normal hover highlight shows the hex about to be painted
- **Preset picker**: `ArenaPreviewGrid` thumbnails via `BoardThumbnail` (see [Teams](./TEAMS.md), Thumbnails)
