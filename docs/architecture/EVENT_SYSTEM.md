# Event System

## Overview

The event system provides centralized, type-safe component communication using Vue 3's provide/inject pattern. It enables decoupled interactions between components while maintaining clear event flow and TypeScript support.

## Design Principles

1. **Pure Pub/Sub**: Emitting only notifies subscribers; all state changes live in the subscribing components, never inside the bus
2. **Namespaced Events**: Organized by feature (`hex:*`, `character:*`)
3. **Type Safety**: Full TypeScript support with compile-time checking
4. **Real Consumers Only**: An event exists only when it has a cross-component subscriber; components with a direct line to a store call its actions directly
5. **Simple API**: Minimal interface with emit, on, and off methods

## Core Components

### Event API (`/src/composables/useGridEvents.ts`)

`GridEventAPI` exposes `emit`, `on` and `off`, each typed against `GridEvents` so an event name fixes its handler signature at compile time. `GridManager` creates one bus per board with `provideGridEvents()`, so an event never crosses boards; `useGridEvents()` throws outside that subtree.

```typescript
interface GridEvents {
  'hex:click': (hex: Hex, event: MouseEvent) => void // the DOM event tells touch taps from mouse clicks
  'character:mouseenter': (hexId: number) => void
  'character:mouseleave': (hexId: number) => void
}
```

## Event Catalog

### Hex Events

- **hex:click**: Emitted by GridTiles' invisible event-capture layer. GridManager's subscriber owns all click semantics in one decision tree: map-editor paint, the lifted-hero drop, the tap-target flow, and wide-layout remove-or-pick (a mouse click on a placed hero removes it; a touch tap does not, since hero taps belong to the character layer's lift flow; an empty placement tile opens the character picker while the team has an open slot)

### Character Events

- **character:mouseenter** / **character:mouseleave**: Emitted by the GridCharacters overlay on every board, readonly ones included, since the emit only reports the pointer; GridTiles subscribes to drive the hover highlight on the tile beneath the portrait and applies its own policy (ignored on readonly boards, and suppressed during the post-drag hover grace period)

Character and artifact removal are not bus events: GridCharacters and GridArtifacts call `ctx.remove()` / `ctx.removeArtifact()` on their injected `GridContext` directly, the same way they call its other operations.

## Subscription Contract

- **Owner subscribes at setup**: GridManager registers its `hex:click` handler synchronously in `<script setup>` and never unsubscribes, since the bus lives and dies with it
- **Children subscribe on mount**: GridTiles pairs `on` in `onMounted` with `off` in `onUnmounted`, passing the same handler reference, because `off` removes by identity
- **Readonly gating is per side**: GridTiles emits `hex:click` only when the board is interactive; the character hover emits are unconditional and the subscriber filters
