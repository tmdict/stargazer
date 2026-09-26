# Board Input

Units reach a board and move around it through mouse drags, touch taps and clicks. All of them end in the same drop router in `useGrids` (`src/stores/grids.ts`), so a drag, a tap and the hover cue before a drop apply the same rules.

Two things make this harder than it looks. HTML5 drag never fires on touch, so every drag gesture needs a tap equivalent. And the tiles are SVG while the portraits standing on them are HTML, so a pointer over a portrait never reaches the tile beneath it.

## Layers

```
GridManager                       event bus, drop handler, hex detector
├── GridTiles                     SVG, stacked by draw order:
│   ├── regular hexes
│   ├── occupied hexes
│   ├── skill-highlighted hexes
│   ├── tile text
│   └── event layer               transparent, takes every tile event
├── GridArtifacts                 artifact cells, own native drag
├── GridCharacters                HTML portraits, the drag sources
├── SkillTargeting                SVG overlay
├── PathfindingDebug              Arena Debug tab only
└── GridArrows                    last, above the debug lines
```

SVG has no z-index, so `GridTiles` stacks its layers by draw order. The visual polygons carry no handlers. The transparent event layer is drawn last and receives every hover, click, drag and drop on the tiles. Portraits sit above the whole SVG and keep `pointer-events: auto` so they can be dragged, which is why a drag over a portrait needs the position detection described below.

## Dragging

One drag exists at a time, so `useDragDrop` keeps its state and document handlers at module level. That way the listener that one component adds is the same function another component removes. The payload goes into `dataTransfer` under `application/character` with a transparent drag image, and `DragPreview` (mounted in `App.vue`) draws the ghost instead.

`DragDropProvider` is mounted once per page (`HomeView`, `TeamsView`, `ShareView`) around the boards and the roster. It owns the document `drop`, `dragover` and `mousemove` listeners. Its `dragover` calls `preventDefault()`, which makes the whole page a drop target, so those listeners live and die with the provider's mount instead of the module. Each interactive `GridManager` registers a hex detector and a drop handler under its board id, and readonly boards register neither.

Hover detection is hybrid. A tile's own `dragover` answers directly. On every `mousemove` and `dragover` the provider also asks each board's detector, which maps the screen point into SVG space through `getScreenCTM()` (the perspective transform included) and ray-casts it against each hex polygon. The first board to report a hex wins. A drop on a tile stops propagation and sets `dropHandled`, two separate guards against the provider's document `drop` handling the same event. A drop anywhere else goes to the handler of the board under the pointer.

A tile's `dragleave` clears the hover only when position detection disagrees, because `dragleave` also fires when the pointer moves onto the portrait above the same tile.

### The frozen ghost

`startDrag` adds a once-only document `dragend` listener, so the drag state resets even if the source element's own `@dragend` binding is gone by the end of the drag. `endDrag` is idempotent because both can fire. This safety net depends on `dragend` bubbling to the document, which only works while the source node is still attached. Browsers pick the innermost draggable element as the source, and images are draggable by default. The `<img>`s inside grid drag wrappers therefore set `draggable="false"`, keeping the keyed wrapper as the source. Without it, a drop that swaps the image node mid-drag (a hero and a phantimal trading places flips a `v-if`) orphans the source, `dragend` reaches no listener, and the ghost freezes on screen.

### Hover after a drop

Mouse events resume the moment `isDragging` drops, which would flash a hover on the drop tile before the drag UI has cleaned up. `GridTiles` blocks the plain hover during a drag and for 100 ms after. `endDrag` copies the hovered hex into `lastDropHexId` and `lastDropGridId`, and when the grace period ends the matching board restores its hover there.

## Drop routing

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ drop on a tile       │  │ drop over a portrait │  │ tap after a lift     │
│ GridTiles            │  │ DragDropProvider     │  │ hex:click            │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      ▼
                  ┌──────────────────────────────────────┐
                  │ routeDrop                            │
                  │ gate: canDropCharacter               │
                  └────┬─────────────────────────────┬───┘
                       │                             │
                       ▼                             ▼
           ┌──────────────────────┐      ┌──────────────────────┐
           │ roster or same board │      │ cross board          │
           │ ctx.handleDrop       │      │ crossGridMove / Swap │
           └──────────────────────┘      └──────────────────────┘
