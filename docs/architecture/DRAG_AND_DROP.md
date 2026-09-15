# Drag and Drop

## Overview

The drag and drop system places, moves and swaps units through the native HTML5 drag API, with point-in-polygon hex detection for pointers that sit over a character portrait instead of a tile. Drag state is a module singleton (`useDragDrop`), a mount-scoped provider owns the document listeners and a per-board registration channel, and every drop (drag or tap) routes through `useGrids` so hover cues and drops share one validation gate.

## Design Principles

1. **Single in-flight drag**: State and document handlers are module singletons, so listener add/remove pairs share identity no matter which component starts or ends the drag
2. **Hybrid hex detection**: A tile's own SVG events answer directly; document-level point-in-polygon detection covers a pointer over a portrait
3. **One routing gate**: `canDropCharacter` drives both the hover cue and `routeDrop`, so hover never promises a drop the router rejects
4. **Live cells are authoritative**: Payloads carry only source coordinates; ids, teams and slots are read from the board at drop time
5. **Tap flows for touch**: HTML5 drag never fires on touch, so touch input uses tap-target and tap-lift gestures that reach the same router

## Architecture

```
GridManager (provides the event bus; registers this board's detector + drop handler)
├── GridTiles (SVG: visual hex layers, transparent event layer drawn last)
├── GridArtifacts (host-cell overlay, behind characters; own artifact drag pipeline)
├── GridCharacters (HTML portraits, pointer-events: auto; drag sources)
├── SkillTargeting (SVG overlay)
├── PathfindingDebug (Arena Debug tab only)
└── GridArrows (Grid Info's Targeting toggle; last so it stays over debug lines)
```

SVG has no z-index, so stacking inside `GridTiles` is draw order: regular hexes, elevated (occupied) hexes, skill-highlighted hexes, text, then the transparent event layer that receives every hover, click and drag event. The visual polygons carry no handlers. Portraits are HTML siblings above the SVG and keep `pointer-events: auto` so they can be dragged, which is why a drag over a portrait never reaches the event layer and needs the provider's position detection.

## Core Components

### DragDropProvider (`/src/components/DragDropProvider.vue`)

Mounted once per page (`HomeView`, `TeamsView`, `ShareView`) around both the boards and the roster. It owns the document `drop`, `dragover` and `mousemove` listeners: the global `dragover` calls `preventDefault()`, which makes the whole page a drop target, and that must not outlive the drag UI, so the listeners are mount-scoped rather than module state.

```typescript
// useDragDrop.ts; consumed via useDragDropRegistration(), which throws outside a provider
interface DragDropRegistration {
  registerHexDetector: (gridId: number, detector: HexDetector) => void
  unregisterHexDetector: (gridId: number) => void
  registerDropHandler: (gridId: number, handler: DropHandler) => void
  unregisterDropHandler: (gridId: number) => void
}
```

- **Detection**: On every `mousemove` and `dragover` during a drag, the provider probes each registered detector; the first board reporting a hex wins and `setHoveredHex(hexId, gridId)` records both
- **Fallback drop**: The document `drop` runs only when `dropHandled` is false (a tile drop sets it) and dispatches to the drop handler registered under `hoveredGridId`

### useDragDrop (`/src/composables/useDragDrop.ts`)

- **Payload**: `startDrag` writes `{ character, characterId }` under the `application/character` MIME type and sets a transparent drag image; `DragPreview` (mounted in `App.vue`) draws the ghost from `draggedCharacter` and `dragPreviewPosition` instead
- **Dragend safety net**: `startDrag` also attaches a once-only document `dragend` listener, so state resets even when the source element's own `@dragend` binding is gone by the time the drag ends; `endDrag` is idempotent because both can fire for one drag
- **Source node must stay attached**: The safety net depends on `dragend` bubbling to the document. Browsers pick the innermost draggable element as the source and images are draggable by default, so inner `<img>`s in grid drag wrappers set `draggable="false"` to keep the keyed wrapper as the source. Otherwise a drop that replaces the image node mid-drag (a character/phantimal swap flipping a `v-if` branch) orphans the source, `dragend` reaches no listener, and the ghost freezes
- **Hover handoff**: `endDrag` copies the hovered hex into `lastDropHexId`/`lastDropGridId`, which `GridTiles` consumes (read and clear) after its grace period
- **Artifact mirror**: `artifactDragPayload` mirrors the in-flight artifact payload because `dataTransfer` data is unreadable during `dragover` (only `types` is)