```

A payload carries only the source coordinates (`sourceHexId`, `sourceGridId`). The router reads the unit id, team and slot from the live board at drop time, and a payload with no source is a roster placement.

`canDropCharacter` is both the router's gate and the predicate behind the hover cue (`drag-hover` with or without `invalid-drop`), so hover never promises a drop the router rejects. It checks page-wide rules that one board cannot see: per-team uniqueness across boards whenever a unit changes team, phantimal faction on each destination, a free hero slot where a hero replaces a phantimal, and the rules that companions and synergy heroes never leave their board and synergy heroes never change team.

Cross-board drops compose a remove and a place across two `Grid` instances, restoring the source when the place fails, because the single-board transactions cannot span two grids. A swap places the second unit only after the first succeeds, since a placement can evict a board's phantimal and a rollback could not bring it back. Upgrade attributes travel with each hero. Any successful drop, roster drops included, makes the target board active.

The engine still has the last word. `performPlace` runs `canPlaceCharacterOnTile` and `canPlaceCharacterOnTeam` (per-board capacity, duplicates, the synergy hero's one-per-team cap). The gate's same-board leg checks only the page-wide rule. A same-board rejection by the engine (a full team on a team change, a companion changing team) or a failure mid-transaction therefore ends as a silent no-op with no hover warning.

## Taps and clicks

A board is in tap mode when it renders below full scale (`ctx.hexScale < 1`), unless its page passes `tap-mode`. The Teams page sets it from its own sheet breakpoint, because its boards render below full scale even on desktop. Tap mode decides how an empty tile adds a hero. The pointer type decides what a tap on a placed hero does, since a touch tap on a wide layout still lifts.

Adding works in two ways. In tap mode, tapping an empty tile targets it, and the next roster tap places there through `resolvePick`. A roster tap with no target auto-places on the active board, ally side first (`fillOrder`). A full team still accepts a target, because a phantimal may fit. On wide layouts, clicking an empty tile opens the multi-add popup. It opens only while `teamHasOpenSlot` holds and closes when that stops holding. Targets carry a board id as well as a hex id, because every board shares the same hex ids and only the tapped board should highlight. Artifact cells target the same way. Dismissing the roster sheet clears pending targets.

Moving and removing work through a lift. A tap on a placed hero lifts it, and a mouse click on a wide layout removes it instead, as in the game. Tapping the lifted hero again removes it. Tapping another hero on the same board swaps the two after `canDropCharacter`, and tapping a hero on another board starts a fresh lift there. Tapping an empty tile on any board sends the lifted hero through `routeLiftDrop`, which builds a normal payload so the tap passes every drag gate. A non-placement tile or the start of a drag cancels the lift.

A lift records its board, hex and unit id. Placements also change under a lift without any tap (roster removes, map switches, board swaps, phantimal reconciliation, companion cascades). `useLiftGuard`, installed once in `App.vue`, drops the lift as soon as its cell stops holding the lifted unit, so a stale lift can never eat a tap or move a hero the user did not lift. Unchecking Syn removes every synergy unit, so `GridControls` clears the target and the lift along with it.

While Syn is on, a roster click on a hero already placed on a team with a free assist slot places the synergy copy instead of removing the hero. Every placement surface resolves the pick through `resolvePick`, so the roster, the popup and the targeted tile agree on when a copy is allowed.

`isTouchClick` (`src/utils/pointer.ts`) decides whether a click came from touch. It records the type of the last `pointerdown` or `pointerup` document-wide in the capture phase, and a press within `PRESS_CLICK_WINDOW_MS` (800) outranks the click's own `pointerType`. Safari before 18.4 synthesizes tap clicks with a missing or wrong `pointerType`, so trusting the click alone would read every tap as a mouse.

## Grid events

`GridManager` creates one small typed pub/sub bus per board (`provideGridEvents`), so events never cross boards. Emitting only notifies subscribers, and all state changes happen in the subscribers. An event exists only when another component subscribes to it, and a component that can reach a store calls its actions directly. The bus carries `hex:click`, which passes the DOM event along so handlers can call `isTouchClick`, and the character `mouseenter` and `mouseleave` events that let `GridTiles` highlight the tile under a hovered portrait.

`GridManager` owns every click decision in its one `hex:click` subscriber: map-editor paint, the lifted-hero drop, tap targeting, and the wide-layout remove or picker. It subscribes synchronously at setup and never unsubscribes, because the bus lives and dies with it. Children subscribe in `onMounted` and call `off` in `onUnmounted` with the same handler reference, since `off` removes by identity.

Readonly gating happens on different sides. `GridTiles` emits `hex:click` only on interactive boards. `GridCharacters` emits hover events on every board, and `GridTiles` ignores them on readonly boards and during the post-drag grace period. Removal is not a bus event: `GridCharacters` and `GridArtifacts` call `ctx.remove()` and `ctx.removeArtifact()` on their injected context directly.

## Artifacts

Artifacts sit in host cells beside the grid (`artifactHostHex`), which hold no tile, so they skip the hex pipeline and use element-level native drag under `application/artifact`. The payload is only `{ sourceCtxId, sourceTeam }`, and the live slot decides what moves. Browsers hide `dataTransfer` data during `dragover`, so `useDragDrop` mirrors the payload in `artifactDragPayload` for the hover check.

A target that `canDropArtifact` rejects gets `stopPropagation()` without `preventDefault()`, so the native not-allowed cursor shows and the provider's page-wide `dragover` cannot accept it. The drop goes through `routeArtifactDrop`, which shares `resolveArtifactDrop` with the hover check: an empty cell moves, a filled one swaps, and uniqueness is re-checked only on a team change. Artifact drag exists only on wide layouts. Touch can add and remove artifacts but not move them.

## Board swap

Swapping two Teams boards (`useGridSwap`, committed by `grids.swapBoards`) uses pointer events instead of HTML5 drag, with module-level state for the same listener-identity reason. A press on a board's swap button that travels past `DRAG_THRESHOLD` (6 px) becomes a drag, and the release picks the board under the pointer through `[data-grid-board-id]`. Otherwise the button arms the swap and a click on another board completes it. On tap layouts the first tap on a board previews it and a second tap confirms, and a release counts as a tap only under `TAP_MOVE_MAX` (10 px) of travel, so swiping the board row neither selects nor cancels. A press outside every board cancels.

## Related documentation

- [Grid & Characters](./GRID.md): board contexts, placement rules and gestures
- [Teams](./TEAMS.md): the multi-board page that hosts cross-board drags and board swaps