### GridManager (`/src/components/grid/GridManager.vue`)

- **Registration**: On mount, registers `findHexUnderMouse` and `handleDetectedHexDrop` under `ctx.id`, skipping readonly boards; unregisters on unmount so detached boards are not probed
- **Detection**: `findHexUnderMouse` converts the screen point into SVG space through the root SVG's `getScreenCTM()` (which already includes the perspective transform) and ray-casts against each hex polygon
- **Fallback drop**: `handleDetectedHexDrop` requires `hoveredHexId` and an unhandled drop, then calls `grids.routeDrop(payload, ctx.id, hoveredHexId)`
- **Tap-lift drop**: The `hex:click` subscriber sends a lifted hero to `grids.routeLiftDrop` (see [Event System](./EVENT_SYSTEM.md))

### GridTiles (`/src/components/grid/GridTiles.vue`)

- **Tile dragover**: Only for events carrying character data (`hasCharacterData`); calls `handleDragOver` and `setHoveredHex(hex, ctx.id)`
- **Tile dragleave**: Clears the hover only when position detection disagrees with the tile, because `dragleave` also fires when the pointer moves onto the portrait above the same tile
- **Tile drop**: `stopPropagation()` plus `setDropHandled(true)`, two independent guards against the provider's document `drop` processing the same event; then `grids.routeDrop`
- **Drop cue classes**: `drag-hover` (this board's hovered hex during a drag), `occupied`, `invalid-drop` (`!canDropCharacter`), plus `hover`, `targeted` (tap target) and `lifted`. A valid target is `drag-hover` without `invalid-drop`: teal for an empty tile, orange for an occupied one, red when invalid
- **Hover grace**: `blockHover` suppresses the non-drag hover while dragging and for 100 ms after, since mouse events fire as soon as `isDragging` drops and would flash a hover on the drop hex before the drag UI has cleaned up. When the timeout ends, the board whose id matches `lastDropGridId` restores the hover highlight on `lastDropHexId`

### GridCharacters (`/src/components/grid/GridCharacters.vue`)

- **Drag source**: A placed unit's payload is its base card with `id` set to the placed unit id (companion or synergy id), plus `sourceHexId` and `sourceGridId`; a phantimal sends only `{ id, sourceHexId, sourceGridId }`
- **Lift reset**: Starting a drag clears any pending lift, since a stale lift would fire on the next empty-cell tap
- **Click split**: Tap layouts and touch or pen clicks (`isTouchClick`) enter the lift flow (lift, tap again to remove, tap another hero on the same board to swap through `canDropCharacter`); a mouse click on a wide layout removes, mirroring the game

### Roster sources

`CharacterIcon` passes the roster card as is and `PhantimalSelection` passes `{ id }`; an absent `sourceHexId` is what marks a roster placement in the router.

## Drop Routing (`/src/stores/grids.ts`)

```typescript
// useGridContext.ts: routeDrop -> handleDrop reads only the source coordinates
interface CharacterDropPayload {
  character: Pick<CharacterType, 'sourceHexId' | 'sourceGridId'>
  characterId: number
}
```

Callers: `GridTiles.handleHexDrop`, `GridManager.handleDetectedHexDrop`, and `routeLiftDrop`, which builds the payload from the lifted cell so taps pass every drag gate.

1. `canDropCharacter(characterId, sourceGridId, sourceHexId, targetCtxId, targetHexId)` is the routing gate, and the same predicate the hover cue reads:
   - **Roster drop** (no source): phantimal faction (`phantimalCanJoinTeam`), or `resolvePick` non-null (the base id, or the synergy copy while Syn is on; an occupied target is judged post-vacate)
   - **Same board**: page-wide per-team uniqueness when the move or swap changes a unit's team, excluding this board; synergy heroes cannot change teams; phantimals are exempt
   - **Cross board**: companions and synergy heroes cannot leave their board; phantimal faction on each destination; uniqueness for any unit whose team changes, excluding its destination board (its occupant is the counterpart, which is vacating); a hero landing where a phantimal held no hero slot needs a free one
2. Roster and same-board drops go to `targetCtx.handleDrop`: a board-origin source swaps onto an occupied target or moves onto an empty one; a roster source places (replacing any occupant) through the same `resolveReplacement` resolver as the gate
3. Cross-board drops run `crossGridMove` or `crossGridSwap`, compensating transactions across two `Grid` instances (remove, place, restore on failure), since the single-board transaction wrappers in `move.ts` and `swap.ts` cannot span two grids. The swap places the second unit only after the first succeeds, because a placement can evict a board's phantimal, which a rollback could not restore. Upgrade attr records travel with each hero
4. A successful drop of any kind, roster drops included, makes the target board active

The engine still has the last word: `performPlace` runs `canPlaceCharacterOnTile` (tile accepts the team) and `canPlaceCharacterOnTeam` (per-board capacity and duplicates, the synergy hero's one-per-team cap). The gate's same-board leg checks only the page-wide rule, so a same-board engine rejection (a full team on a team change, a companion changing teams) or a mid-transaction failure resolves as a silent no-op with no hover warning.

## Artifact Drag (`/src/components/grid/GridArtifacts.vue`)

Artifacts live in off-grid host cells (the hexes beside cells 1 and 45, `artifactHostHex`), which hold no tile, so they bypass the hex pipeline and use element-level native drag.

- **Surfaces**: A filled icon is the source; an empty cell polygon or a filled icon is the target (the same two-surface split as the click affordances). Interactive boards on wide layouts only (`canDrag`)
- **Payload**: `{ sourceCtxId, sourceTeam }` under `application/artifact`, with no artifact id: the live slot is authoritative at drop time. `useDragDrop.artifactDragPayload` mirrors it for `dragover` checks
- **Dragover**: A target `canDropArtifact` rejects gets `stopPropagation()` without `preventDefault()`, so the native not-allowed cursor shows alongside the `invalid-drop` class and the provider's global `dragover` cannot accept it; an accepted target calls `preventDefault()`
- **Drop**: `stopPropagation()` keeps it off the provider's document drop; `routeArtifactDrop` resolves through `resolveArtifactDrop`, the same rule as the hover predicate: an empty target moves, an occupied target swaps, and per-team uniqueness (`isArtifactUsed`) is re-checked only on a team change, excluding each artifact's destination board. Identical on the Arena and the 5 v 5 page; success makes the target board active
- **Scope**: Team view renders one slot per board, so cross-team artifact swaps are structurally unavailable there. Artifacts have no tap-lift: touch adds and removes them, only a mouse drag repositions one

## Touch and Tap Flows

HTML5 drag never fires on touch, so touch interaction is tap-based on every layout, split by pointer type rather than viewport. `isTouchClick` (`/src/utils/pointer.ts`) records the last `pointerdown`/`pointerup` type document-wide in the capture phase and lets a press within the last 800 ms outrank the click's own `pointerType`, because Safari before 18.4 synthesizes tap clicks with a missing or wrong type.

- **Add**: Narrow layouts tap a tile to target it and pick from the roster sheet; wide layouts tap an empty tile for the on-grid picker
- **Move, swap, remove**: A placed hero is tap-lifted; an empty cell (same or another board) drops it through `routeLiftDrop`, so the tap passes every drag gate

Gesture details and the lift guard are in [Grid & Character](./GRID.md#placement-interaction-desktop-vs-mobile).

## Board Swap (`/src/composables/useGridSwap.ts`)

Exchanging two 5 v 5 boards is a pointer-event gesture, separate from the HTML5 pipeline, with module-singleton state for the same listener-identity reason as `useDragDrop`. One armed-source state serves three ways to pick a target:

- **Desktop drag**: Press the swap button and drag; travel under `DRAG_THRESHOLD` (6 px) stays a click, beyond it the release resolves the board under the pointer via `[data-grid-board-id]`
- **Desktop click**: Arm, then click another board's overlay
- **Tap layout**: Arm, tap a board to preview, tap it again to confirm. A release counts as a tap only under `TAP_MOVE_MAX` (10 px) of travel, so swiping the board row never selects or cancels, and the two-step keeps a far board from committing on first touch

A `pointerdown` outside every board cancels (bubble phase, since overlays stop propagation); re-pressing the armed board's own button also cancels. The commit is `grids.swapBoards`.

## Related Documentation

- [Grid & Character](./GRID.md) - Multigrid contexts, placement resolvers, tap-lift gestures
- [Event System](./EVENT_SYSTEM.md) - `hex:click` and hover events between grid layers
- [Teams](./TEAMS.md) - The 5 v 5 page that hosts cross-board drags and board swaps
